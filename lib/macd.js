const rsi = require('./rsi')
const ema = require('./ema')


module.exports = function ichimoku(s, key, length) {
  if (s.options.overbought_rsi) {
    // sync RSI display with overbought RSI periods
    s.options.rsi_periods = s.options.overbought_rsi_periods
    rsi(s, 'overbought_rsi', s.options.overbought_rsi_periods)
    if (!s.in_preroll && s.period.overbought_rsi >= s.options.overbought_rsi && !s.overbought) {
      s.overbought = true
      if (s.options.mode === 'sim' && s.options.verbose) console.log(('\noverbought at ' + s.period.overbought_rsi + ' RSI, preparing to sold\n').cyan)
    }
  }
  
  // compute MACD
  ema(s, 'ema_short', s.options.ema_short_period)
  ema(s, 'ema_long', s.options.ema_long_period)
  if (s.period.ema_short && s.period.ema_long) {
    s.period.macd = (s.period.ema_short - s.period.ema_long)
    ema(s, 'signal', s.options.signal_period, 'macd')
    if (s.period.signal) {
      s.period.macd_histogram = s.period.macd - s.period.signal
    }
  }
}