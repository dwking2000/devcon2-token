pragma solidity ^0.4.0;


import {TokenInterface} from "contracts/TokenInterface.sol";
import {IndividualityTokenRootInterface} from "contracts/IndividualityTokenInterface.sol";


library TokenEventLib {
    /*
     * When underlying solidity issue is fixed this library will not be needed.
     * https://github.com/ethereum/solidity/issues/1215
     */
    event Transfer(address indexed _from,
                   address indexed _to,
                   bytes32 indexed _tokenID);
    event Approval(address indexed _owner,
                   address indexed _spender,
                   bytes32 indexed _tokenID);

    function _Transfer(address _from, address _to, bytes32 _tokenID) public {
        Transfer(_from, _to, _tokenID);
    }

    function _Approval(address _owner, address _spender, bytes32 _tokenID) public {
        Approval(_owner, _spender, _tokenID);
    }
}


contract IndividualityTokenRoot is IndividualityTokenRootInterface {
    TokenInterface public devcon2Token;

    function IndividualityTokenRoot(address _devcon2Token) {
        devcon2Token = TokenInterface(_devcon2Token);
    }

    // owner => token
    mapping (address => bytes32) ownerToToken;

    // token => owner
    mapping (bytes32 => address) tokenToOwner;

    // owner => spender => token
    mapping (address => mapping (address => bytes32)) approvals;

    uint _upgradeCount;

    /*
     * Internal Helpers
     */
    function isEligibleForUpgrade(address _owner) internal returns (bool) {
        if (ownerToToken[_owner] != 0x0) {
            // already a token owner
            return false;
        } else if (!devcon2Token.isTokenOwner(_owner)) {
            // not a token owner on the original devcon2Token contract.
            return false;
        } else if (tokenToOwner[bytes32(devcon2Token.balanceOf(_owner))] != 0x0) {
            // the token has already been upgraded.
            return false;
        } else {
            return true;
        }
    }

    /*
     * Any function modified with this will perform the `upgrade` call prior to
     * execution which allows people to use this contract as-if they had
     * already processed the upgrade.
     */
    modifier silentUpgrade {
        if (isEligibleForUpgrade(msg.sender)) {
            upgrade();
        }
        _;
    }


    /// @dev Return the number of tokens
    function totalSupply() constant returns (uint256) {
        return devcon2Token.totalSupply();
    }

    /// @dev Returns id of token owned by given address (encoded as an integer).
    /// @param _owner Address of token owner.
    function balanceOf(address _owner) constant returns (uint256 balance) {
        if (_owner == 0x0) {
            return 0;
        } else if (ownerToToken[_owner] == 0x0) {
            // not a current token owner.  Check whether they are on the
            // original contract.
            if (devcon2Token.isTokenOwner(_owner)) {
                // pull the tokenID
                var tokenID = bytes32(devcon2Token.balanceOf(_owner));

                if (tokenToOwner[tokenID] == 0x0) {
                    // the token hasn't yet been upgraded so we can return 1.
                    return 1;
                }
            }
            return 0;
        } else {
            return 1;
        }
    }

    /// @dev Returns the token id that may transfer from _owner account by _spender..
    /// @param _owner Address of token owner.
    /// @param _spender Address of token spender.
    function allowance(address _owner,
                       address _spender) constant returns (uint256 remaining) {
        var approvedTokenID = approvals[_owner][_spender];

        if (approvedTokenID == 0x0) {
            return 0;
        } else if (_owner == 0x0 || _spender == 0x0) {
            return 0;
        } else if (tokenToOwner[approvedTokenID] == _owner) {
            return 1;
        } else {
            return 0;
        }
    }

    /// @dev Transfers sender token to given address. Returns success.
    /// @param _to Address of new token owner.
    /// @param _value Bytes32 id of the token to transfer.
    function transfer(address _to,
                      uint256 _value) public silentUpgrade returns (bool success) {
        if (_value != 1) {
            // 1 is the only value that makes any sense here.
            return false;
        } else if (_to == 0x0) {
            // cannot transfer to the null address.
            return false;
        } else if (ownerToToken[msg.sender] == 0x0) {
            // msg.sender is not a token owner
            return false;
        } else if (ownerToToken[_to] != 0x0) {
            // cannot transfer to an address that already owns a token.
            return false;
        } else if (isEligibleForUpgrade(_to)) {
            // cannot transfer to an account which is still holding their token
            // in the old system.
            return false;
        }

        // pull the token id.
        var tokenID = ownerToToken[msg.sender];

        // remove the token from the sender.
        ownerToToken[msg.sender] = 0x0;

        // assign the token to the new owner
        ownerToToken[_to] = tokenID;
        tokenToOwner[tokenID] = _to;

        // log the transfer
        Transfer(msg.sender, _to, 1);
        TokenEventLib._Transfer(msg.sender, _to, tokenID);

        return true;
    }

    /// @dev Transfers sender token to given address. Returns success.
    /// @param _to Address of new token owner.
    function transfer(address _to) public returns (bool success) {
        return transfer(_to, 1);
    }

    /// @dev Allows allowed third party to transfer tokens from one address to another. Returns success.
    /// @param _from Address of token owner.
    /// @param _to Address of new token owner.
    /// @param _value Bytes32 id of the token to transfer.
    function transferFrom(address _from,
                          address _to,
                          uint256 _value) public returns (bool success) {
        if (_value != 1) {
            // Cannot transfer anything other than 1 token.
            return false;
        } else if (_to == 0x0) {
            // Cannot transfer to the null address
            return false;
        } else if (ownerToToken[_from] == 0x0) {
            // Cannot transfer if _from is not a token owner
            return false;
        } else if (ownerToToken[_to] != 0x0) {
            // Cannot transfer to an existing token owner
            return false;
        } else if (approvals[_from][msg.sender] != ownerToToken[_from]) {
            // The approved token doesn't match the token being transferred.
            return false;
        } else if (isEligibleForUpgrade(_to)) {
            // cannot transfer to an account which is still holding their token
            // in the old system.
            return false;
        }

        // pull the tokenID
        var tokenID = ownerToToken[_from];

        // null out the approval
        approvals[_from][msg.sender] = 0x0;

        // remove the token from the sender.
        ownerToToken[_from] = 0x0;

        // assign the token to the new owner
        ownerToToken[_to] = tokenID;
        tokenToOwner[tokenID] = _to;

        // log the transfer
        Transfer(_from, _to, 1);
        TokenEventLib._Transfer(_from, _to, tokenID);

        return true;
    }

    /// @dev Allows allowed third party to transfer tokens from one address to another. Returns success.
    /// @param _from Address of token owner.
    /// @param _to Address of new token owner.
    function transferFrom(address _from, address _to) public returns (bool success) {
        return transferFrom(_from, _to, 1);
    }

    /// @dev Sets approval spender to transfer ownership of token. Returns success.
    /// @param _spender Address of spender..
    /// @param _value Bytes32 id of token that can be spend.
    function approve(address _spender,
                     uint256 _value) public silentUpgrade returns (bool success) {
        if (_value != 1) {
            // cannot approve any value other than 1
            return false;
        } else if (_spender == 0x0) {
            // cannot approve the null address as a spender.
            return false;
        } else if (ownerToToken[msg.sender] == 0x0) {
            // cannot approve if not a token owner.
            return false;
        }

        var tokenID = ownerToToken[msg.sender];
        approvals[msg.sender][_spender] = tokenID;

        Approval(msg.sender, _spender, 1);
        TokenEventLib._Approval(msg.sender, _spender, tokenID);

        return true;
    }

    /// @dev Sets approval spender to transfer ownership of token. Returns success.
    /// @param _spender Address of spender..
    function approve(address _spender) public returns (bool success) {
        return approve(_spender, 1);
    }

    /*
     *  Extra non ERC20 functions
     */
    /// @dev Returns whether the address owns a token.
    /// @param _owner Address to check.
    function isTokenOwner(address _owner) constant returns (bool) {
        if (_owner == 0x0) {
            return false;
        } else if (ownerToToken[_owner] == 0x0) {
            // Check if the owner has a token on the main devcon2Token contract.
            if (devcon2Token.isTokenOwner(_owner)) {
                // pull the token ID
                var tokenID = bytes32(devcon2Token.balanceOf(_owner));

                if (tokenToOwner[tokenID] == 0x0) {
                    // They own an un-transfered token in the parent
                    // devcon2Token contract.
                    return true;
                }
            }
            return false;
        } else {
            return true;
        }
    }

    /// @dev Returns the address of the owner of the given token id.
    /// @param _tokenID Bytes32 id of token to lookup.
    function ownerOf(bytes32 _tokenID) constant returns (address owner) {
        if (_tokenID == 0x0) {
            return 0x0;
        } else if (tokenToOwner[_tokenID] != 0x0) {
            return tokenToOwner[_tokenID];
        } else {
            return devcon2Token.ownerOf(_tokenID);
        }
    }

    /// @dev Returns the token ID for the given address or 0x0 if they are not a token owner.
    /// @param _owner Address of the owner to lookup.
    function tokenId(address _owner) constant returns (bytes32 tokenID) {
        if (_owner == 0x0) {
            return 0x0;
        } else if (ownerToToken[_owner] != 0x0) {
            return ownerToToken[_owner];
        } else {
            tokenID = bytes32(devcon2Token.balanceOf(_owner));
            if (tokenToOwner[tokenID] == 0x0) {
                // this token has not been transfered yet so return the proxied
                // value.
                return tokenID;
            } else {
                // The token has already been transferred so ignore the parent
                // contract data.
                return 0x0;
            }
        }
    }

    /*
     * Pull in a token from the previous contract
     */
    function upgrade() public returns (bool success) {
        if (!devcon2Token.isTokenOwner(msg.sender)) {
            // not a token owner.
            return false;
        } else if (ownerToToken[msg.sender] != 0x0) {
            // already owns a token
            return false;
        }
        
        // pull the token ID
        var tokenID = bytes32(devcon2Token.balanceOf(msg.sender));

        if (tokenID == 0x0) {
            // (should not be possible but here as a sanity check)
            // null token is invalid.
            return false;
        } else if (tokenToOwner[tokenID] != 0x0) {
            // already upgraded.
            return false;
        } else if (devcon2Token.ownerOf(tokenID) != msg.sender) {
            // (should not be possible but here as a sanity check)
            // not the owner of the token.
            return false;
        }

        // Assign the new ownership.
        ownerToToken[msg.sender] = tokenID;
        tokenToOwner[tokenID] = msg.sender;

        // increment the number of tokens that have been upgraded.
        _upgradeCount += 1;

        // Log it
        Mint(msg.sender, tokenID);
        return true;
    }

    /// @dev Returns the number of tokens that have been upgraded.
    function upgradeCount() constant returns (uint256 _amount) {
        return _upgradeCount;
    }

    /// @dev Returns the number of tokens that have been upgraded.
    /// @param _tokenID the id of the token to query
    function isTokenUpgraded(bytes32 _tokenID) constant returns (bool isUpgraded) {
        return (tokenToOwner[_tokenID] != 0x0);
    }
}