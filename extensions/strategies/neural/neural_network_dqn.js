const tf = require('@tensorflow/tfjs')
const fs = require('fs')
const _ = require('lodash')
const path = require('path')

const ensureDirectoryExistence = function (filePath) {
  var dirname = path.dirname(filePath)
  console.log('ensureDirectoryExistence', dirname)
  if (fs.existsSync(dirname)) {
    return true
  }
  ensureDirectoryExistence(dirname)
  fs.mkdirSync(dirname)
}

function whicheverIsLess(a, b) {
  return a < b ? a : b
}

const defaults = {
  depth: 5,
  neurons_1: 32,
  neurons_2: 64,

  decay: 0.001
}

const INPUT_SIZE = 11
const TEMPORAL_WINDOW = 20
const NUM_ACTIONS = 2

function NeuralNetwork(options) {
  options = Object.assign(defaults, options)

  this.neuralDepth = options.depth
  
  const layerDefinitions = {
    layers: [
      // tf.layers.input({shape: [20, 5]}),
      tf.layers.dense({units: options.neurons_1, kernelRegularizer: tf.regularizers.l2(), activation: options.activation_1_type}),
      tf.layers.dense({units: options.neurons_2, activation: options.activation_2_type}),
      tf.layers.dropout({rate: 0.001}),
      tf.layers.dense({units: 1})
    // {type:'regression', num_neurons: 8}
    ]
  }
  this.net = new reimprove.NeuralNetwork()
  this.net.InputShape = [INPUT_SIZE*TEMPORAL_WINDOW + NUM_ACTIONS*TEMPORAL_WINDOW + INPUT_SIZE]
  this.net.addNeuralNetworkLayers(layerDefinitions.layers)

  this.net = new reimprove.Model.FromNetwork(this.net, { epochs: 1, stepsPerEpoch: 1 })

  this.net.compile({
    optimizer: 'adagrad',
    loss: 'meanSquaredError',
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
    [item.open, item.high, item.low, item.close, item.volume, item.bollinger.upperBound, item.bollinger.midBound, item.bollinger.lowerBound, item.rsi_avg_gain, item.rsi_avg_loss, item.rsi]
    )
    var predicted_value = this.net.predict(tf.tensor([data]))
    // console.log(predicted_value.arraySync())
    return predicted_value // close value - x.set(1,0,k,data[k].close)
  }

  this.save = async () => {
    const iOHandler = {
      save: (modelArtifacts) => {
        const filePath = 'brain'
        console.log(filePath)
        ensureDirectoryExistence(filePath+'/anything.json');

        const weightsBinPath = path.join(filePath, 'weights.bin');
        const weightsManifest = [{
          paths: ['weights.bin'],
          weights: modelArtifacts.weightSpecs
        }];
        const modelJSON = {
          modelTopology: modelArtifacts.modelTopology,
          weightsManifest,
          format: modelArtifacts.format,
          generatedBy: modelArtifacts.generatedBy,
          convertedBy: modelArtifacts.convertedBy
        };
        if (modelArtifacts.trainingConfig != null) {
          modelJSON.trainingConfig = modelArtifacts.trainingConfig;
        }
        if (modelArtifacts.userDefinedMetadata != null) {
          modelJSON.userDefinedMetadata = modelArtifacts.userDefinedMetadata;
        }
        const modelJSONPath = path.join(filePath, 'model.json');
        fs.writeFileSync(modelJSONPath, JSON.stringify(modelJSON), 'utf8');
        fs.writeFileSync(weightsBinPath, Buffer.from(modelArtifacts.weightData), 'binary');
  
        return {
          // TODO(cais): Use explicit tfc.io.ModelArtifactsInfo type below once it
          // is available.
          // tslint:disable-next-line:no-any
          modelArtifactsInfo: true // getModelArtifactsInfoForJSON(modelArtifacts)
        }
      }
    }
    await this.net.save(iOHandler)
  }

  function toArrayBuffer(buf) {
    if (Array.isArray(buf)) {
      // An Array of Buffers.
      let totalLength = 0;
      for (const buffer of buf) {
        totalLength += buffer.length;
      }
  
      const ab = new ArrayBuffer(totalLength);
      const view = new Uint8Array(ab);
      let pos = 0;
      for (const buffer of buf) {
        pos += buffer.copy(view, pos);
      }
      return ab;
    } else {
      // A single Buffer. Return a copy of the underlying ArrayBuffer slice.
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
  }

  function loadWeights(weightsManifest, filePath) {
    const dirName = path.dirname(filePath);
    const buffers = [];
    const weightSpecs = [];
    for (const group of weightsManifest) {
      for (const p of group.paths) {
        const weightFilePath = path.join(dirName, p);
        const buffer = fs.readFileSync(weightFilePath)
        buffers.push(buffer);
      }
      weightSpecs.push(...group.weights);
    }
    return [weightSpecs, toArrayBuffer(buffers)];
  }

  this.load = async () => {
    const iOHandler = {
      load: async () => {
        const filePath = 'brain/model.json';
        const info = fs.statSync(filePath)
    
        // `path` can be either a directory or a file. If it is a file, assume
        // it is model.json file.
        if (info.isFile()) {
          const modelJSON = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
          const modelArtifacts = {
            modelTopology: modelJSON.modelTopology,
            format: modelJSON.format,
            generatedBy: modelJSON.generatedBy,
            convertedBy: modelJSON.convertedBy
          };
          if (modelJSON.weightsManifest != null) {
            const [weightSpecs, weightData] = await loadWeights(modelJSON.weightsManifest, filePath);
            modelArtifacts.weightSpecs = weightSpecs;
            modelArtifacts.weightData = weightData;
          }
          if (modelJSON.trainingConfig != null) {
            modelArtifacts.trainingConfig = modelJSON.trainingConfig;
          }
          if (modelJSON.userDefinedMetadata != null) {
            modelArtifacts.userDefinedMetadata = modelJSON.userDefinedMetadata;
          }
          return modelArtifacts;
        } else {
          throw new Error(
              'The path to load from must be a file. Loading from a directory ' +
              'is not supported.');
        }
      }
    }
    try {
      this.net = await tf.loadLayersModel(iOHandler)
      this.net.compile({
        optimizer: 'adagrad',
        loss: 'meanSquaredError',
        metrics: ['accuracy']
      })
      return true
    } catch(e) {
      console.log('model not found')
      return false
    }
  }


  this.backward = (data) => {
    data.forEach((d) => {
      this.net.backward(new DataVolume(d))
    })
    
  }

  this.weights = this.net.weights

  const epochs = 8
  const customCallback = (r) => { console.log('custom', r) }

  this.learn = (data) => {
    // console.log('lookback', lookBack)
    const lookBack = whicheverIsLess(20, data.valMaxRow-data.valMinRow-1)
    const delay = 1
    const batchSize = 1
    const step = 1
    // console.log('training set')
    const trainDataset = tf.data.generator(() => data.getNextBatchFunction(lookBack, delay, batchSize, step, data.trainMinRow, data.trainMaxRow))
    const valDataset = tf.data.generator(() => data.getNextBatchFunction(lookBack, delay, batchSize, step, data.valMinRow, data.valMaxRow))

    // console.log('training set', trainDataset)
    // try {
      return this.net.fitDataset(trainDataset, {
        batchesPerEpoch: 10,
        epochs,
        callbacks: customCallback,
        validationData: valDataset
      });
    // } catch(e) {
    //   console.log(e)
    //   console.log(trainDataset.shape)
    // }
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