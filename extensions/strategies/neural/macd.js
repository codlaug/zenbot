const MACD = require('technicalindicators').MACD

module.exports = function macd(s, options) {
  if(typeof options === 'undefined') {
    options = {
      fastPeriod: 5,
      slowPeriod: 8,
      signalPeriod: 3
    }
  }
  if (s.lookback.length >= options.slowPeriod+options.signalPeriod) {
    const input = {
      values: s.lookback.slice(0, options.slowPeriod+options.signalPeriod).map(p => p.close).reverse(),
      fastPeriod: options.fastPeriod,
      slowPeriod: options.slowPeriod,
      signalPeriod: options.signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    }
    const { close } = s.period
    const result = (new MACD(input)).nextValue({value: close})
    if(result) {
      const {MACD, histogram, signal} = result
      s.period.MACD = MACD
      s.period.histogram = histogram
      s.period.signal = signal
    }
  }
}