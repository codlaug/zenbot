
class Trade {
  constructor(shares, price) {
    this._shares = shares
    this.price = price
  }

  cost_basis() {
    return this._shares * this.price
  }

  get shares() {
    return this._shares
  }

  remove(percent) {
    this._shares -= this._shares * percent
  }
}

class CostBasisCollection {

  constructor() {
    this.trades = []
  }

  append(assets, price) {
    this.trades.push(new Trade(assets, price))
    // console.log('total ', this.num_shares())
  }

  num_shares() {
    return this.trades.map(t => t.shares).reduce((t, s) => t+s, 0)
  }

  cost_basis() {
    return this.trades.map(t => t.cost_basis()).reduce((t, s) => t+s, 0)
  }

  avgPrice() {
    if(this.trades.length == 0) {
      return 0.0
    }
    return this.cost_basis() / this.num_shares()
  }

  remove(shares) {
    // console.log('removing shares', shares)
    let percent = shares / this.num_shares()
    // console.log('total ', this.num_shares())
    if(percent > 1) {
      percent = 1.0
    }
    for(let trade of this.trades) {
      // console.log(trade.shares)
      trade.remove(percent)
      // console.log(trade.shares)
    }
    this.trades = this.trades.filter(t => t.shares > 0.000001)
  }


}

module.exports = CostBasisCollection