
const DEFAULT_LOOKBACK = []
const DEFAULT_STATS = ['high', 'low', 'open', 'close', 'volume', 'bollinger_upper', 'bollinger_mid', 'bollinger_lower', 'rsi', 'rsi_avg_gain', 'rsi_avg_loss', 'tenkanSen', 'kijunSen', 'senkouA', 'senkouB', 'trend_ema', 'adx', 'mdi', 'pdi', 'stochasticD', 'stochasticK', 'MACD', 'histogram', 'signal']

const LOOKBACK_LENGTH = 16

const ACTION_HOLD = 0
const ACTION_BUY = 1
const ACTION_SELL = 2

const ALL_ACTIONS = [ACTION_HOLD, ACTION_BUY, ACTION_SELL]
const NUM_ACTIONS = ALL_ACTIONS.length

const NEUTRAL_REWARD = 0
const SELL_MAXIMA_REWARD = 10
const SELL_PENALTY = -1
const BUY_MINIMA_REWARD = 10
const BUY_PENALTY = -1
const HOLD_REWARD = 1
const HOLD_EXTREMA_PENALTY = -1

const { min, assertPositiveInteger, getRandomInteger } = require('./utils')

function getRandomAction() {
  return getRandomInteger(0, NUM_ACTIONS)
}

class TradingGame {

  /**
   * Constructor of SnakeGame.
   *
   * @param {object} args Configurations for the game. Fields include:
   *   - lookback {number[]} periods to playback (positive integer).
   *   - stats {number[]} keys to look at in period (positive integer).
   */
  constructor(args) {
    if (args == null) {
      args = {}
    }
    if (args.stats == null) {
      args.stats = DEFAULT_STATS
    }

    assertPositiveInteger(args.stats.length, 'keys length')

    this.lookback = args.lookback
    this.stats = args.stats

    this.periods = {}
    this.currentPeriodId = null
    this.lastBalance = null
    this.trades = {}

    this.reset()
  }

  addPeriod(period) {
    this.periods[period.period_id] = period
    if(this.currentPeriodId === null) {
      this.currentPeriodId = period.period_id
    }
  }


  /**
   * Reset the state of the game.
   *
   * @return {object} Initial state of the game.
   *   See the documentation of `getState()` for details.
   */
  reset() {
    this.lookbackIndex = 0
    this.asset = 0
    this.currency = 1000
    this.signals = []
    // this.initializeSnake_();
    // this.fruitSquares_ = null;
    // this.makeFruits_();
    return this.getState()
  }



  /**
   * Perform a step of the game.
   *
   * @param {0 | 1 | 2} action The action to take in the current step/period.
   *   The meaning of the possible values:
   *     0 - hold
   *     1 - buy
   *     2 - sell
   * @return {object} Object with the following keys:
   *   - `reward` {number} the reward value.
   *     - 0 if no fruit is eaten in this step
   *     - 1 if a fruit is eaten in this step
   *   - `state` New state of the game after the step.
   *   - `fruitEaten` {boolean} Whether a fruit is eaten in this step.
   *   - `done` {boolean} whether the game has ended after this step.
   *     A game ends when the head of the snake goes off the board or goes
   *     over its own body.
   */
  step(s, action) {
    // TradingAgent calls this from its completeStep method once it has chosen an action
    // it should know the state of the game

    // Calculate the coordinates of the new head and check whether it has
    // gone off the board, in which case the game will end.
    let done = false

    // Check if we lost a lot of money, in which case, start over
    if (false /* big loss*/) {
      done = true
    }

    if (done) {
      return {reward: BIG_LOSS_REWARD, done, fruitEaten}
    }

    // Update the position of the snake.
    // this.snakeSquares_.unshift([newHeadY, newHeadX]);

    // Check if a fruit is eaten.
    
    let reward = 0
    const balance = s.balance.asset * s.period.close + parseFloat(s.balance.currency)
    // if(this.lastBalance === null) {
    //   reward = 0
    // } else {
    //   reward = balance - this.lastBalance
    // }

    let lastBuy //, losses = 0, sells = 0, wins = 0
    const winPrices = []
    const lossPrices = []
    const tradeIds = []
    if(s.my_trades) {
      for(let trade of s.my_trades) {
        if(typeof this.trades[trade.order_id] !== 'undefined') {
          continue
        }
        
        if (trade.type === 'buy') {
          lastBuy = trade
        } else if(lastBuy) {
          // console.log('buy', lastBuy)
          // console.log('sell', trade)
          if (trade.price < lastBuy.price) {
            // losses++
            lossPrices.push(lastBuy.price - trade.price)
          } else if(trade.price > lastBuy.price) {
            // wins++
            winPrices.push(trade.price - lastBuy.price)
          }
          this.trades[lastBuy.order_id] = lastBuy
          this.trades[trade.order_id] = trade
          // sells++
        }
      }
    }
    winPrices.forEach(price => {
      reward += price
    })
    lossPrices.forEach(price => {
      reward -= price
    })
    // for (let i = 0; i < this.fruitSquares_.length; ++i) {
    //   const fruitYX = this.fruitSquares_[i];
    //   if (fruitYX[0] === newHeadY && fruitYX[1] === newHeadX) {
    //     reward = FRUIT_REWARD;
    //     fruitEaten = true;
    //     this.fruitSquares_.splice(i, 1);
    //     this.makeFruits_();
    //     break;
    //   }
    // }
    // if (!fruitEaten) {
    //   // Pop the tail off if and only if the snake didn't eat a fruit in this step.
    //   this.snakeSquares_.pop()
    // }

    s.rewards.push(reward)

    this.lastBalance = balance
    const state = this.getState(s, action)
    return {reward, state, done}

    // // Calculate the coordinates of the new head and check whether it has
    // // gone off the board, in which case the game will end.
    // let done
    // this.lookbackIndex++

    // if(this.lookbackIndex > this.lookback.length) {
    //   done = true
    // }

    // if (done) {
    //   return {reward: 0, done}
    // }

    // let reward = NEUTRAL_REWARD
    // const period = this.lookback[this.lookbackIndex]
    // const prevPeriod = this.lookback[this.lookbackIndex-1]
    // const prevPrevPeriod = this.lookback[this.lookbackIndex-2]
    // if(action === ACTION_BUY) {
    //   if(period > prevPeriod && prevPeriod < prevPrevPeriod) {
    //     reward = BUY_MINIMA_REWARD
    //   } else {
    //     reward = BUY_PENALTY
    //   }
    // } else if(action === ACTION_SELL) {
    //   if(period < prevPeriod && prevPeriod > prevPrevPeriod) {
    //     reward = SELL_MAXIMA_REWARD
    //   } else {
    //     reward = SELL_PENALTY
    //   }
    // } else if(action === ACTION_HOLD) {
    //   if(period < prevPeriod && prevPeriod < prevPrevPeriod
    //     || period > prevPeriod && prevPeriod > prevPrevPeriod) {
    //     reward = HOLD_REWARD
    //   } else {
    //     reward = HOLD_EXTREMA_PENALTY
    //   }
    // }

    // // Check if a fruit is eaten.
    
    // // if(action === ACTION_BUY) {
    // //     this.signals[this.lookbackIndex] = ACTION_BUY;
    // // } else if(action === ACTION_SELL) {
    // //     this.signals[this.lookbackIndex] = ACTION_SELL
    // // }
    // this.signals[this.lookbackIndex] = action

    // const state = this.getState()
    // return {reward, state, done}
  }


  /**
   * Get plain JavaScript representation of the game state.
   *
   * @return An object with two keys:
   *   - s: {Array<[number, number]>} representing the squares occupied by
   *        the snake. The array is ordered in such a way that the first
   *        element corresponds to the head of the snake and the last
   *        element corresponds to the tail.
   *   - f: {Array<[number, number]>} representing the squares occupied by
   *        the fruit(s).
   */
  getState(s, action) {
    if(typeof s === 'undefined') {
      return { p: [] }
    }
    const lookbacks = s.lookback.slice(0, LOOKBACK_LENGTH).reverse()
    lookbacks.push(s.period)
    // console.log(lookbacks[lookbacks.length-1])
    // console.log(lookbacks.map(i => i.period_id))
    // this.lastState = { 'p': lookbacks }
    const balance = s.balance.asset * s.period.close + parseFloat(s.balance.currency)
    return {
      'p': lookbacks,
      'balance': balance,
      'action': action
    }
  }

  // getLastState() {
  //   return this.lastState
  // }

}

module.exports = { TradingGame, DEFAULT_STATS, ACTION_HOLD, ACTION_BUY, ACTION_SELL, ALL_ACTIONS, NUM_ACTIONS, getRandomAction}