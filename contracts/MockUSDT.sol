// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {
        _mint(msg.sender, 1000000 * 10**6); // 初始供应100万
    }

    function decimals() public pure override returns (uint8) {
        return 6; // 模拟USDT的6位小数
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}