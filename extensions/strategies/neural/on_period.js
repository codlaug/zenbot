const tf = require('@tensorflow/tfjs')
const {ALL_ACTIONS, getRandomAction} = require('./trading_game')
const n = require('numbro')
const getStateTensor = require('./get_state')
const { mkdir } = require('shelljs')
const fs = require('fs')
const { copyWeights } = require('./dqn')
const {MinMaxScaler} = require('machinelearn/preprocessing')


const batchSize = 64
const savePath = './models/dqn'
const logDir = null
const learningRate = 0.001
const cumulativeRewardThreshold = 100
const gamma = 0.99
const maxNumFrames = 1000000
const syncEveryFrames = 1000


const scaler = new MinMaxScaler({ featureRange: [0, 1] })


class MovingAverager {
  constructor(bufferLength) {
    this.buffer = []
    for (let i = 0; i < bufferLength; ++i) {
      this.buffer.push(null)
    }
  }

  append(x) {
    this.buffer.shift()
    this.buffer.push(x)
  }

  average() {
    return this.buffer.reduce((x, prev) => x + prev) / this.buffer.length
  }
}


function encodeBatch(sequences, numRows) {
  const numExamples = sequences.length
  const buffer = tf.buffer([numExamples, numRows, 5])

  for (let n = 0; n < numExamples; ++n) {
    const exampleIndex = n
    const sequence = sequences[n]
    for (let i = 0; i < sequence.length; ++i) {
      const sequenceIndex = i
      const value = sequence[i]
      buffer.set(value[0], exampleIndex, sequenceIndex, 0)
      buffer.set(value[1], exampleIndex, sequenceIndex, 1)
      buffer.set(value[2], exampleIndex, sequenceIndex, 2)
      buffer.set(value[3], exampleIndex, sequenceIndex, 3)
      buffer.set(value[4], exampleIndex, sequenceIndex, 4)
    }
  }
  return buffer.toTensor().as3D(numExamples, numRows, 5)
}


const FEATURE_LENGTH = 24
const LOOKBACK_LENGTH = 3

let isInitialized = false
let nowTraining = false
let trainingCount = 8
let optimizer = null
let tPrev
let frameCountPrev
let averageReward100Best
let rewardAverager100
let summaryWriter
let cumulativeReward
let done

module.exports = {
  onPeriodTraining: function(s, cb) {
    // console.log(s.modelLoaded)
    if(!s.modelLoaded) {
      cb()
      return
    }
    // console.log(s)
    // s.game.addPeriod(s.period)

    // fill up our replayMemory with period data
    if(s.agent.replayMemory.isNotFull()) {
      if(typeof s.lastAction !== 'undefined' && s.lastAction !== null) {
        s.agent.completeStep(s, s.lastAction)
      }
      s.lastAction = s.agent.playStep(s)
      if(s.lastAction === 0) {
        s.signal = null
      } else if(s.lastAction === 1) {
        s.signal = 'buy'
      } else if(s.lastAction === 2) {
        s.signal = 'sell'
      }

      cb()
    } else if(s.agent.replayMemory.isFull()) {
      if(!isInitialized) {
        // now that our memory is full, we can start training
        if (logDir != null) {
          summaryWriter = tf.node.summaryFileWriter(logDir)
        }

        // Moving averager: cumulative reward across 100 most recent 100 episodes.
        rewardAverager100 = new MovingAverager(100)
        // Moving averager: fruits eaten across 100 most recent 100 episodes.
        // const eatenAverager100 = new MovingAverager(100)

        optimizer = tf.train.sgd(learningRate)
        tPrev = new Date().getTime()
        frameCountPrev = s.agent.frameCount
        averageReward100Best = -Infinity
        isInitialized = true
        nowTraining = true
      }
      if(nowTraining) {
        if(trainingCount > 0) {
          s.agent.trainOnReplayBatch(batchSize, gamma, optimizer)
          trainingCount -= 1
        }
        if(typeof s.lastAction !== 'undefined' && s.lastAction !== null) {
          ({cumulativeReward, done} = s.agent.completeStep(s, s.lastAction))
        }
        s.lastAction = s.agent.playStep(s)
        if(s.lastAction === 0) {
          s.signal = null
        } else if(s.lastAction === 1) {
          s.signal = 'buy'
        } else if(s.lastAction === 2) {
          s.signal = 'sell'
        }

        if (s.agent.frameCount % syncEveryFrames === 0) {
          s.agent.trainOnReplayBatch(batchSize, gamma, optimizer)
          copyWeights(s.agent.targetNetwork, s.agent.onlineNetwork)
          console.log('Sync\'ed weights from online network to target network')
        }
      }
      cb()
    }
  },
  onPeriodSimulating: function (s, cb) {
    if(!s.deciderModelLoaded) {
      cb()
      return
    }
    // console.log(s.period)
    // console.log(s.lookback[0])
    let bestAction
    // let currentQValues
    // var trendLinePredict = []
    // var trendLineLearn = []
    // this thing is crazy run with trendline placed here. But there needs to be a coin lock so you dont buy late!
    const notInPreroll = !s.in_preroll
    const enoughLookbackPeriods = s.lookback.length >= LOOKBACK_LENGTH //[s.options.min_periods]
    // if (notInPreroll && enoughLookbackPeriods) {
          
    //   trendLineLearn = s.lookback.slice(0, s.options.min_periods)
          
    //   if(!s.trained && !s.training) {
    //     s.training = true
    
    //     console.log('loobacklength', s.lookback.length)
    //     s.brain.learn(new PriceData(trendLineLearn)).then(() => {
    //       s.trained = true
    //       s.training = false
    //       s.brain.weights.forEach(w => {
    //         console.log(w.name, w.shape)
    //       })
    //       s.brain.save()
    //     }).catch(e => {
    //       console.log(e)
    //       // console.log(s.lookback)
    //     })
    //   }
    
    //   // console.log('learn from ', trendLineLearn[0])
    //   // console.log(trendLineLearn)
    // }


    
    // TODO: put profit in the reward center
    // TODO: put past actions in the state tensor
    // TODO: put balance/profit in the state tensor
        
    // TODO: train or give it the information for a stop loss sell
    const orig_capital = s.start_capital
    let consolidated = n(s.balance.currency).add(n(s.balance.asset).multiply(s.period.close))
    let profit = n(consolidated).divide(orig_capital).subtract(1).value()
    // console.log(s.balance.asset)
    // console.log(s.balance.currency)


    
    if(notInPreroll && enoughLookbackPeriods) {

      const data = []
      for(let i = LOOKBACK_LENGTH-1; i >= 0; --i) {
        data[LOOKBACK_LENGTH-1-i] = [
          s.lookback[i].open,
          s.lookback[i].close,
          s.lookback[i].high,
          s.lookback[i].low,
          s.lookback[i].volume,
        ]
      }
      scaler.fit(data)

      tf.tidy(() => {
        let lookbacks = s.lookback.slice(0, 15).reverse()
        lookbacks.push(s.period)
        const decideLookbacks = lookbacks.slice(lookbacks.length-3, lookbacks.length)
        // console.log(decideLookbacks)
        lookbacks = lookbacks.map(l => [l.open, l.close, l.high, l.low, l.volume])
        
        lookbacks = scaler.transform(lookbacks)
        // console.log(lookbacks)
        const tensors = encodeBatch([lookbacks], 16)
        // console.log(tensors.arraySync())
        const prediction = s.predictor.predict(tensors)
        // console.log(prediction.arraySync())
        const predictedNextPrice = scaler.inverse_transform([0, prediction.arraySync()[0][0]])[1]
        // console.log(predictedNextPrice)
        global.predicted = predictedNextPrice
        // const stateTensor = getStateTensor({assets: s.balance.asset, currency: s.balance.currency, price: s.period.close, nextPrice: predictedNextPrice})
        const stateTensor = getStateTensor({lookbacks: decideLookbacks})
        // console.log(stateTensor.arraySync())
        const predictOut = s.decider.predict(stateTensor)
        console.log(predictOut.dataSync())
        bestAction = ALL_ACTIONS[predictOut.argMax(-1).dataSync()[0]]
        // console.log(bestAction)
      })
      // tf.disposeVariables()
    }
    // if(s.trained && enoughLookbackPeriods) {
    //   // console.log('make prediction')
    //   var min_predict = lowerOfTheTwo(s.options.min_periods, s.options.min_predict)
    //   trendLinePredict = s.lookback.slice(0, min_predict)
    //   console.log(trendLinePredict[0])
    //   var item = trendLinePredict.reverse()
    //   // console.log(item)
    //   s.prediction = s.brain.predict(item).dataSync()[0]
    //   // console.log('item', item[0])
    //   // console.log('s.prediction', s.prediction.dataSync())
    // }
    // NORMAL onPeriod STUFF here
        
    // console.log(s)
    global.bestAction = bestAction
    // console.log(bestAction)
    if (bestAction === 2) {
      s.signal = 'sell'
    } else if(bestAction === 1){
      s.signal = 'buy'
    } else {
      s.signal = null
    } 
    cb()
  } 

}