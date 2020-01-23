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
    const slope2 = s.slope2.m
    const weights = data.toString().split(' ').map(i => parseFloat(i))
    // const short = [weights[0], weights[1]]
    const trend6 = {
      down6: weights[0],
      up6: weights[1]
    }

    // const trend26 = {
    //     down9: weights[2],
    //     up9: weights[3]
    // }

    if(trend6.down6 > 0.99) {
      if(s.trend !== 'down') {
        // reverse trend
        s.trend = 'down'
        s.trendPoints = [[0, s.period.close]]
        s.trendLength = 0
        console.log(priceDiff)
        s.trendStartPrice = s.period.close
      } else {
        s.trendLength += 1
        s.trendPoints.push([s.trendPoints.length, s.period.close])
      }
      if(priceDiff > 0.0025) {
        s.signal = 'sell'
      }
    } else if(trend6.up6 > 0.99) {
      if(s.trend !== 'up') {
        // reverse trend
        s.trend = 'up'
        s.trendPoints = [[0, s.period.close]]
        s.trendLength = 0
        // console.log(trendDiff)
        
        s.trendStartPrice = s.period.close
      } else {
        s.trendLength += 1
        s.trendPoints.push([s.trendPoints.length, s.period.close])
      }
      if(s.trendLength > 3 && slope2 > 1 && s.rateOfChangeOfRate > 1) {
        s.signal = 'buy'
      }
      if(priceDiff < -0.003) {
        s.signal = 'buy'
      }
    } else {
      // current trend interrupted
      s.trendLength = 0
      s.trendPoints = []
      s.trend = null
      s.signal = null
    }


    console.log(s.signal)

        
    // const long = [weights[4], weights[5]]
    global.trend6 = trend6
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