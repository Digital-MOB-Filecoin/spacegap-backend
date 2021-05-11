import axios from "axios";

export type FilRepMiner = {
  address: string,
  rawPower: string,
  price: string,
  verifiedPrice: string,
  isoCode: string,
  region: string,
}

export class FilRep {
  static async getMiners(): Promise<FilRepMiner[]> {
    const response = await axios('https://api.filrep.io/api/v1/miners?limit=100&sortBy=score')
    return response.data.miners.map(miner => ({
      address: miner.address,
      price: miner.price,
      verifiedPrice: miner.verifiedPrice,
      rawPower: miner.rawPower,
      isoCode: miner.isoCode,
      region: miner.region,
      score: miner.score,
      rank: miner.rank,
    }));
  }
}
