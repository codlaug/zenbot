'use strict'

let _ = require('lodash')
  , moment = require('moment')
  , argv = require('yargs').argv
  , shell = require('shelljs')
  , StripAnsi = require('strip-ansi')
  , path = require('path')
  , fs = require('fs')
  , Phenotypes = require('../phenotype')
  , processOutput = require('./output_processor')
  , Monitor = require('./monitor')
const actualRange = require('./utils').actualRange


const spawn = require('child_process').spawn

let simArgs, writeFile


let runUpdate = function (days, selector) {
  let zenbot_cmd = process.platform === 'win32' ? 'zenbot.bat' : './zenbot.sh'
  let command = `${zenbot_cmd} backfill --days=${days} ${selector}`
  console.log('Backfilling (might take some time) ...')
  console.log(command)

  shell.exec(command, {
    silent: true,
    async: false
  })
}

let ensureDirectoryExistence = function (filePath) {
  var dirname = path.dirname(filePath)
  if (fs.existsSync(dirname)) {
    return true
  }
  ensureDirectoryExistence(dirname)
  fs.mkdirSync(dirname)
}

let simTotalCount, parallelLimit

const monitor = new Monitor()

module.exports = {

  init: function (options) {
    simArgs = options.simArgs
    simTotalCount = options.simTotalCount
    parallelLimit = options.parallelLimit
    writeFile = options.writeFile
  },

  deLint: function () {
    //Clean up any generation files left over in the simulation directory
    //they will be overwritten, but best not to confuse the issue.
    //if it fails.   doesn't matter they will be overwritten anyways. not need to halt the system.
    try {
      let tDirName = path.resolve(__dirname, '..', '..', 'simulations')
      let tFileName = 'sim_'
      let files = fs.readdirSync(tDirName)

      for (let i = 0; i < files.length; i++) {
        if (files[i].lastIndexOf(tFileName) == 0) {
          let filePath = path.resolve(__dirname, '..', '..', 'simulations', files[i])
          fs.unlinkSync(filePath)
        }

      }
    } catch (err) {
      console.log('error deleting lint from prior run')
    }
  },

  writeFileAndFolder: function (filePath, data) {
    ensureDirectoryExistence(filePath)
    fs.writeFileSync(filePath, data)
  },

  ensureBackfill: function () {
    let days = argv.days
    if (!days) {
      if (argv.start) {
        var start = moment(argv.start, 'YYYYMMDDHHmm')
        days = Math.max(1, moment().diff(start, 'days'))
      }
      else {
        var end = moment(argv.end, 'YYYYMMDDHHmm')
        days = moment().diff(end, 'days') + 1
      }
    }
    runUpdate(days, argv.selector)
  },

  buildCommand: function (taskStrategyName, phenotype, filename) {
    var cmdArgs = Object.assign({}, phenotype)
    cmdArgs.strategy = taskStrategyName
    Object.assign(cmdArgs, simArgs)

    var selector = cmdArgs.selector
    delete cmdArgs.selector
    delete cmdArgs.exchangeMarketPair
    delete cmdArgs.sim
    delete cmdArgs.command
    delete cmdArgs.help
    delete cmdArgs.version

    if (argv.include_html)
      cmdArgs.filename = filename

    if (argv.silent)
      cmdArgs.silent = true

    cmdArgs.backtester_generation = phenotype.backtester_generation

    let zenbot_cmd = process.platform === 'win32' ? 'zenbot.bat' : './zenbot.sh'
    let command = `${zenbot_cmd} sim ${selector}`

    for (const [key, value] of Object.entries(cmdArgs)) {
      if (_.isBoolean(value)) {
        command += ` --${value ? '' : 'no-'}${key}`
      } else {
        command += ` --${key}=${value}`
      }
    }

    const range = actualRange({
      start: cmdArgs.start, end: cmdArgs.end, days: cmdArgs.days,
      period_length: cmdArgs.period_length, min_periods: (cmdArgs.min_periods || 1)
    })

    return {
      commandString: command,
      queryStart: range.start,
      queryEnd: range.end
    }
  },

  runCommand: (taskStrategyName, phenotype, command, cb) => {
    // console.log(`[ ${command.iteration}/${populationSize * selectedStrategies.length} ] ${command.commandString}`)

    phenotype['sim'] = {}
    phenotype['command'] = command

    command.startTime = moment()
    var cmdArgs = command.commandString.split(' ')
    var cmdName = cmdArgs.shift()
    const proc = spawn(cmdName, cmdArgs)
    var endData = ''

    proc.on('exit', () => {
      let result = null
      let stdout = endData.toString()
      try {
        result = processOutput(stdout, taskStrategyName, phenotype)

        command.endTime = moment()
        command.result = result
        phenotype.command = command

        // console.log('writing file for iteration', command.iteration, command)
        writeFile(command.iteration, JSON.stringify(command))

        result['fitness'] = Phenotypes.fitness(phenotype)
        phenotype['sim'] = result
        phenotype.sim.fitness = Phenotypes.fitness(phenotype)

        monitor.reportStatus(simTotalCount, parallelLimit)

      } catch (err) {
        console.log(`Bad output detected on sim ${command.iteration} while running:`)
        console.log(command.commandString)
        console.log(err.toString())
        console.log(stdout)
        console.log(err.stack)
      }

      cb(null, result)
    })
    proc.stdout.on('data', (data) => {
      if (data.length > 500) {
        endData = data
        // console.log(`${command.iteration}: ${data}`)
      }
      else {
        var str = StripAnsi(data.toString()), lines = str.split(/(\r?\n)/g)
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i]
          // console.log(`${command.iteration}: ${line}`)
          if (line.indexOf('-') == 4 && line.indexOf(':') == 13) {
            var timeStr = line.slice(0, 20)
            command.currentTimeString = timeStr
            // console.log(`${command.iteration}: ${command.currentTimeString}`)
          }
        }

      }
    })
  },

  startMonitor: () => monitor.start(simTotalCount, parallelLimit),
  stopMonitor: (label) => monitor.stop(label),
  resetMonitor: () => monitor.reset(),
  reportStatus: () => monitor.reportStatus(simTotalCount, parallelLimit),
  trackPhenotype: function(phenotype) { monitor.phenotypes.push(phenotype) }


}
