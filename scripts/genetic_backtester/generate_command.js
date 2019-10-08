const isUndefined = require('./utils').isUndefined

  
function isUsefulKey(key) {
  if (key == 'filename' || key == 'show_options' || key == 'sim') return false
  return true
}
  
module.exports = function generateCommandParams(input) {
  if (!isUndefined(input) && !isUndefined(input.params)) {
    input = input.params.replace('module.exports =', '')
  }
  
  input = JSON.parse(input)
  
  var result = ''
  var keys = Object.keys(input)
  for (let i = 0; i < keys.length; i++) {
    var key = keys[i]
    if (isUsefulKey(key)) {
      // selector should be at start before keys
      if (key == 'selector') {
        result = input[key] + result
      }
  
      else result += ' --' + key + '=' + input[key]
    }
  }
  return result
}