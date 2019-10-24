let z = require('zero-fill')
  , Phenotypes = require('../../../lib/phenotype')
  , bollinger = require('../../../lib/ta_bollinger')
  , rsi = require('../../../lib/rsi')
  , tf = require('@tensorflow/tfjs')
  , fs = require('fs')
  , TradingAgent = require('./trading_agent')
  , getStateTensor = require('./get_state')
  , ichimoku = require('./ichimoku')
  , ema = require('../../../lib/ema')
  , adx = require('./adx')
  , macd = require('./macd')
  , stochastic = require('./stochastic')
  , parabolicSAR = require('./parabolic_sar')
const { onPeriodSimulating, onPeriodTraining } = require('./on_period')


const TRAINING = true


const FEATURE_LENGTH = 21

function lowerOfTheTwo(a, b) {
  return a < b ? a : b
}

// the below line starts you at 0 threads
global.forks = 0
// the below line is for calculating the last mean vs the now mean.


module.exports = {
  name: 'neural',
  description: 'Use neural learning to predict future price. Buy = mean(last 3 real prices) < mean(current & last prediction)',
  getOptions: function () {
    this.option('period', 'Period length - longer gets a better average', String, '30s')
    this.option('period_length', 'Period length set same as --period', String, '30s')
    this.option('activation_1_type', 'Neuron Activation Type: sigmoid, tanh, relu', String, 'relu')
    this.option('neurons_1', 'Neurons in layer 1', Number, 32)
    this.option('activation_2_type', 'Neuron Activation Type: sigmoid, tanh, relu', String, 'linear')
    this.option('neurons_2', 'Neurons in layer 2', Number, 64)
    this.option('depth', 'Generally the same as min_predict for accuracy', Number, 200)
    this.option('min_periods', 'Periods to train neural network with from', Number, 20)
    this.option('min_predict', 'Periods to predict next number from less than min_periods', Number, 20)
    this.option('momentum', 'momentum of prediction between 0 and 1 - 0 is stock', Number, 0.0)
    this.option('decay', 'decay of prediction, use teeny tiny increments beteween 0 and 1 - stock', Number, 0.001)
    this.option('threads', 'Number of processing threads you\'d like to run (best for sim - Possibly broken', Number, 1)
    this.option('learns', 'Number of times to \'learn\' the neural network with past data', Number, 10)
    this.option('learningrate', 'The learning rate of the neural network between 0 and 1 - 0.01 is stock', Number, 0.01)
    this.option('training', 'Training or running the sim', Boolean, true)

    this.option('bollinger_size', 'period size', Number, 20)
    this.option('bollinger_time', 'times of standard deviation between the upper band and the moving averages', Number, 2)
    this.option('bollinger_upper_bound_pct', 'pct the current price should be near the bollinger upper bound before we sell', Number, 0)
    this.option('bollinger_lower_bound_pct', 'pct the current price should be near the bollinger lower bound before we buy', Number, 0)

    this.option('rsi_periods', 'number of RSI periods', Number, 14)
    this.option('oversold_rsi', 'buy when RSI reaches or drops below this value', Number, 30)
    this.option('overbought_rsi', 'sell when RSI reaches or goes above this value', Number, 82)
    this.option('rsi_recover', 'allow RSI to recover this many points before buying', Number, 3)
    this.option('rsi_drop', 'allow RSI to fall this many points before selling', Number, 0)
    this.option('rsi_divisor', 'sell when RSI reaches high-water reading divided by this value', Number, 2)
  },
  calculate: function (s) {
    if(typeof s.brain === 'undefined') {
      s.brain = new TradingAgent(null, s.options)
      s.trained = true

      if(fs.existsSync('brain/model.json')) {
        s.training = true
        s.brain.load().then((r) => {
          if(r) {
            s.trained = true
            s.training = false
          }
        })
      }
    }
    bollinger(s, 'bollinger', s.options.bollinger_size, 2, 2, 'EMA').then(result => {
      const { outRealUpperBand: upper, outRealMiddleBand: mid, outRealLowerBand: lower } = result
      s.period['bollinger_upper'] = upper
      s.period['bollinger_mid'] = mid
      s.period['bollinger_lower'] = lower
    }).catch(e => {})
    ema(s, 'trend_ema', s.options.min_periods)
    if (typeof s.period.trend_ema !== 'undefined') {
      s.trend = s.period.trend_ema > s.lookback[0].trend_ema ? 'up' : 'down'
    }
    rsi(s, 'rsi', s.options.rsi_periods)
    ichimoku(s)
    adx(s)
    stochastic(s)
    macd(s)
    parabolicSAR(s)
  },
  onPeriod: TRAINING ? onPeriodTraining : onPeriodSimulating,
  onReport: function () {
    var cols = []
    // cols.push(z(8, n(global.predi).format('0000.00000'), ' '))
    cols.push(typeof global.bestAction !== 'undefined' ? global.bestAction.toString() : '')
    return cols
  },

  phenotypes: {
    // -- common
    period_length: Phenotypes.RangePeriod(1, 120, 'm'),
    min_periods: Phenotypes.Range(1, 200),
    markdown_buy_pct: Phenotypes.RangeFloat(-1, 5),
    markup_sell_pct: Phenotypes.RangeFloat(-1, 5),
    order_type: Phenotypes.ListOption(['maker', 'taker']),
    sell_stop_pct: Phenotypes.Range0(1, 50),
    buy_stop_pct: Phenotypes.Range0(1, 50),
    profit_stop_enable_pct: Phenotypes.Range0(1, 20),
    profit_stop_pct: Phenotypes.Range(1,20),

    // -- strategy
    neurons_1: Phenotypes.Range(1, 200),
    neurons_2: Phenotypes.Range(1, 200),
    activation_1_type: Phenotypes.ListOption(['sigmoid', 'tanh', 'relu']),
    activation_2_type: Phenotypes.ListOption(['sigmoid', 'tanh', 'relu']),
    depth: Phenotypes.Range(1, 200),
    min_predict: Phenotypes.Range(1, 200),
    // momentum and decay and learning rate are decimals?
    momentum: Phenotypes.RangeFloat(0.8, 0.99),
    decay: Phenotypes.RangeFloat(0, 1),
    learns: Phenotypes.Range(1, 500),
    learningrate: Phenotypes.RangeFloat(0, 1)
  }
}
