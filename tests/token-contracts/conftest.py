import functools
import pytest
import rlp
from ethereum import blocks
from eth_abi import (
    encode_single,
    decode_single,
)

from web3.utils.string import (
    force_text,
)
from web3.utils.encoding import (
    decode_hex,
    encode_hex,
)
from sha3 import sha3_256
from testrpc import testrpc


@pytest.fixture()
def token_v1(chain, web3):
    token = chain.get_contract('Devcon2TokenForTesting')
    chain_code = web3.eth.getCode(token.address)
    assert len(chain_code) > 10
    assert token.call().minters(web3.eth.coinbase) is True
    return token


@pytest.fixture()
def token_lib(chain):
    token_lib = chain.get_contract('TokenLib')
    return token_lib


@pytest.fixture()
def TokenLib(token_lib):
    return type(token_lib)


@pytest.fixture()
def token_v1_owner(chain, web3, token_v1, get_event_data):
    token = token_v1
    assert token.call().isTokenOwner(web3.eth.accounts[1]) is False

    mint_txn_hash = token.transact().mint(web3.eth.accounts[1], 'Piper Merriam')
    chain.wait.for_receipt(mint_txn_hash)

    mint_data = get_event_data('Mint', token_v1, mint_txn_hash)
    assert mint_data['args']['_to'] == web3.eth.accounts[1]

    assert token.call().isTokenOwner(web3.eth.accounts[1]) is True

    return web3.eth.accounts[1]


@pytest.fixture()
def token_id(token_v1, token_v1_owner):
    token = token_v1
    token_owner = token_v1_owner
    token_id = token.call().ownedToken(token_owner)
    owner = token.call().ownerOf(token_id)

    assert owner == token_owner
    return token_id


@pytest.fixture()
def other_token_v1_owner(chain, web3, token_v1, get_event_data):
    token = token_v1
    assert token.call().isTokenOwner(web3.eth.accounts[2]) is False

    mint_txn_hash = token.transact().mint(web3.eth.accounts[2], 'Vitalik Buterin')
    chain.wait.for_receipt(mint_txn_hash)

    mint_data = get_event_data('Mint', token_v1, mint_txn_hash)
    assert mint_data['args']['_to'] == web3.eth.accounts[2]

    assert token.call().isTokenOwner(web3.eth.accounts[2]) is True

    return web3.eth.accounts[2]


@pytest.fixture()
def other_token_id(token_v1, other_token_v1_owner):
    token = token_v1
    other_token_owner = other_token_v1_owner
    other_token_id = token.call().ownedToken(other_token_owner)
    owner = token.call().ownerOf(other_token_id)

    assert owner == other_token_owner
    return other_token_id


@pytest.fixture()
def unknown_token_id(token_v1, web3):
    token = token_v1
    unknown_token_id = decode_hex(web3.sha3(encode_hex('Hudson James')))

    assert unknown_token_id == sha3_256(b'Hudson James').digest()
    assert token.call().identityOf(unknown_token_id) == ''
    assert token.call().ownerOf(unknown_token_id) == '0x0000000000000000000000000000000000000000'

    return unknown_token_id


@pytest.fixture()
def NULL_TOKEN():
    return '\x00' * 32


@pytest.fixture()
def NULL_ADDRESS():
    return '0x' + '0' * 40


@pytest.fixture()
def get_event_data(chain, web3):
    def _get_event_data(event_name, contract, txn_hash):
        txn_receipt = chain.wait.for_receipt(txn_hash)
        filter = contract.pastEvents(event_name, {
            'fromBlock': txn_receipt['blockNumber'],
            'toBlock': txn_receipt['blockNumber'],
        })
        log_entries = filter.get()
        if len(log_entries) == 0:
            raise AssertionError("Something went wrong.  No '{0}' log entries found".format(event_name))
        event_data = log_entries[0]
        return event_data
    return _get_event_data


@pytest.fixture()
def evm(web3):
    tester_client = testrpc.tester_client
    assert web3.eth.blockNumber == len(tester_client.evm.blocks) - 1
    return tester_client.evm


@pytest.fixture()
def set_timestamp(web3, evm):
    def _set_timestamp(timestamp):
        evm.block.finalize()
        evm.block.commit_state()
        evm.db.put(evm.block.hash, rlp.encode(evm.block))

        block = blocks.Block.init_from_parent(
            evm.block,
            decode_hex(web3.eth.coinbase),
            timestamp=timestamp,
        )

        evm.block = block
        evm.blocks.append(evm.block)
        return timestamp
    return _set_timestamp


@pytest.fixture()
def convert_uint_to_token_id():
    def _convert_uint_to_token_id(token_id_as_uint):
        return force_text(decode_single('bytes32', encode_single('uint256', token_id_as_uint)))
    return _convert_uint_to_token_id


@pytest.fixture()
def convert_token_id_to_uint(convert_uint_to_token_id):
    def _convert_token_id_to_uint(token_id):
        return decode_single('uint256', encode_single('bytes32', token_id))
    assert _convert_token_id_to_uint(convert_uint_to_token_id(12345)) == 12345
    assert _convert_token_id_to_uint(convert_uint_to_token_id(0)) == 0
    assert _convert_token_id_to_uint(convert_uint_to_token_id(54321)) == 54321
    return _convert_token_id_to_uint
