const tf = require('@tensorflow/tfjs')

// module.exports = function getStateTensor(state) {
//   if (!Array.isArray(state)) {
//     state = [state];
//   }
//   const numExamples = state.length;
//   // TODO(cais): Maintain only a single buffer for efficiency.
//   const buffer = tf.buffer([numExamples, 4]);

//   for (let n = 0; n < numExamples; ++n) {
//     if (state[n] == null) {
//       continue;
//     }

//     buffer.set(state[n].assets, n, 0);
//     buffer.set(state[n].currency, n, 1);
//     buffer.set(state[n].price, n, 2);
//     buffer.set(state[n].nextPrice, n, 3);
//   }
//   return buffer.toTensor();
// }

module.exports = function getStateTensor(state) {
  if (!Array.isArray(state)) {
    state = [state]
  }
  const numExamples = state.length
  // TODO(cais): Maintain only a single buffer for efficiency.
  const buffer = tf.buffer([numExamples, 3, 5])

  for (let n = 0; n < numExamples; ++n) {
    if (state[n] == null) {
      continue
    }

    for(let l = 0; l < state[n].lookbacks.length; ++l) {
      const period = state[n].lookbacks[l]
      buffer.set(period.open, n, l, 0)
      buffer.set(period.close, n, l, 1)
      buffer.set(period.high, n, l, 2)
      buffer.set(period.low, n, l, 3)
      buffer.set(period.volume, n, l, 4)
    }
  }
  return buffer.toTensor()
}