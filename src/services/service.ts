import {Lotus} from "../adapters/lotus";
import {
  setHead,
  setGenesisActors,
  setLast24hActors,
  setEconomics,
  setMinerData,
  setFilRepMiners, MongoDbRepository
} from "../adapters/database";
import {computeEconomics} from "./economics";
import EventEmitter from "events";
import {FilRep, FilRepMiner} from "../adapters/filrep";
import {GasService} from "./gas";
import {TipSet} from "filecoin.js/builds/dist/providers/Types";
import {splitArray} from "./utils";
import {logger} from "../logger";

export enum ServiceEvent {
  NewHead = 'NewHead',
  NewGas = 'NewGas',
  NewActors = 'NewActors',
  NewEconomics = 'NewEconomics',
  NewMiners = 'NewMiners',
}

export class Service extends EventEmitter {
  lotus: Lotus;

  public async run() {
    while(true) {
      await this.getDataRace();
      await this.wait(10);
    }
  }

  private async getDataRace() {
    const start = process.hrtime()
    await Promise.race([this.getData(), this.wait(300)]);
    const end = process.hrtime(start);
    logger.info(`getData duration: ${end[0]}s ${end[1] / 1000000}ms`)
  }


  private async getData() {
    try {
      if (this.lotus) {
        await this.lotus.release();
        this.lotus = undefined;
      }

      this.lotus = new Lotus()

      const head = await this.lotus.getHead();
      const prevHead = await this.lotus.getLast24hHead(head);
      setHead(head)
      this.emit(ServiceEvent.NewHead);

      const gasService = new GasService(head, this.lotus);
      await gasService.initStats();
      await gasService.growth();
      await gasService.biggestUsers()
      await gasService.usage();
      this.emit(ServiceEvent.NewGas);

      const genesisActors = await this.lotus.getGenesisActors(head)
      await setGenesisActors(genesisActors)
      await setLast24hActors(await this.lotus.getGenesisActors(prevHead))
      this.emit(ServiceEvent.NewActors);

      const economics = computeEconomics(head, genesisActors, { projectedDays: 1 })
      await setEconomics(economics)
      this.emit(ServiceEvent.NewEconomics)

      const filrepMiners = await FilRep.getMiners();
      await setFilRepMiners(filrepMiners)
      await this.getMinersData(this.lotus, head, prevHead, filrepMiners)
      this.emit(ServiceEvent.NewMiners);

      await this.lotus.release();
      this.lotus = undefined;
      return true;
    } catch (error) {
      logger.error(error);
    }
  }

  private async getMinersData(lotus: Lotus, head: TipSet, prevHead: TipSet, miners: FilRepMiner[]) {
    const chunksOfMiners = splitArray(miners, 50);
    let minersData = [];

    for (const chunkOfMiners of chunksOfMiners) {
      minersData.push(...(await Promise.all(chunkOfMiners.map(miner => this.getMinerData(lotus, head, prevHead, miner)))));
    }

    for (const dataItem of minersData) {
      await setMinerData(dataItem.miner, dataItem.data)
    }
  }

  async getMinerData (lotus: Lotus, head: TipSet, prevHead: TipSet, miner: FilRepMiner) {
    return {
      miner: miner.address,
      data: await lotus.getMinerData({}, miner.address, head, prevHead, {deadlines: true})
    }
  }

  private async wait(seconds = 1) {
    return new Promise(resolve => {
      setTimeout(resolve, seconds * 1000)
    })
  }
}