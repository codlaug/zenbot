const logic = require('./logic9')

module.exports = function(s, cb) {


  return function pythonHandler(data) {
    // console.log(data)


    const weights = data.toString().split(' ').map(i => parseFloat(i))

    if(s.options.mode === 'sim') {
      s.predictStore.insertOne({period_id: s.period.period_id, timestamp: s.period.time, weights}, function(err, r) {
        //stored
        if(err) console.log(err)
      })
    }

    logic(s, weights, cb)

  }
}