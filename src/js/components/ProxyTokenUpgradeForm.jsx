import _ from 'lodash'
import * as ethUtil from 'ethereumjs-util'
import React from 'react'
import { connect } from 'react-redux'
import { push } from 'react-router-redux';
import SyntaxHighlighter from "react-syntax-highlighter/dist/light"
import docco from 'react-syntax-highlighter/dist/styles/docco'; 
import { Field, reduxForm, formValueSelector, reset as resetForm } from 'redux-form';
import actions from '../actions'
import BSCard from './BSCard'
import BSTag from './BSTag'
import HideIfNoWeb3 from './HideIfNoWeb3'
import EthereumAddress from './EthereumAddress'
import EthereumChecksumAddress from './EthereumChecksumAddress'
import LoadingSpinner from './LoadingSpinner'

function mapStateToProps(state) {
  return {
    tokenContractAddress: state.config.INDIVIDUALITY_TOKEN_ROOT_CONTRACT_ADDRESS,
    web3: state.web3,
    tokens: state.tokens,
  }
}

export default HideIfNoWeb3(connect(mapStateToProps)(React.createClass({
  componentWillMount() {
    if (this.props.accounts === null) {
      this.props.dispatch(actions.getWeb3AccountList())
    }
  },
  setUpgradeParameters(formData) {
    this.props.dispatch(actions.updateTokenUpgradeParameters(
      this.props.tokenId,
      this.props.tokenContractAddress,
      this.props.tokenData.owner,
      formData.tokenRecipient,
    )).then(function() {
      location.hash = 'signature-form'
    })
  },
  submitUpgradeSignature(formData) {
    let upgradeParameters = this.upgradeParameters()
    this.props.dispatch(actions.submitProxyUpgrade(
      this.props.tokenId,
      upgradeParameters.bytesToSign,
      upgradeParameters.currentOwner,
      upgradeParameters.tokenRecipient,
      formData.upgradeSignature,
    )).then(function() {
      location.hash = 'transaction-list'
    })
  },
  getUpgradeParametersFormInitialValues() {
    return {
      contractAddress: this.props.tokenContractAddress,
      currentOwner: this.props.tokenData.owner,
      tokenRecipient: this.props.tokenData.owner,
    }
  },
  getSignatureFormInitialValues() {
    var signedBytes = _.get(this.upgradeData(), 'signedBytes', '')
    var bytesToSign = _.get(this.upgradeParameters(), 'bytesToSign')

    var signature = ''

    if (!_.isEmpty(bytesToSign) && bytesToSign === signedBytes) {
      signature = _.get(this.upgradeData(), 'signature', '')
    }

    return {
      upgradeSignature: signature,
    }
  },
  upgradeData() {
    return _.get(
      this.props.tokens.upgradeData,
      this.props.tokenId,
      {},
    )
  },
  upgradeParameters() {
    return _.get(
      this.props.tokens.upgradeData,
      this.props.tokenId + '.upgradeParameters',
      {},
    )
  },
  canSignLocally() {
    var web3 = this.props.web3.web3
    var address = web3.toChecksumAddress(this.upgradeParameters().currentOwner)
    return _.some(this.props.web3.accounts, function(account) {
      return (address === web3.toChecksumAddress(account))
    })
  },
  isReadyForSignature() {
    return !_.isEmpty(_.get(this.upgradeParameters(), 'bytesToSign'))
  },
  renderSignInBrowserForm() {
    return (
      <SignInBrowserCard tokenId={this.props.tokenId} tokenData={this.props.tokenData} upgradeParameters={this.upgradeParameters()} upgradeData={this.upgradeData()} />
    )
  },
  renderManualSignatureForm() {
      return (
        <SignatureForm tokenId={this.props.tokenId} tokenData={this.props.tokenData} upgradeData={this.upgradeData()} upgradeParameters={this.upgradeParameters()} initialValues={this.getSignatureFormInitialValues()} onSubmit={this.submitUpgradeSignature} validate={signatureValidatorFactory(this.props.web3.web3, this.upgradeParameters())} />
      )
  },
  renderSignatureForms() {
    if (!this.isReadyForSignature()) {
      return (
        <div className="alert alert-info" role="alert">
          <p>Upgrade Parameters must first be confirmed.</p>
        </div>
      )
    } else if (this.canSignLocally()) {
      return (
        <div className="row">
          <div className="col-sm-6">
            {this.renderSignInBrowserForm()}
          </div>
          <div className="col-sm-6">
            {this.renderManualSignatureForm()}
          </div>
        </div>
      )
    } else {
      return (
        <div className="row">
          <div className="col-sm-12">
            {this.renderManualSignatureForm()}
          </div>
        </div>
      )
    }
  },
  render() {
    return (
      <div className="row">
        <h2 className="col-sm-12">Method #2: Proxy Upgrade</h2>
        <div className="col-sm-12">
          <p>This method involves submitting a cryptographic signature to the <code>proxyUpgrade()</code> function.</p>
        </div>
        <a name="upgrade-parameters" />
        <UpgradeParametersForm tokenId={this.props.tokenId} tokenData={this.props.tokenData} upgradeParameters={this.upgradeParameters()} initialValues={this.getUpgradeParametersFormInitialValues()} onSubmit={this.setUpgradeParameters} />
        <div className="col-sm-12 container">
          <a name="signature-form" />
          <BSCard>
            <BSCard.Header>
              <BSTag type="info">Step 2:</BSTag> Create Upgrade Signature
            </BSCard.Header>
            <BSCard.Block>
              {this.renderSignatureForms()}
            </BSCard.Block>
          </BSCard>
        </div>
      </div>
    )
  },
})))

let UpgradeParametersForm = reduxForm({form: 'proxy-signature-parameters'})(connect(function(state) {
  return {
    tokenRecipient: formValueSelector('proxy-signature-parameters')(state, 'tokenRecipient'),
  }
})(React.createClass({
  render() {
    return (
      <div className="col-sm-12">
        <BSCard>
          <BSCard.Header>
            <BSTag type="info">Step 1</BSTag>: Upgrade Parameters
          </BSCard.Header>
          <BSCard.Block>
            <form className="container clearfix" onSubmit={this.props.handleSubmit}>
              <div className="form-group row">
                <label htmlFor="contractAddress" className="col-sm-2 col-form-label">Contract Address</label>
                <div className="col-sm-10">
                  <Field component="input" type="text" readOnly="true" className="form-control" name="contractAddress" placeholder="0x..."/>
                  <p className="form-text text-muted">The address of the upgraded token contract</p>
                </div>
              </div>
              <div className="form-group row">
                <label htmlFor="currentOwner" className="col-sm-2 col-form-label">Current Owner</label>
                <div className="col-sm-10">
                  <Field component="input" type="text" readOnly="true" className="form-control" name="currentOwner" placeholder="0x..."/>
                  <p className="form-text text-muted">The address that owns the token being upgraded in the old token contract.</p>
                </div>
              </div>
              <div className="form-group row">
                <label htmlFor="tokenRecipient" className="col-sm-2 col-form-label">New Owner</label>
                <div className="col-sm-10">
                  <Field component="input" type="text" className="form-control" name="tokenRecipient" placeholder="0x..." />
                  <p className="form-text text-muted">The address that will own the token after upgrading.</p>
                </div>
              </div>
              <div className="btn-group">
                <p>The upgraded token will be owned by <EthereumAddress address={this.props.tokenRecipient} imageSize={12} />.  Is this correct?</p>
                <button type="submit" className="btn btn-primary">Confirm Upgrade Parameters</button>
              </div>
            </form>
          </BSCard.Block>
        </BSCard>
      </div>
    )
  }
})))

let SignInBrowserCard = connect(function(state) {
  return {
    web3: state.web3,
  }
})(React.createClass({
  signAndSubmit() {
    this.props.dispatch(actions.createUpgradeSignature(
      this.props.tokenId,
      this.props.upgradeParameters.currentOwner,
      this.props.upgradeParameters.bytesToSign,
    )).then(function(arst) {
      console.info('Data', this.props.upgradeData)
      console.info('Submitting Signature', this.props.upgradeData.signature)
      this.props.dispatch(actions.submitProxyUpgrade(
        this.props.tokenId,
        this.props.upgradeParameters.bytesToSign,
        this.props.upgradeParameters.currentOwner,
        this.props.upgradeParameters.tokenRecipient,
        this.props.upgradeData.signature,
      )).then(function() {
        location.hash = 'transaction-list'
      })
    }.bind(this))
  },
  render() {
    return (
      <BSCard>
        <BSCard.Header className="card-header">
          Sign In Browser
        </BSCard.Header>
        <BSCard.Block className="card-block">
          <p>It appears that the address <EthereumAddress address={this.props.upgradeParameters.currentOwner} imageSize={12} /> is available for use within your browser.  Click the button below to upgrade your token.</p>
          <div className="btn-group">
            <button type="button" className="btn btn-primary" onClick={this.signAndSubmit}>Upgrade Token</button>
          </div>
        </BSCard.Block>
      </BSCard>
    )
  }
}))

function signatureValidatorFactory(web3, upgradeParameters) {
  return function(values) {
    let errors = {}

    if (_.isEmpty(upgradeParameters.dataHash)) {
      return errors
    }

    let dataHashBuffer = ethUtil.toBuffer(upgradeParameters.dataHash)
    let expectedSigner = ethUtil.toBuffer(upgradeParameters.currentOwner)

    if (ethUtil.stripHexPrefix(values.upgradeSignature).length != 65 * 2) {
      errors.upgradeSignature = "Invalid signature: Must be exactly 65 bytes"
    } else {
      let {v, r, s} = ethUtil.fromRpcSig(values.upgradeSignature)
      let actualSignerPublicKey = ethUtil.ecrecover(dataHashBuffer, v, r, s)
      let actualSigner = ethUtil.pubToAddress(actualSignerPublicKey)

      if (actualSigner.toString() !== expectedSigner.toString()) {
        errors.upgradeSignature = `Invalid signature: Expected signature from '${ethUtil.bufferToHex(expectedSigner)}'.  Signature actually signed by '${ethUtil.bufferToHex(actualSigner)}'`
      }
    }
    return errors
  }
}

let InputWithErrors = React.createClass({
  render() {
    let extraClass = ""
    if (this.props.meta.touched) {
      if (this.props.meta.error) {
        extraClass = " has-error"
      } else {
        extraClass = " has-success"
      }
    }
    return (
      <div className={`form-group row${extraClass}`}>
        <label htmlFor={this.props.name} className="col-sm-2 col-form-label form-control-label">{this.props.label}</label>
        <div className="col-sm-10">
          <input type="text" className={`form-control${extraClass}`} name={this.props.name} {...this.props.input} />
          <div className={`form-control-feedback${extraClass}`}>{this.props.meta.error}</div>
          <p className="form-text text-muted">The 65 byte signature.</p>
        </div>
      </div>
    )
  }
})

let SignatureForm = reduxForm({
  form: 'submit-proxy-upgrade-signature',
})(connect(function(state) {
  return {
    web3: state.web3,
  }
})(React.createClass({
  signatureCodeBlock() {
    return `Data To Sign (hex encoded):\n${this.props.upgradeParameters.hexToSign}\n\nData Hash to Sign (hex encoded):\n${this.props.upgradeParameters.dataHash}`
  },
  gethConsoleCommand() {
    return `> eth.sign("${this.props.upgradeParameters.currentOwner}", "${this.props.upgradeParameters.dataHash}")`
  },
  renderBody() {
    return (
      <div>
        <p>The following data needs to be signed by the account <EthereumAddress address={this.props.upgradeParameters.currentOwner} imageSize={12} />.</p>
        <SyntaxHighlighter language='javascript' style={docco}>{this.signatureCodeBlock()}</SyntaxHighlighter>
        <p>This data is the concatenated bytes of the following three values:</p>
        <ul>
          <li>Token contract address: <EthereumAddress address={this.props.upgradeParameters.tokenContractAddress} imageSize={12} /></li>
          <li>Current owner: <EthereumAddress address={this.props.upgradeParameters.currentOwner} imageSize={12} /></li>
          <li>Owner after upgrade: <EthereumAddress address={this.props.upgradeParameters.tokenRecipient} imageSize={12} /></li>
        </ul>
        <p>You can sign the data above with the following command using the <code>geth</code> console:</p>
        <SyntaxHighlighter language='javascript' style={docco}>{this.gethConsoleCommand()}</SyntaxHighlighter>
        <form className="container" onSubmit={this.props.handleSubmit}>
          <p>Please paste the signature into the field below.</p>
          <Field type="text" component={InputWithErrors} name="upgradeSignature" label="Signature" />
          <div className="btn-group">
            <button type="submit" disabled={this.props.pristine || this.props.invalid} className="btn btn-primary">Upgrade Token</button>
          </div>
        </form>
      </div>
    )
  },
  render() {
    return (
      <BSCard>
        <BSCard.Header className="card-header">
          Create Signature
        </BSCard.Header>
        <BSCard.Block className="card-block">
          {this.renderBody()}
        </BSCard.Block>
      </BSCard>
    )
  }
})));
