var z = require('zero-fill')
  , n = require('numbro')
  , Phenotypes = require('../../../lib/phenotype')
  , Agent = require('../../../lib/reinforce')
  , ichimoku = require('../../../lib/ichimoku')

module.exports = {
  name: 'reinforce',
  description: 'Reinforcement Learning',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '2m')
    this.option('period_length', 'period length, same as --period', String, '2m')
    this.option('tenkenSenPeriods', 'Tenkan-sen (Conversion Line) Periods', Number, 9)                           //default 9
    this.option('kijunSenPeriods', 'Kijun-sen (Base Line) Periods', Number, 26)                                  //default 26
    this.option('senkouSpanPeriods', 'Senkou (Leading) Span B Periods', Number, 52)                              //default 52
    this.option('displacement', 'Displacement', Number, 26)  
    this.option('weakPoints', 'Weak Point Value', Number, 0.5)                                                   //range 0 - 2 Default = 0.5
    this.option('neutralPoints', 'Neutral Point Value', Number, 1)                                               //range 0 - 2 Default = 1
    this.option('strongPoints', 'Strong Point Value', Number, 2)                                                 //range 0 - 2 Default = 2
  },

  calculate: function (s) {
    // console.log('calculate', s)
    ichimoku(s, 'ichimoku', s.options.period)
    const {open, high, low, close, volume} = s.period
    if(!s.brain) {
      s.brain = Agent()
      
    }
    
    const { asset, currency } = s.balance
    let reward = 0
    if(asset === 0) {
      if(close > open) {
        // reward -= 1
        // reward -= (currency*(close-open))
        // console.log('currency', reward)
      }
    } else {
      if(close < open) {
        reward -= (asset*close)*(open-close)
        // console.log('asset', reward)
      } else if(open > close) {
        reward += (asset*close)*(close-open)
      }
    }
    s.reward = reward
    
    
  },

  onPeriod: function (s, cb) {
    // console.log('onPeriod', s)
    const {
      open,
      high,
      low,
      close,
      volume,
      tenkenSen,
      kijunSen,
      senkouA,
      senkouB,
      tkCrossScore,
      pkCrossScore,
      kumoBreakoutScore,
      senkouCrossScore,
      chikouCrossScore,
      pricePlacementScore,
      chikouPlacementScore
    } = s.period
    const brainInputs = [
      open,
      high,
      low,
      close,
      volume,
      tenkenSen,
      kijunSen,
      senkouA,
      senkouB,
      tkCrossScore,
      pkCrossScore,
      kumoBreakoutScore,
      senkouCrossScore,
      chikouCrossScore,
      pricePlacementScore,
      chikouPlacementScore
    ]
    // console.log(brainInputs)
    const action = s.brain.act(brainInputs)
    s.brain.learn(s.reward)

    s.signal = [null, 'buy', 'sell'][action]
    cb()
  },

  onReport: function (s) {
    // console.log('onReport', s)
    var cols = []
    // if (typeof s.period.rsi === 'number') {
    //   var color = 'grey'
    //   if (s.period.rsi <= s.options.oversold_rsi) {
    //     color = 'green'
    //   }
    //   if (s.period.rsi >= s.options.overbought_rsi) {
    //     color = 'red'
    //   }
    //   cols.push(z(4, n(s.period.rsi).format('0'), ' ')[color])
    // }
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
    rsi_periods: Phenotypes.Range(1, 200),
    oversold_rsi: Phenotypes.Range(1, 100),
    overbought_rsi: Phenotypes.Range(1, 100),
    rsi_recover: Phenotypes.Range(1, 100),
    rsi_drop: Phenotypes.Range(0, 100),
    rsi_divisor: Phenotypes.Range(1, 10)
  }
}

