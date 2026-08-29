import { FEE_TIERS } from '../../../shared/contracts.js';
import { mulBps, add } from '../../../shared/money.js';

/** Fee engine. Fees are computed in integer minor units of the quote asset,
 *  rounded UP (away from zero) so the house never under-collects. */
export class FeeEngine {
  constructor(tiers = FEE_TIERS) {
    this.tiers = [...tiers].sort((a, b) => b.minVolumeUsdt - a.minVolumeUsdt);
  }

  tierFor(volume30dUsdt) {
    for (const t of this.tiers) if (volume30dUsdt >= t.minVolumeUsdt) return t;
    return this.tiers[this.tiers.length - 1];
  }

  /**
   * notionalMinor: order value in quote minor units (int)
   * side: 'taker' | 'maker'
   * returns { feeMinor, tier }
   */
  compute(notionalMinor, side, volume30dUsdt = 0) {
    const tier = this.tierFor(volume30dUsdt);
    const bps = side === 'maker' ? tier.makerBps : tier.takerBps;
    const feeMinor = mulBps(notionalMinor, bps, 'up');
    return { feeMinor, tier };
  }
}

/** Reserve check helper: ensure notional + fee fits in available balance. */
export function requiredReserve(notionalMinor, feeMinor) {
  return add(notionalMinor, feeMinor);
}
