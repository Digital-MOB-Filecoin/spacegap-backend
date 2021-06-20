import {TipSet} from "filecoin.js/builds/dist/providers/Types";
import {FilfoxMiner} from "./filfox";
import {FilRepMiner} from "./filrep";
import {Db, MongoClient} from "mongodb";

export class MongoDbRepository {
  private client: MongoClient;
  private db: Db;

  constructor(url: string) {
    this.client = new MongoClient(url)
  }

  async connect(database: string) {
    await this.client.connect();
    this.db = this.client.db(database)
  }

  async disconnect() {
    await this.client.close();
    this.client = undefined;
    this.db = undefined;
  }

  async saveHead(head: TipSet) {
    const dbHead = this.db.collection('head');
    const result = await dbHead.insertOne(head);
  }
}

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
    },
    biggestUsers: {
      height: string,
      data: {
        [miner: string]: number,
      }
    },
    usage: {
      total: number[],
      wpost: number[],
      pre: number[],
      prove: number[],
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
    },
    biggestUsers: {
      height: '',
      data: {},
    },
    usage: {
      pre: [],
      total: [],
      prove: [],
      wpost: []
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
  prevDeadlines: {
    error: boolean,
    data: any,
  },
  stateInfo: {
    error: boolean,
    data: any,
  }
}

export const setHead = (head: TipSet) => {
  database.head = head
}

export const setFilRepMiners = (miners: FilRepMiner[]) => {
  for (const miner of miners) {
    const oldMinerObject = database.miners[miner.address]
    database.miners[miner.address] = {
      ...oldMinerObject,
      filrep: miner,
    }
  }
}

export const setGenesisActors = (genesisActors: any) => {
  database.genesisActors = genesisActors
}

export const setLast24hActors = (last24hActors: any) => {
  database.last24hActors = last24hActors
}

export const setEconomics = (economics: any) => {
  database.economics = economics
}

export const setMinerData = (miner: string, data: any) => {
  database.miners[miner] = {...database.miners[miner], ...data};
}

export const setGasGrowth = ({
    dataCommits, dataWposts, rounds
  }: {
    dataCommits: number[],
    dataWposts: number[],
    rounds: any[],
  }) => {
  database.gas.growth = { dataCommits, dataWposts, rounds }
}

export const setBiggestUsers = (height: string, biggestUsers: {[miner: string]: number}) => {
  database.gas.biggestUsers = {
    height,
    data: biggestUsers || {}
  }
}

export const setUsage = ({ pre, total, prove, wpost }: { pre: [], total: [], prove: [], wpost: [] }) => {
  database.gas.usage = { pre: pre || [], total: total || [], prove: prove || [], wpost: wpost || [] }
  // await fs.writeFile('database.json', Buffer.from(JSON.stringify(database, null, 2)));
}
