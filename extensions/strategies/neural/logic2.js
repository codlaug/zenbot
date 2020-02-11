

module.exports = function(s, weights, cb) {

  const {
    price_higher_diff: PRICE_HIGHER_AMOUNT,
    sell_prob: SELL_THRESHOLD,
    buy_prob: BUY_THRESHOLD,
    ema_buy: EMA_BUY_THRESHOLD,
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
  
  
  s.options.markdown_buy_pct = 0
//   s.options.markup_sell_pct = 0
  s.options.buy_pct_amount = null
//   s.options.sell_pct_amount = null
  
  const allSell = Object.values(downs).reduce((a, d) => a + d, 0)
  const allBuy = Object.values(ups).reduce((a, d) => a + d, 0)

  s.period.allSell = trend8.down
  s.period.allBuy = trend8.up
  s.period.triSell = trend18_3.down
  s.period.triBuy = trend18_3.up
  
  const midTrendDown = slope8 < 0
  const shortTrendUp = slope3 > 0
  const longTrendDown = slope18 < 0
  
  const priceIsHigher = (curPrice - avgPrice) / curPrice > PRICE_HIGHER_AMOUNT
  // const priceIsLower = priceDiff < -0.004
  const priceIsLower = (curPrice - ema) / curPrice < -0.002
  // const goingUp = slope2 > 0 && rateOfChangeOfRateOfChange > 0
  const underEma = curPrice < ema
  const overEma = curPrice > ema
  
  const emaChange = ema - s.lastEma
  
  const tSell = trend18_3.down
  const tBuy = trend18_3.up
  const sideways = 1 - tBuy - tSell

  const lSell = trend38.down
  const lBuy = trend38.up

  const { longEma } = s.period


  const curProfit = avgPrice > 0 ? (curPrice - avgPrice) / curPrice : 0
  s.highestProfit = Math.max(s.highestProfit, curProfit)
  const profitSlide = s.highestProfit - curProfit // TODO: make this a percentage of itself
  // console.log(s.highestProfit)

  const longEmaChange = longEma - s.lastLongEma

  const inSellTrend = s.sellTrend
  const inBuyTrend = s.buyTrend

  if(!inSellTrend) {
    if(tSell > SELL_THRESHOLD && tBuy < SELL_THRESHOLD) {
      s.sellTrend = true
    }
  } else if(inSellTrend) {
    // optimistic sell signal for larger moves 
    // tries to ride the snake until the top-ish
    if(tSell < SELL_THRESHOLD && longEmaChange < -0.1 && (s.highestProfit > 0.01 && profitSlide > 0.002)) {
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
    if(tSell > SELL_THRESHOLD && s.balance.asset > 1 && profitSlide > STOPLOSS) {
      // stoploss
      s.signal = 'sell'
      s.highestProfit = 0
      s.buyTrendStartPrice = null
      console.log('stoploss sell')
    }
  }

  if(!inBuyTrend) {
    if(tBuy > BUY_THRESHOLD && tSell < BUY_THRESHOLD) {
      s.buyTrend = true
      s.buyTrendCount = 1
      s.buyTrendStartEma = longEmaChange

    }
    if(longEmaChange < 0) {
      if(s.buyTrendStartPrice === null) {
        s.buyTrendStartPrice = curPrice
        console.log('set buyTrendPrice', s.buyTrendStartPrice)
      }
    }
  } else if(inBuyTrend) {
    if(tBuy > BUY_THRESHOLD && trend38.up > 0.54) {
      s.buyTrendCount += 1

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

    if(tBuy < BUY_THRESHOLD && lBuy < 0.54 && longEmaChange > -0.1) {
      
      console.log('end buy trend from price', s.buyTrendStartPrice - curPrice)
      if(s.buyTrendStartPrice - curPrice > 40.0) {
        s.signal = 'buy'
        s.options.buy_pct_amount = null
        s.options.markdown_buy_pct = 0.2
        
        console.log('buying at end of trend')
      }
      s.buyTrend = false
      s.buyTrendCount = 0
      s.buyTrendStartPrice = null
    }
  }

  // if(tBuy > 0.24 && s.balance.asset > 1 && (avgPrice - curPrice) / curPrice > STOPLOSS) {
  //   // stoploss
  //   s.signal = 'sell'
  // }

  


  s.lastLongEma = longEma
  
  // console.log(s.signal)
  console.log((avgPrice - curPrice) / curPrice)
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