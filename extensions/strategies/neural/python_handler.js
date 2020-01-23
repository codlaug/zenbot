module.exports = function(s, cb) {
  return function pythonHandler(data) {
    // console.log(data)

    s.signal = null
    const curPrice = s.period.close
    const lastPrice = s.lookback[0].close
    const avgPrice = s.costBasis.avgPrice()
    const weights = data.toString().split(' ').map(i => parseFloat(i))
    // const short = [weights[0], weights[1]]
    const doomsday = weights[0]
    const trend22down8 = weights[1]
    const mid = [weights[2], weights[3]]
    const trend22up8 = weights[4]
    const tothemoon = weights[5]
    const currentSlope = curPrice - lastPrice
    const stopLossSignal = doomsday > 0.5
    // const shortSignal = short[0] > 0.95 ? 'sell' : (short[1] > 0.95 ? 'buy' : null)
    const midSellSignal = mid[0] > 0.9 ? 'sell' : null
    const midBuySignal = mid[1] > 0.9 ? 'buy' : null
    // const LongSignal = long[0] > 0.95 ? 'sell' : (long[1] > 0.95 ? 'buy' : null)
    const toTheMoonSignal = tothemoon > 0.98
    if(midBuySignal === 'buy') {
        s.sellSignalStrength = 0
        s.buySignalStrength += 1
    } else if(midSellSignal === 'sell') {
        s.buySignalStrength = 0
        s.sellSignalStrength += 1
    } else {
        s.sellSignalStrength = 0
        s.buySignalStrength = 0
    }

    // buy signal could prop up to the moon signal
    // console.log('buySignal', midBuySignal)
    // mid buy seems to lead a dip in price and then a bounce back up
    // if(midBuySignal === 'buy' && midBuySignal !== s.lastMidSignal) {
    //   s.inMidBuySignal = true
    //   // console.log('start mid buy')
    // }
    // if(midBuySignal === 'buy' && s.inMidBuySignal && !s.inStopLossSignal) {
    //   // const currentSlope = curPrice - lastPrice
        
    //   if(currentSlope > -0.5) {
    //     if(avgPrice === 0 || curPrice < avgPrice) {
    //       s.signal = 'buy'
    //     }
    //   }
    // }
    // if(midBuySignal !== 'buy' && s.inMidBuySignal === true) {
    //   s.inMidBuySignal = false
    //   // console.log('cancelling midbuy')
    // }
    if(!s.inToTheMoonSignal) {
        if(midSellSignal === 'sell' && (curPrice - avgPrice) / curPrice > 0.0029 /*&& currentSlope < 0.5*/) {
        s.signal = 'sell'
        }
        // maybe sell if the price hits +0.06 and then drops
        // could add a different kind of stop loss
        // if(avgPrice !== 0 && (curPrice - avgPrice) / curPrice > 0.006) {

        // }
        // if(midBuySignal !== 'buy' && avgPrice !== 0 && (curPrice - avgPrice) / curPrice > 0.006) {
        //   s.signal = 'sell'
        // }
    }

    // console.log(s.stopLossBackoffCountdown)
    if(stopLossSignal && currentSlope < 1) {
        s.signal = 'sell'
    }
    if(stopLossSignal) {
        s.inStopLossSignal = true
        s.stopLossBackoffCountdown = 32
    }
    if(s.stopLossBackoffCountdown > 0) {
        s.stopLossBackoffCountdown -= 1
    }
    if(s.stopLossBackoffCountdown === 0 & !stopLossSignal) {
        s.inStopLossSignal = false
    }

    if(toTheMoonSignal) {
        s.signal = 'buy'
    }
    if(toTheMoonSignal) {
        s.inToTheMoonSignal = true
        s.toTheMoonBackoffCountdown = 32
    }
    if(s.toTheMoonBackoffCountdown > 0) {
        s.toTheMoonBackoffCountdown -= 1
    }
    if(s.toTheMoonBackoffCountdown === 0 & !toTheMoonSignal) {
        s.inToTheMoonSignal = false
    }
    console.log(s.signal)
        
    // const long = [weights[4], weights[5]]
    global.buySignal = midBuySignal
    global.sellSignal = midSellSignal
    global.slope = currentSlope
    global.stopLossSignal = stopLossSignal
    global.countdown = s.stopLossBackoffCountdown
    global.toTheMoonSignal = toTheMoonSignal
    global.countdown2 = s.toTheMoonBackoffCountdown
        
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

    s.lastMidSignal = midBuySignal
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