let fs = require('fs')
let path = require('path')

module.exports = { 
  isUndefined: function isUndefined(variable) {
    return typeof variable === typeof undefined
  },

  allStrategyNames: function allStrategyNames() {
    let pathName = path.resolve(__dirname, '..', '..', 'extensions', 'strategies')
    return fs.readdirSync(pathName).filter(function (file) {
      return fs.statSync(pathName + '/' + file).isDirectory()
    })
  }
}