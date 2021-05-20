import {Lotus} from "../adapters/lotus";
import {TipSet} from "filecoin.js/builds/dist/providers/Types";
import {setGasGrowth} from "../adapters/database";

let commits = {}
let wposts = {}
const maxCommits = 20;
const maxRounds = 30;
const roundsPerDay = 2 * 60 * 24
const maxSectorsPerPost = 2349

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
  static async growth(head: TipSet, client: Lotus) {
    const stats = new Stats(head, client)
    await stats.fetchCids()

    const allSealed = await stats.transactionsPerHeight(7)
    const allProven = await stats.transactionsPerHeight(5)
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

  async transactionsPerHeight (...method) {
    const allTx = {}

    for (let height in this.tipsets) {
      const tipset = this.tipsets[height]
      const msgs = await this.lotus.parentAndReceiptsMessages(tipset.Cids[0], ...method)
      allTx[height] = msgs
    }
    return allTx
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
