const data = require('../../../testdata.json')



const tulind = require('tulind')

console.log(tulind.indicators.obv)

const input = {low: data.map(i => i.low), high: data.map(i => i.high), close: data.map(i => i.close), volume: data.map(i => i.volume)}

tulind.indicators.obv.indicator([input.close, input.volume], [], (err, results) => {
  console.log(results[0].slice(0, 10))
})


