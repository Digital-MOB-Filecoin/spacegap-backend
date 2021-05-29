import axios from "axios";

export type FilRepMiner = {
  address: string,
  rawPower: string,
  price: string,
  verifiedPrice: string,
  isoCode: string,
  region: string,
  tag: {
    name: string,
    verified: boolean,
  }
}

export class FilRep {
  static async getMiners(): Promise<FilRepMiner[]> {
    const response = await axios('http://api.filrep.io/api/v1/miners?limit=100&sortBy=score')
    return response.data.miners.map(miner => ({
      address: miner.address,
      price: miner.price,
      verifiedPrice: miner.verifiedPrice,
      rawPower: miner.rawPower,
      isoCode: miner.isoCode,
      region: miner.region,
      score: miner.score,
      rank: miner.rank,
      tag: miner.tag,
    }));
  }
}
