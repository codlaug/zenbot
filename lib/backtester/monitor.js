'use strict'

let moment = require('moment')
  , argv = require('yargs').argv
  , readline = require('readline')
  , z = require('zero-fill')
  , n = require('numbro')
  , distanceOfTimeInWords = require('./utils').distanceOfTimeInWords
  

module.exports = function Monitor() {
  this.periodDurations = []
  this.phenotypes = []
  const self = this
  
  this.reportStatus = function (simTotalCount, parallelLimit) {
    var genCompleted = 0
    // var genTotal = 0
  
    let simsDone = 0
    let simsActive = 0
    var simsErrored = 0
    var simsAll = simTotalCount
    let simsRemaining = simsAll
    // var self = this
    // console.log(`simsAll: ${simsAll}, this.phenotypes: ${this.phenotypes.length}`);
  
    readline.clearLine(process.stdout)
    readline.cursorTo(process.stdout, 0)
  
    var inProgress = []
    var inProgressStr = []
  
    var slowestP = null
    var slowestEta = null
  
    var bestP = null
    var bestBalance = null
  
    self.phenotypes.forEach(function reportEachPhenotype(p) {
      if ('sim' in p) {
        if (Object.keys(p.sim).length === 0) {
          simsActive++
          inProgress.push(p)
        }
        else {
          // console.log('phenotype reported', p)
          simsDone++
  
          if (!p.command || !p.command.result)
            simsErrored++
  
          if (p.command) {
            let balance
            try {
              balance = p.command.result.endBalance
            } catch(e) {
              console.log(e, p.command, p.sim)
            }
  
            if (bestP == null || bestBalance < balance) {
              bestP = p
              bestBalance = balance
            }
            else if (bestP && bestBalance == balance && bestP.command.iteration > p.command.iteration) {
              // Always pick the earliest one so it doesn't look like the number is jumping all over the place
              bestP = p
              bestBalance = balance
            }
          }
        }
        simsRemaining--
      }
  
    })
  
    var homeStretchMode = simsActive < (parallelLimit - 1) && simsRemaining == 0
  
    inProgress.forEach(function (p) {
      var c = p.command
  
      var currentTime
      if (c.currentTimeString) currentTime = moment(c.currentTimeString, 'YYYY-MM-DD HH:mm:ss')
      if (currentTime && currentTime.isBefore(c.queryStart)) c.queryStart = currentTime
      // console.log(`${c.iteration} currentTime: ${currentTime}, queryStart: ${c.queryStart}, queryEnd: ${c.queryEnd}, current: ${c.currentTimeString}`);
  
      // var timeSoFar = moment().diff(c.startTime);
      // console.log(`remaining: ${time} - ${timeSoFar} = ${time - timeSoFar}`);
      // timeLeft += time - timeSoFar;
      if (currentTime && c.queryStart && c.queryEnd) {
        var totalTime = c.queryEnd.diff(c.queryStart)
  
        // 2018-01-25 06:18:00
        var progress = currentTime.diff(c.queryStart)
  
        // console.log(`totalTime: ${totalTime} vs progress: ${progress}`);
        var percentage = Math.min(progress / totalTime, 1)
        genCompleted += percentage
  
        var now = moment()
        var timeElapsed = now.diff(c.startTime)
        // console.log(`startTime: ${c.startTime}, timeElapsed: ${timeElapsed}, adding: ${timeElapsed / percentage}ms`);
        var eta = c.startTime.clone().add(timeElapsed / percentage, 'milliseconds')
  
        if (slowestP == null || slowestEta.isBefore(eta)) {
          slowestP = p
          slowestEta = eta
        }
  
        if (homeStretchMode)
          inProgressStr.push(`${(c.iteration + ':').gray} ${(percentage * 100).toFixed(1)}% ETA: ${distanceOfTimeInWords(eta, now)}`)
        else
          inProgressStr.push(`${(c.iteration + ':').gray} ${(percentage * 100).toFixed(1)}%`)
      }
    })
  
  
    // timeLeft /= simsActive; // how many run at one time
    if (inProgressStr.length > 0) {
      // process.stdout.write("\u001b[1000D") // Move left
      process.stdout.write('\u001b[1A')
      readline.clearLine(process.stdout)
      readline.cursorTo(process.stdout, 0)
  
      process.stdout.write(inProgressStr.join(', '))
      process.stdout.write('\n')
    }
  
  
    var percentage = ((simsDone + genCompleted) / simsAll * 100).toFixed(1)
    // z(8, n(s.period.trend_ema_rate).format('0.0000'), ' ')[color]
    process.stdout.write(`Done: ${simsDone.toString().green}, Active: ${simsActive.toString().yellow}, Remaining: ${simsRemaining.toString().gray}, `)
    if (simsErrored > 0)
      process.stdout.write(`Errored: ${simsErrored.toString().red}, `)
  
    process.stdout.write(`Completion: ${z(5, (n(percentage).format('0.0') + '%'), ' ').green} `)
  
    let bestBColor = 'gray'
  
    if (bestP) {
      if (argv.currency_capital) {
        let cc = parseFloat(argv.currency_capital)
        if (cc < 0.1)
          bestBColor = 'green'
        else if (cc > bestBalance)
          bestBColor = 'red'
        else
          bestBColor = 'yellow'
      }
    }
  
    let bestBalanceString = z(5, n(bestBalance || 0).format('0.0000'), ' ')[bestBColor]
    process.stdout.write(`Best Balance(${(bestP ? bestP.command.iteration.toString() : '?')[bestBColor]}): ${bestBalanceString}`)
  
    if (inProgressStr.length > 0) {
      if (!homeStretchMode)
        process.stdout.write(`, Slowest(${slowestP.command.iteration.toString().yellow}) ETA: ${distanceOfTimeInWords(slowestEta, moment()).yellow}`)
    }
  }
  
  this.reset = function () {
    self.phenotypes.length = 0
  }
  
  this.start = function (simTotalCount, parallelLimit) {
    process.stdout.write('\n\n')
    self.generationStarted = moment()
  
    self.reportInterval = setInterval(() => {
      self.reportStatus(simTotalCount, parallelLimit)
    }, 1000)
  },
  
  this.stop = function (label) {
    self.generationEnded = moment()
    clearInterval(self.reportInterval)
    var timeStr = distanceOfTimeInWords(self.generationEnded, self.generationStarted)
    console.log(`\n\n${label} completed at ${self.generationEnded.format('YYYY-MM-DD HH:mm:ss')}, took ${timeStr}, results saved to:`)
  }

  return this
}