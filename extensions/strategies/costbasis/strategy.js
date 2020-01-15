let z = require('zero-fill')
  , n = require('numbro')
  , Phenotypes = require('../../../lib/phenotype')
const CostBasisCollection = require('../neural/cost_basis')




module.exports = {
  name: 'costbasis',
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
    if(!s.costBasis) {
      s.costBasis = new CostBasisCollection()
    }
    if(typeof s.lastOrderId === 'undefined') {
      s.lastOrderId = 1000
    }
    for(let i = 0; i < s.my_trades.length; ++i) {
      if(s.my_trades[i].order_id <= s.lastOrderId) continue

      if(s.my_trades[i].type === 'buy') {
        // console.log(s.my_trades[i])
        s.costBasis.append(parseFloat(s.my_trades[i].size)-s.my_trades[i].fee, parseFloat(s.my_trades[i].price))
      } else if(s.my_trades[i].type === 'sell') {
        // console.log(s.my_trades[i])
        s.costBasis.remove(parseFloat(s.my_trades[i].size))
      }
    }
    if(s.my_trades.length) {
      s.lastOrderId = s.my_trades[s.my_trades.length-1].order_id
    }
  },
  // onPeriod: TRAINING ? onPeriodTraining : onPeriodSimulating,
  onPeriod: function(s, cb) {
    // console.log(s.period)
    

    global.avgPrice = s.costBasis.avgPrice()
    const avgCostBasis = (s.period.close - s.costBasis.avgPrice()) / Math.max(s.period.close, s.costBasis.avgPrice())
    
    const avgPrice = s.costBasis.avgPrice()
    console.log(avgPrice)
    if(avgPrice == 0) {
      s.signal = 'buy'
    } else if(s.period.close - avgPrice > 15.0) {
      s.signal = 'sell'
    } else if(s.period.close < avgPrice) {
      s.signal = 'buy'
    }

    cb()
  },
  onReport: function () {
    var cols = []
    cols.push(typeof global.avgPrice !== 'undefined' ? global.avgPrice.toString() : '')
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
