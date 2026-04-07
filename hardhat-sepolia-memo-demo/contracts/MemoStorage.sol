// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    // ERC20 标准授权扣款转账接口：调用方必须先被 from 地址 approve 过。
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

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

    function sendUSDTWithMemo(
        // USDT 合约地址（Sepolia 测试网 USDT）。
        address usdtToken,
        // 收款地址。
        address to,
        // USDT 最小单位金额（6 位精度）。
        uint256 amount,
        // 备注（建议传 encode 后字符串）。
        string calldata memo
    ) external {
        // 防止把 U 转到零地址。
        require(to != address(0), "Invalid recipient");
        // 防止 0 金额空转。
        require(amount > 0, "Amount must be greater than 0");
        // 防止空备注（按当前需求强制非空）。
        require(bytes(memo).length > 0, "Memo cannot be empty");

        // 调用 USDT 合约执行 transferFrom：
        // 从 msg.sender 扣款，转给 to。
        bool ok = IERC20(usdtToken).transferFrom(msg.sender, to, amount);
        // 代币转账失败直接回滚。
        require(ok, "USDT transfer failed");

        // 复用原有 MemoStored 事件，amount 字段在 USDT 模式下表示代币数量（最小单位）。
        emit MemoStored(msg.sender, to, amount, memo, block.timestamp);
    }
}
