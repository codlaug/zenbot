'use strict'

let fs = require('fs')
// eslint-disable-next-line no-unused-vars
let colors = require('colors')
const generateCommandParams = require('../generate_command')
const Backtester = require('../../../lib/backtester')

module.exports = { 
  saveGenerationData: function saveGenerationData(csvFileName, jsonFileName, dataCSV, dataJSON) {
    try {
      fs.writeFileSync(csvFileName, dataCSV)
      console.log('> Finished writing generation csv to ' + csvFileName)
    }
    catch (err) {
      throw err
    }
  
    try {
      fs.writeFileSync(jsonFileName, dataJSON)
      console.log('> Finished writing generation json to ' + jsonFileName)
    }
    catch (err) {
      throw err
    }
  },

  saveLaunchFiles: function saveLaunchFiles(saveLauchFile, configuration, ignoreLaunchFitness) {
    if (!saveLauchFile) return
    //let lConfiguration = configuration.replace(' sim ', ' trade ')
    let lFilenameNix = new String().concat('./gen.', configuration.selector.toLowerCase(), '.sh')
    let lFinenamewin32 = new String().concat('./gen.', configuration.selector.toLowerCase(), '.bat')
    delete configuration.generateLaunch
    delete configuration.backtester_generation
  
    let bestOverallCommand = generateCommandParams(configuration)
    let lastFitnessLevel = -9999.0
  
    // get prior fitness level nix
    if (fs.existsSync(lFilenameNix)) {
      let lFileCont = fs.readFileSync(lFilenameNix, { encoding: 'utf8', flag: 'r' })
      let lines = lFileCont.split('\n')
      if (lines.length > 2)
        if (lines[1].includes('fitness=')) {
          let th = lines[1].split('=')
          lastFitnessLevel = th[1]
        }
    }
  
    // get prior firness level win32
    if (fs.existsSync(lFinenamewin32)) {
      let lFileCont = fs.readFileSync(lFinenamewin32, { encoding: 'utf8', flag: 'r' })
      let lines = lFileCont.split('\n')
      if (lines.length > 1)
        if (lines[1].includes('fitness=')) {
          let th = lines[1].split('=')
          lastFitnessLevel = th[1]
        }
    }
  
    //write Nix Version
    let lNixContents = '#!/bin/bash\n'.concat('#fitness=', configuration.fitness, '\n',
      'env node zenbot.js trade ',
      bestOverallCommand, ' $@\n')
  
    let lWin32Contents = '@echo off\n'.concat('rem fitness=', configuration.fitness, '\n',
      'node zenbot.js trade ',
      bestOverallCommand, ' %*\n')
  
    if (((Number(configuration.fitness) > Number(lastFitnessLevel)) || (ignoreLaunchFitness)) && Number(configuration.fitness) > 0.0) {
      fs.writeFileSync(lFilenameNix, lNixContents)
      fs.writeFileSync(lFinenamewin32, lWin32Contents)
      // using the string instead of octet as eslint compaines about an invalid number if the number starts with 0
      fs.chmodSync(lFilenameNix, '777')
      fs.chmodSync(lFinenamewin32, '777')
    }
  },
  writeSimDataFile: function writeSimDataFile(iteration, data, population_data, generationCount) {
    let jsonFileName = `simulations/${population_data}/gen_${generationCount}/sim_${iteration}.json`
    Backtester.writeFileAndFolder(jsonFileName, data)
  }
}