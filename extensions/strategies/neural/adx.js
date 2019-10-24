const ADX = require('technicalindicators').ADX

module.exports = function adx(s) {
  if (s.lookback.length >= 30) {
    const input = {
      close: s.lookback.slice(0, 30).map(p => p.close).reverse(),
      high: s.lookback.slice(0, 30).map(p => p.high).reverse(),
      low: s.lookback.slice(0, 30).map(p => p.low).reverse(),
      period: 30
    }

    const result = ADX.calculate(input)
    if(result.length) {
      const {adx, mdi, pdi } = result[result.length-1]
      s.period.adx = adx
      s.period.mdi = mdi
      s.period.pdi = pdi
    }
  }
}