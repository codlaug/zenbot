
let z = require('zero-fill')
  , n = require('numbro')
  , Phenotypes = require('../../../lib/phenotype')
  // , colors = require('colors')
  // , chalk = require('chalk')
  // , bollinger = require('./bollinger')
  // , rsi = require('../../../lib/rsi')
  // , tf = require('@tensorflow/tfjs')
  , fs = require('fs')
  // , TradingAgent = require('./trading_agent')
  // , { TradingGame } = require('./trading_game')
  // , getStateTensor = require('./get_state_old')
  // , ichimoku = require('./ichimoku')
  , ema = require('../../../lib/ema')
  // , adx = require('./adx')
  // , macd = require('./macd')
  // , stochastic = require('./stochastic')
  // , parabolicSAR = require('./parabolic_sar')
// const { onPeriodSimulating, onPeriodTraining } = require('./on_period')
// const IOHandler = require('./io_handler')
const logic = require('./logic4')
const {MinMaxScaler} = require('machinelearn/preprocessing')
const { PythonShell } = require('python-shell')
const CostBasisCollection = require('./cost_basis')
const pythonHandler = require('./python_handler3')
const ss = require('simple-statistics')
const onReport = require('./on_report')

// const spawn = require('child_process').spawn


// setInterval(log, 10000)


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

// const client = new MongoClient('mongodb://localhost:27017')


module.exports = {
  name: 'neural',
  description: 'Use neural learning to predict future price. Buy = mean(last 3 real prices) < mean(current & last prediction)',
  getOptions: function () {
    this.option('period', 'Period length - longer gets a better average', String, '30s')
    this.option('period_length', 'Period length set same as --period', String, '30s')
    this.option('price_higher_diff', '', Number, 0.04)
    // this.option('sell_trend_start_net_prob_amount', '', Number, 1.4)
    // this.option('sell_trend_start_ema_amount', '', Number, 1.4)
    // this.option('sell_trend_count_threshold_1', '', Number, 13)
    // this.option('sell_trend_1_ema', '', Number, 1.0)
    // this.option('sell_trend_1_markup', '', Number, 0.2)
    // this.option('sell_trend_count_threshold_2', '', Number, 11)
    // this.option('sell_trend_2_ema', '', Number, 2.0)
    // this.option('sell_trend_2_prob_threshold', '', Number, 2.4)
    // this.option('sell_trend_increase_prob', '', Number, 2.3)
    // this.option('sell_trend_end_prob', '', Number, 2.0)
    // this.option('sell_trend_end_ema', '', Number, 1.0)
    // this.option('sell_trend_end_signal_threshold', '', Number, 8)
    // this.option('buy_trend_start_prob_threshold', '', Number, 2.1)
    // this.option('buy_trend_start_ema_threshold', '', Number, -1.0)
    // this.option('buy_trend_count_1_threshold', '', Number, 7)
    // this.option('buy_trend_ema_1_threshold', '', Number, -1.0)
    // this.option('buy_trend_1_markdown', '', Number, 0.1)
    // this.option('buy_trend_count_2_threshold', '', Number, 11)
    // this.option('buy_trend_ema_2_threshold', '', Number, -4.0)
    // this.option('buy_trend_prob_2_threshold', '', Number, 2.5)
    // this.option('buy_trend_2_markdown', '', Number, 0.1)
    // this.option('buy_trend_count_3_threshold', '', Number, 11)
    // this.option('buy_trend_ema_3_threshold', '', Number, -4.0)
    // this.option('buy_trend_prob_3_threshold', '', Number, 2.3)
    // this.option('buy_trend_3_markdown', '', Number, 0.1)
    // this.option('buy_trend_increase_prob', '', Number, 2.5)
    // this.option('buy_trend_increase_ema', '', Number, -5.5)
    // this.option('buy_trend_end_prob', '', Number, 2.0)
    // this.option('buy_trend_end_ema', '', Number, -0.2)
    // this.option('buy_trend_end_count_signal_threshold', '', Number, 21)
    this.option('sell_prob', '', Number, 0.38)
    this.option('buy_prob', '', Number, 0.56)
    this.option('l_buy_prob', '', Number, 0.598)
    this.option('stoploss', '', Number, 0.0089)
    this.option('sell_ema_change', '', Number, -0.098)
    this.option('buy_ema_change', '', Number, -1.0)
    this.option('profit_high_point', '', Number, 0.0048)
    this.option('profit_slide', '', Number, 0.0012)
    
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

    // console.log(s)

    // if(typeof s.predictStore === 'undefined') {
    //   client.connect(function(err, client) {
    //     const db = client.db('zenbot_custom')
    //     s.predictStore = db.collection('inserts')
    //   })
    // }

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
    ema(s, 'shortEma', 9)
    ema(s, 'longEma', 96)
    ema(s, 'veryLongEma', 196)


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

    if(typeof s.sellTrendCount === 'undefined') {
      s.sellTrendCount = 0
      s.buyTrendCount = 0
    }
    if(typeof s.buyTrendStartPrice === 'undefined') {
      s.buyTrendStartPrice = null
      s.highestProfit = 0
      s.buyTrendStartEma = 0
      s.stopLossCooldown = 0
      s.buyCooldown = 0
      s.buyTimer = 0
    }

    // s.period.sidewaysSma = s.lookback.slice(0, 48).reduce((s,{sideways: v}) => s+v, 0) / 48.0
    

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
        let add = parseFloat(s.my_trades[i].size)-(s.my_trades[i].fee)
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

    // if(s.lookback.length > 37) {
      // console.log(s.period.close)
      // const lastSlope = s.slope2
      // const closes = s.closes(38)
      // s.slope3 = ss.linearRegression(closes.slice(-3).map((c,i) => [i,c])).m
      // s.slope8 = ss.linearRegression(closes.slice(-8).map((c,i) => [i,c])).m
      // s.slope18 = ss.linearRegression(closes.slice(-18).map((c,i) => [i,c])).m
      // s.slope38 = ss.linearRegression(closes.map((c,i) => [i,c])).m

      // s.rollingAverageClose = closes.slice(-12).reduce((c,s) => c+s, 0) / 12.0
      // global.rollingAverageClose = s.rollingAverageClose
      // console.log(s.slope2)
      // global.slope3 = s.slope3
      // global.slope8 = s.slope8
      // global.slope18 = s.slope18
      // global.slope38 = s.slope38

      // if(lastSlope) {
      //   s.rateOfChangeRateOfChange = s.slope2.m - lastSlope.m
      //   global.rateOfChangeRateOfChange = s.rateOfChangeRateOfChange
      // }
    // }

    if(typeof s.trend === 'undefined') {
      s.trend = null
    }
    if(typeof s.lastEma === 'undefined') {
      s.lastEma = s.period.close
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
      if(!s.in_preroll && s.lookback.length >= MIN_PERIODS+20) {
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
          // console.log('pyHandler cb')
          cb()
        })

        if(s.options.mode === 'sim') {
          s.predictStore.findOne({period_id: s.period.period_id}, function(err, result){
            if(result) {
              logic(s, result.weights, cb)
            } else {
              s.pythonProcess.on('message', pyHandler)
              s.pythonProcess.send([s.timestamps(size), s.opens(size), s.highs(size), s.lows(size), s.closes(size), s.volumes(size)].join(' '))
            }
          })
        } else {
          s.pythonProcess.on('message', pyHandler)
          s.pythonProcess.send([s.timestamps(size), s.opens(size), s.highs(size), s.lows(size), s.closes(size), s.volumes(size)].join(' '))
        }
        
        
        // console.log('setTimeout')
        

        // console.log(asset, 'and', s.costBasis.num_shares())
        // console.log('asset', assetPosition)
        // console.log('currency', currencyPosition)
        // console.log('profit', profit)
        // s.pythonProcess.send([s.timestamps(size), s.opens(size), s.highs(size), s.lows(size), s.closes(size), s.volumes(size), assetPosition, currencyPosition, profit, avgCostBasis].join(' '))
        // console.log('py send')

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

  onExit: function(s) {
    s.pythonProcess.end(function (err,code,signal) {
      // if (err) throw err
      // console.log('The exit code was: ' + code)
      // console.log('The exit signal was: ' + signal)
      // console.log('finished')
    })
  },

  phenotypes: {
    // -- common
    period_length: Phenotypes.RangePeriod(30, 30, 's'),
    // min_periods: Phenotypes.Range(90, 100),
    // markdown_buy_pct: Phenotypes.RangeFloat(-0.533, 2.533),
    // markup_sell_pct: Phenotypes.RangeFloat(0.201, 0.580),
    // order_type: Phenotypes.ListOption(['maker', 'taker']),
    max_slippage_pct: Phenotypes.RangeFloat(0.01, 1.21),
    sell_stop_pct: Phenotypes.Range0(1, 50),
    buy_stop_pct: Phenotypes.Range0(1, 50),
    profit_stop_enable_pct: Phenotypes.Range0(1, 20),
    profit_stop_pct: Phenotypes.Range(1, 20),

    sell_prob: Phenotypes.RangeFloat(0.30, 0.50),
    buy_prob: Phenotypes.RangeFloat(0.50, 0.70),
    buy_ema_change: Phenotypes.RangeFloat(-2.0, 0.0),
    // stoploss: Phenotypes.RangeFloat(0.007, 0.011),

    // l_buy_prob: Phenotypes.RangeFloat(0.578, 0.618),
    
    // sell_ema_change: Phenotypes.RangeFloat(-0.118, -0.079),
    
    // profit_high_point: Phenotypes.RangeFloat(0.0078, 0.0118),
    // profit_slide: Phenotypes.RangeFloat(0.0008, 0.0028),


    // price_higher_diff: Phenotypes.RangeFloat(0.0, 0.06),
    // sell_trend_start_net_prob_amount: Phenotypes.RangeFloat(1.4, 2.6),
    // sell_trend_start_ema_amount: Phenotypes.RangeFloat(0.5, 2.0),
    
    // sell_trend_increase_prob: Phenotypes.RangeFloat(2.3, 2.5),
    // sell_trend_end_prob: Phenotypes.RangeFloat(1.9, 2.5),
    // sell_trend_end_ema: Phenotypes.RangeFloat(0.1, 1.0),
    // sell_trend_end_signal_threshold: Phenotypes.Range(4, 28),
    // buy_trend_start_prob_threshold: Phenotypes.RangeFloat(1.8, 2.2),
    // buy_trend_start_ema_threshold: Phenotypes.RangeFloat(-2.0, 0.8),
    
    // buy_trend_increase_prob: Phenotypes.RangeFloat(2.1, 2.6),
    // buy_trend_increase_ema: Phenotypes.RangeFloat(-6.0, 1.0),
    // buy_trend_end_prob: Phenotypes.RangeFloat(2.0, 2.4),
    // buy_trend_end_ema: Phenotypes.RangeFloat(-0.7, 0.6),
    // buy_trend_end_count_signal_threshold: Phenotypes.Range(7, 31)
  }
}
