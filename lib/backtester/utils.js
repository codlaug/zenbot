let moment = require('moment')
  , tb = require('timebucket')

module.exports = { 
  distanceOfTimeInWords: function distanceOfTimeInWords(timeA, timeB) {
    var hourDiff = timeA.diff(timeB, 'hours')
    let minDiff = 0
    if (hourDiff == 0) {
      minDiff = timeA.diff(timeB, 'minutes')
      var secDiff = timeA.clone().subtract(minDiff, 'minutes').diff(timeB, 'seconds')
      return `${minDiff}m ${secDiff}s`
    }
    else {
      minDiff = timeA.clone().subtract(hourDiff, 'hours').diff(timeB, 'minutes')
      return `${hourDiff}h ${minDiff}m`
    }
  },

  actualRange: function actualRange(so) {
    // Adapted from sim.js logic to similarly figure out how much time is being processed
    if (so.start) {
      so.start = moment(so.start, 'YYYYMMDDHHmm')
      if (so.days && !so.end) {
        so.end = so.start.clone().add(so.days, 'days')
      }
    }
    if (so.end) {
      so.end = moment(so.end, 'YYYYMMDDHHmm')
      if (so.days && !so.start) {
        so.start = so.end.clone().subtract(so.days, 'days')
      }
    }
    if (!so.start && so.days) {
      so.start = moment().subtract(so.days, 'days')
    }
  
    if (so.days && !so.end) {
      so.end = so.start.clone().add(so.days, 'days')
    }
  
    if (so.start && so.end) {
      var actualStart = moment(tb(so.start.valueOf()).resize(so.period_length).subtract(so.min_periods + 2).toMilliseconds())
      return {
        start: actualStart,
        end: so.end
      }
    }
  
    return { start: so.start, end: so.end }
  }
}