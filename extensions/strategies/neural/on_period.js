const tf = require('@tensorflow/tfjs')
const {ALL_ACTIONS, getRandomAction} = require('./trading_game')
const n = require('numbro')

module.exports = {
  onPeriodSimulating: function (s, cb) {
    // console.log(s.lookback[0])
    let bestAction
    let currentQValues
    var trendLinePredict = []
    var trendLineLearn = []
    // this thing is crazy run with trendline placed here. But there needs to be a coin lock so you dont buy late!
    const notInPreroll = !s.in_preroll
    const enoughLookbackPeriods = s.lookback.length >= 4 //[s.options.min_periods]
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
      if (Math.random() < 0.1) {
        // Pick an action at random.
        bestAction = getRandomAction();
      } else {
        tf.tidy(() => {
          const stateTensor = getStateTensor({p: s.lookback.slice(0, 6).reverse(), profit: profit, lastAction: s.lastAction}, 6, FEATURE_LENGTH);
          const predictOut = s.brain.onlineNetwork.predict(stateTensor);
          // currentQValues = predictOut.dataSync();
          bestAction = ALL_ACTIONS[predictOut.argMax(-1).dataSync()[0]];
        })
        // tf.disposeVariables()
      }
    
      if(typeof s.lastAction !== 'undefined') {
        tf.tidy(() => {
          s.brain.addMemory({p: s.lookback.slice(1, 7).reverse(), profit: profit - s.lastProfit, lastAction: s.lastAction}, s.lastAction)
          s.brain.trainOnReplayBatch(1, 0.99)
        })
      }
      s.lastAction = bestAction
      s.lastProfit = profit
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
  },
  
  onPeriodTraining: function(s, cb) {
    cb()
  }
}