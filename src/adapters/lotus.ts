import {LotusClient, WsJsonRpcConnector} from "filecoin.js";
import {Cid, TipSet} from "filecoin.js/builds/dist/providers/Types";
import * as d3 from "d3";
import {buildObject, bytesToBig} from "../hamt";
import Big from "big.js";
import asyncPool from 'tiny-async-pool'
import bx from 'base-x'
import { config } from '../../config'

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const b64 = bx(BASE64)

function b64ToBn (b64) {
  if (b64 === '') return BigInt(0)
  var bin = new Buffer(b64, 'base64').toString('binary');
  var hex = []

  bin.split('').forEach(function (ch) {
    var h = ch.charCodeAt(0).toString(16)
    if (h.length % 2) {
      h = '0' + h
    }
    hex.push(h)
  })

  return BigInt('0x' + hex.join(''))
}

export class Lotus {
  client: LotusClient
  parents = {}
  receipts = {}

  public constructor() {
    this.client = new LotusClient(new WsJsonRpcConnector({
      url: config.app.filecoinRpcUrl,
    }))

  }

  public async getHead() {
    return this.client.chain.getHead()
  }

  public async getGenesisActors(head: TipSet) {
    const [Supply, Reward, Power, Market, Burnt, SupplyVM] = await Promise.all([
      this.client.state.circulatingSupply(head.Cids),
      this.client.state.readState('f02', head.Cids),
      this.client.state.readState('f04', head.Cids),
      this.client.state.readState('f05', head.Cids),
      this.client.state.readState('f099', head.Cids),
      this.client.state.vmCirculatingSupply(head.Cids)
    ])

    return { Supply, Reward, Power, Market, Burnt, SupplyVM }
  }

  public async getLast24hHead(head: TipSet) {
    const height = head.Height - 2880
    const head24 = await this.client.chain.getTipSetByHeight(height)
    return head24;
  }

  public async release() {
    await this.client.release()
  }

  async fetchPreCommittedSectors (client: LotusClient, miner: string, head: TipSet) {
    const node = `@Ha:${miner}/1/6`
    const preCommittedSectors = await this.getData(client, miner)
    const PreCommitDeadlines = d3
      .groups(
        Object.keys(preCommittedSectors).map(d => ({
          SectorNumber: preCommittedSectors[d].info.sector_number,
          Expiry: preCommittedSectors[d].precommit_epoch + (10000 + 60 + 150)
        })),
        d => d.Expiry
      )
      .map(([Expiry, Sectors]) => ({
        Expiry,
        Sectors: Sectors.map(d => d.SectorNumber)
      }))
      .sort((a, b) => a.Expiry - b.Expiry)

    return {
      PreCommitDeadlines,
      Count: Object.keys(preCommittedSectors).length
    }
  }

  async getData(client: LotusClient, miner: string) {
    const load = async (a) => {
      const res = await this.client.conn.request({ method: 'Filecoin.ChainGetNode', params: [a] })
      return res.Obj
    }
    const actor = await client.state.getActor(miner)
    const data = (await client.conn.request({ method: 'Filecoin.ChainGetNode', params: [`${actor.Head['/']}/6`] })).Obj
    const object = await buildObject(data, load);
    return this.fromPreCommitSchema(object)
  }

  async fetchDeposits(client: LotusClient, miner: string, head: TipSet) {
    const state = await client.state.readState(miner, head.Cids)
    const { State, Balance } = state
    const { PreCommitDeposits, LockedFunds, InitialPledge, FeeDebt } = State
    const Available = Big(Balance).sub(InitialPledge).sub(PreCommitDeposits).sub(LockedFunds)

    return {
      Balance: (+Balance / 1000000000000000000).toFixed(2),
      InitialPledge: (+InitialPledge / 1000000000000000000).toFixed(2),
      Available: (+Available / 1000000000000000000).toFixed(2),
      LockedFunds: (+LockedFunds / 1000000000000000000).toFixed(2),
      PreCommitDeposits: (+PreCommitDeposits / 1000000000000000000).toFixed(2),
      FeeDebt: (+FeeDebt / 1000000000000000000).toFixed(2)
    }
  }

  async fetchDeadlinesProxy(client: LotusClient, miner, head: TipSet) {
    const actor = await client.state.getActor(miner)
    const deadlinesCids = (await client.conn.request({ method: 'Filecoin.ChainGetNode', params: [`${actor.Head['/']}/12`] })).Obj[0]
    const deadlines = await asyncPool(24, deadlinesCids, async deadlineCid => {
      const deadline = (await client.conn.request({method: 'Filecoin.ChainGetNode', params: [deadlineCid['/']]})).Obj
      return {
        Partitions: deadline[0],
        LiveSectors: deadline[4],
        TotalSectors: deadline[5],
        FaultyPower: { Raw: Number(b64ToBn(deadline[6][0])) }
      }
    })
    return deadlines
  }

  async fetchDeadlines(client: LotusClient, miner: string, head: TipSet) {
    const [deadline, deadlines] = await Promise.all([
      client.state.minerProvingDeadline(miner, head.Cids),
      this.fetchDeadlinesProxy(client, miner, head)
    ])

    const nextDeadlines = [...Array(48)].map((_, i) => ({
      ...deadlines[(deadline.Index + i) % 48],
      Close: deadline.Close + i * 60,
      Index: (deadline.Index + i) % 48
    }))

    const SectorsCount = deadlines
      .map(d => +d.LiveSectors)
      .reduce((acc, curr) => acc + curr, 0)

    const FaultsCount =
      deadlines
        .map(d => +d.FaultyPower.Raw)
        .reduce((acc, curr) => acc + curr, 0) /
      (32 * 1024 * 1024 * 1024)

    return {
      deadlines: deadlines.map((d, i) => ({
        ...deadlines[i],
        Close: deadline.Close + i * 60,
        Index: i
      })),
      nextDeadlines,
      SectorsCount,
      FaultsCount,
      ActiveCount: SectorsCount - FaultsCount,
      deadline
    }
  }

  async getMinerInfo(client: LotusClient, miner: string, head: TipSet) {
    return client.state.minerInfo(miner, head.Cids)
  }

  async parentMessages (cid: Cid) {
    if (cid['/'] in this.parents) {
      return this.parents[cid['/']]
    }
    const msgs = await this.client.chain.getParentMessages(cid)
    this.parents[cid['/']] = msgs
    return msgs
  }

  async receiptParentMessages (cid: Cid) {
    if (cid['/'] in this.receipts) {
      return this.receipts[cid['/']]
    }
    const r = await this.client.chain.getParentReceipts(cid)
    this.receipts[cid['/']] = r
    return r
  }

  async parentAndReceiptsMessages (cid, ...methods) {
    const msgs = await this.parentMessages(cid)
    const receipts = await this.receiptParentMessages(cid)
    if (msgs.length != receipts.length) {
      throw new Error('invalid length')
    }
    return zip(msgs, receipts).filter(entry => {
      const [tx, r] = entry
      const exit = r.ExitCode == 0
      var inMethod = true
      if (methods.length > 0) {
        inMethod = methods.includes(tx.Message.Method)
      }
      return exit && inMethod
    })
  }

  async getMinerData(
    oldMinerData = {},
    miner,
    head,
    prevHead,
    filter = { deadlines: true }
  ) {
    let minerData: any = oldMinerData;

    try {
      const minerInfo = await this.getMinerInfo(this.client, miner, head);
      minerData = {...minerData, minerInfo: { error: false, data: minerInfo }}
    } catch {
      minerData = {...minerData, minerInfo: { error: true, data: undefined }}
    }

    if (filter.deadlines) {
      try {
        const deadlines = await this.fetchDeadlines(this.client, miner, head)
        minerData = {...minerData, deadlines: { error: false, data: deadlines }}
      } catch (e) {
        minerData = {...minerData, deadlines: { error: true, data: undefined }}
      }
    }

    if (filter.deadlines) {
      try {
        const prevDeadlines = await this.fetchDeadlines(this.client, miner, prevHead)
        minerData = {...minerData, prevDeadlines: { error: false, data: prevDeadlines }}
      } catch (e) {
        minerData = {...minerData, prevDeadlines: { error: true, data: undefined }}
      }
    }

    try {
      const deposits = await this.fetchDeposits(this.client, miner, head)
      minerData = {...minerData, deposits: { error: false, data: deposits }}
    } catch (e) {
      minerData = {...minerData, deposits: { error: true, data: undefined }}
    }

    try {
      const preCommits = await this.fetchPreCommittedSectors(this.client, miner, head);
      minerData = {...minerData, preCommits: { error: false, data: preCommits }}
    } catch (e) {
      minerData = {...minerData, preCommits: { error: true, data: undefined }}
    }

    return minerData;
  }

  private fromPreCommitSchema(data) {
    const keys = Object.keys(data)
    return keys.reduce((acc, key) => ({
      ...acc,
      [key]: {
        info: {
          seal_proof: data[key][0][0],
          sector_number: data[key][0][1],
          sealed_cid: data[key][0][2],
          seal_rand_epoch: data[key][0][3],
          deal_ids: data[key][0][4],
          expiration: data[key][0][5],
          replace_capacity: data[key][0][6],
          replace_sector_deadline: data[key][0][7],
          replace_sector_partition: data[key][0][8],
          replace_sector_number: data[key][0][9]
        },
        precommit_deposit: bytesToBig(data[key][1]),
        precommit_epoch: data[key][2],
        deal_weight: bytesToBig(data[key][3]),
        verified_deal_weight: bytesToBig(data[key][4])
      }
    }), {})
  }
}

const zip = (arr, ...arrs) => {
  return arr.map((val, i) => arrs.reduce((a, arr) => [...a, arr[i]], [val]))
}
