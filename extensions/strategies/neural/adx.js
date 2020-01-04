const ADX = require('technicalindicators').ADX

module.exports = function adx(s, options) {
  if(typeof options === 'undefined') {
    options = {
      period: 14
    }
  }
  if (s.lookback.length >= 28) {
    const input = {
      close: s.lookback.slice(0, 28).map(p => p.close).reverse(),
      high: s.lookback.slice(0, 28).map(p => p.high).reverse(),
      low: s.lookback.slice(0, 28).map(p => p.low).reverse(),
      period: options.period
    }

    const { close, high, low } = s.period
    const result = new ADX(input).nextValue({close, high, low})
    if(result) {
      const {adx, mdi, pdi } = result
      s.period.adx = adx
      s.period.mdi = mdi
      s.period.pdi = pdi
    }
  }
}
