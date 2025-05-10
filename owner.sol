// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {MYGUY} from "./Token.sol";

contract owneronly {
    MYGUY immutable myguy_;
    address public constant fix_address =
        0xd697bc803e23F51f7e7dA4475860B813db514D41;
    address public constant deployed_add =
        0x848744ad263Cb9008D265Cb60B086A9e6FFe19B9;
    uint256 public num;
    uint256 public total_supply;

    constructor() {
        require(msg.sender == fix_address, "owner no");
        myguy_ = MYGUY(payable(deployed_add));

        num = myguy_.index();
        total_supply = myguy_.total_balance();
    }

    modifier restriction() {
        require(msg.sender == fix_address, "only owner have access");
        _;
    }

    function deposit_fund() public payable restriction returns (uint256) {
        require(msg.value > 0, "No Amount");
        uint256 fund = msg.value;
        payable(deployed_add).transfer(fund);
        return (deployed_add).balance;
    }

    receive() external payable {
        deposit_fund();
    }

    fallback() external payable {
        deposit_fund();
    }
}
