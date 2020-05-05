const emaFunc = require('../../../lib/ema')
const smoothedZScore = require('./z_score')
const n = require('numbro')

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


  s.options.markdown_buy_pct = 0.0
  s.options.markup_sell_pct = 0.0
  s.options.buy_pct_amount = null
  s.options.sell_pct_amount = null

  if(s.options.old_max_slippage_pct) {
    s.options.max_slippage_pct = s.options.old_max_slippage_pct
  }
  
  const allSell = Object.values(downs).reduce((a, d) => a + d, 0)
  const allBuy = Object.values(ups).reduce((a, d) => a + d, 0)

  s.period.allSell = trend38.down
  s.period.allBuy = trend38.up
  s.period.triSell = trend18_3.down
  s.period.triBuy = trend18_3.up

  emaFunc(s, 'buyTrendEma', 96, 'triBuy')

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

  const { longEma, veryLongEma, ultraLongEma, shortEma, medEma, buyTrendEma2 } = s.period


  const shortEmaChange = shortEma - s.lastShortEma
  const medEmaChange = medEma - s.lastMedEma
  const longEmaChange = longEma - s.lastLongEma
  const veryLongEmaChange = veryLongEma - s.lastVeryLongEma
  const ultraLongEmaChange = ultraLongEma - s.lastUltraLongEma

  if(curPrice < ultraLongEma) {
    s.period.buyTrendEma += ((ultraLongEma - curPrice) / ultraLongEma)/10
  } else if(curPrice > ultraLongEma) {
    s.period.buyTrendEma -= ((curPrice - ultraLongEma) / ultraLongEma)/10
  }

  const { buyTrendEma } = s.period

  emaFunc(s, 'buyTrendEma2', 96, 'buyTrendEma')
  emaFunc(s, 'buyTrendEma3', 96, 'buyTrendEma2')
  

  // console.log(ultraLongEmaChange)

  
  // could adjust these based on fear greed index
  const downwardTrend = veryLongEma - ultraLongEma < -0.1
  const upwardTrend = veryLongEma - ultraLongEma > 0.1

  let emasConverging = false
  if(upwardTrend) {
    if(ultraLongEmaChange - veryLongEmaChange > 0.1) {
      emasConverging = true
    }
  } else if(downwardTrend) {
    // ultraLong change is falling faster than veryLong change
    if(ultraLongEmaChange - veryLongEmaChange < -0.1) {
      emasConverging = true
    }
  }
  let emasDiverging = false
  if(upwardTrend) {
    if(ultraLongEmaChange - veryLongEmaChange < -0.1) {
      emasDiverging = true
    }
  } else if(downwardTrend) {
    // veryLong change is falling faster than ultraLong change
    if(ultraLongEmaChange - veryLongEmaChange > 0.1) {
      emasDiverging = true
    }
  }

  // console.log('ultraLongEma', ultraLongEma)

  if(s.lookback.length > 16) {
    const length = Math.min(s.lookback.length, 196)
    const buyTrendArray = s.lookback.slice(0, length).reverse().map(l => l.buyTrendEma2)
    buyTrendArray.push(buyTrendEma2)
    const signals = smoothedZScore(buyTrendArray, {threshold: 2.0, lag: length-2})
    s.period.zScore = signals[signals.length-1]
  }

  const trendBuySignal = s.period.zScore === 1

  // if(s.slowLookback.length > 16) {
  //   const length = Math.min(s.slowLookback.length, 196)
  //   const closeArray = s.lookback.slice(0, length).reverse().map(l => l.close)
  //   closeArray.push(curPrice)
  //   const closeZ = smoothedZScore(closeArray, {threshold: 2.4, lag: length-2})
  //   s.period.closeZScore = closeZ[closeZ.length-1]
  // }

  if(s.lookback.length > 16) {
    const length = Math.min(s.lookback.length, 396)
    const closeArray = s.lookback.slice(0, length).reverse().map(l => l.ultraLongEma)
    closeArray.push(ultraLongEma)
    const ultraLongEmaZ = smoothedZScore(closeArray, {threshold: 2.1, lag: length-2})
    s.period.ultraLongEmaZ = ultraLongEmaZ[ultraLongEmaZ.length-1]
  }

  if(s.lookback.length > 16) {
    const length = Math.min(s.lookback.length, 196)
    const closeArray = s.lookback.slice(0, length).reverse().map(l => l.ultraLongEma - l.veryLongEma)
    closeArray.push(ultraLongEma - veryLongEma)
    const longEmaZ = smoothedZScore(closeArray, {threshold: 2.2, lag: length-2})
    s.period.longEmaZ = longEmaZ[longEmaZ.length-1]
  }

  if(s.lookback.length > 16) {
    const length = Math.min(s.lookback.length, 48)
    const closeArray = s.lookback.slice(0, length).reverse().map(l => l.medEma)
    closeArray.push(medEma)
    const medEmaZ = smoothedZScore(closeArray, {threshold: 2.2, lag: length-2})
    s.period.medEmaZ = medEmaZ[medEmaZ.length-1]
  }

  const longSellSig = s.period.ultraLongEmaZ === 1
  const longBuySig = s.period.ultraLongEmaZ === -1
  const emaDiffTroughSig = s.period.longEmaZ === -1
  const emaDiffPeakSig = s.period.longEmaZ === 1

  const emaDiff = ultraLongEma - veryLongEma

  let buyTrendEnded = false


  const curProfit = avgPrice > 0 ? (curPrice - avgPrice) / curPrice : 0
  const curDip = typeof veryLongEma !== 'undefined' ? (curPrice - veryLongEma) / curPrice : 0
  console.log('curProfit', curProfit)
  s.highestProfit = Math.max(s.highestProfit, curProfit)
  const profitSlide = (s.highestProfit - curProfit) / s.highestProfit
  console.log('highestProfit', s.highestProfit)
  s.highestPrice = Math.max(s.highestPrice, curPrice)


  const extremeFear = s.fearGreedClass === 'Extreme Fear'
  const fear = s.fearGreedClass === 'Fear'
  const neutral = s.fearGreedClass === 'Neutral'
  const greed = s.fearGreedClass === 'Greed'

  const noFear = !extremeFear && !fear
  const someFear = extremeFear || fear

  const { rsi, emaRsi, atr, mdi } = s.period

  console.log('atr', atr)


  const stoplossPoint = s.highestPrice - atr*2

  // console.log(s.balance)
  // console.log(s.start_capital)
  const invested = n(s.start_capital || s.balance.currency).subtract(s.balance.currency)
  const percentInvested = invested / s.start_capital
  console.log('percentInvested', percentInvested)
  const currency = n(s.balance.currency).value()
  const assets = n(s.balance.asset).value() * curPrice
  const percentCurrency = currency / (currency + assets)
  const percentAssets = assets / (currency + assets)
  // s.logStream.write(`invested: ${percentAssets}\n`)

  if(assets < 0.02 || n(s.balance.asset).value() < 0.06) {
    s.highestProfit = -Infinity
  }

  const notStillRising = ultraLongEmaChange < 0.20

  console.log(`${s.fearGreedClass}: ${s.fearGreedValue}`)

  const { bollinger_lower: bollingerLower } = s.period

  if(s.patience > 0) {
    s.patience -= 1
  }
  if(trend38.up < 0.51) {
    s.actedOnSignal = false
  }

  const { ParabolicSAR } = s.period
  
  if(buyTrendEma > 0.44 && ParabolicSAR < curPrice) {
    // s.signal = 'buy'
  }


  const settledDownOrMuchLower = atr < 4.0 || curPrice < s.lastBuyPrice-80

  if(trend38.up > 0.535 && trend38.up > buyTrendEma && ParabolicSAR < curPrice) {
    if(!s.actedOnSignal) {
      if(true || emaRsi < 36.0) {
        if((upwardTrend || (downwardTrend && settledDownOrMuchLower)) && longEmaChange > -0.4) {
          if(curPrice < s.lastBuyPrice-40 || avgPrice === 0) {
            let buyPercent = percentInvested
            if(percentInvested < 0.03) {
              buyPercent = 0.25
            }
            s.options.buy_pct_amount = Math.round(buyPercent*100)
            console.log('buying with ', buyPercent)
            s.logStream.write(`buying with ${buyPercent} at ${curPrice}\n`)
            s.actedOnSignal = true
            s.lastBuyPrice = curPrice
            s.signal = 'buy'
          }
        }
      }
    }
  }

  if(downwardTrend && curProfit > 0 && trend38.down > 0.55) {
    if(ParabolicSAR > curPrice) {
      s.signal = 'sell'
    }
  }

  if(curProfit > 0.003 && trend38.down > 0.55) {
    if(ParabolicSAR > curPrice) {
      s.signal = 'sell'
    }
  }

  if(curProfit < -0.008) {
    // s.signal = 'sell'
  }

  const { adx, histogram, MACD, fastMA, slowMA, verySlowMA } = s.period
  
  const { close: recentPrice } = s.lookback[26]

  console.log('parabolicSar:', ParabolicSAR)
  console.log('mdi', mdi)
  // console.log(histogram, MACD, fastMA, slowMA, recentPrice, verySlowMA)
  // hist crossed over 0
  if(histogram > 0 && s.lastHistogram < 0 && MACD > 0 && fastMA > slowMA && recentPrice > verySlowMA) {
    // s.signal = 'buy'
  }
  

  // if(emaDiffPeakSig) {
  //   s.signal = 'sell'
  // }


  if(s.buyTrendSuffixCount > 0) {
    s.buyTrendSuffixCount -= 1
  }


  if(curDip > 0) {
    s.lowestDip = 0
  }

  s.lowestDip = Math.min(s.lowestDip, curDip)
  const dipRebound = s.lowestDip - curDip

  


  const inSellTrend = s.sellTrend
  const inBuyTrend = s.buyTrend
  const inBuySuffix = s.buyTrendSuffixCount > 0



  // console.log(s.period.time)

  // TODO: The longer we hold onto it, the more eager we become to sell,
  //       hopefully at a profit
  // TODO: The larger the increase in price, the less sensitive the
  //       SELL_THRESHOLD needs to be
  // TODO: Try percentage profit_slide instead of flat amount
  // console.log(shortEmaChange)
//   console.log('sellthresh', `${buyTrendEma} < ${SELL_THRESHOLD+0.05}`)
  // console.log(`${longEmaChange} < ${SELL_EMA_THRESHOLD}`)
//   console.log('upward', `${curPrice} > ${s.lookback[196] && (s.lookback[196].close + 80)}`)
//   console.log('downward', downwardTrend, `${curPrice} < ${s.lookback[196] && (s.lookback[196].close - 60)}`)
  // console.log('highprofit', `${s.highestProfit} > ${PROFIT_HIGH_POINT}`)
  console.log('profitslide', `${profitSlide} < ${0.9}`)
  // let softSell1 = downwardTrend && longSellSig && shortEmaChange < 0.0 && longEmaChange < SELL_EMA_THRESHOLD && (s.highestProfit > PROFIT_HIGH_POINT*0.4 && profitSlide > s.highestProfit*0.1)
  // let softSell2 = !upwardTrend && longSellSig && shortEmaChange < 0.0 && longEmaChange < SELL_EMA_THRESHOLD && (s.highestProfit > PROFIT_HIGH_POINT*0.4 && profitSlide > s.highestProfit*0.1)
  
  // const medSell = false // /*!inBuyTrend &&*/ shortEmaChange < SELL_EMA_THRESHOLD && (s.highestProfit > PROFIT_HIGH_POINT*2 && profitSlide > PROFIT_SLIDE/10)
  // let hardSell = buyTrendEma < SELL_THRESHOLD && (s.highestProfit > PROFIT_HIGH_POINT*4 && profitSlide > s.highestProfit*0.1)

  // // sometimes we get the sell signal at the peak, and then the price begins to fall
  // if(!s.inSellWindow && downwardTrend && buyTrendEma < SELL_THRESHOLD && s.highestProfit > PROFIT_HIGH_POINT) {
  //   s.inSellWindow = true
  //   s.sellWindowTimer = 30
  // } else if(s.inSellWindow) {
  //   s.sellWindowTimer -= 1
  //   if(s.sellWindowTimer === 0) {
  //     s.inSellWindow = false
  //   }
  //   if(profitSlide > s.highestProfit*0.01) {
  //     softSell1 = true
  //   }
  // }


  // if(false && softSell1 || softSell2 || medSell || hardSell) {
  //   s.signal = 'sell'
  //   if(shortEmaChange < 0) {
  //     s.options.markup_sell_pct = 0
  //   }
  //   s.sellTrend = false
  //   s.highestProfit = 0
  //   s.buyTrendStartPrice = null
  //   if(softSell1 || softSell2 || medSell) {
  //     console.log('softsell')
  //     s.buyTimer = s.period.time + 7200000
  //   } else if(hardSell) {
  //     console.log('hardsell')
  //     s.buyTimer = s.period.time + 36000000
  //   }
  //   // console.log('large sell')
  // }

  // stoploss
  // console.log('curProfit', curProfit)
  // if(downwardTrend && curProfit < -0.008 && s.period.time - s.lastBuyTime > ONE_HOUR*3) {
  //   console.log('stoploss')
  //   s.signal = 'sell'
  //   s.buyTimer = s.period.time + 3600000
  // }


  // console.log(veryLongEmaChange)
  if(veryLongEmaChange > -0.01) {
    s.buyCooldown = 0
  }

  if(s.emaTrend === 'down') {
    if(longEmaChange > 0.1) {
      // s.buyTrendStartPrice = curPrice
      s.emaTrend = 'up'
    }
  } else if(s.emaTrend === 'up') {
    if(longEmaChange < -0.1) {
      // s.buyTrendStartPrice = curPrice
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
  // console.log('dip', `${s.lowestDip} < ${EMA_DIP_POINT}`)
  // console.log('not downward', !downwardTrend)
  //   console.log(s.buyTrendCount)
  // console.log('shortEmaChange', `${shortEmaChange} > ${BUY_EMA}`)
  // console.log('long', longEmaChange)
  // console.log('verylong', veryLongEmaChange)
  // if(s.period.time >= s.buyTimer && 
  //   // buyTrendEnded && 
  //   !downwardTrend &&
  //   s.lowestDip < EMA_DIP_POINT && 
  //   //  s.buyTrendCount > 13 && 
  //   //  buyTrendEma > BUY_THRESHOLD && 
  //    // buySig && 
  //   shortEmaChange > BUY_EMA
  //    /*(s.lowestDip < EMA_DIP_POINT && dipRebound < EMA_REBOUND)*/) {
  //   // const allLookbackPricesHigher = s.lookback[96] && s.lookback.slice(32, 96).map(l => l.close).reduce((r, c) => r && c > curPrice, true)
  //   // console.log('lookbacks higher', allLookbackPricesHigher)
  //   // if(!allLookbackPricesHigher) {
  //   console.log('normal buy')
  //   // s.signal = 'buy'
  //   if(shortEmaChange > 0) {
  //     s.options.markdown_buy_pct = -0.1
  //   } else if(longEmaChange < -0.5) {
  //     s.options.markdown_buy_pct = 1
  //   }
  //   s.lastBuyTime = s.period.time
  //   s.lowestDip = 0
  //   // }
  // }

  // if things are rocketing up, jump on the wagon
  // if(shortEmaChange > 1.0) {
  //   console.log('short', shortEmaChange)
  //   console.log('long', longEmaChange)
  //   console.log('verylong', veryLongEmaChange)
  //   console.log('buyTrendEma', buyTrendEma)
  //   console.log('curPrice oldPrice', `${curPrice} < ${s.lookback[196] && s.lookback[196].close+90}`)
  // }
  
  // const rocketBuy1 = shortEmaChange > 1.5 && longEmaChange > 1.0 && veryLongEmaChange > 0.7 && (inBuyTrend || inBuySuffix) && buyTrendEma > 0.35 && curPrice < s.lookback[196].close+90
  // const rocketBuy2 = shortEmaChange > 1.3 && longEmaChange > 0.04 && veryLongEmaChange > 0.002 && (inBuyTrend || inBuySuffix) && buyTrendEma > 0.51 && curPrice < s.lookback[196].close+20
  // const rocketBuy3 = shortEmaChange > 4.0 && longEmaChange > 0.9 && veryLongEmaChange > 0.4 && (inBuyTrend || inBuySuffix) && buyTrendEma > 0.35 && curPrice < s.lookback[196].close+90
  // if(rocketBuy1 || rocketBuy2) {
  //   console.log('rocket buy')
  //   s.options.markdown_buy_pct = -0.2
  //   // s.signal = 'buy'
  //   s.lastBuyTime = s.period.time
  // }
  

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
  s.lastMedEma = medEma
  s.lastLongEma = longEma
  s.lastVeryLongEma = veryLongEma
  s.lastUltraLongEma = ultraLongEma
  s.lastHistogram = histogram
  
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