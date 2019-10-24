

const tf = require('@tensorflow/tfjs');
const fs = require('fs')

const {createDeepQNetwork} = require('./dqn');
const {getRandomAction, NUM_ACTIONS, ALL_ACTIONS} = require('./trading_game')
const getStateTensor = require('./get_state')
const ReplayMemory = require('./replay_memory');
const { assertPositiveInteger } = require('./utils');
const IOHandler = require('./io_handler')

const FEATURE_LENGTH = 21

const defaultConfig = {
  epsilonDecayFrames: 100,
  epsilonInit: 0.5,
  epsilonFinal: 0.01,
  featureLength: FEATURE_LENGTH,
  learningRate: 0.1
}

const ACTION_HOLD = 0;
const ACTION_BUY = 1;
const ACTION_SELL = 2;


const NEUTRAL_REWARD = 0;
const SELL_MAXIMA_REWARD = 2;
const SELL_PENALTY = -1;
const BUY_MINIMA_REWARD = 2;
const BUY_PENALTY = -1;
const HOLD_REWARD = 1;
const HOLD_EXTREMA_PENALTY = -1;


function isCloseToAndAbove(a, b) {
  return a > b && a - b < a * 0.05
}

function isCloseToAndBelow(a, b) {
  return a < b && b - a < a * 0.05
}

function debugging(onOff) {
  if(!onOff) {
    return (name, val) => val
  } else {
    return (name, val) => {
      console.log(name, val)
      return val
    }
  }
}

function rewardForBollingerBounce(period, action) {
  const { close, bollinger_upper: upper, bollinger_lower: lower } = period
  if(typeof upper === 'undefined' || typeof lower === 'undefined') return 0

  const lowBounce = isCloseToAndAbove(close, lower)
  const highBounce = isCloseToAndBelow(close, upper)

  if(action === ACTION_BUY) {
    if(lowBounce) {
      return 1
    } else if(highBounce) {
      return -1
    }
  } else if(action === ACTION_SELL) {
    if(highBounce) {
      return 1
    } else if(lowBounce) {
      return -1
    }
  }
  return 0
}

function rewardForAdxTrend(period, action) {
  const { adx, mdi, pdi } = period
  console.log(period)

  if(action === ACTION_BUY) {
    if(adx > 50 && pdi > 0) {
      return 1
    } else {
      return -1
    }
  } else if(action === ACTION_SELL) {
    if(adx > 50 && mdi > 0) {
      return 1
    } else {
      return -1
    }
  } else if(action === ACTION_HOLD) {
    if(adx < 20) {
      return 1
    }
  }
  return 1 // hold
}

function rewardForOverboughtOversold(period, action) {
  const { rsi } = period
  if(action === ACTION_BUY) {
    if(rsi < 30) {
      return 1
    } else {
      return -1
    }
  } else if(action === ACTION_SELL) {
    if(rsi > 70) {
      return 1
    } else {
      return -1
    }
  }
  return 1 // hold
}

function rewardForStochasticOverboughtOversold(period, action) {
  const { stochasticD, stochasticK } = period
  if(action === ACTION_BUY) {
    if(stochasticD < 20 && stochasticK < 20) {
      return 1
    } else {
      return -1
    }
  } else if(action === ACTION_SELL) {
    if(stochasticD > 80 && stochasticK > 80) {
      return 1
    } else {
      return -1
    }
  }
  return 1 // hold
}

// https://forextester.com/blog/ichimoku-kinko-hyo



// Chikou Span is greater than the price from 26 bars ago. ??? I thought chikou span was that

// Price is near the Kijun Sen and Tenkan Sen.
// Tenkan Sen, Kijun Sen, and Chikou Span are not in a thick Kumo Cloud.

// bullish if: The market is trading above the Kumo Cloud.
function rewardForKumoCloud(period, action) {
  const { close, senkouA, senkouB } = period
  if(action === ACTION_BUY) {
    if(close > senkouA && close > senkouB) {
      return close - senkouA
    } else {
      return 0
    }
  } else if(action === ACTION_SELL) {
    if(close < senkouA && close < senkouB) {
      return senkouA - close
    } else {
      return 0
    }
  }
  return 1 //hold
}

// bullish if: Tenkan Sen is greater than the Kijun Sen.
function rewardForTenkanSenGreaterThanKijunSen(period, action) {
  const { tenkanSen, kijunSen } = period
  if(action === ACTION_BUY) {
    // return tenkanSen > kijunSen ? 1 : -1
    return tenkanSen - kijunSen
  } else if(action === ACTION_SELL) {
    // return tenkanSen < kijunSen ? 1 : -1
    return kijunSen - tenkanSen
  }
  return 1 // hold
}

// bullish if: Future Senkou A is greater than the Future Senkou B.
function rewardForSenkouAGreaterThanSenkouB(period, action) {
  const { senkouA, senkouB } = period
  if(action === ACTION_BUY) {
    // return senkouA > senkouB ? 1 : -1
    return senkouA - senkouB
  } else if(action === ACTION_SELL) {
    // return senkouA < senkouB ? 1 : -1
    return senkouB - senkouA
  }
  return 1 // hold
}

function rewardForParabolicSAR(period, action) {
  const { parabolicSAR, close } = period
  if(action === ACTION_BUY) {
    return parabolicSAR < close ? 1 : -1
  } else if(action === ACTION_SELL) {
    return parabolicSAR > close ? 1 : -1
  }
  return 1 //hold
}


module.exports = class TradingAgent {


  /**
   * Constructor of SnakeGameAgent.
   *
   * @param {TradingGame} game A game object.
   * @param {object} config The configuration object with the following keys:
   *   - `replayBufferSize` {number} Size of the replay memory. Must be a
   *     positive integer.
   *   - `epsilonInit` {number} Initial value of epsilon (for the epsilon-
   *     greedy algorithm). Must be >= 0 and <= 1.
   *   - `epsilonFinal` {number} The final value of epsilon. Must be >= 0 and
   *     <= 1.
   *   - `epsilonDecayFrames` {number} The # of frames over which the value of
   *     `epsilon` decreases from `epislonInit` to `epsilonFinal`, via a linear
   *     schedule.
   */
  constructor(game, config) {
    config = Object.assign(config, defaultConfig);
    assertPositiveInteger(config.epsilonDecayFrames);

    this.game = game;

    this.epsilonInit = config.epsilonInit;
    this.epsilonFinal = config.epsilonFinal;
    this.epsilonDecayFrames = config.epsilonDecayFrames;
    this.epsilonIncrement_ = (this.epsilonFinal - this.epsilonInit) /
        this.epsilonDecayFrames;

    const lookbackLength = 6;

    this.onlineNetwork = createDeepQNetwork(lookbackLength, config.featureLength, NUM_ACTIONS)
    this.targetNetwork = createDeepQNetwork(lookbackLength, config.featureLength, NUM_ACTIONS)
    // Freeze taget network: it's weights are updated only through copying from
    // the online network.
    this.targetNetwork.trainable = false;

    this.optimizer = tf.train.adam(config.learningRate);

    this.replayBufferSize = config.replayBufferSize;
    this.replayMemory = new ReplayMemory(config.replayBufferSize);
    this.frameCount = 0;
  }


  reset() {
    this.cumulativeReward_ = 0;
  }




  /**
   * Play one step of the game.
   *
   * @returns {number | null} If this step leads to the end of the game,
   *   the total reward from the game as a plain number. Else, `null`.
   */
  playStep() {
    this.epsilon = this.frameCount >= this.epsilonDecayFrames ?
      this.epsilonFinal :
      this.epsilonInit + this.epsilonIncrement_  * this.frameCount;
    this.frameCount++;

    const lookbackLength = 3;

    // The epsilon-greedy algorithm.
    let action
    const state = this.game.getState();
    if (Math.random() < this.epsilon) {
      // Pick an action at random.
      action = getRandomAction()
    } else {
      // Greedily pick an action based on online DQN output.
      tf.tidy(() => {
        const stateTensor = getStateTensor(state, lookbackLength, this.game.stats.length)
        action = ALL_ACTIONS[this.onlineNetwork.predict(stateTensor).argMax(-1).dataSync()[0]];
      })
    }

    const {state: nextState, reward, done} = this.game.step(action)

    this.replayMemory.append([state, action, reward, done, nextState])

    this.cumulativeReward_ += reward
    const output = {
      action,
      cumulativeReward: this.cumulativeReward_,
      done
    };
    if (done) {
      this.reset();
    }
    return output;
  }

  save() {
    this.onlineNetwork.save(IOHandler)
  }

  load() {
    const promise = tf.loadLayersModel(IOHandler)
    promise.then(r => {
      this.onlineNetwork = r
    })
    return promise
  }


  // TODO: save and load the model


  addMemory(state, lastAction) {
    // console.log(state.p[2])
    const period = state.p[2]
    const prevPeriod = state.p[1].close;
    const prevPrevPeriod = state.p[0].close;
    let reward = 0

    const debug = debugging(true)

    // https://forextester.com/blog/ichimoku-kinko-hyo

    // reward += rewardForIdealIchimokuStrategy(period, lastAction)
    // reward += rewardForTenkanSenCrossStrategy(period, lastAction)
    // reward += rewardForKijunSenCrossStrategy(period, lastAction)
    

    // reward += debug('rewardForKumoCloud', rewardForKumoCloud(period, lastAction))
    // reward += debug('rewardForSenkouAGreaterThanSenkouB', rewardForSenkouAGreaterThanSenkouB(period, lastAction))
    // reward += debug('rewardForTenkanSenGreaterThanKijunSen', rewardForTenkanSenGreaterThanKijunSen(period, lastAction))
    // reward += debug('rewardForOverboughtOversold', rewardForOverboughtOversold(period, lastAction))
    // reward += debug('rewardForStochasticOverboughtOversold', rewardForStochasticOverboughtOversold(period, lastAction))
    // reward += debug('rewardForAdxTrend', rewardForAdxTrend(period, lastAction))
    // reward += debug('rewardForParabolicSAR', rewardForParabolicSAR(period, lastAction))
    // profit is actually profit direction
    reward += state.profit > 0 ? 10 : -10
    
    if(lastAction === ACTION_BUY) {
      // if(period > prevPeriod && prevPeriod < prevPrevPeriod) {
      //   reward = BUY_MINIMA_REWARD;
      // } else {
      //   reward = BUY_PENALTY;
      // }
      // reward += rewardForBollingerBounce(state.p[2], ACTION_BUY)
    } else if(lastAction === ACTION_SELL) {
      // if(period < prevPeriod && prevPeriod > prevPrevPeriod) {
      //   reward = SELL_MAXIMA_REWARD;
      // } else {
      //   reward = SELL_PENALTY;
      // }
      // reward += rewardForBollingerBounce(state.p[2], ACTION_SELL)
    } else if(lastAction === ACTION_HOLD) {
      // reward += 1
      // if(period < prevPeriod && prevPeriod < prevPrevPeriod
      //   || period > prevPeriod && prevPeriod > prevPrevPeriod) {
      //   reward = HOLD_REWARD;
      // } else {
      //   reward = HOLD_EXTREMA_PENALTY;
      // }
    }

    // console.log(reward)

    // console.log('adding memory', state, lastAction, reward)
    this.replayMemory.append([state, lastAction, reward, false, state])
  }











  /**
   * Perform training on a randomly sampled batch from the replay buffer.
   *
   * @param {number} batchSize Batch size.
   * @param {number} gamma Reward discount rate. Must be >= 0 and <= 1.
   * @param {tf.train.Optimizer} optimizer The optimizer object used to update
   *   the weights of the online network.
   */
  trainOnReplayBatch(batchSize, gamma, optimizer) {
    optimizer = this.optimizer
    // Get a batch of examples from the replay buffer.
    const batch = this.replayMemory.sample(batchSize);
    console.log(batch[0])
    const lossFunction = () => tf.tidy(() => {
      const stateTensor = getStateTensor(batch.map(example => example[0]), 6, FEATURE_LENGTH);
      const actionTensor = tf.tensor1d(batch.map(example => example[1]), 'int32');
      const qs = this.onlineNetwork.apply(stateTensor, {training: true}).mul(tf.oneHot(actionTensor, NUM_ACTIONS)).sum(-1);

      const rewardTensor = tf.tensor1d(batch.map(example => example[2]));
      const nextStateTensor = getStateTensor(batch.map(example => example[4]), 6, FEATURE_LENGTH);
      const nextMaxQTensor = this.targetNetwork.predict(nextStateTensor).max(-1);
      const doneMask = tf.scalar(1).sub(tf.tensor1d(batch.map(example => example[3])).asType('float32'));
      const targetQs = rewardTensor.add(nextMaxQTensor.mul(doneMask).mul(gamma));
      return tf.losses.meanSquaredError(targetQs, qs);
    });

    // Calculate the gradients of the loss function with repsect to the weights
    // of the online DQN.
    const grads = tf.variableGrads(lossFunction);
    // Use the gradients to update the online DQN's weights.
    optimizer.applyGradients(grads.grads);
    tf.dispose(grads);
    // TODO(cais): Return the loss value here?
  }

}
