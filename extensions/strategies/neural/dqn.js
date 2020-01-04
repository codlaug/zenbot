
const tf = require('@tensorflow/tfjs')

function createDeepQNetwork(l, f, numActions) {
  if (!(Number.isInteger(l) && l > 0)) {
    throw new Error(`Expected height to be a positive integer, but got ${l}`)
  }
  if (!(Number.isInteger(f) && f > 0)) {
    throw new Error(`Expected height to be a positive integer, but got ${f}`)
  }
  if (!(Number.isInteger(numActions) && numActions > 1)) {
    throw new Error(
      'Expected numActions to be a integer greater than 1, ' +
        `but got ${numActions}`)
  }

  const model = tf.sequential()
  model.add(tf.layers.dense({
    units: 256,
    kernelSize: 3,
    strides: 1,
    activation: 'relu',
    inputShape: [l, f]
  }))
  model.add(tf.layers.batchNormalization())
  model.add(tf.layers.dense({
    units: 512,
    kernelSize: 3,
    strides: 1,
    activation: 'relu'
  }))
  model.add(tf.layers.batchNormalization())
  model.add(tf.layers.dense({
    units: 512,
    kernelSize: 3,
    strides: 1,
    activation: 'relu'
  }))
  model.add(tf.layers.flatten())
  model.add(tf.layers.dense({units: 100, activation: 'relu'}))
  model.add(tf.layers.dropout({rate: 0.25}))
  model.add(tf.layers.dense({units: numActions}))

  return model
}

/**
 * Copy the weights from a source deep-Q network to another.
 *
 * @param {tf.LayersModel} destNetwork The destination network of weight
 *   copying.
 * @param {tf.LayersModel} srcNetwork The source network for weight copying.
 */
function copyWeights(destNetwork, srcNetwork) {
  // https://github.com/tensorflow/tfjs/issues/1807:
  // Weight orders are inconsistent when the trainable attribute doesn't
  // match between two `LayersModel`s. The following is a workaround.
  // TODO(cais): Remove the workaround once the underlying issue is fixed.
  let originalDestNetworkTrainable
  if (destNetwork.trainable !== srcNetwork.trainable) {
    originalDestNetworkTrainable = destNetwork.trainable
    destNetwork.trainable = srcNetwork.trainable
  }

  destNetwork.setWeights(srcNetwork.getWeights())

  // Weight orders are inconsistent when the trainable attribute doesn't
  // match between two `LayersModel`s. The following is a workaround.
  // TODO(cais): Remove the workaround once the underlying issue is fixed.
  // `originalDestNetworkTrainable` is null if and only if the `trainable`
  // properties of the two LayersModel instances are the same to begin
  // with, in which case nothing needs to be done below.
  if (originalDestNetworkTrainable != null) {
    destNetwork.trainable = originalDestNetworkTrainable
  }
}

module.exports = { createDeepQNetwork, copyWeights }