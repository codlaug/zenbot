const ParabolicSAR = require('technicalindicators').PSAR

module.exports = function adx(s) {
  if (s.lookback.length >= 30) {
    const input = {
      high: s.lookback.slice(0, 30).map(p => p.high).reverse(),
      low: s.lookback.slice(0, 30).map(p => p.low).reverse(),
      step: 0.02,
      max: 0.2
    }
    const { high, low } = s.period
    const result = new ParabolicSAR(input).nextValue({high, low})
    if(result) {
    //   const { d, k } = result
      s.period.ParabolicSAR = result
    }
  }
}