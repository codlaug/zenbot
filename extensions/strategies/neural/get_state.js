const tf = require('@tensorflow/tfjs')


/**
 * Get the current state of the game as an image tensor.
 *
 * @param {object | object[]} state The state object as returned by
 *   `SnakeGame.getState()`, consisting of two keys: `s` for the snake and
 *   `f` for the fruit(s). Can also be an array of such state objects.
 * @param {number} lookbackLength how far to lookback at previous periods.
 * @param {number} featureLength how many statistics per period.
 * @return {tf.Tensor} A tensor of shape [numExamples, height, width, 2] and
 *   dtype 'float32'
 *   - The first channel uses 0-1-2 values to mark the snake.
 *     - 0 means an empty square.
 *     - 1 means the body of the snake.
 *     - 2 means the haed of the snake.
 *   - The second channel uses 0-1 values to mark the fruits.
 *   - `numExamples` is 1 if `state` argument is a single object or an
 *     array of a single object. Otherwise, it will be equal to the length
 *     of the state-object array.
 */

const {DEFAULT_STATS} = require('./trading_game')
const profitIndex = DEFAULT_STATS.length
const actionIndex = profitIndex+1

module.exports = function getStateTensor(state, lookbackLength, featureLength) {
  
  if (!Array.isArray(state)) {
    state = [state];
  }
  
  const numExamples = state.length;
  const buffer = tf.buffer([numExamples, lookbackLength, featureLength])
  
  for (let n = 0; n < numExamples; ++n) {
    if (state[n] == null) {
      continue;
    }

    state[n].p.forEach((p, i) => {
      DEFAULT_STATS.forEach((key, j) => {
        buffer.set(p[key], n, i, j)
      })
      buffer.set(state[n].profit, n, i, profitIndex)
      buffer.set(state[n].lastAction, n, i, actionIndex)
    })

  }
  return buffer.toTensor();
}