'use strict'

let parallel = require('run-parallel-limit')
let Json2csvParser = require('json2csv').Parser
let fs = require('fs')
let moment = require('moment')
// eslint-disable-next-line no-unused-vars
let colors = require('colors')
let Backtester = require('../../../lib/backtester')
let argv = require('yargs').argv
let z = require('zero-fill')
let n = require('numbro')
const isUndefined = require('../utils').isUndefined
const generateCommandParams = require('../generate_command')
const saveGenerationData = require('./writer').saveGenerationData
const saveLaunchFiles = require('./writer').saveLaunchFiles
const writeSimDataFile = require('./writer').writeSimDataFile


const PARALLEL_LIMIT = (process.env.PARALLEL_LIMIT && +process.env.PARALLEL_LIMIT) || require('os').cpus().length

const readSimDataFile = (iteration, population_data, generationCount) => {
  let jsonFileName = `simulations/${population_data}/gen_${generationCount}/sim_${iteration}.json`

  if (fs.existsSync(jsonFileName)) {
    let simData = JSON.parse(fs.readFileSync(jsonFileName, { encoding: 'utf8' }))
    return simData
  }
  else {
    return null
  }
}

let cycleCount = -1
let iterationCount = 0

module.exports = function simulateGeneration(generateLaunchFile, population_data, generationCount, pools, noStatSave, runGenerations, selectedStrategies, minimumTrades, fitnessCalcType, ignoreLaunchFitness) {
  
  // Find the first incomplete generation of this session, where incomplete means no "results" files
  while (fs.existsSync(`simulations/${population_data}/gen_${generationCount}`)) {
    generationCount++
  }
  
  generationCount--
  
  if (generationCount > 0 && !fs.existsSync(`simulations/${population_data}/gen_${generationCount}/results.csv`)) {
    generationCount--
  }
  
  if (noStatSave) {
    cycleCount++
    generationCount = cycleCount
  }
  
  let ofGenerations = (!isUndefined(runGenerations)) ? `of ${runGenerations}` : ''
  
  console.log(`\n\n=== Simulating generation ${++generationCount} ${ofGenerations} ===\n`)
  Backtester.resetMonitor()
  Backtester.ensureBackfill()
  
  iterationCount = 0
  
  let tasks = selectedStrategies.map(v => pools[v]['pool'].population().map(phenotype => {
    return cb => {
      phenotype.backtester_generation = iterationCount
      phenotype.exchangeMarketPair = argv.selector
      Backtester.trackPhenotype(phenotype)
  
      var command
      let simData = readSimDataFile(iterationCount)
  
      if (simData) {
        if (simData.result) {
          // Found a complete and cached sim, don't run anything, just forward the results of it
          phenotype['sim'] = simData.result
          iterationCount++
          return cb(null, simData.result)
        }
        else {
          command = {
            iteration: iterationCount,
            commandString: simData.commandString,
            queryStart: moment(simData.queryStart),
            queryEnd: moment(simData.queryEnd)
          }
        }
      }
  
      if (!command) {
        // Default flow, build the command to run, and cache it so there's no need to duplicate work when resuming
        if(phenotype['0']) {
          throw (new Error())
        }
        command = Backtester.buildCommand(v, phenotype, `../simulations/${population_data}/gen_${generationCount}/sim_${iterationCount}_result.html`)
        command.iteration = iterationCount
        writeSimDataFile(iterationCount, JSON.stringify(command), population_data, generationCount)
      }
  
      iterationCount++
      phenotype.minTrades = minimumTrades
      phenotype.fitnessCalcType = fitnessCalcType
      Backtester.runCommand(v, phenotype, command, cb)
    }
  })).reduce((a, b) => a.concat(b))
  
  Backtester.startMonitor()

  let resolve
  const returnPromise = new Promise(function(r){
    resolve = r
  })
  
  parallel(tasks, PARALLEL_LIMIT, (err, results) => {
    Backtester.stopMonitor(`Generation ${generationCount}`)
  
    results = results.filter(function (r) {
      return !!r
    })
  
    results.sort((a, b) => (Number(a.fitness) < Number(b.fitness)) ? 1 : ((Number(b.fitness) < Number(a.fitness)) ? -1 : 0))
  
    const fields = [
      {
        'label': 'Selector',
        'value': 'selector'
      },
      {
        'label': 'Fitness',
        'value': 'fitness'
      },
      {
        'label': 'VS Buy Hold (%)',
        'value': 'vsBuyHold'
      },
      {
        'label': 'Win/Loss Ratio',
        'value': 'wlRatio'
      },
      {
        'label': '# Trades/Day',
        'value': 'frequency'
      },
      {
        'label': 'Strategy',
        'value': 'strategy'
      },
      {
        'label': 'Order Type',
        'value': 'order_type'
      },
      {
        'label': 'Ending Balance ($)',
        'value': 'endBalance'
      },
      {
        'label': 'Buy Hold ($)',
        'value': 'buyHold'
      },
      {
        'label': '# Wins',
        'value': 'wins'
      },
      {
        'label': '# Losses',
        'value': 'losses'
      },
      {
        'label': 'Period',
        'value': 'period_length'
      },
      {
        'label': 'Min Periods',
        'value': 'min_periods'
      },
      {
        'label': '# Days',
        'value': 'days'
      },
      {
        'label': 'Full Parameters',
        'value': 'params'
      }
    ]
  
    let json2csvParser = new Json2csvParser({ fields })
    let dataCSV = json2csvParser.parse(results)
    let csvFileName = `simulations/${population_data}/gen_${generationCount}/results.csv`
    let poolData = {}
    selectedStrategies.forEach(function (v) {
      poolData[v] = pools[v]['pool'].population()
    })
  
    let jsonFileName = `simulations/${population_data}/gen_${generationCount}/results.json`
    let dataJSON = JSON.stringify(poolData, null, 2)
    if (!noStatSave)
      saveGenerationData(csvFileName, jsonFileName, dataCSV, dataJSON)
  
      //Display best of the generation
    console.log('\n\nGeneration\'s Best Results')
    let bestOverallResult = []
    let prefix = './zenbot.sh sim '
    selectedStrategies.forEach((v) => {
      let best = pools[v]['pool'].best()
      let bestCommand
  
      if (best.sim) {
        console.log(`(${best.sim.strategy}) Sim Fitness ${best.sim.fitness}, VS Buy and Hold: ${z(5, (n(best.sim.vsBuyHold).format('0.0') + '%'), ' ').yellow} BuyAndHold Balance: ${z(5, (n(best.sim.buyHold).format('0.000000')), ' ').yellow}  End Balance: ${z(5, (n(best.sim.endBalance).format('0.000000')), ' ').yellow}, Wins/Losses ${best.sim.wins}/${best.sim.losses}, ROI ${z(5, (n(best.sim.roi).format('0.000000')), ' ').yellow}.`)
        // console.log(best)
        bestCommand = generateCommandParams(best.sim)
        bestOverallResult.push(best.sim)
      } else {
        console.log(`(${results[0].strategy}) Result Fitness ${results[0].fitness}, VS Buy and Hold: ${z(5, (n(results[0].vsBuyHold).format('0.0') + '%'), ' ').yellow} BuyAndHold Balance: ${z(5, (n(results[0].buyHold).format('0.000000')), ' ').yellow}  End Balance: ${z(5, (n(results[0].endBalance).format('0.000000')), ' ').yellow}, Wins/Losses ${results[0].wins}/${results[0].losses}, ROI ${z(5, (n(results.roi).format('0.000000')), ' ').yellow}.`)
        bestCommand = generateCommandParams(results[0])
        bestOverallResult.push(results[0])
      }
  
      // prepare command snippet from top result for this strat
      if (bestCommand != '') {
        bestCommand = prefix + bestCommand
        bestCommand = bestCommand + ' --asset_capital=' + argv.asset_capital + ' --currency_capital=' + argv.currency_capital
        console.log(bestCommand + '\n')
      }
    })
  
    bestOverallResult.sort((a, b) =>
      (isUndefined(a.fitness)) ? 1 :
        (isUndefined(b.fitness)) ? 0 :
          (a.fitness < b.fitness) ? 1 :
            (b.fitness < a.fitness) ? -1 : 0)
  
    // let bestOverallCommand = generateCommandParams(bestOverallResult[0])
    // bestOverallCommand = prefix + bestOverallCommand
    // bestOverallCommand = bestOverallCommand + ' --asset_capital=' + argv.asset_capital + ' --currency_capital=' + argv.currency_capital
  
    saveLaunchFiles(generateLaunchFile, bestOverallResult[0], ignoreLaunchFitness)
  
    if (selectedStrategies.length > 1) {
      console.log(`(${bestOverallResult[0].strategy}) Best Overall Fitness ${bestOverallResult[0].fitness}, VS Buy and Hold: ${z(5, (n(bestOverallResult[0].vsBuyHold).format('0.00') + '%'), ' ').yellow} BuyAndHold Balance: ${z(5, (n(bestOverallResult[0].buyHold).format('0.000000')), ' ').yellow}  End Balance: ${z(5, (n(bestOverallResult[0].endBalance).format('0.000000')), ' ').yellow}, Wins/Losses ${bestOverallResult[0].wins}/${bestOverallResult[0].losses}, ROI ${z(5, (n(bestOverallResult[0].roi).format('0.000000')), ' ').yellow}.`)
    }
  
    selectedStrategies.forEach((strategy) => {
      pools[strategy]['pool'] = pools[strategy]['pool'].evolve()
    })
  
    if (!isUndefined(runGenerations) && runGenerations <= generationCount) {
      process.exit()
    }

    resolve()
  })

  return returnPromise
}