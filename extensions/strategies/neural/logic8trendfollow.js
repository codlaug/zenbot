const emaFunc = require('../../../lib/ema')
const smoothedZScore = require('./z_score')
const n = require('numbro')
const regression = require('regression')
const DTRegression = require('ml-cart').DecisionTreeRegression

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

  s.period.allSell = trend8.down
  s.period.allBuy = trend8.up
  s.period.triSell = trend18_3.down
  s.period.triBuy = trend18_3.up

  emaFunc(s, 'buyTrendEma', 18, 'triBuy')
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

  const { longEma, veryLongEma, ultraLongEma, shortEma, medEma, buyTrendEma, emaDiffEma } = s.period


  const shortEmaChange = shortEma - s.lastShortEma
  const medEmaChange = medEma - s.lastMedEma
  const longEmaChange = longEma - s.lastLongEma
  const veryLongEmaChange = veryLongEma - s.lastVeryLongEma
  const ultraLongEmaChange = ultraLongEma - s.lastUltraLongEma

  // console.log(ultraLongEmaChange)

  
  const downwardTrend = veryLongEma < ultraLongEma
  const upwardTrend = veryLongEma > ultraLongEma
  const emasCrossed = (upwardTrend && !s.lastUpwardTrend) || (downwardTrend && !s.lastDownwardTrend)

  if(emasCrossed) {
    s.emaCrossTrendCount = 30
  }
  if(s.emaCrossTrendCount > 0) {
    s.emaCrossTrendCount -= 1
  }

  let emasConverging = false
  const emaConvergance = ultraLongEmaChange - veryLongEmaChange
  const emaConvergance2 = ultraLongEmaChange - longEmaChange
  if(upwardTrend) {
    if(emaConvergance > 0.1) {
      emasConverging = true
    }
  } else if(downwardTrend) {
    // ultraLong change is falling faster than veryLong change
    if(emaConvergance < -0.1) {
      emasConverging = true
    }
  }
  let emasDiverging = false
  const emaDivergance = emaConvergance
  const emaDivergance2 = emaConvergance2
  if(upwardTrend) {
    if(emaDivergance < -0.1) {
      emasDiverging = true
    }
  } else if(downwardTrend) {
    // veryLong change is falling faster than ultraLong change
    if(emaDivergance > 0.1) {
      emasDiverging = true
    }
  }

  // console.log('ultraLongEma', ultraLongEma)

  if(s.lookback.length > 16) {
    const length = Math.min(s.lookback.length, 196)
    const buyTrendArray = s.lookback.slice(0, length).reverse().map(l => l.buyTrendEma)
    buyTrendArray.push(buyTrendEma)
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
    const length = Math.min(s.lookback.length, 496)
    const closeArray = s.lookback.slice(0, length).reverse().map(l => l.ultraLongEma)
    closeArray.push(ultraLongEma)
    const ultraLongEmaZ = smoothedZScore(closeArray, {threshold: 2.4, lag: length-2})
    s.period.ultraLongEmaZ = ultraLongEmaZ[ultraLongEmaZ.length-1]
    const lowUltraLongEmaZ = smoothedZScore(closeArray, {threshold: 1.3, lag: length-2})
    s.period.lowUltraLongEmaZ = lowUltraLongEmaZ[lowUltraLongEmaZ.length-1]
  }

  if(s.lookback.length > 16) {
    const length = Math.min(s.lookback.length, 196)
    const closeArray = s.lookback.slice(0, length).reverse().map(l => l.ultraLongEma - l.veryLongEma)
    closeArray.push(ultraLongEma - veryLongEma)
    const longEmaZ = smoothedZScore(closeArray, {threshold: 2.0, lag: length-2})
    s.period.longEmaZ = longEmaZ[longEmaZ.length-1]
  }

  const longSellSig = s.period.ultraLongEmaZ === 1
  const longBuySig = s.period.ultraLongEmaZ === -1
  const lowLongPeakSig = s.period.lowUltraLongEmaZ === 1
  const lowLongTroughSig = s.period.lowUltraLongEmaZ === -1
  const emaDiffTroughSig = s.period.longEmaZ === -1
  const emaDiffPeakSig = s.period.longEmaZ === 1

  const emaDiff = ultraLongEma - veryLongEma
  const emaDiffChange = emaDiff - s.lastEmaDiff
  s.period.emaDiffChange = emaDiffChange
  emaFunc(s, 'emaDiffChangeEma', 32, 'emaDiffChange')
  // console.log(s.period.emaDiffChangeEma)
  const emaDiffChangeChange = emaDiffChange - s.lastEmaDiffChange
  s.period.emaDiffChangeChange = emaDiffChangeChange


  let buyTrendEnded = false


  const curProfit = avgPrice > 0 ? (curPrice - avgPrice) / curPrice : 0
  const curDip = typeof veryLongEma !== 'undefined' ? (curPrice - veryLongEma) / curPrice : 0
  console.log('curProfit', curProfit)
  s.highestProfit = Math.max(s.highestProfit, curProfit)
  const profitSlide = (s.highestProfit - curProfit) / s.highestProfit
  // console.log('highestProfit', s.highestProfit)

  const extremeFear = s.fearGreedClass === 'Extreme Fear'
  const fear = s.fearGreedClass === 'Fear'
  const neutral = s.fearGreedClass === 'Neutral'
  const greed = s.fearGreedClass === 'Greed'

  const noFear = !extremeFear && !fear
  const anyFear = extremeFear || fear

  

  // console.log(s.balance)
  // console.log(s.start_capital)
  const invested = n(s.start_capital || s.balance.currency).subtract(s.balance.currency)
  const percentInvested = invested / s.start_capital
  const currency = n(s.balance.currency).value()
  const assets = n(s.balance.asset).value() * curPrice
  const percentCurrency = currency / (currency + assets)
  const percentAssets = assets / (currency + assets)
  // s.logStream.write(`invested: ${percentAssets}\n`)

  const { atr, pdi, trendMagicSignal2, emaRsi } = s.period

  // console.log(atr)

  if(assets < 0.02 || n(s.balance.asset).value() < 0.06) {
    s.highestProfit = -Infinity
  }

  if(s.patience >= 0) {
    s.patience += 1
  }

  // console.log('adx', s.period.adx)

  const notStillRising = ultraLongEmaChange < 0.20

  const length = Math.min(s.lookback.length, 12)

  const dataArray = s.lookback.slice(0, length).reverse().map(l => l.veryLongEma)
  dataArray.push(veryLongEma)
  const dataVeryLong = dataArray.map((d, i) => [i, d])
  const modelVeryLong = regression.linear(dataVeryLong, {order: 2})
  const predictedVeryLong = modelVeryLong.predict(length+80)[1]

  const dataUltraArray = s.lookback.slice(0, length).reverse().map(l => l.ultraLongEma)
  dataUltraArray.push(ultraLongEma)
  const dataUltraLong = dataUltraArray.map((d, i) => [i, d])
  const modelUltraLong = regression.linear(dataUltraLong, {order: 2})
  const predictedUltraLong = modelUltraLong.predict(length+80)[1]

  const recentlyCrossed = s.emaCrossTrendCount > 0


  if(s.buyTrendCount > 0) {
    s.buyTrend = true
  }

  const inBuyTrend = s.buyTrend
  const inBuySuffix = s.buyTrendSuffixCount > 0


  if(upwardTrend) {

    const { rsi, emaRsi } = s.period

    const emasStillRising = veryLongEma > 0.2 && ultraLongEma > 0.2



    s.highestEmaDiff = -Infinity
  }

  const { trendMagicSignal2: lastTrendMagicSignal } = s.lookback[0]

  console.log(s.fearGreedClass, `(${s.fearGreedValueChange})`)
  s.period.fearGreedValueChange = s.fearGreedValueChange


  // TODO: use lowUltraLongPeak to sell
  // TODO: fiddle with buying during a steep downward ema

  // (lastTrendMagicSignal === -1 && trendMagicSignal2 === 1)

  if(trendBuySignal && !lowLongPeakSig) {
    s.logStream.write(`atr: ${atr}\n`)
    if(downwardTrend && atr > 2.0 /* emaDivergance < 0.01 && veryLongEmaChange > -0.01 */) {
      s.logStream.write(`emaDiver: ${downwardTrend} - ${emaConvergance}\n`)
      // s.logStream.write(`emaDiver2: ${emaDivergance2}\n`)
      s.logStream.write(`veryLongEmaChange: ${veryLongEmaChange}\n`)
      // s.signal = 'buy'
    }
    if(upwardTrend) {
      // s.signal = 'buy'
    }
  }

  if(trendBuySignal) {
    if(downwardTrend) {
      if(atr < 4.0) {
        s.signal = 'buy'
      }
    }
  }


  if(trendMagicSignal2 === 1 && s.buyTrendCount < 20) {
    if((upwardTrend && emaDivergance > 0.008) ||
        (downwardTrend && emaConvergance < -0.2)) {
      if(atr > 8.0) {
        s.logStream.write(`emaDiver: ${downwardTrend} - ${emaConvergance}\n`)
        s.logStream.write(`emaDiver2: ${emaDivergance2}\n`)
        s.logStream.write(`atr: ${atr}\n`)
        // s.signal = 'buy'
      }
    }
  }

  if(tBuy > 0.46 && emaRsi < 40) {
    // s.signal = 'buy'
  }

  if(tSell > 0.46) {
    if(s.highestProfit > 0.012 && profitSlide > 0.15) {
      s.signal = 'sell'
    }
  }

  if(tSell > 0.46) {
    if(downwardTrend) {
      if(s.highestProfit > 0.006 && profitSlide > 0.05) {
        // s.signal = 'sell'
      }
    }
  }

  if(tSell > 0.46) {
    if(curProfit < -0.016) {
      s.signal = 'sell'
    }
  }

  // const rocketBuy1 = shortEmaChange > 1.5 && longEmaChange > 1.0 && veryLongEmaChange > 0.7 && (inBuyTrend || inBuySuffix) && buyTrendEma > 0.35 && curPrice < s.lookback[196].close+90 && !lowLongPeakSig
  // const rocketBuy2 = shortEmaChange > 1.3 && longEmaChange > 0.04 && veryLongEmaChange > 0.002 && (inBuyTrend || inBuySuffix) && buyTrendEma > 0.51 && curPrice < s.lookback[196].close+20 && !lowLongPeakSig
  // const rocketBuy3 = shortEmaChange > 4.0 && longEmaChange > 0.9 && veryLongEmaChange > 0.4 && (inBuyTrend || inBuySuffix) && buyTrendEma > 0.35 && curPrice < s.lookback[196].close+90
  // if(rocketBuy1 || rocketBuy2) {
  //   if(rocketBuy1) {
  //     console.log('rocketBuy1')
  //   } else if(rocketBuy2) {
  //     console.log('rocketBuy2')
  //   }
  //   s.options.markdown_buy_pct = -0.2
  //   s.signal = 'buy'
  //   s.patience = 400
  //   s.lastBuyTime = s.period.time
  // }

  if(trendMagicSignal2 === 1) {
    s.buyTrendCount += 1
    s.sellTrendCount = 0
  }

  if(trendMagicSignal2 === -1) {
    s.sellTrendCount += 1
    s.buyTrendCount = 0
  }

  if(trendMagicSignal2 === 1) {
    if(s.highestProfit > 0.020 && profitSlide > 0.15) {
      // s.signal = 'sell'
    }
  }

  if(lastTrendMagicSignal === 1 && trendMagicSignal2 === -1) {
    // s.signal = 'sell'
  }



  if(s.buyTrendSuffixCount > 0) {
    s.buyTrendSuffixCount -= 1
  }


  if(curDip > 0) {
    s.lowestDip = 0
  }

  s.lowestDip = Math.min(s.lowestDip, curDip)
  const dipRebound = s.lowestDip - curDip

  


  const inSellTrend = s.sellTrend



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
  console.log('highprofit', `${s.highestProfit} > ${PROFIT_HIGH_POINT}`)
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
  s.lastEmaDiff = emaDiff
  s.lastEmaDiffChange = emaDiffChange
  s.lastDownwardTrend = downwardTrend
  s.lastUpwardTrend = upwardTrend
  s.lastLongSellSig = longSellSig
  
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