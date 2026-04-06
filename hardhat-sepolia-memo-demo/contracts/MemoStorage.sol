// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MemoStorage {
    event MemoStored(
        address indexed from,
        address indexed to,
        uint256 amount,
        string memo,
        uint256 timestamp
    );

    function sendWithMemo(address payable to, string calldata memo) external payable {
        require(to != address(0), "Invalid recipient");

        (bool success, ) = to.call{value: msg.value}("");
        require(success, "Transfer failed");

        emit MemoStored(msg.sender, to, msg.value, memo, block.timestamp);
    }
}
