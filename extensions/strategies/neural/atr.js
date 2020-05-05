const ATR = require('technicalindicators').ATR

module.exports = function atr(s, options) {
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
    const result = new ATR(input).nextValue({close, high, low})
    if(result) {
      s.period.atr = result
    }
  }
}