import {Lotus} from "../adapters/lotus";
import {
  setEconomics,
  setGenesisActors,
  setHead,
  setLast24hActors,
  setMinerData,
  setFilfoxMiners,
  setFilRepMiners
} from "../adapters/database";
import {Filfox} from "../adapters/filfox";
import {computeEconomics} from "./economics";
import EventEmitter from "events";
import {FilRep} from "../adapters/filrep";

export enum ServiceEvent {
  DataReloaded = 'DataReloaded',
}

export class Service extends EventEmitter {
  public async run() {
    await this.getData();
    this.emit(ServiceEvent.DataReloaded)
    await this.wait(60);
    await this.run()
  }

  private async getData() {
    async function getMinerData (miner) {
      return {
        miner: miner.address,
        data: await lotus.getMinerData({}, miner.address, head, {deadlines: true})
      }
    }
    const lotus = new Lotus()
    const head = await lotus.getHead();
    await setHead(head)
    // const filfoxMiners = await Filfox.getMiners()
    // await setFilfoxMiners(filfoxMiners)
    const filrepMiners = await FilRep.getMiners();
    await setFilRepMiners(filrepMiners)
    const genesisActors = await lotus.getGenesisActors(head)
    await setGenesisActors(genesisActors)
    await setLast24hActors(await lotus.getLast24hActors(head))
    const economics = computeEconomics(head, genesisActors, { projectedDays: 1 })
    await setEconomics(economics)

    const data = await Promise.all(filrepMiners.map(
      miner => getMinerData(miner)
    ))

    for (const dataItem of data) {
      await setMinerData(dataItem.miner, dataItem.data)
    }
  }

  private async wait(seconds = 1) {
    return new Promise(resolve => {
      setTimeout(resolve, seconds * 1000)
    })
  }
}