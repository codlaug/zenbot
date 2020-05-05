const CCI = require('technicalindicators').CCI

module.exports = function cci(s, options) {
  if(typeof options === 'undefined') {
    options = {
      period: 20
    }
  }
  if (s.lookback.length >= options.period) {
    const input = {
      close: s.lookback.slice(0, options.period).map(p => p.close).reverse(),
      high: s.lookback.slice(0, options.period).map(p => p.high).reverse(),
      low: s.lookback.slice(0, options.period).map(p => p.low).reverse(),
      open: s.lookback.slice(0, options.period).map(p => p.open).reverse(),
      period: options.period
    }
    const { close, open, high, low } = s.period
    const result = (new CCI(input)).nextValue({open, close, high, low})
    if(result) {
      s.period.cci = result
    }
  }
}