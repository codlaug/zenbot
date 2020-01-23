const SHORT_THRESHOLD = 0.5
const MID_THRESHOLD = 0.5
const LONG_THRESHOLD = 0.5
const VERY_LONG_THRESHOLD = 0.5

module.exports = function(s, cb) {
  return function pythonHandler(data) {
    // console.log(data)

    s.signal = null
    const curPrice = s.period.close
    const lastPrice = s.lookback[0].close
    const avgPrice = s.costBasis.avgPrice()
    const noAssets = avgPrice === 0
    const priceDiff = avgPrice !== 0 ? (curPrice - avgPrice) / curPrice : 0
    const trendDiff = (curPrice - s.trendStartPrice) / curPrice
    const { slope3, slope8, slope18, slope38 } = s
    const rateOfChangeOfRateOfChange = s.rateOfChangeRateOfChange
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

    const allSell = Object.values(downs).reduce((a, d) => a && d > 0.5, true)
    const allBuy = Object.values(ups).reduce((a, d) => a && d > 0.5, true)

    const midTrendDown = slope8 < 0
    const shortTrendUp = slope3 > 0
    const longTrendDown = slope18 < 0

    const priceIsHigher = priceDiff > 0.006
    const priceIsLower = priceDiff < -0.004
    // const goingUp = slope2 > 0 && rateOfChangeOfRateOfChange > 0

    if(allSell && midTrendDown && longTrendDown && (noAssets || priceIsHigher)) {
      s.signal = 'sell'
    } else if(allBuy && shortTrendUp && longTrendDown && (noAssets || priceIsLower)) {
      s.signal = 'buy'
    }
    // } else if(normSell && priceIsHigher) {
    //   s.signal = 'sell'
    // } else if(normBuy && priceIsLower) {
    //   s.signal = 'buy'
    // } else if(normBuy && noAssets && goingUp) {
    //   s.signal = 'buy'
    // }


    console.log(s.signal)

        
    // const long = [weights[4], weights[5]]
    global.trend3 = trend3
    global.trend8 = trend8
    global.trend18 = trend18
    global.trend38 = trend38
    global.trend = s.trend
    global.trendDiff = trendDiff
    global.trendLength = s.trendLength
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