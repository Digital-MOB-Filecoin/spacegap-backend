import {database} from "../adapters/database";

export class PageDataService {
  static getHead() {
    const { head } = database;

    return {
      head,
    }
  }

  static getActors() {
    const { genesisActors: actors, last24hActors } = database;

    if (!actors || !last24hActors) {
      return {
        actors: undefined
      }
    }

    return {
      actors: {
        circulatingSupply: (+actors.Supply / 1e18),
        burnt: (+actors.SupplyVM.FilBurnt / 1e18),
        locked: (+actors.SupplyVM.FilLocked / 1e18),
        last24hNewSupply: ((+actors.Supply - +last24hActors.Supply) / 1e18),
        last24hNewBurnt: ((+actors.SupplyVM.FilBurnt - +last24hActors.SupplyVM.FilBurnt) / 1e18),
        last24hLocked: ((actors.SupplyVM.FilLocked - +last24hActors.SupplyVM.FilLocked) / 1e18),
        networkRaw: (+actors.Power.State.TotalBytesCommitted / 2 ** 50),
        last24hNewStorage: ((+actors.Power.State.TotalBytesCommitted - +last24hActors.Power.State.TotalBytesCommitted) / 2 ** 50),
        totalBytesCommitted: +actors.Power.State.TotalBytesCommitted,
        activeMiners: actors.Power.State.MinerAboveMinPowerCount,
        blockReward: (+actors.Reward.State.ThisEpochReward / 5 / 1e18),
        totalProviderLockedCollateral: +actors.Market.State.TotalProviderLockedCollateral / 1e18,
        totalClientStorageFee: +actors.Market.State.TotalClientStorageFee / 1e18,
        nextId: actors.Market.State.NextID,
      },
    }
  }

  static getEconomics() {
    const { economics } = database;

    if (!economics) return { economics: undefined };

    return {
      economics: {
        sectorPledge: economics.sectorIp,
        sectorProjectedReward: economics.sectorProjectedReward,
        sectorProjectedReward1: economics.sectorProjectedReward1,
        sectorFaultFee: economics.sectorFaultFee,
        dayFilTiBReward: ((economics.sectorProjectedReward1 * 1024) / 32),
      },
    };
  }

  static getGas() {
    const { gas } = database;

    return { gas };
  }

  static getMiners() {
    const { miners } = database;

    if (Object.keys(miners).length === 0) {
      return {
        miners: {},
      };
    }

    return {
      miners: Object.keys(miners).reduce((acc, miner) => {
        return {
          ...acc,
          [miner]: {
            address: miner,
            price: miners[miner].filrep.price,
            rawPower: miners[miner].filrep.rawPower,
            preCommitsCount: miners[miner].preCommits?.data?.Count,
            tag: {...miners[miner].filrep.tag},
            country: miners[miner].filrep.isoCode,
            deposits: {
              available: miners[miner].deposits?.data?.Available,
              balance: miners[miner].deposits?.data?.Balance,
              lockedFunds: miners[miner].deposits?.data?.LockedFunds,
              feeDebt: miners[miner].deposits?.data?.FeeDebt || 0,
              initialPledge: miners[miner].deposits?.data?.InitialPledge || 0,
              preCommitDeposits: miners[miner].deposits?.data?.PreCommitDeposits || 0,
            },
            deadlines: {
              sectorsCount: miners[miner].deadlines?.data.SectorsCount,
              activeCount: miners[miner].deadlines?.data.ActiveCount,
              faultsCount: miners[miner].deadlines?.data.FaultsCount,
              nextDeadlines: miners[miner].deadlines?.data.nextDeadlines,
              deadline: miners[miner].deadlines?.data.deadline,
            },
            prevDeadlines: {
              sectorsCount: miners[miner].prevDeadlines?.data.SectorsCount,
              activeCount: miners[miner].prevDeadlines?.data.ActiveCount,
              faultsCount: miners[miner].prevDeadlines?.data.FaultsCount,
              nextDeadlines: miners[miner].prevDeadlines?.data.nextDeadlines,
              deadline: miners[miner].prevDeadlines?.data.deadline,
            },
            preCommits: {
              preCommitDeadlines: miners[miner].preCommits?.data?.PreCommitDeadlines,
            }
          }
        }
      }, {}),
    }
  }

  static getAll() {
    return {
      ...this.getHead(),
      ...this.getActors(),
      ...this.getEconomics(),
      ...this.getGas(),
      ...this.getMiners(),
    }
  }
}