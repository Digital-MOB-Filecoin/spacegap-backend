export const computeEconomics = (
  head,
  { Supply, Reward, Power },
  {
    projectedDays,
    perDurationNwRbGrowth = 10 * 2 ** 50,
    perDurationMinerQaGrowth = 2 ** 51
  }
) => {
  const inputs = {
    currEpoch: +head.Height,
    nwqap: +Power.State.ThisEpochQualityAdjPower,
    nwqapP: +Power.State.ThisEpochQAPowerSmoothed.PositionEstimate / 2 ** 128,
    nwqapV: +Power.State.ThisEpochQAPowerSmoothed.VelocityEstimate / 2 ** 128,
    nwCircSupply: +Supply / 1e18,
    perEpochRewardP: +Reward.State.ThisEpochRewardSmoothed.PositionEstimate / (2 ** 128 * 1e18),
    perEpochRewardV: +Reward.State.ThisEpochRewardSmoothed.VelocityEstimate / (2 ** 128 * 1e18),
    nwCumsumRealized: +Reward.State.CumsumRealized,
    perDurationNwRbGrowth,
    projectedDays,
    perDurationMinerQaGrowth
  }
  const econ = new Economics(inputs)
  return econ.summary()
}

const EPOCHS_PER_DAY = (24 * 60 * 60) / 30
const EPOCHS_PER_YEAR = 365 * EPOCHS_PER_DAY
const INITIAL_BASELINE = 2888888880000000000
const BASELINE_ANNUAL_GROWTH = 1

class Economics {
  currEpoch
  nwqap
  nwqapP
  nwqapV
  nwCircSupply
  perEpochRewardP
  perEpochRewardV
  perDurationNwRbGrowth
  projectedDays
  perDurationMinerQaGrowth
  nwCumsumRealized

  constructor (
    {
      currEpoch,
      nwqap,
      nwqapP,
      nwqapV,
      nwCircSupply,
      perEpochRewardP,
      perEpochRewardV,
      perDurationNwRbGrowth,
      projectedDays,
      perDurationMinerQaGrowth,
      nwCumsumRealized
    }
  ) {
    Object.assign(this, {
      currEpoch,
      nwqap,
      nwqapP,
      nwqapV,
      nwCircSupply,
      perEpochRewardP,
      perEpochRewardV,
      perDurationNwRbGrowth,
      projectedDays,
      perDurationMinerQaGrowth,
      nwCumsumRealized
    })
  }

  public summary() {
    const sectorIp = this.computeInitialPledgeForQAPower(
      32 * 2 ** 30,
      this.currEpoch
    )
    const sectorProjectedReward = this.projectFutureReward(32 * 2 ** 30, 360)
    const sectorProjectedReward1 = this.projectFutureReward(32 * 2 ** 30, 1)
    const sectorFaultFee = this.projectFutureReward(32 * 2 ** 30, 3.51)

    return {
      sectorIp,
      sectorProjectedReward,
      sectorProjectedReward1,
      sectorFaultFee
    }
  }

  private computeInitialPledgeForQAPower (sectorQAP, currEpoch) {
    return (
      this.projectFutureReward(sectorQAP, 20) +
      (sectorQAP * 0.3 * this.nwCircSupply) /
      Math.max(this.nwqap, getCurrBaseline(currEpoch))
    )
  }

  private projectFutureReward (sectorQAP, days) {
    const networkQAPFilter = new AlphaBetaFilter(this.nwqapP, this.nwqapV)
    const perEpochRewardFilter = new AlphaBetaFilter(
      this.perEpochRewardP,
      this.perEpochRewardV
    )
    return (sectorQAP * extrapolateCumsumRatio(perEpochRewardFilter, networkQAPFilter, days * EPOCHS_PER_DAY)
    )
  }
}

class AlphaBetaFilter {
  alpha
  beta
  p
  v

  constructor (p, v) {
    this.alpha = 9.25e-4
    this.beta = 2.84e-7
    this.p = p
    this.v = v
  }

  addNewEntry (value, deltaT) {
    this.p += this.v * deltaT
    const residual = value - this.p
    this.p += this.alpha * residual
    this.p = Math.max(this.p, 0)
    this.v += (this.beta * residual) / deltaT
  }
}

const extrapolateCumsumRatio = function (numerator, denominator, futureT) {
  const x2a = Math.log(denominator.p + denominator.v)
  const x2b = Math.log(denominator.p + denominator.v + denominator.v * futureT)
  const m1 = denominator.v * numerator.p * (x2b - x2a)
  const m2 =
    numerator.v * (denominator.p * (x2a - x2b) + denominator.v * futureT)
  return (m1 + m2) / Math.pow(denominator.v, 2)
}

const getCurrBaseline = function (e) {
  const x0 = INITIAL_BASELINE
  const annualGrowth = BASELINE_ANNUAL_GROWTH
  const k = Math.pow(1 + annualGrowth, 1 / EPOCHS_PER_YEAR)
  return x0 * Math.pow(k, e)
}