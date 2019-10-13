let z = require('zero-fill')
  , n = require('numbro')
  , neural = require('../../../lib/neural')
  , convnetjs = require('convnetjs')
  , Phenotypes = require('../../../lib/phenotype')
  , reinforcejs = require('reinforcejs')
  , NeuralNetwork = require('./neural_network_tensorflow')
  , bollinger = require('../../../lib/bollinger')
  , tf = require('@tensorflow/tfjs')
  , PriceData = require('./dataset')


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
    this.option('period', 'Period length - longer gets a better average', String, '30m')
    this.option('period_length', 'Period length set same as --period', String, '30m')
    this.option('activation_1_type', 'Neuron Activation Type: sigmoid, tanh, relu', String, 'sigmoid')
    this.option('neurons_1', 'Neurons in layer 1', Number, 50)
    this.option('activation_2_type', 'Neuron Activation Type: sigmoid, tanh, relu', String, 'tanh')
    this.option('neurons_2', 'Neurons in layer 2', Number, 10)
    this.option('depth', 'Generally the same as min_predict for accuracy', Number, 200)
    this.option('min_periods', 'Periods to train neural network with from', Number, 200)
    this.option('min_predict', 'Periods to predict next number from less than min_periods', Number, 20)
    this.option('momentum', 'momentum of prediction between 0 and 1 - 0 is stock', Number, 0.0)
    this.option('decay', 'decay of prediction, use teeny tiny increments beteween 0 and 1 - stock', Number, 0.001)
    this.option('threads', 'Number of processing threads you\'d like to run (best for sim - Possibly broken', Number, 1)
    this.option('learns', 'Number of times to \'learn\' the neural network with past data', Number, 10)
    this.option('learningrate', 'The learning rate of the neural network between 0 and 1 - 0.01 is stock', Number, 0.01)

    this.option('bollinger_size', 'period size', Number, 20)
    this.option('bollinger_time', 'times of standard deviation between the upper band and the moving averages', Number, 2)
    this.option('bollinger_upper_bound_pct', 'pct the current price should be near the bollinger upper bound before we sell', Number, 0)
    this.option('bollinger_lower_bound_pct', 'pct the current price should be near the bollinger lower bound before we buy', Number, 0)
  },
  calculate: function (s) {
    if(typeof s.brain === 'undefined') {
      s.brain = new NeuralNetwork(s.options)
    }
    bollinger(s, 'bollinger', s.options.bollinger_size)
  },
  onPeriod: function (s, cb) {
    var trendLinePredict = []
    var trendLineLearn = []
    // this thing is crazy run with trendline placed here. But there needs to be a coin lock so you dont buy late!
    const notInPreroll = !s.in_preroll
    const enoughLookbackPeriods = s.lookback[s.options.min_periods]
    if (notInPreroll && enoughLookbackPeriods) {
      var min_predict = lowerOfTheTwo(s.options.min_periods, s.options.min_predict)
      trendLineLearn = s.lookback.slice(0, s.options.min_periods)
      trendLinePredict = s.lookback.slice(0, min_predict)
      if(!s.trained && !s.training) {
        s.training = true
        s.brain.learn(new PriceData(s.lookback), min_predict).then(() => {
          s.trained = true
        })
      }

      // console.log('learn from ', trendLineLearn[0])
      // console.log(trendLineLearn)
      if(s.trained) {
        var item = trendLinePredict.reverse()
        // s.brain.backward(item)
        s.prediction = s.brain.predict(item)
      }
    }
    // NORMAL onPeriod STUFF here
    global.predi = s.prediction
    //something strange is going on here
    global.sig0 = global.predi > s.period.close
    // console.log(s)
    if (global.sig0 === false) {
      s.signal = 'sell'
    } else if(global.sig0 === true){
      s.signal = 'buy'
    } else {
      s.signal = null
    }
    cb()
  },
  onReport: function () {
    var cols = []
    cols.push(z(8, n(global.predi).format('0000.00000'), ' '))
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
