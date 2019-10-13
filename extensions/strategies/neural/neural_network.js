const convnetjs = require('convnetjs')
const fs = require('fs')
const _ = require('lodash')


const defaults = {
  depth: 5,
  neurons_1: 40,
  neurons_2: 12,

  decay: 0.001
}

function DataVolume(data) {
  const vol = new convnetjs.Vol(8, 1, data.length, 0)

  for (var k = 0; k < data.length; k++) {
    vol.set(0, 0, k, data[k].open)
    vol.set(1, 0, k, data[k].close)
    vol.set(2, 0, k, data[k].high)
    vol.set(3, 0, k, data[k].low)
    vol.set(4, 0, k, data[k].volume)
    vol.set(5, 0, k, _.get(data[k], 'bollinger.upperBound', null))
    vol.set(6, 0, k, _.get(data[k], 'bollinger.midBound', null))
    vol.set(7, 0, k, _.get(data[k], 'bollinger.lowerBound', null))
  }

  return vol
}

function NeuralNetwork(options) {
  options = Object.assign(defaults, options)

  this.neuralDepth = options.depth
  
  const layerDefinitions = [
    {type:'input', out_sx:8, out_sy:1, out_depth: options.depth},
    {type:'fc', num_neurons: options.neurons_1, activation: options.activation_1_type},
    {type:'fc', num_neurons: options.neurons_2, activation: options.activation_2_type},
    {type:'regression', num_neurons: 8}
  ]
  this.net = new convnetjs.Net()
  this.net.makeLayers(layerDefinitions)

  if(fs.existsSync('brain.json')) {
    this.net.fromJSON(JSON.parse(fs.readFileSync('brain.json').toString()))
  }
  
  const trainerConfig = {
    method: 'adadelta',
    learning_rate: options.learningrate,
    momentum: options.momentum,
    batch_size: 1,
    l2_decay: options.decay
  }
  this.trainer = new convnetjs.Trainer(this.net, trainerConfig)

  this.predict = (data) => {
    var x = new convnetjs.Vol(8, 1, this.neuralDepth, 0)
  
    for (var k = 0; k < this.neuralDepth && k < data.length; k++) {
      x.set(0,0,k,data[k].open)
      x.set(1,0,k,data[k].close)
      x.set(2,0,k,data[k].high)
      x.set(3,0,k,data[k].low)
      x.set(4,0,k,data[k].volume)
      x.set(5, 0, k, _.get(data[k], 'bollinger.upperBound', null))
      x.set(6, 0, k, _.get(data[k], 'bollinger.midBound', null))
      x.set(7, 0, k, _.get(data[k], 'bollinger.lowerBound', null))
    }
  
    var predicted_value = this.net.forward(x)
    // console.log(predicted_value)
    return predicted_value.w[1] // close value - x.set(1,0,k,data[k].close)
  }


  this.backward = (data) => {
    data.forEach((d) => {
      this.net.backward(new DataVolume(d))
    })
    
  }


  this.learn = (data) => {
    forEveryChunkOfDataDepthFarInThePast(data, this.neuralDepth, (dataLeadingUpTo, theseDataValues) => {
      const vol = new DataVolume(dataLeadingUpTo)

      this.trainer.train(vol, [theseDataValues.open, theseDataValues.close, theseDataValues.high, theseDataValues.low, theseDataValues.volume, 0, 0, 0])
    })
  }

  this.toJSON = this.net.toJSON.bind(this.net)
  
  return this
}

function forEveryChunkOfDataDepthFarInThePast(data, depth, callback) {
  for (var i = 0; i < data.length - depth; i++) {
    const dataLeadingUpTo = data.slice(i, i + depth)
    const theseDataValues = data[i + depth]
    callback(dataLeadingUpTo, theseDataValues)
  }
}

module.exports = NeuralNetwork