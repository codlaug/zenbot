const emaFunc = require('../../../lib/ema')
const smoothedZScore = require('./z_score')

const ONE_HOUR = 3600000
const HALF_HOUR = 1800000

module.exports = function(s, weights, cb) {

  const {
    // price_higher_diff: PRICE_HIGHER_AMOUNT,
    sell_prob: SELL_THRESHOLD,
    sell_ema_change: SELL_EMA_THRESHOLD,
    buy_prob: BUY_THRESHOLD,
    buy_ema_change: BUY_EMA,
    profit_high_point: PROFIT_HIGH_POINT,
    profit_slide: PROFIT_SLIDE,
    ema_dip_point: EMA_DIP_POINT,
    ema_rebound: EMA_REBOUND,
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

  s.options.markdown_buy_pct = 0.5
  s.options.markup_sell_pct = 1.0
  s.options.buy_pct_amount = null
  //   s.options.sell_pct_amount = null

  if(s.options.old_max_slippage_pct) {
    s.options.max_slippage_pct = s.options.old_max_slippage_pct
  }
  
  const allSell = Object.values(downs).reduce((a, d) => a + d, 0)
  const allBuy = Object.values(ups).reduce((a, d) => a + d, 0)

  s.period.allSell = trend8.down
  s.period.allBuy = trend8.up
  s.period.triSell = trend18_3.down
  s.period.triBuy = trend18_3.up

  emaFunc(s, 'buyTrendEma', 26, 'allBuy')
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

  // console.log(s.period.buyTrendEma)
  
  const emaChange = ema - s.lastEma
  
  const tSell = trend18_3.down
  const tBuy = trend18_3.up
  const sideways = 1 - tBuy - tSell

  const lSell = trend8.down
  const lBuy = trend8.up

  const { longEma, veryLongEma, ultraLongEma, shortEma } = s.period

  console.log('ultraLongEma', ultraLongEma)
  console.log('last', s.lastUltraLongEma)
  const ultraLongEmaChange = ultraLongEma - s.lastUltraLongEma

  let generalTrend = null
  // if(s.lookback[196]) {
  //   if(curPrice < s.lookback[196].close - 60) {
  //     generalTrend = 'down'
  //   } else if(curPrice > s.lookback[196].close + 80) {
  //     generalTrend = 'up'
  //   }
  // }
  if(!isNaN(ultraLongEmaChange)) {
    if(ultraLongEmaChange > 0.15) {
      generalTrend = 'up'
    } else if(ultraLongEmaChange < -0.15) {
      generalTrend = 'down'
    }
  }
  const downwardTrend = generalTrend === 'down'
  const upwardTrend = generalTrend === 'up'



  // console.log(sideways)

  if(tBuy > 0.34) {
    s.buyTrendCount += 1
    s.buyTrend = true
  } else {
    if(s.buyTrendCount > 5) {
      s.buyTrendSuffixCount = 4
    }
    s.buyTrendCount = 0
    s.buyTrend = false
  }

  if(s.buyTrendSuffixCount > 0) {
    s.buyTrendSuffixCount -= 1
  }
  if(!upwardTrend && s.patience > 0) {
    s.patience -= 1
  }


  const curProfit = avgPrice > 0 ? (curPrice - avgPrice) / curPrice : 0
  const curDip = typeof veryLongEma !== 'undefined' ? (curPrice - veryLongEma) / curPrice : 0
  s.highestProfit = Math.max(s.highestProfit, curProfit)
  const profitSlide = s.highestProfit - curProfit // TODO: make this a percentage of itself
  // console.log(s.highestProfit)
  
  if(curDip > 0) {
    s.lowestDip = 0
  }

  s.lowestDip = Math.min(s.lowestDip, curDip)
  const dipRebound = s.lowestDip - curDip

  const shortEmaChange = shortEma - s.lastShortEma
  const longEmaChange = longEma - s.lastLongEma
  const veryLongEmaChange = veryLongEma - s.lastVeryLongEma

  const inSellTrend = s.sellTrend
  const inBuyTrend = s.buyTrend
  const inBuySuffix = s.buyTrendSuffixCount > 0

  const { buyTrendEma } = s.period
  const impatient = s.patience <= 0


  // console.log(s.period.time)

  // TODO: The longer we hold onto it, the more eager we become to sell,
  //       hopefully at a profit
  // TODO: The larger the increase in price, the less sensitive the
  //       SELL_THRESHOLD needs to be
  // TODO: Try percentage profit_slide instead of flat amount
  // console.log(shortEmaChange)
  // console.log('sellthresh', `${buyTrendEma} < ${SELL_THRESHOLD+0.05}`)
  // // console.log(`${longEmaChange} < ${SELL_EMA_THRESHOLD}`)
  // console.log('upward', `${curPrice} > ${s.lookback[196] && (s.lookback[196].close + 80)}`)
  // console.log('downward', downwardTrend, `${curPrice} < ${s.lookback[196] && (s.lookback[196].close - 60)}`)
  // console.log('highprofit', `${s.highestProfit} > ${PROFIT_HIGH_POINT*0.4}`)
  // console.log('profitslide', `${profitSlide} > ${s.highestProfit*0.1}`)
  let verySoftSell = !upwardTrend && impatient && curProfit > 0 && buyTrendEma < SELL_THRESHOLD+0.1
  let softSell1 = downwardTrend && buyTrendEma < SELL_THRESHOLD+0.05 && shortEmaChange < 0.0 && longEmaChange < SELL_EMA_THRESHOLD && (s.highestProfit > PROFIT_HIGH_POINT*0.4 && profitSlide > s.highestProfit*0.1)
  let softSell2 = !upwardTrend && buyTrendEma < SELL_THRESHOLD-0.02 && shortEmaChange < 0.0 && longEmaChange < SELL_EMA_THRESHOLD && (s.highestProfit > PROFIT_HIGH_POINT*0.4 && profitSlide > s.highestProfit*0.1)

  const medSell = false // /*!inBuyTrend &&*/ shortEmaChange < SELL_EMA_THRESHOLD && (s.highestProfit > PROFIT_HIGH_POINT*2 && profitSlide > PROFIT_SLIDE/10)
  let hardSell = !upwardTrend && buyTrendEma < SELL_THRESHOLD && (s.highestProfit > PROFIT_HIGH_POINT*4 && profitSlide > PROFIT_SLIDE)

  // sometimes we get the sell signal at the peak, and then the price begins to fall
  if(!s.inSellWindow && downwardTrend && buyTrendEma < SELL_THRESHOLD && s.highestProfit > PROFIT_HIGH_POINT) {
    s.inSellWindow = true
    s.sellWindowTimer = 90
  } else if(s.inSellWindow) {
    s.sellWindowTimer -= 1
    if(s.sellWindowTimer === 0) {
      s.inSellWindow = false
    }
    if(profitSlide > s.highestProfit*0.01) {
      softSell1 = true
    }
  }


  if(verySoftSell || softSell1 || softSell2 || medSell || hardSell) {
    s.signal = 'sell'
    if(verySoftSell) {
      s.options.markup_sell_pct = 0
    }
    // if(shortEmaChange < 0) {
    //   s.options.markup_sell_pct = 0
    // }
    s.sellTrend = false
    s.highestProfit = 0
    s.buyTrendStartPrice = null
    if(softSell1 || softSell2 || medSell) {
      console.log('softsell')
      s.buyTimer = s.period.time + 7200000
    } else if(hardSell) {
      console.log('hardsell')
      s.buyTimer = s.period.time + 36000000
    }
    // console.log('large sell')
  }

  if(s.sell_order && upwardTrend) {
    s.signal = 'buy' // cancel sell signal
  }

  // stoploss
  // console.log('curProfit', curProfit)
  if(downwardTrend && curProfit < -0.008 && s.period.time - s.lastBuyTime > ONE_HOUR*3) {
    console.log('stoploss')
    s.signal = 'sell'
    s.buyTimer = s.period.time + 3600000
  }


  // console.log(veryLongEmaChange)
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

  // console.log(shortEmaChange)

  // after a precipitous drop, we wait for 
  // things to settle down before buying again
  if(shortEmaChange < -8.0) {
    s.buyTimer = s.period.time + ONE_HOUR*2
  }

  
  // console.log('dip', `${s.lowestDip} < ${EMA_DIP_POINT}`, `${dipRebound} < ${EMA_REBOUND}`)
  // console.log(s.buyTrendCount)
  console.log('shortEmaChange', `${shortEmaChange} > ${BUY_EMA}`)
  console.log('long', longEmaChange)
  console.log('verylong', veryLongEmaChange)
  console.log('ultraLong', ultraLongEmaChange)
  if(s.period.time >= s.buyTimer && 
     inBuyTrend && s.buyTrendCount > 16 && 
     buyTrendEma > BUY_THRESHOLD && 
     shortEmaChange > BUY_EMA && 
     (s.lowestDip < EMA_DIP_POINT && dipRebound < EMA_REBOUND)) {
    // const allLookbackPricesHigher = s.lookback[96] && s.lookback.slice(32, 96).map(l => l.close).reduce((r, c) => r && c > curPrice, true)
    // console.log('lookbacks higher', allLookbackPricesHigher)
    // if(!allLookbackPricesHigher) {
    console.log('normal buy')
    s.signal = 'buy'
    if(shortEmaChange > 0) {
      s.options.markdown_buy_pct = -0.1
    } else if(longEmaChange < -0.5) {
      s.options.markdown_buy_pct = 1
    }
    if(longEmaChange < -0.75) {
      s.options.markdown_buy_pct = 1
      if(veryLongEmaChange < -0.5) {
        s.options.markdown_buy_pct = 2
      }
    }
    s.lastBuyTime = s.period.time
    s.lowestDip = 0
    s.patience = 400
    // }
  }

  // if things are rocketing up, jump on the wagon
  // if(shortEmaChange > 1.0) {
  //   console.log('short', shortEmaChange)
  //   console.log('long', longEmaChange)
  //   console.log('verylong', veryLongEmaChange)
  //   console.log('buyTrendEma', buyTrendEma)
  //   console.log('curPrice oldPrice', `${curPrice} < ${s.lookback[196] && s.lookback[196].close+90}`)
  // }
  
  const rocketBuy1 = shortEmaChange > 1.5 && longEmaChange > 1.0 && veryLongEmaChange > 0.7 && (inBuyTrend || inBuySuffix) && buyTrendEma > 0.35 && curPrice < s.lookback[196].close+90
  const rocketBuy2 = shortEmaChange > 1.3 && longEmaChange > 0.04 && veryLongEmaChange > 0.002 && (inBuyTrend || inBuySuffix) && buyTrendEma > 0.51 && curPrice < s.lookback[196].close+20
  const rocketBuy3 = shortEmaChange > 4.0 && longEmaChange > 0.9 && veryLongEmaChange > 0.4 && (inBuyTrend || inBuySuffix) && buyTrendEma > 0.35 && curPrice < s.lookback[196].close+90
  if(rocketBuy1 || rocketBuy2) {
    console.log('rocket buy')
    s.options.markdown_buy_pct = -0.2
    s.signal = 'buy'
    s.patience = 400
    s.lastBuyTime = s.period.time
  }

  // uncertainty!! Jan 21st for instance
  // use this to signal NOT to stoploss sell
  if(sideways > 0.73) {
    s.uncertaintyCounter += 1
  } else {
    s.uncertaintyCounter = 0
  }

  // PANIC!!! Jan 19th for instance
  // console.log(`${trend18.up} - ${s.lastTrend18Up}`)
  // console.log(trend18.up - s.lastTrend18Up)
  // if(trend18.up - s.lastTrend18Up > 0.2) {
  //   console.log('panic')
  //   s.options.old_max_slippage_pct = s.options.max_slippage_pct
  //   s.options.max_slippage_pct = 5.0
  //   s.signal = 'sell'
  // }

  // if(tBuy > 0.24 && s.balance.asset > 1 && (avgPrice - curPrice) / curPrice > STOPLOSS) {
  //   // stoploss
  //   s.signal = 'sell'
  // }

  

  s.lastTrend18Up = trend18.up

  s.lastShortEma = shortEma
  s.lastLongEma = longEma
  s.lastVeryLongEma = veryLongEma
  s.lastUltraLongEma = ultraLongEma
  
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