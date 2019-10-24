const Stochastic = require('technicalindicators').Stochastic

module.exports = function adx(s) {
  if (s.lookback.length >= 28) {
    const input = {
      close: s.lookback.slice(0, 28).map(p => p.close).reverse(),
      high: s.lookback.slice(0, 28).map(p => p.high).reverse(),
      low: s.lookback.slice(0, 28).map(p => p.low).reverse(),
      period: 14,
      signalPeriod: 2
    }
    const { close, high, low } = s.period
    const result = new Stochastic(input).nextValue({close, high, low})
    if(result) {
      const { d, k } = result
      s.period.stochasticD = d
      s.period.stochasticK = k
    }
  }
}