import {Lotus} from "../adapters/lotus";
import {TipSet} from "filecoin.js/builds/dist/providers/Types";
import {setBiggestUsers, setGasGrowth, setUsage} from "../adapters/database";

let commits = {}
let wposts = {}
const maxCommits = 20;
const maxRounds = 30;
const roundsPerDay = 2 * 60 * 24
const blockLimit = 5 * 10 ** 9
const maxSectorsPerPost = 2349
const maxUser = 10

const limitCommits = () => {
  while (Object.keys(commits).length > maxCommits) {
    const lowestKey = Object.keys(commits)
      .map(key => parseInt(key))
      .sort((a, b) => a - b)[0]

    if (Number.isInteger(commits[lowestKey]) && Number.isInteger(wposts[lowestKey])) {
      delete commits[lowestKey]
      delete wposts[lowestKey]
    }
  }
}

export class GasService {
  private stats: Stats;

  constructor(head: TipSet, client: Lotus) {
    this.stats = new Stats(head, client)
  }

  public async initStats() {
    await this.stats.fetchCids()
  }

  public async biggestUsers() {
    const allHeights = await this.stats.biggestGasUserFor()
    if (Object.keys(allHeights).length < 1) {
      return
    }
    const sortedHeight = Object.keys(allHeights).sort((a, b) => +b - +a)
    const data = allHeights[sortedHeight[0]].slice(0, maxUser).reduce((acc, tuple) => ({ ...acc, [tuple[0]]: tuple[1] }), {})
    await setBiggestUsers(sortedHeight[0], data)
  }

  public async growth() {
    const allSealed = await this.stats.transactionsPerHeight(7)
    const allProven = await this.stats.transactionsPerHeight(5)
    const sealed = Object.fromEntries(objectMap(allSealed, (v, k) => [k, v.length]))
    const proven = Object.fromEntries(objectMap(allProven, (v, k) => [k, v.length]))
    limitCommits()
    const newCommits = { ...commits, ...sealed }
    const newWposts = { ...wposts, ...proven }
    const rounds = objectMap(newCommits, (v, k) => k)
      .sort((a, b) => b - a)
      .slice(0, maxRounds)
      .reverse()
    const filteredCommits = objectFilter(newCommits, (v, k) =>
      rounds.includes(k)
    )
    const dataCommits = rounds
      .map(r => filteredCommits[r])
      .map(c => Math.round(growthRate(c)))
    const filteredPosts = objectFilter(newWposts, (v, k) => rounds.includes(k))
    const dataWposts = rounds
      .map(r => filteredPosts[r])
      .map(w => Math.round(wpostToSectors(w)))
    commits = filteredCommits;
    wposts = filteredPosts;
    await setGasGrowth({dataCommits, dataWposts, rounds})
  }

  public async usage() {
    const data: any = {}
    const totalUsed = await this.stats.avgTotal(msgToGasUsed)
    const totalLimit = await this.stats.avgTotal(msgToGasLimit)
    data.total = await this.computeEntry(totalUsed, totalLimit)
    data.wpost = await this.computeEntry(totalUsed, totalLimit, 5)
    data.pre = await this.computeEntry(totalUsed, totalLimit, 6)
    data.prove = await this.computeEntry(totalUsed, totalLimit, 7)
    await setUsage(data);
  }

  async computeEntry(totalUsed: number, totalLimit: number, ...method) {
    const nTx = await this.stats.avgNumberTx(...method)
    const gasUsed = await this.stats.avgValue(msgToGasUsed,...method)
    const gasLimit = await this.stats.avgValue(msgToGasLimit,...method)
    const mtotalUsed = await this.stats.avgTotal(msgToGasUsed, ...method)
    const mtotalLimit = await this.stats.avgTotal(msgToGasLimit, ...method)
    const ratioUsed = mtotalUsed / totalUsed
    const ratioLimit = mtotalLimit / totalLimit
    const ratioUsedLimit = mtotalUsed / mtotalLimit
    const ratioUsedBlockLimit = await this.stats.avgTotalGasUsedOverTipsetLimit(
      ...method
    )
    const ratioBlockLimit = await this.stats.avgTotalGasLimitOverTipsetLimit(
      ...method
    )
    return [
      nTx,
      gasUsed,
      ratioUsed,
      gasLimit,
      ratioLimit,
      ratioUsedLimit,
      ratioUsedBlockLimit,
      ratioBlockLimit
    ]
  }
}

export function msgToGasUsed(m) {
  return m[1].GasUsed
}

export function msgToGasLimit(m) {
  return m[0].Message.GasLimit
}

export class Stats {
  private average = 3;
  private tipsets = {};

  constructor(private head: TipSet, private lotus: Lotus) {}

  async fetchCids() {
    this.tipsets[this.head.Height] = this.head;

    for (let i = 1; i < this.average; i++) {
      const tipset = await this.lotus.client.chain.getTipSetByHeight(this.head.Height - i)
      this.tipsets[tipset.Height] = tipset
    }
  }

  async avgTotal(cb, ...method) {
    var avg = [];
    await this.msgsPerHeight((msgs) => {
      avg.push(msgs.reduce((acc,m) => acc + cb(m), 0))
    },...method)
    return avg.reduce((acc,v) => v,0) / avg.length
  }

  async avgNumberTx (...method) {
    const tx = await this.transactions(...method)
    return tx.length / Object.keys(this.tipsets).length
  }

  async avgValue(cb, ...method) {
    var avg = 0;
    await this.msgsPerHeight((msgs) => {
      if (msgs.length < 1) {
        return
      }
      avg += msgs.reduce((acc,m) => acc + cb(m), 0) / msgs.length
    },...method)
    return avg / Object.keys(this.tipsets).length
  }

  async msgsPerHeight(cb, ...method)  {
    for (var height in this.tipsets) {
      const tipset = this.tipsets[height]
      const msgs = await this.lotus.parentAndReceiptsMessages(tipset.Cids[0], ...method);
      cb(msgs,height)
    }
  }

  async transactionsPerHeight (...method) {
    const allTx = {}

    for (let height in this.tipsets) {
      const tipset = this.tipsets[height]
      const msgs = await this.lotus.parentAndReceiptsMessages(tipset.Cids[0], ...method)
      allTx[height] = msgs
    }
    return allTx
  }

  async transactions (...method) {
    var allTx = []
    for (let height in this.tipsets) {
      const tipset = this.tipsets[height]
      const msgs = await this.lotus.parentAndReceiptsMessages(tipset.Cids[0], ...method)
      allTx = allTx.concat(msgs)
    }
    return allTx
  }

  async biggestGasUserFor (...methods) {
    var datas = {}

    for (let height in this.tipsets) {
      const msgs = await this.transactions(...methods)
      var users = msgs.reduce((acc, tuple) => {
        if (acc[tuple[0].Message.To] == undefined) {
          acc[tuple[0].Message.To] = 0
        }
        acc[tuple[0].Message.To] += tuple[1].GasUsed
        return acc
      }, {})
      const sorted = objectMap(users, (gas, user) => [user, gas]).sort((a, b) => b[1] - a[1])
      datas[height] = sorted
    }
    return datas
  }

  // return the avg total gas limit set per height for the given method over
  // the maximal theoretical gas limit
  async avgTotalGasLimitOverTipsetLimit (...method) {
    var ratios = []
    await this.msgsPerHeight((msgs,height) => {
      const tipset = this.tipsets[height]
      const totalGasLimit = msgs.reduce(
        (total, tup) => total + tup[0].Message.GasLimit,
        0
      )
      const nbBlocks = tipset.Cids.length
      const ratio = totalGasLimit / (blockLimit * nbBlocks)
      ratios.push(ratio)
    },...method)
    // make the average
    return ratios.reduce((acc, v) => acc + v, 0) / ratios.length
  }

  async avgTotalGasUsedOverTipsetLimit (...method) {
    var ratios = []
    await this.msgsPerHeight((msgs,height) => {
      const totalGasUsed = msgs.reduce(
        (total, tup) => total + tup[1].GasUsed,
        0
      )
      const nbBlocks = this.tipsets[height].Cids.length
      const ratio = totalGasUsed / (blockLimit * nbBlocks)
      ratios.push(ratio)
    },...method)
    // make the average
    return ratios.reduce((acc, v) => acc + v, 0) / ratios.length
  }
}

export function objectMap (obj, fn) {
  return Object.entries(obj).map(([k, v], i) => fn(v, k, i))
}

export function objectFilter (obj, fn) {
  return Object.fromEntries(Object.entries(obj).filter(([k, v]) => fn(v, k)))
}

export function growthRate (prove) {
  return gbToPB(prove * 32) * roundsPerDay
}

function gbToPB (v) {
  return v / 1024 / 1024
}

function wpostToSectors (wpost) {
  return maxSectorsPerPost * wpost
}
