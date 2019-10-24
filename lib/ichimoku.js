const crossover = require('./helpers').crossover
  , crossunder = require('./helpers').crossunder

function resolve(src, fallback) { return isNaN(src) ? fallback : src}


function donchian(s, len) {

  let data = s.lookback.slice(0, len - 1),
    lowData = [s.period.low, ...data.map(p => p.low)],
    highData = [s.period.high, ...data.map(p => p.high)]

  return (Math.min(...lowData) + Math.max(...highData)) / 2

}


function getIntersect(s, key1, key2) {

  return (s.lookback[0][key1] * (s.period[key2] - s.lookback[0][key2]) -
    s.lookback[0][key2] * (s.period[key1] - s.lookback[0][key1])) /
      ((s.period[key2] - s.lookback[0][key2]) - (s.period[key1] - s.lookback[0][key1]))
}

function belowKumo(s, key, key1, key2) {

  return valueBelowKumo(s, s.period[key], key1, key2)
}
function aboveKumo(s, key, key1, key2) {

  return valueAboveKumo(s, s.period[key], key1, key2)
}

function valueBelowKumo(s, val, key1, key2) {

  if(s.lookback.length >= s.options.displacement)
    return valueBelow(val, s.lookback[s.options.displacement][key1], s.lookback[s.options.displacement][key2])
  else
    throw 'belowKumo, s.lookback.length < s.options.displacement'
}

function valueAboveKumo(s, val, key1, key2) {

  if(s.lookback.length >= s.options.displacement)
    return valueAbove(val, s.lookback[s.options.displacement][key1], s.lookback[s.options.displacement][key2])
  else
    throw 'aboveKumo, s.lookback.length < s.options.displacement'
}

function valueAbove(val, target1, target2) {
  return val > Math.max(target1, target2)
}

function valueBelow(val, target1, target2) {
  return val < Math.min(target1, target2)
}



// == == ichimoku cloud signals == ==





// == Tenkan Sen (turning line) / Kijun Sen (standard line) Cross ==
function calcTkCross(s, previousVal) {

  let bullish = crossover(s, 'tenkenSen', 'kijunSen')
  let bearish = crossunder(s, 'tenkenSen', 'kijunSen')

  let intersect = getIntersect(s, 'tenkenSen', 'kijunSen')
  let above = valueAboveKumo(s, intersect, 'senkouA', 'senkouB')
  let below = valueBelowKumo(s, intersect, 'senkouA', 'senkouB')
  let inside = !above && !below

  let score =  resolve(previousVal, 0)
  if (bullish && below) {score = s.options.weakPoints}      //A weak bullish signal occurs when the cross is below the Kumo.
  if (bullish && inside) {score = s.options.neutralPoints}  //A neutral bullish signal occurs when the cross is inside the Kumo.
  if (bullish && above) {score = s.options.strongPoints}    //A strong bullish signal occurs when the cross is above the Kumo.
  if (bearish && below) {score = -s.options.strongPoints}   //A strong bearish signal occurs when the cross is below the Kumo.
  if (bearish && inside) {score = -s.options.neutralPoints} //A neutral bearish signal occurs when the cross is inside the Kumo.
  if (bearish && above) {score = -s.options.weakPoints}     //A weak bearish signal occurs when the cross is above the Kumo.

  return (score)

}

// == Price and Kijun Sen (standard line) Cross ==
function calcPkCross(s, previousVal) {

  let bullish = crossover(s, 'close', 'kijunSen')
  let bearish = crossunder(s, 'close', 'kijunSen')

  let intersect = getIntersect(s, 'close', 'kijunSen')
  let above = valueAboveKumo(s, intersect, 'senkouA', 'senkouB')
  let below = valueBelowKumo(s, intersect, 'senkouA', 'senkouB')
  let inside = !above && !below

  let score =  resolve(previousVal, 0)
  if (bullish && below) {score = s.options.weakPoints}      //A weak bullish signal occurs when the cross is below the Kumo.
  if (bullish && inside) {score = s.options.neutralPoints}  //A neutral bullish signal occurs when the cross is inside the Kumo.
  if (bullish && above) {score = s.options.strongPoints}    //A strong bullish signal occurs when the cross is above the Kumo.
  if (bearish && below) {score = -s.options.strongPoints}   //A strong bearish signal occurs when the cross is below the Kumo.
  if (bearish && inside) {score = -s.options.neutralPoints} //A neutral bearish signal occurs when the cross is inside the Kumo.
  if (bearish && above) {score = -s.options.weakPoints}     //A weak bearish signal occurs when the cross is above the Kumo.

  return (score)

}

// == Kumo Breakouts ==
function calcKumoBreakout(s, previousVal) {

  let bullish = (crossover(s, 'close', 'senkouA') && s.period.senkouA >= s.period.senkouB) || (crossover(s, 'close', 'senkouB') && s.senkouB >= s.senkouA)
  let bearish = (crossunder(s, 'close', 'senkouB') && s.period.senkouA >= s.period.senkouB) || (crossover(s, 'close', 'senkouA') && s.senkouB >= s.senkouA)

  let score =  resolve(previousVal, 0)
  if (bullish) {score = s.options.strongPoints}  //A bullish signal occurs when the price goes upwards through the top of the Kumo.
  if (bearish) {score = -s.options.strongPoints} //A bearish signal occurs when the price goes downwards through the bottom of the Kumo.

  return (score)

}

// == Senkou Span Cross ==
// The Senkou Span Cross signal occurs when the Senkou Span A (1st leading line) crosses the Senkou Span B (2nd leading line).
// NOTE: this cross occurs ahead of the price, since it's displaced to the right; this displacement must be removed
function calcSenkouCross(s, previousVal) {

  s.period.noDpsenkouA = (s.period.tenkenSen + s.period.kijunSen) / 2 //Senkou Span A (no displacement)
  s.period.noDpsenkouB = donchian(s, s.options.senkouSpanPeriods) //senkou Span B (no displacement)

  let bullish = crossover(s, 'noDpsenkouA', 'noDpsenkouB')
  let bearish = crossunder(s, 'noDpsenkouA', 'noDpsenkouB')

  let score =  resolve(previousVal, 0)
  if (bullish && s.priceBelowKumo) {score = s.options.weakPoints}      //A weak bullish signal occurs if the current price is below the Kumo.
  if (bullish && s.priceInsideKumo) {score = s.options.neutralPoints}  //A neutral bullish signal occurs if the current price is inside the Kumo.
  if (bullish && s.priceAboveKumo) {score = s.options.strongPoints}    //A strong bullish signal occurs if the current price is above the Kumo.
  if (bearish && s.priceBelowKumo) {score = -s.options.strongPoints}   //A strong bearish signal occurs if the current price is below the Kumo.
  if (bearish && s.priceInsideKumo) {score = -s.options.neutralPoints} //A neutral bearish signal occurs if the current price is inside the Kumo.
  if (bearish && s.priceAboveKumo) {score = -s.options.weakPoints}     //A weak bearish signal occurs if the current price is above the Kumo.

  return (score)

}

// == Chikou Span Cross ==
// The Chikou Span Cross signal occurs when the Chikou Span (Lagging line) rises above or falls below the price.
function calcChikouCross(s, previousVal) {

  s.period.leadline = s.lookback[s.options.displacement].close//offset(s.period.close, s.options.displacement)
  let bullish = crossover(s, 'close', 'leadline')
  let bearish = crossunder(s, 'close', 'leadline')

  let score =  resolve(previousVal, 0)
  if (bullish && s.priceBelowKumo) {score = s.options.weakPoints}      //A weak bullish signal occurs if the current price is below the Kumo.
  if (bullish && s.priceInsideKumo) {score = s.options.neutralPoints}  //A neutral bullish signal occurs if the current price is inside the Kumo.
  if (bullish && s.priceAboveKumo) {score = s.options.strongPoints}    //A strong bullish signal occurs if the current price is above the Kumo.
  if (bearish && s.priceBelowKumo) {score = -s.options.strongPoints}   //A weak bearish signal occurs if the current price is above the Kumo.
  if (bearish && s.priceInsideKumo) {score = -s.options.neutralPoints} //A neutral bearish signal occurs if the current price is inside the Kumo.
  if (bearish && s.priceAboveKumo) {score = -s.options.weakPoints}     //A strong bearish signal occurs if the current price is below the Kumo.

  return (score)

}


// == price relative to cloud ==
function calcPricePlacement(s, previousVal) {

  let score =  resolve(previousVal, 0)
  if (s.priceAboveKumo) {score = s.options.strongPoints}
  if (s.priceInsideKumo) {score = s.options.neutralPoints}
  if (s.priceBelowKumo) {score = -s.options.strongPoints}

  return (score)

}



// == lag line releative to cloud ==
function calcChikouPlacement(s, previousVal) {

  let score =  resolve(previousVal, 0)
  if(s.lookback.length >= s.options.displacement) {
    // above
    if(aboveKumo(s, 'close', 'senkouA', 'senkouB'))
      score = s.options.strongPoints
    // below
    else if(belowKumo(s, 'close', 'senkouA', 'senkouB'))
      score = -s.options.strongPoints
    else
      score = 0
  }

  return (score)
}


module.exports = function ichimoku(s, key, length) {

  if (s.lookback.length > s.options.min_periods) {



    // == == generate ichimoku data == ==
  
  
    s.period.tenkenSen = donchian(s, s.options.tenkenSenPeriods)
    s.period.kijunSen = donchian(s, s.options.kijunSenPeriods)
  
    s.period.senkouA = (s.period.tenkenSen + s.period.kijunSen) / 2
    s.period.senkouB = donchian(s, s.options.senkouSpanPeriods)
  
    // have to wait until displacement periods have passed
    if (s.lookback.length > s.options.displacement) {
  
      s.lookback[s.options.displacement].chikouSen = s.period.close
  
      s.priceAboveKumo = valueAbove(s.period.close, s.period.senkouA, s.period.senkouB)
      s.priceBelowKumo = valueBelow(s.period.close, s.period.senkouA, s.period.senkouB)
      s.priceInsideKumo = !s.priceAboveKumo && !s.priceBelowKumo
  
      // == == calculate score == ==
  
  
      s.period.tkCrossScore = calcTkCross(s, s.lookback[0].tkCrossScore)
      s.period.pkCrossScore = calcPkCross(s, s.lookback[0].pkCrossScore)
      s.period.kumoBreakoutScore = calcKumoBreakout(s, s.lookback[0].kumoBreakoutScore)
      s.period.senkouCrossScore =  calcSenkouCross(s, s.lookback[0].senkouCrossScore)
      s.period.chikouCrossScore = calcChikouCross(s, s.lookback[0].chikouCrossScore)
      s.period.pricePlacementScore = calcPricePlacement(s, s.lookback[0].pricePlacementScore)
      s.period.chikouPlacementScore = calcChikouPlacement(s, s.lookback[0].chikouPlacementScore)
  
      s.totalScore = (s.options.tkCrossWeight * s.period.tkCrossScore)
      s.totalScore += (s.options.pkCrossWeight * s.period.pkCrossScore)
      s.totalScore += (s.options.kumoBreakoutWeight * s.period.kumoBreakoutScore)
      s.totalScore += (s.options.senkouCrossWeight * s.period.senkouCrossScore)
      s.totalScore += (s.options.chikouCrossWeight * s.period.chikouCrossScore)
      s.totalScore += (s.options.pricePlacementWeight * s.period.pricePlacementScore)
      s.totalScore += (s.options.chikouPlacementWeight * s.period.chikouPlacementScore)
  
      let maxScore = s.options.strongPoints * (s.options.tkCrossWeight + s.options.pkCrossWeight + s.options.kumoBreakoutWeight + s.options.senkouCrossWeight + s.options.chikouCrossWeight + s.options.pricePlacementWeight + s.options.chikouPlacementWeight)
      s.normalizedScore = 100 * s.totalScore / maxScore
  
    }
  }
}