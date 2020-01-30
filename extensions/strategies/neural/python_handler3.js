

module.exports = function(s, cb) {
  const {
    price_higher_diff: PRICE_HIGHER_AMOUNT,
    sell_trend_start_net_prob_amount: SELL_START_NET,
    sell_trend_start_ema_amount: SELL_START_EMA,
    sell_trend_count_threshold_1: SELL_TREND_1,
    sell_trend_1_ema: SELL_TREND_1_EMA,
    sell_trend_1_markup: SELL_TREND_1_MARKUP,
    sell_trend_count_threshold_2: SELL_TREND_2,
    sell_trend_2_ema: SELL_TREND_2_EMA,
    sell_trend_2_prob_threshold: SELL_TREND_2_PROB,
    sell_trend_increase_prob: SELL_TREND_INCREASE_PROB,
    sell_trend_increase_ema: SELL_TREND_INCREASE_EMA,
    sell_trend_end_prob: SELL_TREND_END_PROB,
    sell_trend_end_ema: SELL_TREND_END_EMA,
    sell_trend_end_signal_threshold: SELL_TREND_END_SIGNAL_THRESHOLD,
    buy_trend_start_prob_threshold: BUY_TREND_START_PROB_THRESHOLD,
    buy_trend_start_ema_threshold: BUY_TREND_START_EMA_THRESHOLD,
    buy_trend_count_1_threshold: BUY_TREND_COUNT_1,
    buy_trend_ema_1_threshold: BUY_TREND_EMA_1,
    buy_trend_1_markdown: BUY_TREND_1_MARKDOWN,
    buy_trend_count_2_threshold: BUY_TREND_COUNT_2,
    buy_trend_ema_2_threshold: BUY_TREND_EMA_2,
    buy_trend_prob_2_threshold: BUY_TREND_PROB_2,
    buy_trend_2_markdown: BUY_TREND_2_MARKDOWN,
    buy_trend_count_3_threshold: BUY_TREND_COUNT_3,
    buy_trend_ema_3_threshold: BUY_TREND_EMA_3,
    buy_trend_prob_3_threshold: BUY_TREND_PROB_3,
    buy_trend_3_markdown: BUY_TREND_3_MARKDOWN,
    buy_trend_increase_prob: BUY_TREND_INCREASE_PROB,
    buy_trend_increase_ema: BUY_TREND_INCREASE_EMA,
    buy_trend_end_prob: BUY_TREND_END_PROB,
    buy_trend_end_ema: BUY_TREND_END_EMA,
    buy_trend_end_count_signal_threshold: BUY_TREND_END_SIGNAL_THRESHOLD
  } = s.options

  return function pythonHandler(data) {
    // console.log(data)

    s.signal = null
    const curPrice = s.period.close
    const lastPrice = s.lookback[0].close
    const avgPrice = s.costBasis.avgPrice()
    const noAssets = avgPrice === 0
    const priceDiff = avgPrice !== 0 ? (curPrice - avgPrice) / curPrice : 0
    const trendDiff = (curPrice - s.trendStartPrice) / curPrice
    const { slope3, slope8, slope18, slope38, rollingAverageClose: avgClose } = s
    const weights = data.toString().split(' ').map(i => parseFloat(i))

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

    s.options.markdown_buy_pct = 0
    s.options.markup_sell_pct = 0
    s.options.buy_pct_amount = null
    s.options.sell_pct_amount = null

    const allSell = Object.values(downs).reduce((a, d) => a + d, 0)
    const allBuy = Object.values(ups).reduce((a, d) => a + d, 0)

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

    const inRisingSell = s.sellTrendCount > 0
    let risingSellEnded = false
    const inFallingBuy = s.buyTrendCount > 0
    let fallingBuyEnded = false

    // sell fakouts (in zenbot time):
    // 2020-01-09 11:56:28

    if(allSell > SELL_START_NET && emaChange > SELL_START_EMA) {
      if(!inRisingSell) {
        s.sellTrendCount = 1
        s.maxSellTrendCount = 1
        s.sellTrendStartPrice = curPrice
      } else {
        s.sellTrendCount += 1
        s.maxSellTrendCount += 1
        s.buyTrendCount -= 5
        // if(emaChange > 0.9) {
        //   s.buyTrendCount -= Math.round(6 * emaChange)
        // }
        // if(emaChange > 2.9) {
        //   s.buyTrendCount -= Math.round(6 * emaChange)
        // }
      }
      if(false && s.trendCount > SELL_TREND_1 && priceIsHigher && emaChange < SELL_TREND_1_EMA) {
        s.signal = 'sell'
        s.options.markup_sell_pct = SELL_TREND_1_MARKUP * emaChange
      }
      if(false && s.trendCount > SELL_TREND_2 && priceIsHigher && emaChange < SELL_TREND_2_EMA && allSell > SELL_TREND_2_PROB) {
        s.signal = 'sell'
        s.options.markdown_sell_pct = SELL_TREND_1_MARKUP * emaChange
      }
      s.trend = 'risingsell' /*&& midTrendDown && longTrendDown && (noAssets || priceIsHigher)*/
    } else if(inRisingSell && allSell > SELL_TREND_INCREASE_PROB && emaChange > SELL_TREND_INCREASE_EMA) {
      s.sellTrendCount += 1
      s.maxSellTrendCount += 1
      s.buyTrendCount -= 4
      if(emaChange > 0.9) {
        s.buyTrendCount -= Math.round(4 * emaChange)
      }
    } else if(inRisingSell && (allSell <= SELL_TREND_END_PROB || emaChange < SELL_TREND_END_EMA)) {
      s.sellTrendCount -= 1
      console.log(curPrice - s.sellTrendStartPrice)
    }
    if(allSell <= SELL_TREND_END_PROB && s.sellTrendCount <= 0) {
      if(s.maxSellTrendCount > SELL_TREND_END_SIGNAL_THRESHOLD) {
        risingSellEnded = true
      }
      s.trend = null
    }
    if(risingSellEnded) {
      s.signal = 'sell'
    }

    // could experiment with trend petering out vs reversing abruptly
    // buy fakouts (in zenbot time):
    // 2020-01-09 12:33:25 (fixed with trendCount confirmation 3 -> 7)
    // 2020-01-09 14:56:24 (fixed with emaChange -1.0 threshold)

    if(allBuy > BUY_TREND_START_PROB_THRESHOLD && emaChange < BUY_TREND_START_EMA_THRESHOLD /*&& shortTrendUp && longTrendDown && priceIsLower*/) {
      
      if(!inFallingBuy) {
        s.buyTrendCount = 1
        s.maxBuyTrendCount = 1
        if(s.buyTrendStartPrice === null) {
          s.buyTrendStartPrice = curPrice
        }
      } else {
        s.buyTrendCount += 1
        s.maxBuyTrendCount += 1
        s.sellTrendCount -= 6
      }
      if(emaChange > 0.9) {
        s.buyTrendCount += Math.round(2 * emaChange)
      }
      if(false && s.trendCount > BUY_TREND_COUNT_1 && emaChange > BUY_TREND_EMA_1) {
        s.signal = 'buy'
        // could use strength of buy signals here instead
        s.options.markdown_buy_pct = BUY_TREND_1_MARKDOWN * (-emaChange)
      }
      if(false && s.trendCount > BUY_TREND_COUNT_2 && emaChange > BUY_TREND_EMA_2 && allBuy > BUY_TREND_PROB_2) {
        s.signal = 'buy'
        console.log('buying trend 2 markrdown')
        s.options.markdown_buy_pct = BUY_TREND_2_MARKDOWN
        s.options.buy_pct_amount = 0.2
      }
      if(false && s.trendCount > BUY_TREND_COUNT_3 && emaChange > BUY_TREND_EMA_3 && allBuy > BUY_TREND_PROB_3) {
        s.signal = 'buy'
        console.log('buying trend 3 markrdown')
        s.options.markdown_buy_pct = BUY_TREND_3_MARKDOWN
        s.options.buy_pct_amount = 0.2
      }
      s.trend = 'fallingbuy'
    } else if(inFallingBuy && allBuy > BUY_TREND_INCREASE_PROB && emaChange < BUY_TREND_INCREASE_EMA) {
      s.buyTrendCount += 1
      s.maxBuyTrendCount += 1
    } else if(inFallingBuy && (allBuy <= BUY_TREND_END_PROB && emaChange > BUY_TREND_END_EMA)) {
      s.buyTrendCount -= 1
      // try to make sure a slower, longer fall is really over before we buy
      
    }
    if(allBuy <= BUY_TREND_END_PROB && s.buyTrendCount <= 0) {
      // check here for buy
      console.log(inRisingSell)
      if(s.maxBuyTrendCount > BUY_TREND_END_SIGNAL_THRESHOLD && s.buyTrendStartPrice - curPrice > 30) {
        fallingBuyEnded = true
      }
      s.trend = null
    }
    if(fallingBuyEnded) {
      s.signal = 'buy'
      s.buyTrendStartPrice = null
    }
    // } else if(normSell && priceIsHigher) {
    //   s.signal = 'sell'
    // } else if(normBuy && priceIsLower) {
    //   s.signal = 'buy'
    // } else if(normBuy && noAssets && goingUp) {
    //   s.signal = 'buy'
    // }

    if(s.sellTrendCount < 0) {
      s.sellTrendCount = 0
    }
    if(s.buyTrendCount < 0) {
      s.buyTrendCount = 0
    }

    s.lastEma = ema

    console.log(s.signal)

        
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
    // global.trend26 = trend26
        
    // console.log(weights)
    // if (weights[0] > weights[1] && weights[0] > weights[2]) {
    //   s.signal = 'sell'
    // } else if(weights[1] > weights[0] && weights[1] > weights[2]){
    //   s.signal = 'buy'
    // } else {
    //   s.signal = null
    // }
        
        
        

    // if(weights[0] > 0.8) {
    //   global.predictTrend = 'down'
    //   if((curPrice - avgPrice) / curPrice > 0.0019) {
    //     s.signal = 'sell'
    //   }
    // }
    // } else if(weights[1] > 0.8) {
    //   global.predictTrend = 'up'
    //   if((curPrice - avgPrice) / curPrice < -0.001 || (avgPrice === 0 && curPrice < lastPrice)) {
    //     s.signal = 'buy'
    //   }
    // } else {
    //   global.predictTrend = '???'
    //   s.signal = null
    // }

    // s.lastMidSignal = midBuySignal
    // s.lastSlope = currentSlope

    // const nextPrice = parseFloat(data)
    // global.predicted = nextPrice
    // if(avgPrice == 0 && nextPrice < s.period.close) {
    //   s.signal = 'buy'
    // } else if(nextPrice - avgPrice > 20) {
    //   s.signal = 'sell'
    // } else if(nextPrice - avgPrice < -20) {
    //   s.signal = 'buy'
    // }

    // s.pythonProcess.off('message', pythonHandler)
    cb()
  }
}