const ADL = require('technicalindicators').ADL

module.exports = function adl(s, options) {

  let { close, high, low, volume } = s.period
  close = [close]
  high = [high]
  low = [low]
  volume = [volume]
  const result = ADL.calculate({close, high, low, volume})
  if(result) {
    s.period.adl = result[0]
    s.period.volume_adi = result[0]
  }

}
