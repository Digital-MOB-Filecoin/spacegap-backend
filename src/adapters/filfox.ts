import axios from "axios";

export type FilfoxMiners = {
  [address: string]: FilfoxMiner,
}

export type FilfoxMiner = {
  address: string,
  tag: {
    name: string,
    signed: true
  },
  rawBytePower: string,
  qualityAdjPower: string,
  blocksMined: number,
  weightedBlocksMined: number,
  totalRewards: string,
  rewardPerByte: number,
  rawBytePowerDelta: string,
  qualityAdjPowerDelta: string,
}

export class Filfox {
  static async getMiners(): Promise<FilfoxMiner[]> {
    const response = await axios('https://filfox.info/api/v1/miner/top-miners/power?count=100')
    return response.data.miners;
  }
}
