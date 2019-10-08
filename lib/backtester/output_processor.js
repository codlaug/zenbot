'use strict'

let moment = require('moment')
  , argv = require('yargs').argv
  , path = require('path')
  , fs = require('fs')
  , roundp = require('round-precision')

module.exports = function processOutput(output, taskStrategyName, pheno) {
  let selector = pheno.selector || pheno.exchangeMarketPair
  // console.log('__dirname', __dirname)
  let tFileName = path.resolve(__dirname, '..', '..', 'simulations', 'sim_' + taskStrategyName.replace('_', '') + '_' + selector.toLowerCase().replace('_', '') + '_' + pheno.backtester_generation + '.json')
  let simulationResults
  
  let outputArray
  let params
  let assetPriceLastBuy
  let lastAssestValue
  let assetCapital
  let profit
  let startCapital
  let endBalance
  let buyHold
  let vsBuyHold
  //let wlMatch
  //let errMatch
  let wins
  let losses
  let errorRate
  let days
  let start
  let end
  // This can retrieve the results from 2 different places.  It defaults to reading it from the json file
  // but if no file is found it will fall back to the older metheod of scraping the output of the sim process
  // stdio scraping to be removed after full verification of functionality.
  // todo: see above comment
  // console.log('looked for result file', tFileName)
  if (fs.existsSync(tFileName)) {
    // console.log('and found it!')
    let jsonBuffer
    jsonBuffer = fs.readFileSync(tFileName, { encoding: 'utf8' })
    simulationResults = JSON.parse(jsonBuffer)
    fs.unlinkSync(tFileName)
  } else {
    console.log('could not find result file')
    console.log('output', output)
    console.log(pheno)
    console.log('looked for ', tFileName)
  }
  
  // If somehow the sim file failed to write, this will most often recover it by parsing the last output
  if (typeof (simulationResults) !== 'object') {
    // Find everything between the first { and last }
    outputArray = output.split('{')
    outputArray.shift()
    output = outputArray.join('{')
  
    outputArray = output.split('}')
    outputArray.pop()
    output = outputArray.join('}')
  
    // try {
    simulationResults = JSON.parse(`{${output}}`)
    // } catch(error) {
    //   console.log('problem JSON.parsing output', output)
    //   simulationResults = eval(output)
    // }
  }
  
  if (typeof (simulationResults) === 'object' && typeof simulationResults.simresults !== typeof undefined) {
    params = simulationResults
    endBalance = simulationResults.simresults.currency
    assetPriceLastBuy = simulationResults.simresults.last_buy_price
    lastAssestValue = simulationResults.simresults.last_assest_value
    assetCapital = simulationResults.simresults.asset_capital
    startCapital = simulationResults.simresults.start_capital
    profit = simulationResults.simresults.profit
  
  
    buyHold = simulationResults.simresults.buy_hold
    vsBuyHold = simulationResults.simresults.vs_buy_hold
    //wlMatch = (simulationResults.simresults.total_sells - simulationResults.simresults.total_losses) +'/'+ simulationResults.simresults.total_losses
    wins = simulationResults.simresults.total_sells - simulationResults.simresults.total_losses
    losses = simulationResults.simresults.total_losses
    errorRate = simulationResults.simresults.total_losses / simulationResults.simresults.total_sells
    days = parseInt(simulationResults.days)
    start = parseInt(simulationResults.start)
    end = parseInt(simulationResults.end || null)
  }
  else {
    console.log(`Couldn't find simulationResults for ${pheno.backtester_generation}`)
    console.log('simResults', simulationResults)
    console.log(pheno.command.commandString)
    // this should return a general bad result but not throw an error
    // our job here is to use the result.  not diagnose an error at this point so a failing sim should just be ignored.
    // idea here is to make the fitness of this calculation as bad as possible so darwin won't use the combonation of parameters again.
    // todo:  make the result its own object, and in this function just set the values don't define the result here.
    return {
      params: 'module.exports = {}',
      endBalance: 0,
      buyHold: 0,
      vsBuyHold: 0,
      lastAssestValue: 0,
      assetPriceLastBuy:0,
      wins: 0,
      losses: -1,
      errorRate: 100,
      days: 0,
      period_length: 0,
      min_periods: 0,
      markdown_buy_pct: 0,
      markup_sell_pct: 0,
      order_type: 'maker',
      wlRatio: 'Infinity',
      roi: -1000,
      selector: selector,
      strategy: taskStrategyName,
      frequency: 0,
      assetCapital:0,
      startCapital:0,
      profit:0
  
    }
  }
  
  if (typeof params === 'undefined') {
    console.log('busted params')
    console.log(`output: ${JSON.stringify(output)}`)
    console.log(`simulationResults: ${JSON.stringify(simulationResults)}`)
  }
  
  let roi
  if (params.currency_capital == 0.0) {
    roi = roundp(endBalance, 3)
  }
  else {
    roi = roundp(((endBalance - params.currency_capital) / params.currency_capital) * 100, 3)
  }
  
  //todo: figure out what this is trying to do.
  let r = params
  delete r.asset_capital
  delete r.buy_pct
  delete r.currency_capital
  delete r.days
  delete r.mode
  delete r.order_adjust_time
  delete r.population
  delete r.population_data
  delete r.sell_pct
  delete r.start
  delete r.end
  delete r.stats
  delete r.use_strategies
  delete r.verbose
  delete r.simresults
  delete r.silent
  delete r.generateLaunch
  delete r.ignoreLaunchFitness
  delete r.maxCores
  delete r.minTrades
  delete r.noStatSave
  delete r.filename
  //delete r.fitnessCalcType
     
  r.selector = r.selector.normalized
  
  if (start) {
    r.start = moment(start).format('YYYYMMDDHHmm')
  }
  if (end) {
    r.end = moment(end).format('YYYYMMDDHHmm')
  }
  if (!start && !end && params.days) {
    r.days = params.days
  }
  if (!days) {
    days = parseInt(argv.days, 10)
  }
  if (!days || days < 1) days = 1
  
  let results = {
    params: 'module.exports = ' + JSON.stringify(r),
    assetPriceLastBuy: assetPriceLastBuy,
    lastAssestValue: lastAssestValue,
    profit: profit,
    assetCapital: assetCapital,
    startCapital: startCapital,
    endBalance: parseFloat(endBalance),
    buyHold: parseFloat(buyHold),
    vsBuyHold: parseFloat(vsBuyHold) || vsBuyHold,
    wins: wins,
    losses: losses,
    errorRate: parseFloat(errorRate),
    days: days,
    period_length: params.period_length,
    min_periods: params.min_periods,
    markdown_buy_pct: params.markdown_buy_pct,
    markup_sell_pct: params.markup_sell_pct,
    order_type: params.order_type,
    wlRatio: losses > 0 ? roundp(wins / losses, 3) : 'Infinity',
    roi: roi,
    selector: params.selector,
    strategy: params.strategy,
    frequency: roundp((wins + losses) / days, 3)
  }
  
  
  // console.log('returned results from output processoer', results)
  return results
}