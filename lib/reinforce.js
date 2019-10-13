const RL = require('reinforcejs')
const fs = require('fs')

const spec = {}
spec.update = 'qlearn' // qlearn | sarsa
spec.gamma = 0.9; // discount factor, [0, 1)
spec.epsilon = 0.2; // initial epsilon for epsilon-greedy policy, [0, 1)
spec.alpha = 0.01; // value function learning rate
spec.experience_add_every = 5; // number of time steps before we add another experience to replay memory
spec.experience_size = 10000; // size of experience
spec.learning_steps_per_iteration = 5;
spec.tderror_clamp = 1.0; // for robustness
spec.num_hidden_units = 100 // number of neurons in hidden layer

const states = [
  'open',
  'high',
  'low',
  'close',
  'volume',
  'tenkenSen',
  'kijunSen',
  'senkouA',
  'senkouB',
  'tkCrossScore',
  'pkCrossScore',
  'kumoBreakoutScore',
  'senkouCrossScore',
  'chikouCrossScore',
  'pricePlacementScore',
  'chikouPlacementScore'
]

const env = {
  getNumStates: function() {
    return states.length
  },
  getMaxNumActions: function() {
    return ['hold', 'buy', 'sell'].length
  }
}


module.exports = function() {
  const agent = new RL.DQNAgent(env, spec)
  if(fs.existsSync('brain.json')) {
    agent.fromJSON(JSON.parse(fs.readFileSync('brain.json').toString()))
  }
  return agent
}