const tf = require('@tensorflow/tfjs')

const TRAIN_MIN_ROW = 0
const TRAIN_MAX_ROW = 200

module.exports = function PriceData(data) {
  // data is s.lookback
  
  data = data.map((item) => 
    [item.open, item.close, item.high, item.low, item.volume]
  )
  this.numColumns = data[0].length
  this.data = data
  const minIndex = TRAIN_MIN_ROW
  const maxIndex = TRAIN_MAX_ROW
  const closeIndex = 1
  
  this.getNextBatchFunction = function getNextBatchFunction(lookBack, delay, batchSize, step) {
    const normalize = false
    const shuffle = false
    const includeDateTime = false
    let startIndex = minIndex + lookBack
    const lookBackSlices = Math.floor(lookBack / step)
  
    return {
      next: () => {
        const rowIndices = []
        let done = false  // Indicates whether the dataset has ended.
        if (shuffle) {
          // If `shuffle` is `true`, start from randomly chosen rows.
          const range = maxIndex - (minIndex + lookBack)
          for (let i = 0; i < batchSize; ++i) {
            const row = minIndex + lookBack + Math.floor(Math.random() * range)
            rowIndices.push(row)
          }
        } else {
          // If `shuffle` is `false`, the starting row indices will be sequential.
          let r = startIndex
          for (; r < startIndex + batchSize && r < maxIndex; ++r) {
            rowIndices.push(r)
          }
          if (r >= maxIndex) {
            done = true
          }
        }
        console.log(rowIndices)
        const numExamples = rowIndices.length
        startIndex += numExamples
    
        const featureLength =
                includeDateTime ? this.numColumns + 2 : this.numColumns
        const samples = tf.buffer([numExamples, lookBackSlices, featureLength])
        const targets = tf.buffer([numExamples, 1])
        console.log('sample shape', samples.toTensor())
        console.log('target shape', targets.shape)
        
        // Iterate over examples. Each example contains a number of rows.
        for (let j = 0; j < numExamples; ++j) {
          const rowIndex = rowIndices[j]
          let exampleRow = 0
          // Iterate over rows in the example.
          for (let r = rowIndex - lookBack; r < rowIndex; r += step) {
            let exampleCol = 0
            // Iterate over features in the row.
            for (let n = 0; n < featureLength; ++n) {
              let value
              if (n < this.numColumns) {
                value = normalize ? this.normalizedData[r][n] : this.data[r][n]
              } else if (n === this.numColumns) {
                // Normalized day-of-the-year feature.
                value = this.normalizedDayOfYear[r]
              } else {
                // Normalized time-of-the-day feature.
                value = this.normalizedTimeOfDay[r]
              }
              samples.set(value, j, exampleRow, exampleCol++)
            }
    
            let value
            try {
              value = normalize ?
                this.normalizedData[r + delay][closeIndex] :
                this.data[r + delay][closeIndex]
            } catch(e) {
              console.log(e, r, delay, this.data.length)
            }
            targets.set(value, j, 0)
            exampleRow++
          }
        }
        console.log('sample shape', samples.toTensor())
        // process.exit()
        return {
          value: {xs: samples.toTensor(), ys: targets.toTensor()},
          done
        }
      }
    }
  }
}