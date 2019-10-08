#!/usr/bin/env node
'use strict'

/* Zenbot 4 Genetic Backtester
 * Clifford Roche <clifford.roche@gmail.com>
 * 07/01/2017
 *
 * Example: ./darwin.js --selector="bitfinex.ETH-USD" --days="10" --currency_capital="5000" --use_strategies="all | macd,trend_ema,etc" --population="101" --population_data="simulations/generation_data_NUMBERS"
 * Params:
 * --use_strategies=<stragegy_name>,<stragegy_name>,<stragegy_name>   Min one strategy, can include more than one
 * --population_data=<filename>           filename used for continueing backtesting from previous run
 * --generateLaunch=<true>|<false>        will generate .sh and .bat file using the best generation discovered
 * --ignoreLaunchFitness=<true>|<false>   if used with --generateLaunch it will always write a new launch file regardless if latest fitness is greater
 * --floatScanWindow                      Time window used for analyzing data be adjusted every generation
 * --population=<int>                     populate per strategy
 * --maxCores=<int>                       maximum processes to execute at a time default is # of cpu cores in system
 * --selector=<exchange.marketPair>
 * --asset_capital=<float>                amount coin to start sim with
 * --currency_capital=<float>             amount of capital/base currency to start sim with
 * --days=<int>                           amount of days to use when backfilling
 * --noStatSave=<true>|<false>            true:no statistics are saved to the simulation folder
 * --silent=<true>|<false>                true:can improve performance
 * --runGenerations=<int>                 if used run this number of generations, will be shown 1 less due to generations starts at 0
 * --minTrades=<int>                      Minimum wins before generation is considured fit to evolve
 * --fitnessCalcType=<wl / profit / classic / profitwl> Default: Classic. wl will score the highes for wins and losses, profit doesn't care about wins and losses only the higest end balance, classic uses original claculation / profitwl tries to get the highest profit using the lowest win/loss ratio
 *
 *
 * any parameters for sim and or strategy can be passed in and will override the genetic test generated parameter
 * i.e. if --period_length=1m is passed all test will be performed using --period_length=1m instead of trying to find that parameter
 *
 */

let fs = require('fs')
let GeneticAlgorithmCtor = require('geneticalgorithm')
let moment = require('moment')
let path = require('path')
// eslint-disable-next-line no-unused-vars
let colors = require('colors')
let Phenotypes = require('../../lib/phenotype')
let Backtester = require('../../lib/backtester')
let argv = require('yargs').argv
const isUndefined = require('./utils').isUndefined
const simulateGeneration = require('./generation/simulator')
const allStrategyNames = require('./utils').allStrategyNames
const writeSimDataFile = require('./generation/writer').writeSimDataFile


let VERSION = 'Zenbot 4 Genetic Backtester v0.2.3'

let PARALLEL_LIMIT = (process.env.PARALLEL_LIMIT && +process.env.PARALLEL_LIMIT) || require('os').cpus().length


let selectedStrategies
let pools = {}
let simArgs
let populationSize = 0
let generationCount = 1
let runGenerations = undefined
let generationProcessing = false
let population_data = ''
let noStatSave = false
//let floatScanWindow = false
let ignoreLaunchFitness = false
let minimumTrades = 0
let fitnessCalcType = 'classic'



// Find the first incomplete generation of this session, where incomplete means no "results" files
while (fs.existsSync(`simulations/${population_data}/gen_${generationCount}`)) {
  generationCount++
}
generationCount--

if (generationCount > 0 && !fs.existsSync(`simulations/${population_data}/gen_${generationCount}/results.csv`)) {
  generationCount--
}



console.log(`\n--==${VERSION}==--`)
console.log(new Date().toUTCString() + '\n')

simArgs = Object.assign({}, argv)
if (!simArgs.selector) {
  simArgs.selector = 'bitfinex.ETH-USD'
}

if (!simArgs.filename) {
  simArgs.filename = 'none'
}

if (simArgs.help || !(simArgs.use_strategies)) {
  console.log('--use_strategies=<stragegy_name>,<stragegy_name>,<stragegy_name>   Min one strategy, can include more than one')
  console.log('--population_data=<filename>    filename used for continueing backtesting from previous run')
  console.log('--generateLaunch=<true>|<false>        will generate .sh and .bat file using the best generation discovered')
  console.log('--population=<int>    populate per strategy')
  console.log('--maxCores=<int>    maximum processes to execute at a time default is # of cpu cores in system')
  console.log('--selector=<exchange.marketPair>  ')
  console.log('--asset_capital=<float>    amount coin to start sim with ')
  console.log('--currency_capital=<float>  amount of capital/base currency to start sim with')
  console.log('--days=<int>  amount of days to use when backfilling')
  console.log('--noStatSave=<true>|<false>')
  console.log('--runGenerations=<int>  if used run this number of generations, will be shown 1 less due to generations starts at 0')
  console.log('--minTrades=<int>  Minimum wins before generation is considured fit to evolve')
  console.log('--fitnessCalcType=<wl / profit / classic / profitwl> Default: Classic.')
  console.log('                  wl will score the highes for wins and losses, profit does not care about wins and losses only the higest end balance,')
  console.log('                  classic uses original claculation / profitwl tries to get the highest profit using the lowest win/loss ratio')
  process.exit(0)
}

delete simArgs.use_strategies
delete simArgs.population_data
delete simArgs.population
delete simArgs['$0'] // This comes in to argv all by itself
delete simArgs['_']  // This comes in to argv all by itself

if (simArgs.maxCores) {
  if (simArgs.maxCores < 1) PARALLEL_LIMIT = 1
  else PARALLEL_LIMIT = simArgs.maxCores
}
fitnessCalcType = 'classic'
if (simArgs.fitnessCalcType) {

  if (simArgs.fitnessCalcType == 'classic') fitnessCalcType = 'classic'
  if (simArgs.fitnessCalcType == 'wl') fitnessCalcType = 'wl'
  if (simArgs.fitnessCalcType == 'profit') fitnessCalcType = 'profit'
  if (simArgs.fitnessCalcType == 'profitwl') fitnessCalcType = 'profitwl'


}


if (!isUndefined(simArgs.runGenerations)) {
  if (simArgs.runGenerations) {
    runGenerations = simArgs.runGenerations - 1
  }
}

let generateLaunchFile = (simArgs.generateLaunch) ? true : false
noStatSave = (simArgs.noStatSave) ? true : false

let strategyName = (argv.use_strategies) ? argv.use_strategies : 'all'
populationSize = (argv.population) ? argv.population : 100
minimumTrades = (argv.minTrades) ? argv.minTrades : 0
//floatScanWindow = (argv.floatScanWindow) ? argv.floatScanWindow : false
ignoreLaunchFitness = (argv.ignoreLaunchFitness) ? argv.ignoreLaunchFitness : false

population_data = argv.population_data || `backtest.${simArgs.selector.toLowerCase()}.${moment().format('YYYYMMDDHHmmss')}`

console.log(`Backtesting strategy ${strategyName} ...\n`)
console.log(`Creating population of ${populationSize} ...\n`)

selectedStrategies = (strategyName === 'all') ? allStrategyNames() : strategyName.split(',')

Backtester.deLint()

for (var i = 0; i < selectedStrategies.length; i++) {
  let strategy = selectedStrategies[i]
  let strategyPool = pools[strategy] = {}
  let strategyData = require(path.resolve(__dirname, `../../extensions/strategies/${strategy}/strategy`))
  let strategyPhenotypes = strategyData.phenotypes

  if (strategyPhenotypes) {
    let evolve = true
    let population = []

    for (var i2 = population.length; i2 < populationSize; ++i2) {
      var lPheno = Phenotypes.create(strategyPhenotypes)
      population.push(lPheno)
      evolve = false
    }

    strategyPool['config'] = {
      mutationFunction: function (phenotype) {
        return Phenotypes.mutation(phenotype, strategyPhenotypes)
      },
      crossoverFunction: function (phenotypeA, phenotypeB) {
        return Phenotypes.crossover(phenotypeA, phenotypeB, strategyPhenotypes)
      },
      fitnessFunction: Phenotypes.fitness,
      doesABeatBFunction: Phenotypes.competition,
      population: population,
      populationSize: populationSize
    }

    strategyPool['pool'] = GeneticAlgorithmCtor(strategyPool.config)

    if (evolve) {
      strategyPool['pool'].evolve()
    }
  }
  else {
    if (strategyName === 'all') {
      // skip it
      selectedStrategies.splice(i, 1)
      i--
    }
    else {
      console.log(`No phenotypes definition found for strategy ${strategy}`)
      process.exit(1)
    }
  }
}

// BEGIN - exitHandler
var exitHandler = function (options, exitErr) {
  if (generationCount && options.cleanup && (isUndefined(runGenerations) || runGenerations !== generationCount)) {
    console.log('Resume this backtest later with:')
    var darwin_args = process.argv.slice(2, process.argv.length)

    var hasPopData = false
    var popDataArg = `--population_data=${population_data}`
    darwin_args.forEach(function (arg) {
      if (arg === popDataArg) {
        hasPopData = true
      }
    })

    if (!hasPopData) {
      darwin_args.push(popDataArg)
    }

    console.log(`./scripts/genetic_backtester/darwin.js ${darwin_args.join(' ')}`)
  }

  if (exitErr) console.log(exitErr.stack || exitErr)
  if (options.exit) process.exit()
}

process.on('exit', exitHandler.bind(null, { cleanup: true }))

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }))

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }))
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }))

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }))
// END - exitHandler

Backtester.init({
  simArgs: simArgs,
  simTotalCount: populationSize * selectedStrategies.length,
  parallelLimit: PARALLEL_LIMIT,
  writeFile: (iteration, data) => {
    // console.log('backtester writing iteration ', iteration, population_data, generationCount)
    writeSimDataFile(iteration, data, population_data, generationCount)
  }
})
/*eslint-disable */
setInterval(async () => {
/*eslint-enable */
  if (generationProcessing == false) {
    generationProcessing = true
    await simulateGeneration(generateLaunchFile, population_data, generationCount, pools, noStatSave, runGenerations, selectedStrategies, minimumTrades, fitnessCalcType, ignoreLaunchFitness)
    generationProcessing = false
  }
}, 1000)
