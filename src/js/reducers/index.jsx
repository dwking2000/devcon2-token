import { combineReducers } from 'redux'
import { routerReducer } from 'react-router-redux'
import { reducer as formReducer } from 'redux-form'

import tokens from './tokens'
import addresses from './addresses'
import pagination from './pagination'
import web3 from './web3'
import chain from './chain'
import config from './config'
import transactions from './transactions'


export default combineReducers({
  tokens,
  pagination,
  web3,
  addresses,
  chain,
  config,
  transactions,
  routing: routerReducer,
  form: formReducer,
})
