const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

async function main() {
  // 获取账户
  const [owner, user1, user2] = await ethers.getSigners();
  console.log("=== 测试账户 ===");
  console.log("Owner:", owner.address);
  console.log("User1:", user1.address);
  console.log("User2:", user2.address);

  // 部署 MockUSDT
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const usdt = await MockUSDT.deploy();
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log("MockUSDT 部署地址:", usdtAddress);

  // 准备参数
  const propertyValue = ethers.parseUnits("1000000", 6); // 100万美元
  const ipfsHash = "QmRYfrZ4yobkBMUD3Y4d4NV28ZeTUFCBwWSm1Z3B2Ndkca";

  // 部署 RealEstateManager（自动部署Token）
  const RealEstateManager = await ethers.getContractFactory("RealEstateManager");
  const manager = await RealEstateManager.deploy(
    usdtAddress, // _usdtToken
    propertyValue, // _propertyValue
    ipfsHash, // _ipfsHash
    owner.address // initialOwner
  );
  await manager.waitForDeployment();
  const managerAddress = await manager.getAddress();
  console.log("Manager 部署地址:", managerAddress);

  // 从Manager获取Token地址
  const tokenAddress = await manager.getPropertyToken();
  const token = await ethers.getContractAt("RealEstateToken", tokenAddress);
  console.log("Token 部署地址:", tokenAddress);

  // 给用户分配 USDT
  const amount = ethers.parseUnits("100000", 6); // 100,000 USDT
  await usdt.mint(user1.address, amount);
  await usdt.mint(user2.address, amount);
  console.log("分配 100,000 USDT 给每个用户");

  // 用户授权 Manager 合约使用 USDT
  await usdt.connect(user1).approve(managerAddress, ethers.MaxUint256);
  await usdt.connect(user2).approve(managerAddress, ethers.MaxUint256);
  
  // 给owner授权Manager合约使用USDT
  await usdt.connect(owner).approve(managerAddress, ethers.MaxUint256);
  
  console.log("用户和owner授权合约使用 USDT");

  // 返回合约实例
  return { usdt, token, manager, owner, user1, user2 };
}

async function runTests() {
  const { usdt, token, manager, owner, user1, user2 } = await main();
  
  // 1. 合约状态验证
  console.log("\n[测试] 验证合约状态...");
  const initialPropertyValue = await manager.propertyValue();
  console.log("房产价值:", ethers.formatUnits(initialPropertyValue, 6), "USDT");
  
  const minPurchase = await manager.minPurchaseAmount();
  console.log("最小购买金额:", ethers.formatUnits(minPurchase, 6), "USDT");
  
  const ipfsHash = await manager.ipfsHash();
  console.log("IPFS哈希:", ipfsHash);
  
  // 获取初始总份额
  const initialTotalShares = await token.totalSupply();
  console.log("初始总份额:", ethers.formatUnits(initialTotalShares, 18));
  
  // 2. 购买房产份额
  console.log("\n[测试] 用户1购买 20,000 USDT 的份额...");
  const buyAmount = ethers.parseUnits("20000", 6);
  
  // 计算预期份额
  const expectedShares = (buyAmount * initialTotalShares) / initialPropertyValue;
  console.log("用户1预期份额:", ethers.formatUnits(expectedShares, 18));
  
  const initialBalance = await usdt.balanceOf(user1.address);
  console.log("用户初始 USDT 余额:", ethers.formatUnits(initialBalance, 6));
  
  const tx = await manager.connect(user1).buyShares(buyAmount);
  await tx.wait();
  
  const finalBalance = await usdt.balanceOf(user1.address);
  console.log("用户购买后 USDT 余额:", ethers.formatUnits(finalBalance, 6));
  
  // 获取用户1的份额
  const shares = await token.balanceOf(user1.address);
  console.log("用户实际份额:", ethers.formatUnits(shares, 18));
  
  // 验证份额
  if (shares.toString() !== expectedShares.toString()) {
    console.error("错误: 用户份额不正确");
    console.error("预期:", ethers.formatUnits(expectedShares, 18));
    console.error("实际:", ethers.formatUnits(shares, 18));
    process.exit(1);
  } else {
    console.log("✅ 份额正确");
  }
  
  // 3. 最小购买金额限制
  console.log("\n[测试] 尝试购买低于最小限额 (999 USDT)...");
  const smallAmount = ethers.parseUnits("999", 6);
  try {
    await manager.connect(user1).buyShares(smallAmount);
    console.log("测试失败: 低于最小金额的购买未被拒绝");
    process.exit(1);
  } catch (error) {
    console.log("测试通过: 低于最小金额的购买被拒绝");
    console.log("错误详情:", error.message);
  }
  
  // 4. 分红功能测试
  console.log("\n[测试] 用户2购买 100,000 USDT 的份额...");
  const user2BuyAmount = ethers.parseUnits("100000", 6);
  
  // 获取当前总份额
  const currentTotalShares = await token.totalSupply();
  
  // 计算用户2预期份额
  const expectedUser2Shares = (user2BuyAmount * currentTotalShares) / initialPropertyValue;
  console.log("用户2预期份额:", ethers.formatUnits(expectedUser2Shares, 18));
  
  await manager.connect(user2).buyShares(user2BuyAmount);
  
  // 获取用户2的份额
  const user2Shares = await token.balanceOf(user2.address);
  console.log("用户2实际份额:", ethers.formatUnits(user2Shares, 18));
  
  // 验证份额
  if (user2Shares.toString() !== expectedUser2Shares.toString()) {
    console.error("错误: 用户2份额不正确");
    console.error("预期:", ethers.formatUnits(expectedUser2Shares, 18));
    console.error("实际:", ethers.formatUnits(user2Shares, 18));
    process.exit(1);
  } else {
    console.log("✅ 用户2份额正确");
  }
  
  // 获取总份额
  const totalSharesAfter = await token.totalSupply();
  console.log("总份额:", ethers.formatUnits(totalSharesAfter, 18));
  
  // 计算用户2房产价值
  const user2PropertyValue = (user2Shares * initialPropertyValue) / totalSharesAfter;
  console.log("用户2房产价值:", ethers.formatUnits(user2PropertyValue, 6), "USDT");
  
  // 计算用户2房产价值比例
  const user2Ratio = (user2PropertyValue * 10000n) / initialPropertyValue;
  console.log("用户2产权比例:", Number(user2Ratio)/100, "%");
  
  // 精确计算月租金收入
  const annualRentRate = 8; // 8%
  const monthlyDividend = (initialPropertyValue * BigInt(annualRentRate)) / 1200n;
  console.log("精确月租金收入:", ethers.formatUnits(monthlyDividend, 6), "USDT");

  // 计算用户2预期分红
  const expectedDividend = (user2PropertyValue * monthlyDividend) / initialPropertyValue;
  console.log("用户2预期分红:", ethers.formatUnits(expectedDividend, 6), "USDT");

  // 给owner铸造分红资金
  console.log("给owner铸造分红资金...");
  await usdt.mint(owner.address, monthlyDividend);
  
  // 存入分红
  console.log("存入分红...");
  await manager.depositDividend(monthlyDividend);
  
  // 用户领取分红
  console.log("用户2领取分红...");
  const initialBalance2 = await usdt.balanceOf(user2.address);
  await manager.connect(user2).claimDividend();
  const finalBalance2 = await usdt.balanceOf(user2.address);
  const actualDividend = finalBalance2 - initialBalance2;
  
  // 计算分红误差
  const difference = actualDividend > expectedDividend 
    ? actualDividend - expectedDividend
    : expectedDividend - actualDividend;
  
  console.log("用户2实际分红:", ethers.formatUnits(actualDividend, 6), "USDT");
  console.log("分红误差:", ethers.formatUnits(difference, 6), "USDT");
  console.log("用户领取分红后余额:", ethers.formatUnits(finalBalance2, 6));
  
  // 验证误差在可接受范围内（小于0.01 USDT）
  const tolerance = ethers.parseUnits("0.01", 6);
  if (difference <= tolerance) {
    console.log("✅ 分红误差在允许范围内");
  } else {
    console.error("❌ 分红误差过大，超过允许范围");
  }
  
  // 5. 锁定期转账限制
  console.log("\n[测试] 尝试在锁定期内转移份额...");
  try {
    await token.connect(user1).transfer(user2.address, shares);
    console.log("测试失败: 锁定期内转账未被拒绝");
    process.exit(1);
  } catch (error) {
    console.log("测试通过: 锁定期内转账被拒绝");
    console.log("错误详情:", error.message);
  }
  
  // 6. 锁定期后转账测试
  console.log("\n[测试] 推进时间跳过锁定期...");
  const lockPeriod = 365 * 24 * 60 * 60; // 365天
  await time.increase(lockPeriod + 86400); // 增加一天确保解锁

  // 获取转账前的余额
  const transferAmount = shares; // 用户1要转账的份额
  const beforeTransferUser1 = await token.balanceOf(user1.address);
  const beforeTransferUser2 = await token.balanceOf(user2.address);

  console.log("\n转账前余额:");
  console.log("用户1余额:", ethers.formatUnits(beforeTransferUser1, 18));
  console.log("用户2余额:", ethers.formatUnits(beforeTransferUser2, 18));

  console.log(`用户1转账给用户2: ${ethers.formatUnits(transferAmount, 18)} 份额`);
  await token.connect(user1).transfer(user2.address, transferAmount);

  // 获取转账后的余额
  const afterTransferUser1 = await token.balanceOf(user1.address);
  const afterTransferUser2 = await token.balanceOf(user2.address);

  console.log("\n转账后余额:");
  console.log("用户1余额:", ethers.formatUnits(afterTransferUser1, 18));
  console.log("用户2余额:", ethers.formatUnits(afterTransferUser2, 18));

  // 验证转账结果
  console.log("\n转账验证:");
  console.log("用户1减少:", ethers.formatUnits(beforeTransferUser1 - afterTransferUser1, 18));
  console.log("用户2增加:", ethers.formatUnits(afterTransferUser2 - beforeTransferUser2, 18));
  
  if (afterTransferUser1 === beforeTransferUser1 - transferAmount &&
      afterTransferUser2 === beforeTransferUser2 + transferAmount) {
    console.log("✅ 转账成功");
  } else {
    console.error("❌ 转账失败");
    process.exit(1);
  }
  
  // 7. 赎回功能测试
  console.log("\n[测试] 用户2赎回份额...");
  
  // 获取合约当前USDT余额
  const managerAddress = await manager.getAddress();
  const contractBalanceBefore = await usdt.balanceOf(managerAddress);
  console.log("合约赎回前余额:", ethers.formatUnits(contractBalanceBefore, 6), "USDT");
  
  // 获取用户要赎回的份额
  const sharesToRedeem = await token.balanceOf(user2.address);
  console.log(`用户2要赎回的份额:`, ethers.formatUnits(sharesToRedeem, 18), "份额");
  
  // 获取用户赎回前的USDT余额
  const initialUSDTBalance = await usdt.balanceOf(user2.address);
  console.log(`用户2赎回前 USDT 余额:`, ethers.formatUnits(initialUSDTBalance, 6), "USDT");
  
  // 获取当前总份额
  const totalSharesBefore = await token.totalSupply();
  console.log("赎回前总份额:", ethers.formatUnits(totalSharesBefore, 18), "份额");
  
  // 计算预期赎回金额（基于合约总余额）
  const expectedRedeemAmount = (sharesToRedeem * contractBalanceBefore) / totalSharesBefore;
  console.log("预期赎回金额:", ethers.formatUnits(expectedRedeemAmount, 6), "USDT");
  
  // 执行赎回
  console.log("执行赎回...");
  await manager.connect(user2).redeemShares(sharesToRedeem);
  
  // 获取赎回后数据
  const finalUSDTBalance = await usdt.balanceOf(user2.address);
  const redeemedAmount = finalUSDTBalance - initialUSDTBalance;
  console.log(`用户2实际赎回金额:`, ethers.formatUnits(redeemedAmount, 6), "USDT");
  console.log(`赎回后用户2 USDT 余额:`, ethers.formatUnits(finalUSDTBalance, 6), "USDT");
  
  // 验证差异在可接受范围内
  const differenceRedeem = redeemedAmount > expectedRedeemAmount 
    ? redeemedAmount - expectedRedeemAmount
    : expectedRedeemAmount - redeemedAmount;
  
  console.log("赎回金额差异:", ethers.formatUnits(differenceRedeem, 6), "USDT");
  
  const toleranceRedeem = ethers.parseUnits("0.01", 6);
  if (differenceRedeem <= toleranceRedeem) {
    console.log("✅ 赎回金额在允许误差范围内");
  } else {
    console.error("❌ 赎回金额误差过大");
  }
  
  // 8. 房产价值更新
  console.log("\n[测试] 更新房产价值...");
  const newValue = ethers.parseUnits("1200000", 6);
  await manager.setPropertyValue(newValue);
  
  const updatedValue = await manager.propertyValue();
  console.log("更新后房产价值:", ethers.formatUnits(updatedValue, 6), "USDT");
  
  if (updatedValue.toString() === newValue.toString()) {
    console.log("✅ 房产价值更新成功");
  } else {
    console.error("❌ 房产价值更新失败");
  }
  
  console.log("\n✅ 所有测试完成!");
}

runTests().catch((error) => {
  console.error("测试失败:", error);
  process.exitCode = 1;
});