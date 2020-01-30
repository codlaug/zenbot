const z = require('zero-fill')
  , n = require('numbro')
  , colors = require('colors')
  , chalk = require('chalk')

module.exports = function onReport() {
  var cols = []
  const { trend8, trend, trendDiff, periodCount, trendStrength, trendLength, rateOfChangeRateOfChange, trend3, trend18, trend38, ema, trend18_3 } = global
  // cols.push(z(4, n(periodCount).format('0')+' ', ' '))
  cols.push(z(8, n(global.avgPrice).format('0.00')+' ', ' '))
  // cols.push(z(6, n(global.ema).format('0.00')+' ', ' '))
  // cols.push(typeof global.avgPrice !== 'undefined' ? global.avgPrice.toString() : '')
  // if(global.trend26) {
  //   cols.push(chalk.rgb(255, 0, 0)(n(global.trend26.down9).format('00%')+' '))
  // }
  if(trend38) {
    const { down: down38 } = trend38
    cols.push(chalk.rgb(Math.min(255, Math.round(200*((down38-0.3)*5))+55), 0, 0)(n(down38).format('00%')+' '))
  }
  if(trend18) {
    const { down: down18 } = trend18
    cols.push(chalk.rgb(Math.min(255, Math.round(200*((down18-0.3)*5))+55), 0, 0)(n(down18).format('00%')+' '))
  }
  if(trend18_3) {
    const { down: down18_3 } = trend18_3
    cols.push(chalk.rgb(Math.min(255, Math.round(200*((down18_3-0.2)*6))+55), 0, 90)(n(down18_3).format('00%')+' '))
  }
  if(trend8) {
    const { down: down8 } = trend8
    cols.push(chalk.rgb(Math.min(255, Math.round(200*((down8-0.4)*5))+55), 0, 0)(n(down8).format('00%')+' '))
  }
  if(trend3) {
    const { down: down3 } = trend3
    cols.push(chalk.rgb(Math.min(255, Math.round(200*((down3-0.4)*5))+55), 0, 0)(n(down3).format('00%')+' '))
  }
  if(ema) {
    cols.push(chalk.rgb(200, 50, 200)(z(4, n(ema).format('0.00'), ' ')+' '))
  }
  // if(typeof slope3 !== 'undefined') {
  //   const red = Math.min(255, Math.round(-255*Math.min(slope3, 0)))
  //   const green = Math.min(255, Math.round(255*Math.max(0, slope3)))
  //   cols.push(chalk.rgb(red, green, 0)(z(4, n(slope3).format('0.0'), ' ')+' '))
  // }
  // if(typeof slope8 !== 'undefined') {
  //   const red = Math.min(255, Math.round(-255*Math.min(slope8, 0)))
  //   const green = Math.min(255, Math.round(255*Math.max(0, slope8)))
  //   cols.push(chalk.rgb(red, green, 0)(z(4, n(slope8).format('0.0'), ' ')+' '))
  // }
  // if(typeof slope18 !== 'undefined') {
  //   const red = Math.min(255, Math.round(-255*Math.min(slope18, 0)))
  //   const green = Math.min(255, Math.round(255*Math.max(0, slope18)))
  //   cols.push(chalk.rgb(red, green, 0)(z(4, n(slope18).format('0.0'), ' ')+' '))
  // }
  // if(typeof slope38 !== 'undefined') {
  //   const red = Math.min(255, Math.round(-255*Math.min(slope38, 0)))
  //   const green = Math.min(255, Math.round(255*Math.max(0, slope38)))
  //   cols.push(chalk.rgb(red, green, 0)(z(4, n(slope38).format('0.0'), ' ')+' '))
  // }
  // if(typeof rateOfChangeRateOfChange !== 'undefined') {
  //   const red = Math.min(255, Math.round(-255*Math.min(rateOfChangeRateOfChange, 0)))
  //   const green = Math.min(255, Math.round(255*Math.max(0, rateOfChangeRateOfChange)))
  //   cols.push(chalk.rgb(red, green, 0)(z(4, n(rateOfChangeRateOfChange).format('0.0'), ' ')+' '))
  // }
  if(trend) {
    if(trend === 'risingsell') {
      cols.push(chalk.red('risingsell '))
    } else if(trend === 'fallingbuy') {
      cols.push(chalk.green('fallingbuy '))
    }
  }
  if(trendDiff) {
    cols.push(chalk.yellow(n(trendDiff).format('0.0000')+' '))
  }
  if(trendStrength) {
    cols.push(chalk.cyan(n(trendStrength).format('0.000')+' '))
  }
  if(trendLength) {
    cols.push(chalk.cyan('+'+n(trendLength.buy).format('0')+' '))
    cols.push(chalk.cyan('-'+n(trendLength.sell).format('0')+' '))
  }
  if(trend3) {
    const { up: up3 } = trend3
    cols.push(chalk.rgb(0, Math.max(1, Math.min(255, Math.round(200*((up3-0.4)*5))+55)), 0)(n(up3).format('00%')+' '))
  }
  if(trend8) {
    const { up: up8 } = trend8
    cols.push(chalk.rgb(0, Math.max(1, Math.min(255, Math.round(200*((up8-0.4)*5))+55)), 0)(n(up8).format('00%')+' '))
  }
  if(trend18) {
    const { up: up18 } = trend18
    cols.push(chalk.rgb(0, Math.max(1, Math.min(255, Math.round(200*((up18-0.3)*5))+55)), 0)(n(up18).format('00%')+' '))
  }
  if(trend18_3) {
    const { up: up18_3 } = trend18_3
    cols.push(chalk.rgb(0, Math.max(1, Math.min(255, Math.round(200*((up18_3-0.1)*6))+55)), 90)(n(up18_3).format('00%')+' '))
  }
  if(trend38) {
    const { up: up38 } = trend38
    cols.push(chalk.rgb(0, Math.max(1, Math.min(255, Math.round(200*((up38-0.3)*5))+55)), 0)(n(up38).format('00%')+' '))
  }
  // if(global.trend26) {
  //   cols.push(chalk.rgb(0, 255, 0)(global.trend26.up9.toString()))
  // }
  // const shortTrend = global.weights[1] - global.weights[0]
  // cols.push(shortTrend < -0.9 ? 'S'.red : (shortTrend > 0.9 ? 'S'.green : 's'.gray))
  // const buySignal = global.buySignal === 'buy'
  // cols.push(buySignal ? 'B'.green : 'b'.gray)
  // const sellSignal = global.sellSignal === 'sell'
  // cols.push(sellSignal ? 'S'.red : 's'.gray)
  // const longTrend = global.weights[1] - global.weights[0]
  // cols.push(longTrend < -0.9 ? 'L'.red : (longTrend > 0.9 ? 'L'.green : 'l'.gray))
  // const doomTrend = global.stopLossSignal
  // cols.push(doomTrend ? 'D'.red : 'd'.gray)
  // const moonTrend = global.toTheMoonSignal
  // cols.push(moonTrend ? '+'.green : '+'.gray)
  // const slope = global.slope
  // cols.push(slope > 0.5 ? '/'.green : (slope < -0.5 ? '\\'.red : '-'.yellow))
  // cols.push(typeof global.stopLossBackoffCountdown !== 'undefined' ? global.stopLossBackoffCountdown.toString() : ' ')
  // cols.push(typeof global.countdown2 !== 'undefined' ? global.countdown2.toString() : ' ')
    
  // cols.push(typeof global.weights !== 'undefined' ? global.weights.toString() : '')
  return cols
}