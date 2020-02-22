const emaFunc = require('../../../lib/ema')

module.exports = function(s, weights, cb) {

  const {
    // price_higher_diff: PRICE_HIGHER_AMOUNT,
    sell_prob: SELL_THRESHOLD,
    sell_ema_change: SELL_EMA_THRESHOLD,
    buy_prob: BUY_THRESHOLD,
    profit_high_point: PROFIT_HIGH_POINT,
    profit_slide: PROFIT_SLIDE,
    l_buy_prob: L_BUY_THRESHOLD,
    stoploss: STOPLOSS
  } = s.options

  s.signal = null
  const curPrice = s.period.close
  const lastPrice = s.lookback[0].close
  const avgPrice = s.costBasis.avgPrice()
  const noAssets = avgPrice === 0
  const priceDiff = avgPrice !== 0 ? (curPrice - avgPrice) / curPrice : 0
  const trendDiff = (curPrice - s.trendStartPrice) / curPrice
  const { slope3, slope8, slope18, slope38, rollingAverageClose: avgClose } = s

  const trend3 = {
    down: weights[0],
    up: weights[1]
  }
  
  const trend8 = {
    down: weights[2],
    up: weights[3]
  }
  
  const trend18 = {
    down: weights[4],
    up: weights[5]
  }
  
  const trend38 = {
    down: weights[6],
    up: weights[7]
  }
  
  const downs = {
    trend3: weights[0],
    trend8: weights[2],
    trend18: weights[4],
    trend38: weights[6]
  }
  
  const ups = {
    trend3: weights[1],
    trend8: weights[3],
    trend18: weights[5],
    trend38: weights[7]
  }
  
  const ema = weights[8]
  
  const trend18_3 = {
    down: weights[9],
    up: weights[10]
  }
  
  // console.log(s.period.ema, ema)
  
  

  // TODO: In genetic sims, markup and markdown can vary a lot
  //       maybe I can make it smarter

  // s.options.markdown_buy_pct = 0
  //   s.options.markup_sell_pct = 0
  s.options.buy_pct_amount = null
  //   s.options.sell_pct_amount = null
  
  const allSell = Object.values(downs).reduce((a, d) => a + d, 0)
  const allBuy = Object.values(ups).reduce((a, d) => a + d, 0)

  s.period.allSell = trend8.down
  s.period.allBuy = trend8.up
  s.period.triSell = trend18_3.down
  s.period.triBuy = trend18_3.up

  emaFunc(s, 'buyTrendEma', 6, 'allBuy')
  s.period.buyTrendRateOfChange = s.period.buyTrendEma - s.lookback[0].buyTrendEma
  
  const midTrendDown = slope8 < 0
  const shortTrendUp = slope3 > 0
  const longTrendDown = slope18 < 0
  
  // const priceIsHigher = (curPrice - avgPrice) / curPrice > PRICE_HIGHER_AMOUNT
  // const priceIsLower = priceDiff < -0.004
  // const priceIsLower = (curPrice - ema) / curPrice < -0.002
  // const goingUp = slope2 > 0 && rateOfChangeOfRateOfChange > 0
  // const underEma = curPrice < ema
  // const overEma = curPrice > ema

  console.log(s.period.buyTrendEma)
  
  const emaChange = ema - s.lastEma
  
  const tSell = trend18_3.down
  const tBuy = trend18_3.up
  const sideways = 1 - tBuy - tSell

  const lSell = trend8.down
  const lBuy = trend8.up

  const { longEma, veryLongEma } = s.period

  // console.log(sideways)


  const curProfit = avgPrice > 0 ? (curPrice - avgPrice) / curPrice : 0
  s.highestProfit = Math.max(s.highestProfit, curProfit)
  const profitSlide = s.highestProfit - curProfit // TODO: make this a percentage of itself
  // console.log(s.highestProfit)

  const longEmaChange = longEma - s.lastLongEma
  const veryLongEmaChange = veryLongEma - s.lastVeryLongEma

  const inSellTrend = s.sellTrend
  const inBuyTrend = s.buyTrend

  if(!inSellTrend) {
    if(tSell > SELL_THRESHOLD && tBuy < SELL_THRESHOLD) {
      s.sellTrend = true
    }
  } else if(inSellTrend) {
    // optimistic sell signal for larger moves 
    // tries to ride the snake until the top-ish
    if(tSell < SELL_THRESHOLD && longEmaChange < SELL_EMA_THRESHOLD && (s.highestProfit > PROFIT_HIGH_POINT && profitSlide > PROFIT_SLIDE)) {
      s.signal = 'sell'
      s.sellTrend = false
      s.highestProfit = 0
      s.buyTrendStartPrice = null
      console.log('large sell')
    }
    // "normal" wave-riding sell signal
    // if(lSell > 0.61 && s.highestProfit > 0.003) {
    //   s.signal = 'sell'
    //   s.highestProfit = 0
    //   s.buyTrendStartPrice = null
    //   console.log('normal sell')
    // }
    // TODO: pessimistic sell signal / stoploss
    // console.log(s.stopLossCooldown)
    if(tSell > SELL_THRESHOLD && s.balance.asset > 1 && profitSlide > STOPLOSS && s.stopLossCooldown <= 0) {
      if(s.uncertaintyCounter >= 3) {
        s.stopLossCooldown = 25
      } else {
        // stoploss
        s.signal = 'sell'
        s.highestProfit = 0
        s.buyTrendStartPrice = null
        console.log('stoploss sell')
        s.buyCooldown = 40
      }
    }
  }

  if(s.stopLossCooldown > 0) {
    s.stopLossCooldown -= 1
  }
  console.log(veryLongEmaChange)
  if(veryLongEmaChange > -0.01) {
    s.buyCooldown = 0
  }

  if(s.emaTrend === 'down') {
    if(longEmaChange > 0.1) {
      s.buyTrendStartPrice = curPrice
      s.emaTrend = 'up'
    }
  } else if(s.emaTrend === 'up') {
    if(longEmaChange < -0.1) {
      s.buyTrendStartPrice = curPrice
      s.emaTrend = 'down'
    }
  } else {
    s.emaTrend = longEmaChange > 0 ? 'up' : 'down'
  }

  if(!inBuyTrend) {
    if(tBuy > BUY_THRESHOLD && tSell < BUY_THRESHOLD) {
      s.buyTrend = true
      s.buyTrendCount = 1
      s.buyTrendStartEma = longEmaChange

    }
  } else if(inBuyTrend) {
    if(tBuy > BUY_THRESHOLD && trend38.up > 0.54) {
      s.buyTrendCount += 1
    }
    if(tBuy < BUY_THRESHOLD) {
      s.buyTrend = false
    }
    
    // movement already happening and we want in
    // if(tSell > BUY_THRESHOLD && longEmaChange > EMA_BUY_THRESHOLD) {
    //   console.log('buying reactively', longEmaChange)
    //   s.signal = 'buy'
    //   // s.buyTrendStartPrice = null
    // }
    // opportunistic buy signal
    // if(longEma - curPrice > 30 && ema > 0.0) {
    //   s.signal = 'buy'
    //   s.options.buy_pct_amount = 20.0
    //   s.options.markdown_buy_pct = 0.005 * -emaChange
      
    //   console.log('buying opportunisticly', s.options.markdown_buy_pct)
    // }

    console.log(s.buyTrendStartPrice - curPrice)
    if(lBuy > L_BUY_THRESHOLD && tBuy > 0.50 && s.buyTrendStartPrice - curPrice > 30 && s.buyCooldown <= 0) {
      s.signal = 'buy'
    }
  }

  // uncertainty!! Jan 21st for instance
  // use this to signal NOT to stoploss sell
  if(sideways > 0.73) {
    s.uncertaintyCounter += 1
  } else {
    s.uncertaintyCounter = 0
  }

  // PANIC!!! Jan 19th for instance
  // console.log(trend18.up - s.lastTrend18Up)
  if(trend18.up - s.lastTrend18Up > 0.2) {
    console.log('panic')
    s.signal = 'sell'
  }

  // if(tBuy > 0.24 && s.balance.asset > 1 && (avgPrice - curPrice) / curPrice > STOPLOSS) {
  //   // stoploss
  //   s.signal = 'sell'
  // }

  

  s.lastTrend18Up = trend18.up

  s.lastLongEma = longEma
  s.lastVeryLongEma = veryLongEma
  
  // console.log(s.signal)
  //   console.log((avgPrice - curPrice) / curPrice)
  // if((avgPrice - curPrice) / curPrice < -0.05) {
  //   s.signal = 'sell'
  // }
  
          
  // const long = [weights[4], weights[5]]
  global.trend18_3 = trend18_3
  global.trend3 = trend3
  global.trend8 = trend8
  global.trend18 = trend18
  global.trend38 = trend38
  global.trend = s.trend
  global.trendDiff = trendDiff
  global.trendLength = {buy: s.buyTrendCount, sell: s.sellTrendCount }
  global.ema = emaChange
  

  cb()
}