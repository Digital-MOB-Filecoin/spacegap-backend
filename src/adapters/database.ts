import {TipSet} from "filecoin.js/builds/dist/providers/Types";
import fs from 'fs/promises'
import {FilfoxMiner, FilfoxMiners} from "./filfox";
import {FilRepMiner} from "./filrep";

type Database = {
  head?: TipSet,
  miners: {
    [address: string]: DatabaseMiner,
  },
  genesisActors: any,
  last24hActors: any,
  economics: any,
  gas: {
    growth: {
      dataCommits: number[],
      dataWposts: number[],
      rounds: any[],
    }
  }
}

export const database: Database = {
  head: undefined,
  miners: {},
  genesisActors: undefined,
  last24hActors: undefined,
  economics: undefined,
  gas: {
    growth: {
      dataCommits: [],
      dataWposts: [],
      rounds: [],
    }
  }
}

type DatabaseMiner = {
  filfox: FilfoxMiner,
  filrep: FilRepMiner,
  deposits: {
    error: boolean,
    data: any,
  },
  preCommits: {
    error: boolean,
    data: any,
  },
  deadlines: {
    error: boolean,
    data: any,
  },
  stateInfo: {
    error: boolean,
    data: any,
  }
}

export const setHead = async (head: TipSet) => {
  database.head = head
  await fs.writeFile('database.json', Buffer.from(JSON.stringify(database, null, 2)));
}

export const setFilfoxMiners = async (miners: FilfoxMiner[]) => {
  for (const miner of miners) {
    const oldMinerObject = database.miners[miner.address]
    database.miners[miner.address] = {
      ...oldMinerObject,
      filfox: miners[miner.address],
    }
  }
  await fs.writeFile('database.json', Buffer.from(JSON.stringify(database, null, 2)));
}

export const setFilRepMiners = async (miners: FilRepMiner[]) => {
  for (const miner of miners) {
    const oldMinerObject = database.miners[miner.address]
    database.miners[miner.address] = {
      ...oldMinerObject,
      filrep: miner,
    }
  }
  await fs.writeFile('database.json', Buffer.from(JSON.stringify(database, null, 2)));
}

export const setGenesisActors = async (genesisActors: any) => {
  database.genesisActors = genesisActors
  await fs.writeFile('database.json', Buffer.from(JSON.stringify(database, null, 2)));
}

export const setLast24hActors = async (last24hActors: any) => {
  database.last24hActors = last24hActors
  await fs.writeFile('database.json', Buffer.from(JSON.stringify(database, null, 2)));
}

export const setEconomics = async (economics: any) => {
  database.economics = economics
  await fs.writeFile('database.json', Buffer.from(JSON.stringify(database, null, 2)));
}

export const setMinerData = async (miner: string, data: any) => {
  database.miners[miner] = {...database.miners[miner], ...data};
  await fs.writeFile('database.json', Buffer.from(JSON.stringify(database, null, 2)));
}

export const setGasGrowth = async ({
    dataCommits, dataWposts, rounds
  }: {
    dataCommits: number[],
    dataWposts: number[],
    rounds: any[],
  }) => {
  database.gas.growth = { dataCommits, dataWposts, rounds }
  await fs.writeFile('database.json', Buffer.from(JSON.stringify(database, null, 2)));
}
