const BollingerBands = require('technicalindicators').BollingerBands

module.exports = function bollinger(s, options) {
  if(typeof options === 'undefined') {
    options = {
      period: 14,
      stdDev: 2
    }
  }
  if (s.lookback.length >= 14) {
    const input = {
      values: s.lookback.slice(0, 14).map(p => p.close).reverse(),
      period: options.period,
      stdDev: options.stdDev
    }
    const { close } = s.period
    const result = new BollingerBands(input).nextValue(close)
    if(result) {
      const { lower, middle, upper } = result
      s.period.bollingerLower = lower
      s.period.bollingerMid = middle
      s.period.bollingerUpper = upper
    }
  }
}