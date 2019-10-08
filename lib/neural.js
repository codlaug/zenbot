// Bollinger Bands
let convnetjs = require('convnetjs')

function NeuralNetwork(options) {

  this.neuralDepth = options.depth

  const layerDefinitions = [
    {type:'input', out_sx:5, out_sy:1, out_depth: options.depth},
    {type:'fc', num_neurons: options.neurons_1, activation: options.activation_1_type},
    {type:'fc', num_neurons: options.neurons_2, activation: options.activation_2_type},
    {type:'regression', num_neurons: 1}
  ]
  this.net = new convnetjs.Net()
  this.net.makeLayers(layerDefinitions)

  const trainerConfig = {
    method: 'adadelta',
    learning_rate: options.learningrate,
    momentum: options.momentum,
    batch_size: 1,
    l2_decay: options.decay
  }
  this.trainer = new convnetjs.Trainer(this.net, trainerConfig)

  this.train = function train() {
    this.trainer.train
  }

  return this
}

module.exports = function neural(s, key, length, source_key) {
  if (!source_key) source_key = 'close'

  if (s.neural === undefined) {
    // Create the net the first time it is needed and NOT on every run
    s.neural = new NeuralNetwork(s.options)
  }

  if (s.lookback.length > length) {
    // skip calculation if result already presented as we use historical data only,
    // no need to recalculate for each individual trade
    if (key in s.period) return
    let data = []
    for (var i=length-1; i>=0; i--) {
      data.push(s.lookback[i][source_key])
    }
    const result = s.neural.train(data, length, s.options.bollinger_time)
    const upperBound = result.upper[result.upper.length-1]
    const lowerBound = result.lower[result.lower.length-1]
    const midBound = result.mid[result.mid.length-1]
    const simple_result = {
      upperBound : upperBound,
      midBound: midBound,
      lowerBound : lowerBound
    }
    s.period[key] = simple_result
  }
}

