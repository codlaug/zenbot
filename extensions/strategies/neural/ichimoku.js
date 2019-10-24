const IchimokuCloud = require('technicalindicators').IchimokuCloud

module.exports = function ichimoku(s) {
  if (s.lookback.length >= 52) {
    const input = {
      high: s.lookback.slice(0, 26).map(p => p.high).reverse(),
      low: s.lookback.slice(0, 52).map(p => p.low).reverse(),
      conversionPeriod: 9,
      basePeriod: 26,
      spanPeriod: 52,
      displacement: 26
    }
    const { high, low } = s.period
    const result = (new IchimokuCloud(input)).nextValue({ high, low})
    if(result) {
      const {conversion, base, spanA, spanB } = result
      s.period.tenkanSen = conversion
      s.period.kijunSen = base
      s.period.senkouA = spanA
      s.period.senkouB = spanB
    }
  }
}

function rsi (s, key, length) {
  if (s.lookback.length >= length) {
    var avg_gain = s.lookback[0][key + '_avg_gain']
    var avg_loss = s.lookback[0][key + '_avg_loss']
    if (typeof avg_gain === 'undefined') {
      var gain_sum = 0
      var loss_sum = 0
      var last_close
      s.lookback.slice(0, length).forEach(function (period) {
        if (last_close) {
          if (period.close > last_close) {
            gain_sum += period.close - last_close
          }
          else {
            loss_sum += last_close - period.close
          }
        }
        last_close = period.close
      })
      s.period[key + '_avg_gain'] = gain_sum / length
      s.period[key + '_avg_loss'] = loss_sum / length
    }
    else {
      var current_gain = s.period.close - s.lookback[0].close
      s.period[key + '_avg_gain'] = ((avg_gain * (length - 1)) + (current_gain > 0 ? current_gain : 0)) / length
      var current_loss = s.lookback[0].close - s.period.close
      s.period[key + '_avg_loss'] = ((avg_loss * (length - 1)) + (current_loss > 0 ? current_loss : 0)) / length
    }

    if(s.period[key + '_avg_loss'] == 0) {
      s.period[key] = 100
    } else {
      var rs = s.period[key + '_avg_gain'] / s.period[key + '_avg_loss']
      s.period[key] = precisionRound(100 - (100 / (1 + rs)), 2)
    }
  }
}