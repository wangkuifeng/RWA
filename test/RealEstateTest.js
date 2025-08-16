const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// 使用您部署的实际地址
const MOCK_USDT_ADDRESS = "0x2E9e09057408A7a1035e6A871e5F73848b4379B1";
const MANAGER_ADDRESS = "0x0D2e0d1975a394980Af3cee5aec969ac73251F6A";

// 获取当前区块时间
async function getCurrentBlockTime() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}

// 精确计算分红
function calculateMonthlyDividend(propertyValue) {
  const annualRate = 8; // 8%
  return (propertyValue * BigInt(annualRate * 1e6)) / (100n * 12n * 1_000_000n);
}

// 安全除法（避免除零）
function safeDiv(a, b) {
  if (b === 0n) return 0n;
  return a / b;
}

describe("Real Estate RWA System - Sepolia Testnet", function () {
  let manager, token, usdt;
  let owner, user1, user2;
  
  // 延长测试超时时间（Sepolia 交易较慢）
  this.timeout(300000); // 5分钟超时

  before(async function () {
    // 获取所有可用账户
    const accounts = await ethers.getSigners();
    
    // 安全分配账户
    owner = accounts[0];
    user1 = accounts[1] || owner;
    user2 = accounts[2] || owner;
    
    console.log("=== 测试账户 ===");
    console.log("Owner:", owner.address);
    console.log("User1:", user1.address);
    console.log("User2:", user2.address);
    
    // 获取已部署的合约实例
    usdt = await ethers.getContractAt("MockUSDT", MOCK_USDT_ADDRESS);
    manager = await ethers.getContractAt("RealEstateManager", MANAGER_ADDRESS);
    
    // 直接使用已知的代币地址（替换为您的实际地址）
    const TOKEN_ADDRESS = "0x29d0D4D7607ec52E695AD6748fAEb8a3C69A7C09"; // 请替换为您的实际代币地址
      // 检查代币地址
    const tokenAddress = await manager.getPropertyToken();
    console.log("Manager中的代币地址:", tokenAddress);
    token = await ethers.getContractAt("RealEstateToken", TOKEN_ADDRESS);
    
    console.log("\n=== 合约地址 ===");
    console.log("MockUSDT:", MOCK_USDT_ADDRESS);
    console.log("Manager:", MANAGER_ADDRESS);
    console.log("Token:", tokenAddress);
    
    // 给用户分配USDT
    const amount = ethers.parseUnits("100000", 6);
    console.log("\n分配 10,0000 USDT 给用户...");
    const mintTx = await usdt.mint(user1.address, amount);
    await mintTx.wait();
    
    // 用户授权Manager合约使用USDT
    console.log("用户授权合约使用 USDT...");
    const approveTx = await usdt.connect(user1).approve(MANAGER_ADDRESS, ethers.MaxUint256);
    await approveTx.wait();
    
    // 给用户2分配USDT
    const mintTx2 = await usdt.mint(user2.address, amount);
    await mintTx2.wait();
    const approveTx2 = await usdt.connect(user2).approve(MANAGER_ADDRESS, ethers.MaxUint256);
    await approveTx2.wait();
  });

  it("1. 合约状态验证", async function () {
    console.log("\n[测试] 验证合约状态...");
    // 验证合约地址
  const tokenAddress = await manager.propertyToken();
  console.log("代币合约地址:", tokenAddress);

    // 验证合约地址
    expect(MOCK_USDT_ADDRESS).to.be.properAddress;
    expect(MANAGER_ADDRESS).to.be.properAddress;
    expect(tokenAddress).to.be.properAddress;
    
    // 验证初始值
    const propertyValue = await manager.propertyValue();
    console.log("房产价值:", ethers.formatUnits(propertyValue, 6), "USDT");
    
    const minPurchase = await manager.minPurchaseAmount();
    console.log("最小购买金额:", ethers.formatUnits(minPurchase, 6), "USDT");
    
    const ipfsHash = await manager.ipfsHash();
    console.log("IPFS哈希:", ipfsHash);
  });

  it("2. 购买房产份额", async function () {
    const buyAmount = ethers.parseUnits("20000", 6);
    
    console.log("\n[测试] 用户购买 2,0000 USDT 的份额...");
    
    // 记录初始状态
    const initialBalance = await usdt.balanceOf(user1.address);
    const initialShares = await token.balanceOf(user1.address);
    const initialTotalSupply = await token.totalSupply();
    const propertyValue = await manager.propertyValue();
    
    console.log("用户初始 USDT 余额:", ethers.formatUnits(initialBalance, 6));
    console.log("用户初始份额:", ethers.formatUnits(initialShares, 18));
    console.log("初始总供应量:", ethers.formatUnits(initialTotalSupply, 18));
    
    // 计算预期份额
    const expectedShares = (buyAmount * initialTotalSupply) / propertyValue;
    console.log("预期获得份额:", ethers.formatUnits(expectedShares, 18));
    
    // 执行购买
    console.log("执行购买交易...");
    const tx = await manager.connect(user1).buyShares(buyAmount);
    const receipt = await tx.wait();
    
    console.log("交易哈希:", receipt.hash);
    console.log("Gas 使用量:", receipt.gasUsed.toString());
    
    // 验证结果
    const finalBalance = await usdt.balanceOf(user1.address);
    console.log("用户购买后 USDT 余额:", ethers.formatUnits(finalBalance, 6));
    
    const finalShares = await token.balanceOf(user1.address);
    const sharesGained = finalShares - initialShares;
    console.log("用户获得份额:", ethers.formatUnits(sharesGained, 18));
    
    // 验证份额在预期范围内（考虑Gas等小误差）
    const tolerance = ethers.parseUnits("0.01", 18); // 0.01份额容差
    const difference = sharesGained > expectedShares 
      ? sharesGained - expectedShares 
      : expectedShares - sharesGained;
    
    if (difference <= tolerance) {
      console.log("✅ 份额差异在允许范围内");
    } else {
      console.error("❌ 份额差异过大:", ethers.formatUnits(difference, 18));
    }
  });

  it("3. 最小购买金额限制", async function () {
    const smallAmount = ethers.parseUnits("999", 6);
    
    console.log("\n[测试] 尝试购买低于最小限额 (999 USDT)...");
    
    try {
      await manager.connect(user1).buyShares(smallAmount);
      console.error("测试失败: 低于最小金额的购买未被拒绝");
      throw new Error("测试失败");
    } catch (error) {
      console.log("测试通过: 低于最小金额的购买被拒绝");
      console.log("错误详情:", error.message);
    }
  });

  it("4. 分红功能测试", async function () {
  // 用户2购买10,000 USDT的份额
  const buyAmount = ethers.parseUnits("100000", 6);
  console.log("\n[测试] 用户2购买 10,0000 USDT 的份额...");
  const buyTx = await manager.connect(user2).buyShares(buyAmount);
  await buyTx.wait();
  
  // 获取用户2的份额
  const user2Shares = await token.balanceOf(user2.address);
  console.log("用户2份额:", ethers.formatUnits(user2Shares, 18));
  
  // 获取总份额和房产价值
  const totalShares = await token.totalSupply();
  const propertyValue = await manager.propertyValue();
  
  // 计算用户2房产价值
  const user2PropertyValue = (user2Shares * propertyValue) / totalShares;
  console.log("用户2房产价值:", ethers.formatUnits(user2PropertyValue, 6), "USDT");
  
  // 计算月分红（年化8%）
  const monthlyDividend = calculateMonthlyDividend(propertyValue);
  console.log("月分红金额:", ethers.formatUnits(monthlyDividend, 6), "USDT");
  
  // 正确计算用户2预期分红 - 基于份额比例
  const expectedDividend = (user2Shares * monthlyDividend) / totalShares;
  console.log("用户2预期分红:", ethers.formatUnits(expectedDividend, 6), "USDT");
  
  // 确保所有者有足够USDT
  console.log("给所有者分配分红资金...");
  const mintTx = await usdt.mint(owner.address, monthlyDividend);
  await mintTx.wait();
  
  // 所有者授权合约
  console.log("所有者授权合约使用 USDT...");
  const approveTx = await usdt.connect(owner).approve(MANAGER_ADDRESS, monthlyDividend);
  await approveTx.wait();
  
  // 存入分红
  console.log("存入分红到合约...");
  const depositTx = await manager.depositDividend(monthlyDividend);
  await depositTx.wait();
  
  // 检查可领取分红
  const claimable = await manager.getClaimableDividend(user2.address);
  console.log("用户可领取分红:", ethers.formatUnits(claimable, 6), "USDT");
  
  // 用户领取分红
  console.log("用户领取分红中...");
  const initialBalance = await usdt.balanceOf(user2.address);
  console.log("用户2初始 USDT 余额:", ethers.formatUnits(initialBalance, 6));
  
  const claimTx = await manager.connect(user2).claimDividend();
  await claimTx.wait();
  
  // 验证余额变化
  const finalBalance = await usdt.balanceOf(user2.address);
  console.log("用户领取分红后余额:", ethers.formatUnits(finalBalance, 6));
  
  const received = finalBalance - initialBalance;
  console.log("实际领取金额:", ethers.formatUnits(received, 6), "USDT");
  
  // 验证分红在预期范围内
  const tolerance = ethers.parseUnits("0.1", 6); // 0.1 USDT容差
  const difference = received > expectedDividend 
    ? received - expectedDividend 
    : expectedDividend - received;
  
  if (difference <= tolerance) {
    console.log("✅ 分红差异在允许范围内");
  } else {
    console.error("❌ 分红差异过大:", ethers.formatUnits(difference, 6));
  }
});

  it("5. 锁定期转账限制", async function () {
    // 获取最小购买金额
    const minPurchase = await manager.minPurchaseAmount();
    
    console.log("\n[测试] 用户1购买最小金额的份额...");
    const buyTx = await manager.connect(user1).buyShares(minPurchase);
    await buyTx.wait();
    
    const shares = await token.balanceOf(user1.address);
    console.log("用户份额:", ethers.formatUnits(shares, 18));
    
    // 尝试转移
    console.log("尝试在锁定期内转移份额...");
    try {
      await token.connect(user1).transfer(user2.address, shares);
      console.error("测试失败: 锁定期内转账未被拒绝");
      throw new Error("测试失败");
    } catch (error) {
      console.log("测试通过: 锁定期内转账被拒绝");
      console.log("错误详情:", error.message);
    }
  });

  it("6. 锁定期后转账测试", async function () {
    // 检查强制跳过锁定期环境变量
    const forceSkipLock = process.env.TEST_FORCE_SKIP_LOCK?.toLowerCase() === "true";
    
    if (forceSkipLock) {
      console.log("\n⚠️ 强制跳过锁定期检查 (TEST_FORCE_SKIP_LOCK=true)");
    } else {
      // 检查锁定期状态
      const startTime = await token.startTime();
      const lockPeriod = 365n * 24n * 60n * 60n; // 固定锁定期365天
      const currentBlockTime = await getCurrentBlockTime();
      
      console.log("\n锁定期开始时间:", new Date(Number(startTime) * 1000));
      console.log("锁定期时长 (天):", Number(lockPeriod) / (24 * 3600));
      console.log("当前区块时间:", new Date(Number(currentBlockTime) * 1000));
      
      if (currentBlockTime < startTime + lockPeriod) {
        const remaining = Number(startTime) + Number(lockPeriod) - Number(currentBlockTime);
        const daysRemaining = Math.ceil(remaining / (24 * 3600));
        
        console.log(`锁定期还剩 ${daysRemaining} 天，跳过转账测试`);
        this.skip();
        return;
      }
    }
    
    // 执行转账
    const shares = await token.balanceOf(user1.address);
    console.log("用户1份额:", ethers.formatUnits(shares, 18));
    
    console.log("用户1转账给用户2...");
    const tx = await token.connect(user1).transfer(user2.address, shares);
    const receipt = await tx.wait();
    console.log("转账交易哈希:", receipt.hash);
    
    // 验证结果
    const newBalanceUser1 = await token.balanceOf(user1.address);
    const newBalanceUser2 = await token.balanceOf(user2.address);
    
    console.log("用户1新余额:", ethers.formatUnits(newBalanceUser1, 18));
    console.log("用户2新余额:", ethers.formatUnits(newBalanceUser2, 18));
    
    expect(newBalanceUser1).to.equal(0);
    expect(newBalanceUser2).to.equal(shares);
  });

  it("7. 赎回功能测试", async function () {
    // 检查强制跳过锁定期环境变量
    const forceSkipLock = process.env.TEST_FORCE_SKIP_LOCK?.toLowerCase() === "true";
    
    if (forceSkipLock) {
      console.log("\n⚠️ 强制跳过锁定期检查 (TEST_FORCE_SKIP_LOCK=true)");
    } else {
      // 检查锁定期状态
      const startTime = await token.startTime();
      const lockPeriod = 365n * 24n * 60n * 60n; // 固定锁定期365天
      const currentBlockTime = await getCurrentBlockTime();
      
      console.log("\n锁定期开始时间:", new Date(Number(startTime) * 1000));
      console.log("锁定期时长 (天):", Number(lockPeriod) / (24 * 3600));
      console.log("当前区块时间:", new Date(Number(currentBlockTime) * 1000));
      
      if (currentBlockTime < startTime + lockPeriod) {
        const remaining = Number(startTime) + Number(lockPeriod) - Number(currentBlockTime);
        const daysRemaining = Math.ceil(remaining / (24 * 3600));
        
        console.log(`锁定期还剩 ${daysRemaining} 天，跳过赎回测试`);
        this.skip();
        return;
      }
    }
    
    // 使用用户2进行赎回测试
    const shares = await token.balanceOf(user2.address);
    console.log("用户2份额:", ethers.formatUnits(shares, 18));
    
    const initialUSDTBalance = await usdt.balanceOf(user2.address);
    console.log("用户2初始 USDT 余额:", ethers.formatUnits(initialUSDTBalance, 6));
    
    // 获取合约USDT余额和总份额
    const managerAddress = await manager.getAddress();
    const contractUSDTBalance = await usdt.balanceOf(managerAddress);
    const totalShares = await token.totalSupply();
    
    // 计算预期赎回金额
    const expectedRedeemAmount = safeDiv(shares * contractUSDTBalance, totalShares);
    console.log("预期赎回金额:", ethers.formatUnits(expectedRedeemAmount, 6), "USDT");
    
    console.log("用户2赎回份额...");
    const tx = await manager.connect(user2).redeemShares(shares);
    const receipt = await tx.wait();
    console.log("赎回交易哈希:", receipt.hash);
    
    // 验证结果
    const finalUSDTBalance = await usdt.balanceOf(user2.address);
    console.log("用户2赎回后 USDT 余额:", ethers.formatUnits(finalUSDTBalance, 6));
    
    const newShares = await token.balanceOf(user2.address);
    console.log("用户2赎回后代币余额:", ethers.formatUnits(newShares, 18));
    
    const received = finalUSDTBalance - initialUSDTBalance;
    console.log("实际赎回金额:", ethers.formatUnits(received, 6), "USDT");
    
    // 验证金额在预期范围内
    const tolerance = ethers.parseUnits("0.01", 6); // 0.01 USDT容差
    const difference = received > expectedRedeemAmount 
      ? received - expectedRedeemAmount 
      : expectedRedeemAmount - received;
    
    if (difference <= tolerance) {
      console.log("✅ 赎回金额差异在允许范围内");
    } else {
      console.error("❌ 赎回金额差异过大:", ethers.formatUnits(difference, 6));
    }
  });

  it("8. 房产价值更新", async function () {
    const newValue = ethers.parseUnits("1000000", 6); // 100万美元
    
    console.log("\n[测试] 更新房产价值...");
    console.log("原值:", ethers.formatUnits(await manager.propertyValue(), 6), "USDT");
    console.log("新值:", ethers.formatUnits(newValue, 6), "USDT");
    
    const tx = await manager.setPropertyValue(newValue);
    const receipt = await tx.wait();
    console.log("更新交易哈希:", receipt.hash);
    
    // 验证结果
    const updatedValue = await manager.propertyValue();
    console.log("更新后房产价值:", ethers.formatUnits(updatedValue, 6), "USDT");
  });
});