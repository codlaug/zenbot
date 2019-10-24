const MACD = require('technicalindicators').MACD

module.exports = function adx(s) {
  if (s.lookback.length >= 30) {
    const input = {
      values: s.lookback.slice(0, 30).map(p => p.close).reverse(),
      fastPeriod: 5,
      slowPeriod: 8,
      signalPeriod: 3,
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