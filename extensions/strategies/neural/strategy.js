let z = require('zero-fill')
  , n = require('numbro')
  , Phenotypes = require('../../../lib/phenotype')
  , colors = require('colors')
  , chalk = require('chalk')
  , bollinger = require('./bollinger')
  , rsi = require('../../../lib/rsi')
  , tf = require('@tensorflow/tfjs')
  , fs = require('fs')
  , TradingAgent = require('./trading_agent')
  , { TradingGame } = require('./trading_game')
  , getStateTensor = require('./get_state_old')
  , ichimoku = require('./ichimoku')
  , ema = require('../../../lib/ema')
  , adx = require('./adx')
  , macd = require('./macd')
  , stochastic = require('./stochastic')
  , parabolicSAR = require('./parabolic_sar')
const { onPeriodSimulating, onPeriodTraining } = require('./on_period')
const IOHandler = require('./io_handler')
const {MinMaxScaler} = require('machinelearn/preprocessing')
const { PythonShell } = require('python-shell')
const CostBasisCollection = require('./cost_basis')
const pythonHandler = require('./python_handler3')
const ss = require('simple-statistics')
const onReport = require('./on_report')

// const spawn = require('child_process').spawn


const TRAINING = false
const CAPTURING = false



function lowerOfTheTwo(a, b) {
  return a < b ? a : b
}

// the below line starts you at 0 threads
global.forks = 0
// the below line is for calculating the last mean vs the now mean.

function getLastXValues(key) {
  return function(n) {
    return this.lookback.slice(0, n-1).map(i => i[key]).reverse().concat([this.period[key]])
  }
}

const scaler = new MinMaxScaler({ featureRange: [0, 1] })



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
    if(TRAINING) {
      if(typeof s.rewards === 'undefined') {
        s.rewards = []
      }
      if(typeof s.game === 'undefined') {
        s.game = new TradingGame({})
      }
    } else {
      if(typeof s.game === 'undefined') {
        s.game = null
      }
      // if(typeof s.predictor === 'undefined') {
      //   if(fs.existsSync('predictor/model.json')) {
      //     s.predictor = null
      //     tf.loadLayersModel(IOHandler('predictor')).then((model) => {
      //       s.predictor = model
      //       console.log('loaded existing predictor model')
      //       s.predictorModelLoaded = true
      //     }).catch(e => { console.log('error', e)})
      //   } else {
      //     console.log('no model found to load')
      //     s.predictorModelLoaded = true
      //   }
      // }
      if(false && typeof s.decider === 'undefined') {
        if(fs.existsSync('decider/model.json')) {
          s.decider = null
          tf.loadGraphModel(IOHandler('decider')).then((model) => {
            s.decider = model
            console.log('loaded existing decider model')
            s.deciderModelLoaded = true
          }).catch(e => { console.log('error', e)})
        } else {
          console.log('no model found to load')
          s.deciderModelLoaded = true
        }
      }
    }
    if(false && typeof s.agent === 'undefined') {
      s.agent = new TradingAgent(s.game, s.options)
      if(fs.existsSync('brain/model.json')) {
        s.agent.load().then(() => {
          console.log('loaded existing model')
          s.modelLoaded = true
        }).catch(e => { console.log('error', e)})
      } else {
        console.log('no model found to load')
        s.modelLoaded = true
      }
    }

    if(CAPTURING && typeof s.stream === 'undefined') {
      s.stream = fs.createWriteStream('testdata.json', {flags:'a'})
      s.stream.write('[')
    }

    // bollinger(s)
    // ema(s, 'trend_ema', s.options.min_periods)
    // if (typeof s.period.trend_ema !== 'undefined') {
    //   s.trend = s.period.trend_ema > s.lookback[0].trend_ema ? 'up' : 'down'
    // }
    // rsi(s, 'rsi', s.options.rsi_periods)
    // ichimoku(s)
    // adx(s)
    // stochastic(s)
    // macd(s)
    // parabolicSAR(s)


    if(!s.highs) {
      s.highs = getLastXValues('high').bind(s)
    }

    if(!s.closes) {
      s.closes = getLastXValues('close').bind(s)
    }
    if(!s.lows) {
      s.lows = getLastXValues('low').bind(s)
    }
    if(!s.volumes) {
      s.volumes = getLastXValues('volume').bind(s)
    }
    if(!s.opens) {
      s.opens = getLastXValues('open').bind(s)
    }
    if(!s.timestamps) {
      s.timestamps = getLastXValues('time').bind(s)
    }

    

    if(!CAPTURING && !s.pythonProcess) {
      s.pythonProcess = new PythonShell('hello3.py')
      s.pythonProcess.receiveStderr(function (err,code,signal) {
        if (err) console.log(err)
        console.log('The exit code was: ' + code)
        console.log('The exit signal was: ' + signal)
        console.log('finished')
        console.log('finished')
      })
      console.log('python init')
    }

    if(!s.costBasis) {
      s.costBasis = new CostBasisCollection()
    }
    
    if(typeof s.lastOrderId === 'undefined') {
      s.lastOrderId = 1000
    }
    for(let i = 0; i < s.my_trades.length; ++i) {
      if(s.my_trades[i].order_id <= s.lastOrderId) continue
      // console.log(s.my_trades[i])
      if(s.my_trades[i].type === 'buy') {
        let add = parseFloat(s.my_trades[i].size)-(s.my_trades[i].orig_fee)
        s.costBasis.append(add, parseFloat(s.my_trades[i].price))
      } else if(s.my_trades[i].type === 'sell') {
        
        s.costBasis.remove(parseFloat(s.my_trades[i].size))
      }
    }
    if(s.my_trades.length) {
      s.lastOrderId = s.my_trades[s.my_trades.length-1].order_id
    }

    // correct a diff I can't find
    if(s.costBasis.num_shares() !== s.balance.asset) {
      if(s.costBasis.num_shares() > s.balance.asset) {
        const diff = s.costBasis.num_shares() - s.balance.asset
        s.costBasis.remove(diff)
      }
    }

    if(!s.inWarmupPhase) {
      s.inWarmupPhase = true
    }

    if(s.lookback.length > 36) {
      // console.log(s.period.close)
      // const lastSlope = s.slope2
      const closes = s.closes(38)
      s.slope3 = ss.linearRegression(closes.slice(-3).map((c,i) => [i,c])).m
      s.slope8 = ss.linearRegression(closes.slice(-8).map((c,i) => [i,c])).m
      s.slope18 = ss.linearRegression(closes.slice(-18).map((c,i) => [i,c])).m
      s.slope38 = ss.linearRegression(closes.map((c,i) => [i,c])).m
      // console.log(s.slope2)
      global.slope3 = s.slope3
      global.slope8 = s.slope8
      global.slope18 = s.slope18
      global.slope38 = s.slope38
      // if(lastSlope) {
      //   s.rateOfChangeRateOfChange = s.slope2.m - lastSlope.m
      //   global.rateOfChangeRateOfChange = s.rateOfChangeRateOfChange
      // }
    }

    if(typeof s.periodCount === 'undefined') {
      s.periodCount = -20 // starts a few periods back
    }

    if(typeof s.trendLength === 'undefined') {
      s.trendLength = 0
    }

    if(typeof s.trendPoints === 'undefined') {
      s.trendPoints = []
    }

    if(s.trendPoints.length > 1) {
      // console.log(s.trendPoints)
      s.trendStrength = ss.linearRegression(s.trendPoints)
      // console.log(s.trendStrength)
      global.trendStrength = s.trendStrength.m
    }
    
  },
  // onPeriod: TRAINING ? onPeriodTraining : onPeriodSimulating,
  onPeriod: function(s, cb) {
    // console.log(s.period)
    
    // tulind.indicators.ad.indicator([s.highs(1), s.lows(1), s.closes(1), s.volumes(1)], [], (err, results) => {
    //   s.period.volume_adi = results[0][1]
    // })
    // tulind.indicators.obv.indicator([s.closes(1), s.volumes(1)], [], (err, results) => {
    //   console.log(results)
    //   s.period.volume_obv = results[0][1]
    // })

    s.periodCount +=1
    global.periodCount = s.periodCount


    global.avgPrice = s.costBasis.avgPrice()

    if(!CAPTURING) {
      const MIN_PERIODS = 28+48
      if(s.lookback.length >= MIN_PERIODS+20) {
        const size = MIN_PERIODS+20
        
        let { asset, currency } = s.balance
        asset = parseFloat(asset)
        currency = parseFloat(currency)
        const portfolioValue = currency + asset * s.period.close
        const assetPosition = asset / (asset + currency / s.period.close)
        const currencyPosition = currency / portfolioValue

        const profit = s.start_capital ? (portfolioValue - s.start_capital) / s.start_capital : 0

        const avgCostBasis = (s.period.close - s.costBasis.avgPrice()) / Math.max(s.period.close, s.costBasis.avgPrice())

        // console.log(s.my_trades)

        const pyHandler = pythonHandler(s, () => {
          s.pythonProcess.off('message', pyHandler)
          cb()
        })

        s.pythonProcess.on('message', pyHandler)

        // console.log(asset, 'and', s.costBasis.num_shares())
        // console.log('asset', assetPosition)
        // console.log('currency', currencyPosition)
        // console.log('profit', profit)
        // s.pythonProcess.send([s.timestamps(size), s.opens(size), s.highs(size), s.lows(size), s.closes(size), s.volumes(size), assetPosition, currencyPosition, profit, avgCostBasis].join(' '))
        s.pythonProcess.send([s.timestamps(size), s.opens(size), s.highs(size), s.lows(size), s.closes(size), s.volumes(size)].join(' '))

        // const process = spawn('python3', ['hello.py', s.timestamps(size), s.opens(size), s.highs(size), s.lows(size), s.closes(size), s.volumes(size)])
        // console.log(['hello.py', s.timestamps(size), s.opens(size), s.highs(size), s.lows(size), s.closes(size), s.volumes(size)].join(' '))
        // process.stderr.on('data', function(data) { 
        //   console.log(data.toString())
        // } ) 

        // process.stdout.on('data', function(data) {
        //   const weights = data.toString().slice(2, -3).split(' ').filter(i => i !== '').map(i => parseFloat(i))
          
        //   // if(data) {
        //   //   const keyVals = data.toString().split('\n')
        //   //   for(let i = 5; i < keyVals.length; ++i) {
        //   //     const [key, value] = keyVals[i].split(' ')
        //   //     s.period[key] = parseFloat(value)
        //   //   }
        //   //   console.log(s.period)
        //   // }
        //   // if(data) {
        //   //   const trimmed = data.toString().slice(1, -2)
        //   //   const arr = trimmed.split(' ').filter(i => i !== '').map(i => parseFloat(i))
        //   //   console.log(arr)
        //   //   const predictedAction = s.decider.predict(tf.tensor([arr]))
        //   //   console.log(predictedAction)
        //   // }
        //   // console.log(weights[1] - weights[0])
        //   if (weights[0] > weights[1]) {
        //     s.signal = 'sell'
        //   } else if(weights[1] > weights[0]){
        //     s.signal = 'buy'
        //   } else {
        //     s.signal = null
        //   } 
        //   cb()
        // })
        
      } else {
        cb()
      }
    } else if(CAPTURING) {
      s.stream.write(JSON.stringify(s.period)+',')
      cb()
    } else {
      cb()
    }

    // console.log(s.period)
    // s.getQuote((err, quote) => {
    //   console.log('bid', quote.bid)
    //   console.log('ask', quote.ask)
    //   cb()
    // })
    // s.stream.write(JSON.stringify(s.period)+',')
    // cb()
  },
  afterPeriod: function(s, cb) {
    // console.log('after')
    // s.agent.completeStep(s)
    cb()
  },
  onReport: onReport,

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
