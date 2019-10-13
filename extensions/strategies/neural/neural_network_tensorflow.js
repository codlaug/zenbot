const tf = require('@tensorflow/tfjs')
const fs = require('fs')
const _ = require('lodash')


const defaults = {
  depth: 5,
  neurons_1: 40,
  neurons_2: 12,

  decay: 0.001
}

function DataVolume(data) {
  // console.log(data)
  data = data.map((item) => 
    [item.open, item.high, item.low, item.close, item.volume]
  )
  const tensor = new tf.tensor(data, [data.length, 5])
  // console.log(tensor.arraySync())

  // for (var k = 0; k < data.length; k++) {
  //   vol.set(0, 0, k, data[k].open)
  //   vol.set(1, 0, k, data[k].close)
  //   vol.set(2, 0, k, data[k].high)
  //   vol.set(3, 0, k, data[k].low)
  //   vol.set(4, 0, k, data[k].volume)
  //   vol.set(5, 0, k, _.get(data[k], 'bollinger.upperBound', null))
  //   vol.set(6, 0, k, _.get(data[k], 'bollinger.midBound', null))
  //   vol.set(7, 0, k, _.get(data[k], 'bollinger.lowerBound', null))
  // }

  return tensor
}

function NeuralNetwork(options) {
  options = Object.assign(defaults, options)

  this.neuralDepth = options.depth
  
  const layerDefinitions = {
    layers: [
      tf.layers.flatten({inputShape: [200, 5]}),
      tf.layers.dense({units: options.neurons_1, activation: options.activation_1_type}),
      tf.layers.dense({units: options.neurons_2, activation: options.activation_2_type}),
      tf.layers.dense({units: 1})
    // {type:'regression', num_neurons: 8}
    ]
  }
  this.net = tf.sequential(layerDefinitions)

  this.net.compile({
    optimizer: 'sgd',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  })

  // if(fs.existsSync('brain.json')) {
  //   this.net.fromJSON(JSON.parse(fs.readFileSync('brain.json').toString()))
  // }
  

  this.predict = (data) => {
    // var x = new convnetjs.Vol(8, 1, this.neuralDepth, 0)
  
    // for (var k = 0; k < this.neuralDepth && k < data.length; k++) {
    //   x.set(0,0,k,data[k].open)
    //   x.set(1,0,k,data[k].close)
    //   x.set(2,0,k,data[k].high)
    //   x.set(3,0,k,data[k].low)
    //   x.set(4,0,k,data[k].volume)
    //   x.set(5, 0, k, _.get(data[k], 'bollinger.upperBound', null))
    //   x.set(6, 0, k, _.get(data[k], 'bollinger.midBound', null))
    //   x.set(7, 0, k, _.get(data[k], 'bollinger.lowerBound', null))
    // }
    data = data.map((item) => 
      [item.open, item.high, item.low, item.close, item.volume]
    )
    var predicted_value = this.net.predict(tf.tensor([data]))
    console.log(predicted_value.arraySync())
    return predicted_value // close value - x.set(1,0,k,data[k].close)
  }


  this.backward = (data) => {
    data.forEach((d) => {
      this.net.backward(new DataVolume(d))
    })
    
  }

  const epochs = 1
  const customCallback = (r) => { console.log(r) }

  this.learn = (data, lookBack) => {
    const delay = 1
    const batchSize = 10
    const step = 1
    const trainDataset = tf.data.generator(() => data.getNextBatchFunction(lookBack, delay, batchSize, step))
    const valDataset = tf.data.generator(() => data.getNextBatchFunction(lookBack, delay, batchSize, step))

    return this.net.fitDataset(trainDataset, {
      batchesPerEpoch: 20,
      epochs,
      callbacks: customCallback,
      validationData: valDataset
    });
  }

  // this.learn = async (data) => {
  //   await forEveryChunkOfDataDepthFarInThePast(data, this.neuralDepth, async (dataLeadingUpTo, theseDataValues) => {
  //     const vol = new DataVolume(dataLeadingUpTo)

  //     await this.net.fit(vol, tf.tensor([theseDataValues.open, theseDataValues.close, theseDataValues.high, theseDataValues.low, theseDataValues.volume, 0, 0, 0]))
  //   }).catch(e => {
  //     console.log(e)
  //   })
  // }

  this.toJSON = this.net.toJSON.bind(this.net)
  
  return this
}

async function forEveryChunkOfDataDepthFarInThePast(data, depth, callback) {
  for (var i = 0; i < data.length - depth; i++) {
    const dataLeadingUpTo = data.slice(i, i + depth)
    const theseDataValues = data[i + depth]
    await callback(dataLeadingUpTo, theseDataValues)
  }
}

module.exports = NeuralNetwork