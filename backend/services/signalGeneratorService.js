// ============================================================================
// FILE: backend/services/signalGeneratorService.js
// Quantitative Signal Generator for Bank Nifty Options
// Integrates PCR Rolling Z-Score + Bank Stock Breadth + Risk Sizing Engine
// ============================================================================

const StatArbService = require('./statArbService');
const { calculateFractionalKelly, calculateVolatilityTargetWeight } = require('../utils/riskEngine');

class SignalGeneratorService {
  constructor() {
    this.statArbService = new StatArbService();
  }

  /**
   * Generates quantitative strategy signal
   * @param {Object} pcrData - { pcr, pcrZScore, historicalValues }
   * @param {Array} stockList - Bank Nifty constituent stocks [{ symbol: 'HDFCBANK', pChange: 1.2 }, ...]
   * @param {Object} riskParams - { portfolioCapital, indiaVix, currentVol }
   * @returns {Object} Strategy Signal & Recommendation Payload
   */
  generateSignal(pcrData, stockList, riskParams = {}) {
    const { pcr, pcrZScore = 0.0 } = pcrData || {};
    
    // 1. Calculate Constituent Breadth Skew
    const breadthMetrics = this.statArbService.calculateConstituentBreadth(stockList);
    const { weightedBreadthScore, directionalBias } = breadthMetrics;

    // 2. Extract Volatility & Risk Sizing Factors
    const portfolioCapital = riskParams.portfolioCapital || 100000;
    const indiaVix = riskParams.indiaVix || 15.0; // Default 15% VIX
    const annualizedVol = (indiaVix / 100);

    const volWeight = calculateVolatilityTargetWeight(annualizedVol, 0.15, 1.0);
    const kellyFraction = calculateFractionalKelly(0.02, 0.0004, 0.25); // Quarter-Kelly

    // Recommended capital allocation per trade (capped by Volatility Target)
    const allocatedCapital = portfolioCapital * kellyFraction * volWeight;

    // 3. Core Signal Logic Matrix
    let signal = 'NEUTRAL_HOLD';
    let rationale = [];
    let targetContract = null; // 'CE' or 'PE'

    // Signal Condition A: Long Call (CE)
    if (pcrZScore < -1.2 && weightedBreadthScore > 0.15) {
      signal = 'BUY_CALL_CE';
      targetContract = 'CE';
      rationale.push(`PCR Z-Score (${pcrZScore.toFixed(2)}) is Oversold (< -1.2)`);
      rationale.push(`Bank Stock Breadth (${weightedBreadthScore.toFixed(2)}%) is Bullish`);
    }
    // Signal Condition B: Long Put (PE)
    else if (pcrZScore > +1.2 && weightedBreadthScore < -0.15) {
      signal = 'BUY_PUT_PE';
      targetContract = 'PE';
      rationale.push(`PCR Z-Score (${pcrZScore.toFixed(2)}) is Overbought (> +1.2)`);
      rationale.push(`Bank Stock Breadth (${weightedBreadthScore.toFixed(2)}%) is Bearish`);
    }
    // Default Neutral / Conflicting Signal
    else {
      signal = 'NEUTRAL_HOLD';
      rationale.push(`No directional convergence between PCR Z-Score (${pcrZScore.toFixed(2)}) and Breadth (${weightedBreadthScore.toFixed(2)}%)`);
    }

    return {
      timestamp: new Date().toISOString(),
      signal,
      targetContract,
      pcrMetrics: {
        rawPcr: pcr,
        pcrZScore: pcrZScore
      },
      breadthMetrics: {
        weightedBreadthScore,
        directionalBias,
        advancingWeight: breadthMetrics.advancingWeight,
        decliningWeight: breadthMetrics.decliningWeight
      },
      riskAllocation: {
        portfolioCapital,
        indiaVix,
        volatilityWeight: parseFloat(volWeight.toFixed(2)),
        allocatedCapital: parseFloat(allocatedCapital.toFixed(2)),
        recommendedLotSize: Math.max(1, Math.floor(allocatedCapital / 7500)) // Assuming ~₹7,500 premium per lot
      },
      rationale
    };
  }
}

module.exports = SignalGeneratorService;
