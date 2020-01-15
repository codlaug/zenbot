let z = require('zero-fill')
  , n = require('numbro')
  , Phenotypes = require('../../../lib/phenotype')
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

const spawn = require('child_process').spawn


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
    return this.lookback.slice(0, n).map(i => i[key]).reverse().concat([this.period[key]])
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

    
    if(!s.fieldList) {
      s['Open', 'High', 'Low', 'Close', 'Volume', 'volume_adi', 'volume_obv', 'volume_cmf', 'volume_fi', 'volume_em', 
      'volume_sma_em', 'volume_vpt', 'volume_nvi', 'volatility_atr', 'volatility_bbm', 'volatility_bbh', 'volatility_bbl', 
      'volatility_bbw', 'volatility_bbhi', 'volatility_bbli', 'volatility_kcc', 'volatility_kch', 'volatility_kcl', 
      'volatility_kchi', 'volatility_kcli', 'volatility_dcl', 'volatility_dch', 'volatility_dchi', 'volatility_dcli', 
      'trend_macd', 'trend_macd_signal', 'trend_macd_diff', 'trend_ema_fast', 'trend_ema_slow', 'trend_adx', 'trend_adx_pos', 
      'trend_adx_neg', 'trend_vortex_ind_pos', 'trend_vortex_ind_neg', 'trend_vortex_ind_diff', 'trend_trix', 'trend_mass_index', 
      'trend_cci', 'trend_dpo', 'trend_kst', 'trend_kst_sig', 'trend_kst_diff', 'trend_ichimoku_a', 'trend_ichimoku_b', 
      'trend_visual_ichimoku_a', 'trend_visual_ichimoku_b', 'trend_aroon_up', 'trend_aroon_down', 'trend_aroon_ind', 
      'trend_psar', 'trend_psar_up', 'trend_psar_down', 'trend_psar_up_indicator', 'trend_psar_down_indicator', 'momentum_rsi', 
      'momentum_mfi', 'momentum_tsi', 'momentum_uo', 'momentum_stoch', 'momentum_stoch_signal', 'momentum_wr', 'momentum_ao', 
      'momentum_roc', 'others_dr', 'others_dlr', 'others_cr']
    }

    if(!CAPTURING && !s.pythonProcess) {
      s.pythonProcess = new PythonShell('hello2.py')
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

      if(s.my_trades[i].type === 'buy') {
        s.costBasis.append(parseFloat(s.my_trades[i].size)-s.my_trades[i].fee, parseFloat(s.my_trades[i].price))
      } else if(s.my_trades[i].type === 'sell') {
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
    
    // tulind.indicators.ad.indicator([s.highs(1), s.lows(1), s.closes(1), s.volumes(1)], [], (err, results) => {
    //   s.period.volume_adi = results[0][1]
    // })
    // tulind.indicators.obv.indicator([s.closes(1), s.volumes(1)], [], (err, results) => {
    //   console.log(results)
    //   s.period.volume_obv = results[0][1]
    // })


    global.avgPrice = s.costBasis.avgPrice()

    function pythonHandler(data) {
      // console.log(data)
      // const weights = data.toString().split(' ').map(i => parseFloat(i))
      
      // console.log(weights)
      // if (weights[0] > weights[1] && weights[0] > weights[2]) {
      //   s.signal = 'sell'
      // } else if(weights[1] > weights[0] && weights[1] > weights[2]){
      //   s.signal = 'buy'
      // } else {
      //   s.signal = null
      // }
      const avgPrice = s.costBasis.avgPrice()

      const nextPrice = parseFloat(data)
      global.predicted = nextPrice
      if(avgPrice == 0 && nextPrice < s.period.close) {
        s.signal = 'buy'
      } else if(nextPrice - avgPrice > 20) {
        s.signal = 'sell'
      } else if(nextPrice - avgPrice < -20) {
        s.signal = 'buy'
      }

      s.pythonProcess.off('message', pythonHandler)
      cb()
    }

    if(!CAPTURING) {
      const MIN_PERIODS = 28
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

        s.pythonProcess.on('message', pythonHandler)

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
  onReport: function () {
    var cols = []
    cols.push(z(8, n(global.predicted).format('0000.00000'), ' '))
    cols.push(typeof global.avgPrice !== 'undefined' ? global.avgPrice.toString() : '')
    // cols.push(typeof global.bestAction !== 'undefined' ? global.bestAction.toString() : '')
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
