
let convnetjs = require('convnetjs')



module.exports = function neural(s, key, length, source_key) {
  if (!source_key) source_key = 'close'


  if (s.lookback.length > length) {
    // skip calculation if result already presented as we use historical data only,
    // no need to recalculate for each individual trade
    if (key in s.period) return
    let data = []
    for (var i=length-1; i>=0; i--) {
      data.push(s.lookback[i][source_key])
    }
    const result = s.neural.train(data, length, s.options.bollinger_time)

  }
}

