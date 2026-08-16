// ============================================================================
// FILE: backend/services/statArbService.js
// Bank Nifty Constituent Weighting & Statistical Arbitrage Skew Service
// Calculates weighted constituent directional momentum & lead-lag skew
// ============================================================================

/**
 * Bank Nifty Constituent Weightings (NSE India Index Methodology)
 */
const BANKNIFTY_CONSTITUENT_WEIGHTS = {
  'HDFCBANK': 0.285,  // 28.5%
  'ICICIBANK': 0.231, // 23.1%
  'KOTAKBANK': 0.118, // 11.8%
  'AXISBANK': 0.112,  // 11.2%
  'SBIN': 0.104,      // 10.4%
  'INDUSINDBK': 0.052,
  'BANKBARODA': 0.028,
  'PNB': 0.021,
  'AUBANK': 0.019,
  'IDFCFIRSTB': 0.015,
  'FEDERALBNK': 0.015
};

class StatArbService {
  /**
   * Calculates weighted constituent directional breadth score
   * @param {Array} stockDataList - Array of stock objects [{ symbol: 'HDFCBANK', pChange: 1.25, ltp: 1650 }, ...]
   * @returns {Object} Weighted breadth metrics & directional skew
   */
  calculateConstituentBreadth(stockDataList) {
    if (!stockDataList || !Array.isArray(stockDataList) || stockDataList.length === 0) {
      return {
        weightedBreadthScore: 0.0,
        advancingWeight: 0.0,
        decliningWeight: 0.0,
        directionalBias: 'NEUTRAL',
        activeConstituentsCount: 0
      };
    }

    let weightedBreadthScore = 0.0;
    let totalWeightTracked = 0.0;
    let advancingWeight = 0.0;
    let decliningWeight = 0.0;

    stockDataList.forEach(stock => {
      const symbol = stock.symbol;
      const weight = BANKNIFTY_CONSTITUENT_WEIGHTS[symbol] || 0.01;
      const pChange = parseFloat(stock.pChange) || 0.0;

      weightedBreadthScore += weight * pChange;
      totalWeightTracked += weight;

      if (pChange > 0) {
        advancingWeight += weight;
      } else if (pChange < 0) {
        decliningWeight += weight;
      }
    });

    // Normalize weighted score relative to tracked total weight
    const normalizedBreadthScore = totalWeightTracked > 0 
      ? weightedBreadthScore / totalWeightTracked 
      : 0.0;

    let directionalBias = 'NEUTRAL';
    if (normalizedBreadthScore > 0.35) {
      directionalBias = 'STRONG_BULLISH';
    } else if (normalizedBreadthScore > 0.10) {
      directionalBias = 'BULLISH';
    } else if (normalizedBreadthScore < -0.35) {
      directionalBias = 'STRONG_BEARISH';
    } else if (normalizedBreadthScore < -0.10) {
      directionalBias = 'BEARISH';
    }

    return {
      weightedBreadthScore: parseFloat(normalizedBreadthScore.toFixed(4)),
      advancingWeight: parseFloat((advancingWeight * 100).toFixed(2)),
      decliningWeight: parseFloat((decliningWeight * 100).toFixed(2)),
      directionalBias: directionalBias,
      activeConstituentsCount: stockDataList.length
    };
  }

  /**
   * Calculates Lead-Lag Spread between Bank Nifty Spot Index % Change and Constituent Weighted % Change
   * @param {number} bankNiftyPChange - Percentage change of Bank Nifty Index
   * @param {number} weightedBreadthScore - Weighted constituent score
   * @returns {Object} Lead-Lag discrepancy & opportunity signal
   */
  calculateLeadLagDiscrepancy(bankNiftyPChange, weightedBreadthScore) {
    const spread = weightedBreadthScore - bankNiftyPChange;
    let signal = 'NO_DISCREPANCY';

    // If underlying constituent weight is surging up (+0.5%) while Bank Nifty index is lagging (-0.1%), index is expected to catch up up
    if (spread > 0.40) {
      signal = 'BULLISH_CATCHUP_EXPECTED';
    } else if (spread < -0.40) {
      signal = 'BEARISH_CATCHUP_EXPECTED';
    }

    return {
      spread: parseFloat(spread.toFixed(4)),
      signal: signal
    };
  }
}

module.exports = StatArbService;
