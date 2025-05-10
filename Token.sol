// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {owneronly} from "./owner.sol";

contract MYGUY {
    string public constant token_name = "myguy";
    string public constant token_symbol = "mg";
    uint256 public max_limit = 1000 * 10 ** (18);
    uint256 public index;
    mapping(address => uint256) public balance_sheet;
    mapping(address => uint256) mining_tracker;
    mapping(address => bool) active;
    address[] public all_users;
    uint256[] public token;
    owneronly immutable owner_;

    event transfer(address indexed from, address indexed to, uint256 tokens);
    event min_started(address indexed miner);
    event min_stopped(address indexed miner);
    event info_(address indexed add, uint256 indexed tokens);

    address constant owned = 0xd697bc803e23F51f7e7dA4475860B813db514D41;

    uint256 public total_balance;
    uint256 public owner_supply;
    uint256 public add_supply;
    uint256 public price_per_token;

    constructor() {
        total_balance = 100000 * 10 ** (18);
        owner_supply = total_balance / 2;
        add_supply = total_balance - owner_supply;
        balance_sheet[owned] = owner_supply;
        emit transfer(address(0), owned, owner_supply);
        price_per_token = 1000000000;
        balance_sheet[address(this)] = add_supply;
        emit transfer(address(0), address(this), add_supply);
    }

    modifier buying() {
        require(msg.value > 0, "Your account is zero");
        require(msg.value >= price_per_token, "eth isnt enough");
        _;
    }

    receive() external payable {}

    fallback() external payable {}

    function buy_token() public payable buying {
        uint256 payment = msg.value;
        uint256 bought_token = (payment / price_per_token) * 10 ** 18;
        if (balance_sheet[msg.sender] == 0) {
            all_users.push(msg.sender);
            token.push(bought_token);
            index++;
        }
        balance_sheet[msg.sender] += bought_token;
        emit transfer(address(0), msg.sender, bought_token);
    }

    modifier selling_precaution() {
        require(
            balance_sheet[msg.sender] > 0,
            "you dont have any tokens to sell"
        );
        _;
    }

    function sell_tokens(
        uint256 token_to_sell
    ) public selling_precaution returns (uint256) {
        uint256 amount = token_to_sell * (10 ** 18);
        uint256 payment = (token_to_sell * price_per_token);
        payable(msg.sender).transfer(payment);
        balance_sheet[msg.sender] -= amount;
        emit transfer(msg.sender, address(0), token_to_sell);
        return balance_sheet[msg.sender];
    }

    function start_mining() public {
        require(!active[msg.sender], "mining is already running");
        active[msg.sender] = true;
        emit min_started(msg.sender);
        mining_tracker[msg.sender] = block.timestamp;
    }

    modifier timerr() {
        uint256 timer = block.timestamp - mining_tracker[msg.sender];
        require(timer >= 300, " Wait for 5 min to get your token minted");
        _;
    }

    function get_your_tokens() public timerr {
        uint256 timer = block.timestamp - mining_tracker[msg.sender];
        uint256 token_minted = (timer / 300) * 10 ** (18);
        require(
            token_minted + balance_sheet[msg.sender] < max_limit,
            "You cant mint more tokens"
        );
        if (balance_sheet[msg.sender] == 0) {
            all_users.push(msg.sender);
            token.push(token_minted);
            index++;
        }
        max_limit -= token_minted;
        balance_sheet[msg.sender] += token_minted;
        balance_sheet[address(this)] -= token_minted;
        emit info_(msg.sender, token_minted);
        mining_tracker[msg.sender] = block.timestamp;
        emit transfer(address(0), msg.sender, token_minted);
    }

    function stop_mining() public {
        require(active[msg.sender], "mining already stopped");
        active[msg.sender] = false;
        emit min_stopped(msg.sender);
    }

    modifier limit() {
        require(
            balance_sheet[msg.sender] > 0,
            "You dont have enough token to transfer"
        );
        _;
    }

    function transfering(address reciever, uint256 amount) public limit {
        require(reciever != msg.sender, "you cant transfer to yourself");

        require(
            amount != 0 && amount < balance_sheet[msg.sender],
            "amount cant be zero"
        );

        if (balance_sheet[reciever] == 0) {
            all_users.push(msg.sender);
            token.push(amount);
            index++;
        }
        balance_sheet[msg.sender] -= amount;
        balance_sheet[reciever] += amount;
        emit transfer(msg.sender, reciever, amount);
    }

    function getbalance() public view returns (uint256) {
        return balance_sheet[msg.sender];
    }

    function getContractMgBalance() public view returns (uint256) {
        return balance_sheet[address(this)];
    }

    modifier owner() {
        require(msg.sender == owned, "only owner can run");
        _;
    }

    function executeAirdrop(
        address user,
        uint256 tokens
    ) external owner returns (uint256) {
        balance_sheet[user] += tokens;
        balance_sheet[address(this)] -= tokens;
        emit transfer(address(this), user, tokens);
        return balance_sheet[user];
    }
}
