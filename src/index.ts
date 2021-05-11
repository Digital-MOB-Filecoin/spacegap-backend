import { inspect } from 'util'
import { LotusClient, HttpJsonRpcConnector, WsJsonRpcConnector } from 'filecoin.js'
import {Cid, TipSet} from "filecoin.js/builds/dist/providers/Types";
import axios from "axios";
import Big from 'big.js';
import * as d3 from 'd3';
import {Economics} from "./Economics";

import {buildObject, bytesToBig} from './hamt'

const preCommitSchema = {
  type: 'hamt',
  key: 'bigint',
  value: {
    info: {
      seal_proof: 'int',
      sector_number: 'int',
      sealed_cid: 'cid',
      seal_rand_epoch: 'int',
      deal_ids: ['list', 'int'],
      expiration: 'int',
      replace_capacity: 'bool',
      replace_sector_deadline: 'int',
      replace_sector_partition: 'int',
      replace_sector_number: 'int'
    },
    precommit_deposit: 'bigint',
    precommit_epoch: 'int',
    deal_weight: 'bigint',
    verified_deal_weight: 'bigint'
  }
}



let pages;







async function get24hActors(client: LotusClient, head: TipSet) {
  const height = head.Height - 2880
  const head24 = await client.chain.getTipSetByHeight(height)
  return getGenesisActors(client, head24)
}

async function main() {
  const client = getClient()
  const miners = await getMiners()
  const currentHead = await getHead(client)
  const actors = await getGenesisActors(client, currentHead)
  const actors24 = await get24hActors(client, currentHead);
  const economics = await computeEconomics(currentHead, actors, {
    projectedDays: 1
  })
  const data = await Promise.all(Object.keys(miners).map(
    miner => getMinerData(client, {}, miners[miner].address, currentHead, { deadlines: true })
  ))
  const data = await getMinerData(client, {}, miners[Object.keys(miners)[0]].address, currentHead, { deadlines: true })
  await client.release()

  // pages = {
  //   home: {
  //     tokens: {
  //       circulatingSupply: (+actors.Supply / 1e18).toFixed(0),
  //       burnt: (+actors.SupplyVM.FilBurnt / 1e18).toFixed(0),
  //       locked: (+actors.SupplyVM.FilLocked / 1e18).toFixed(0),
  //       "24hNewSupply": Big(actors.Supply as any).sub(actors24.Supply as any).div(1e18).toFixed(0),
  //       "24hNewBurnt": Big(actors.SupplyVM.FilBurnt).sub(actors24.SupplyVM.FilBurnt).div(1e18).toFixed(0),
  //       "24hLocked": Big(actors.SupplyVM.FilLocked).sub(actors24.SupplyVM.FilLocked).div(1e18).toFixed(0)
  //     },
  //     power: {
  //       networkRaw: (+actors.Power.State.TotalBytesCommitted / 2 ** 50).toFixed(1),
  //       "24hNewStorage": ((+actors.Power.State.TotalBytesCommitted - +actors24.Power.State.TotalBytesCommitted) / 2 ** 50).toFixed(1),
  //       activeMiners: actors.Power.State.MinerAboveMinPowerCount.toFixed(0)
  //     },
  //     economics: {
  //       sectorPledge: economics.sectorIp.toFixed(3),
  //       sector360daysReward: economics.sectorProjectedReward.toFixed(3),
  //       sectorFaultFee: economics.sectorFaultFee.toFixed(3),
  //       blockReward: (+actors.Reward.State.ThisEpochReward / 5 / 1e18).toFixed(3),
  //       "1dayFilTiBReward": ((economics.sectorProjectedReward1 * 1024) / 32).toFixed(3)
  //     }
  //   }
  // }

  // console.log(inspect(pages, false, null, true))

}



main()