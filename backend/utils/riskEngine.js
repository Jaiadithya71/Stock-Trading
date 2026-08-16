// ============================================================================
// FILE: backend/utils/riskEngine.js
// Quantitative Risk Engine for Dynamic Position Sizing & Tail Risk
// - Fractional Kelly Criterion (0.25f*)
// - Volatility Targeting (GARCH / EWMA)
// - Cornish-Fisher VaR & Expected Shortfall (CVaR)
// ============================================================================

/**
 * Calculates Fractional Kelly Sizing Fraction
 * @param {number} meanReturn - Expected average return per trade (mu)
 * @param {number} varianceReturn - Variance of return (sigma^2)
 * @param {number} fraction - Kelly multiplier (default 0.25 for Quarter Kelly)
 * @returns {number} Optimal position sizing fraction (0.0 to 1.0)
 */
function calculateFractionalKelly(meanReturn, varianceReturn, fraction = 0.25) {
  if (!varianceReturn || varianceReturn <= 0 || !meanReturn || meanReturn <= 0) {
    return 0.0;
  }
  const fullKelly = meanReturn / varianceReturn;
  const allocatedKelly = Math.max(0.0, fullKelly * fraction);
  return Math.min(allocatedKelly, 1.0); // Cap at 100% portfolio allocation
}

/**
 * Calculates Volatility-Targeted Position Weight
 * @param {number} currentVolatility - Current annualized volatility (e.g. 0.22 for 22%)
 * @param {number} targetVolatility - Target annualized volatility (default 0.15 for 15%)
 * @param {number} maxLeverage - Maximum allowable leverage multiplier (default 1.0)
 * @returns {number} Position weight multiplier
 */
function calculateVolatilityTargetWeight(currentVolatility, targetVolatility = 0.15, maxLeverage = 1.0) {
  if (!currentVolatility || currentVolatility <= 0) {
    return 1.0;
  }
  const weight = targetVolatility / currentVolatility;
  return Math.min(weight, maxLeverage);
}

/**
 * Calculates Cornish-Fisher Value at Risk (VaR) and Expected Shortfall (CVaR)
 * Adjusts for non-Gaussian return distributions (skewness & kurtosis)
 * @param {number[]} returns - Array of historical return percentages
 * @param {number} confidenceLevel - Confidence level (default 0.95 for 95% VaR)
 * @returns {Object} VaR and CVaR metrics
 */
function calculateCornishFisherVaR(returns, confidenceLevel = 0.95) {
  if (!returns || returns.length < 10) {
    return { var95: 0.0, cvar95: 0.0, skewness: 0.0, kurtosis: 3.0 };
  }

  const n = returns.length;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return { var95: 0.0, cvar95: 0.0, skewness: 0.0, kurtosis: 3.0 };
  }

  // Calculate Skewness and Kurtosis
  const skewness = returns.reduce((a, b) => a + Math.pow((b - mean) / stdDev, 3), 0) / n;
  const kurtosis = returns.reduce((a, b) => a + Math.pow((b - mean) / stdDev, 4), 0) / n;
  const excessKurtosis = kurtosis - 3.0;

  // Standard normal quantile for 95% confidence (alpha = 0.05 -> z = -1.64485)
  const zAlpha = -1.64485;

  // Cornish-Fisher Expansion Quantile
  const zCF = zAlpha +
    (skewness / 6.0) * (Math.pow(zAlpha, 2) - 1) +
    (excessKurtosis / 24.0) * (Math.pow(zAlpha, 3) - 3 * zAlpha) -
    (Math.pow(skewness, 2) / 36.0) * (2 * Math.pow(zAlpha, 3) - 5 * zAlpha);

  const var95 = -(mean + zCF * stdDev);

  // Expected Shortfall (CVaR): Average loss of returns below VaR threshold
  const tailLosses = returns.filter(r => r <= -var95);
  const cvar95 = tailLosses.length > 0
    ? - (tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length)
    : var95;

  return {
    var95: Math.max(0, var95),
    cvar95: Math.max(0, cvar95),
    skewness: parseFloat(skewness.toFixed(4)),
    kurtosis: parseFloat(kurtosis.toFixed(4))
  };
}

module.exports = {
  calculateFractionalKelly,
  calculateVolatilityTargetWeight,
  calculateCornishFisherVaR
};
