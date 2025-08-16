// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./RealEstateToken.sol";

contract RealEstateManager is Ownable {
    IERC20 public immutable usdtToken;
    RealEstateToken public immutable propertyToken; // 改为immutable
    
    uint256 public propertyValue;
    uint256 public constant minPurchaseAmount = 1000 * 10 ** 6;
    string public ipfsHash;
    uint256 public constant annualRentRate = 8;
    
    uint256 public totalDividends;
    mapping(address => uint256) public claimedDividends;
    uint256 public dividendPerToken;
    mapping(address => uint256) public lastDividendPoints;
    
    event SharesPurchased(address indexed buyer, uint256 usdtAmount, uint256 tokenAmount);
    event DividendPaid(address indexed user, uint256 amount);
    event DividendDeposited(uint256 amount);
    event SharesRedeemed(address indexed user, uint256 tokenAmount, uint256 usdtAmount);
    event PropertyValueUpdated(uint256 newValue);

    constructor(
        address _usdtToken,
        uint256 _propertyValue,
        string memory _ipfsHash,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_usdtToken != address(0), "Invalid USDT address");
        
        usdtToken = IERC20(_usdtToken);
        propertyValue = _propertyValue;
        ipfsHash = _ipfsHash;
        
        // 在构造函数内部创建Token合约
        propertyToken = new RealEstateToken(
            "Real Estate Property Shares", 
            "REPS",
            initialOwner,
            address(this) // 传入当前Manager地址
        );
        
        // 初始铸造总份额 = 房产价值 * 10^12 (保持高精度)
        uint256 initialShares = propertyValue * 10 ** 12;
        propertyToken.mint(address(this), initialShares);
    }

    function buyShares(uint256 usdtAmount) external {
        require(usdtAmount >= minPurchaseAmount, "Amount below minimum");
        
        uint256 totalShares = propertyToken.totalSupply();
        uint256 tokenAmount = (usdtAmount * totalShares) / propertyValue;
        require(tokenAmount > 0, "Token amount too small");
        
        require(
            usdtToken.transferFrom(msg.sender, address(this), usdtAmount),
            "USDT transfer failed"
        );
        
        require(
            propertyToken.transfer(msg.sender, tokenAmount),
            "Token transfer failed"
        );
        
        _updateDividendPoint(msg.sender);
        emit SharesPurchased(msg.sender, usdtAmount, tokenAmount);
    }

    function depositDividend(uint256 usdtAmount) external onlyOwner {
        require(
            usdtToken.transferFrom(msg.sender, address(this), usdtAmount),
            "USDT transfer failed"
        );
        
        totalDividends += usdtAmount;
        uint256 totalShares = propertyToken.totalSupply();
        if (totalShares > 0) {
            dividendPerToken += (usdtAmount * 1e18) / totalShares;
        }
        emit DividendDeposited(usdtAmount);
    }

    function claimDividend() external {
        _updateDividendPoint(msg.sender);
        uint256 claimable = claimedDividends[msg.sender];
        require(claimable > 0, "No dividend to claim");
        
        claimedDividends[msg.sender] = 0;
        require(usdtToken.transfer(msg.sender, claimable), "Dividend transfer failed");
        emit DividendPaid(msg.sender, claimable);
    }

    function _updateDividendPoint(address user) internal {
        uint256 userShares = propertyToken.balanceOf(user);
        
        // 计算应得分红
        uint256 owed = (dividendPerToken - lastDividendPoints[user]) * userShares / 1e18;
        
        claimedDividends[user] += owed;
        lastDividendPoints[user] = dividendPerToken;
    }

    function redeemShares(uint256 tokenAmount) external {
        require(
            block.timestamp >= propertyToken.startTime() + propertyToken.lockPeriod(), 
            "Lock period not over"
        );
        
        _updateDividendPoint(msg.sender);

        uint256 contractBalance = usdtToken.balanceOf(address(this));
        uint256 usdtAmount = (tokenAmount * contractBalance) / propertyToken.totalSupply();
        
        propertyToken.burn(msg.sender, tokenAmount);
        require(usdtToken.transfer(msg.sender, usdtAmount), "USDT transfer failed");
        emit SharesRedeemed(msg.sender, tokenAmount, usdtAmount);
    }

    function setPropertyValue(uint256 newValue) external onlyOwner {
        require(newValue > 0, "Invalid property value");
        propertyValue = newValue;
        emit PropertyValueUpdated(newValue);
    }

    function getClaimableDividend(address user) public view returns (uint256) {
        uint256 currentPoint = lastDividendPoints[user];
        uint256 newDividendPerToken = dividendPerToken;
        uint256 userShares = propertyToken.balanceOf(user);
        
        uint256 owed = (newDividendPerToken - currentPoint) * userShares / 1e18;
        return claimedDividends[user] + owed;
    }
    
    // 获取代币合约地址
    function getPropertyToken() external view returns (address) {
        return address(propertyToken);
    }
}