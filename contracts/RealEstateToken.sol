// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RealEstateToken is ERC20, Ownable {
    uint256 public immutable startTime;
    uint256 public constant lockPeriod = 365 days;
    address public immutable managerContract; // 改为immutable
    
    mapping(address => bool) public isMinter;

    constructor(
        string memory name,
        string memory symbol,
        address initialOwner,
        address managerAddress
    ) ERC20(name, symbol) Ownable(initialOwner) {
        require(managerAddress != address(0), "Invalid manager address");
        
        startTime = block.timestamp;
        managerContract = managerAddress;
        
        // 设置初始minter权限
        isMinter[managerAddress] = true; // Manager合约
        isMinter[initialOwner] = true;    // 所有者
        isMinter[msg.sender] = true;      // 部署者
    }

    function addMinter(address account) external onlyOwner {
        isMinter[account] = true;
    }

    function removeMinter(address account) external onlyOwner {
        isMinter[account] = false;
    }

    function mint(address to, uint256 amount) external {
        require(isMinter[msg.sender], "Only minter can mint");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(isMinter[msg.sender], "Only minter can burn");
        _burn(from, amount);
    }

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override {
        // 允许铸币操作和Manager合约的操作
        bool isMinting = from == address(0);
        bool isManagerOperation = msg.sender == managerContract;
        
        if (isMinting || isManagerOperation) {
            super._update(from, to, amount);
            return;
        }
        
        // 检查锁定期
        require(
            block.timestamp >= startTime + lockPeriod,
            "Transfer is locked"
        );
        
        super._update(from, to, amount);
    }
    
    // 新增：获取锁定结束时间
    function lockEndTime() external view returns (uint256) {
        return startTime + lockPeriod;
    }
}