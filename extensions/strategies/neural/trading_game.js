
const DEFAULT_LOOKBACK = [];
const DEFAULT_STATS = ['high', 'low', 'open', 'close', 'volume', 'bollinger_upper', 'bollinger_mid', 'bollinger_lower', 'rsi', 'rsi_avg_gain', 'rsi_avg_loss', 'tenkanSen', 'kijunSen', 'senkouA', 'senkouB', 'trend_ema', 'adx', 'mdi', 'pdi', 'stochasticD', 'stochasticK', 'MACD', 'histogram', 'signal']

const ACTION_HOLD = 0;
const ACTION_BUY = 1;
const ACTION_SELL = 2;

const ALL_ACTIONS = [ACTION_HOLD, ACTION_BUY, ACTION_SELL];
const NUM_ACTIONS = ALL_ACTIONS.length;

const NEUTRAL_REWARD = 0;
const SELL_MAXIMA_REWARD = 10;
const SELL_PENALTY = -1;
const BUY_MINIMA_REWARD = 10;
const BUY_PENALTY = -1;
const HOLD_REWARD = 1;
const HOLD_EXTREMA_PENALTY = -1;

const { min, assertPositiveInteger, getRandomInteger } = require('./utils');

function getRandomAction() {
  return getRandomInteger(0, NUM_ACTIONS);
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
      args = {};
    }
    if (args.lookback == null) {
      args.lookback = DEFAULT_LOOKBACK;
    }
    if (args.stats == null) {
      args.stats = DEFAULT_STATS;
    }

    assertPositiveInteger(args.lookback.length, 'lookback length');
    assertPositiveInteger(args.stats.length, 'keys length');

    this.lookback = args.lookback;
    this.stats = args.stats;

    this.reset();
  }


  /**
   * Reset the state of the game.
   *
   * @return {object} Initial state of the game.
   *   See the documentation of `getState()` for details.
   */
  reset() {
    this.lookbackIndex = 0;
    this.asset = 0;
    this.currency = 1000;
    this.signals = [];
    // this.initializeSnake_();
    // this.fruitSquares_ = null;
    // this.makeFruits_();
    return this.getState();
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
  step(action) {

    // Calculate the coordinates of the new head and check whether it has
    // gone off the board, in which case the game will end.
    let done;
    this.lookbackIndex++;

    this.updateAction_(action);
    
    if(this.lookbackIndex > this.lookback.length) {
        done = true;
    }

    if (done) {
      return {reward: 0, done};
    }

    let reward = NEUTRAL_REWARD;
    const period = this.lookback[this.lookbackIndex];
    const prevPeriod = this.lookback[this.lookbackIndex-1];
    const prevPrevPeriod = this.lookback[this.lookbackIndex-2];
    if(action === ACTION_BUY) {
      if(period > prevPeriod && prevPeriod < prevPrevPeriod) {
        reward = BUY_MINIMA_REWARD;
      } else {
        reward = BUY_PENALTY;
      }
    } else if(action === ACTION_SELL) {
      if(period < prevPeriod && prevPeriod > prevPrevPeriod) {
        reward = SELL_MAXIMA_REWARD;
      } else {
        reward = SELL_PENALTY;
      }
    } else if(action === ACTION_HOLD) {
      if(period < prevPeriod && prevPeriod < prevPrevPeriod
        || period > prevPeriod && prevPeriod > prevPrevPeriod) {
        reward = HOLD_REWARD;
      } else {
        reward = HOLD_EXTREMA_PENALTY;
      }
    }

    // Check if a fruit is eaten.
    
    // if(action === ACTION_BUY) {
    //     this.signals[this.lookbackIndex] = ACTION_BUY;
    // } else if(action === ACTION_SELL) {
    //     this.signals[this.lookbackIndex] = ACTION_SELL
    // }
    this.signals[this.lookbackIndex] = action;

    const state = this.getState();
    return {reward, state, done};
  }



  updateAction_(action) {
    this.action =action;
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
  getState() {
    return {
      "p": this.lookback.slice(this.lookbackIndex-3, this.lookbackIndex+1)
    }
  }

}

module.exports = { TradingGame, DEFAULT_STATS, ACTION_HOLD, ACTION_BUY, ACTION_SELL, ALL_ACTIONS, NUM_ACTIONS, getRandomAction}