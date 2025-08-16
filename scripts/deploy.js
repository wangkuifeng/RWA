const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  
  // 1. 部署 MockUSDT
  console.log("\n=== 步骤 1/3: 部署 MockUSDT ===");
  const USDT = await hre.ethers.getContractFactory("MockUSDT");
  const usdt = await USDT.deploy();
  const usdtReceipt = await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  const usdtTxHash = usdtReceipt.deploymentTransaction().hash;
  
  console.log("✅ MockUSDT 已部署");
  console.log("合约地址:", usdtAddress);
  console.log("交易哈希:", usdtTxHash);
  console.log("等待 15 秒确认...");
  await new Promise(resolve => setTimeout(resolve, 15000)); // 确保区块确认
  
  // 2. 准备参数
  const propertyValue = hre.ethers.parseUnits("1000000", 6);
  const ipfsHash = "QmRYfrZ4yobkBMUD3Y4d4NV28ZeTUFCBwWSm1Z3B2Ndkca";
  
  // 3. 部署 RealEstateManager
  console.log("\n=== 步骤 2/3: 部署房产管理系统 ===");
  const Manager = await hre.ethers.getContractFactory("RealEstateManager");
  const manager = await Manager.deploy(
    usdtAddress,
    propertyValue,
    ipfsHash,
    deployer.address
  );
  
  const managerReceipt = await manager.waitForDeployment();
  const managerAddress = await manager.getAddress();
  const managerTxHash = managerReceipt.deploymentTransaction().hash;
  
  console.log("✅ RealEstateManager 已部署");
  console.log("合约地址:", managerAddress);
  console.log("交易哈希:", managerTxHash);
  console.log("等待 30 秒确认...");
  await new Promise(resolve => setTimeout(resolve, 30000)); // 更长的等待时间
  
  // 4. 获取 Token 地址
  console.log("\n=== 步骤 3/3: 获取房产代币地址 ===");
  const tokenAddress = await manager.getPropertyToken();
  console.log("✅ RealEstateToken 地址:", tokenAddress);
  
  // 5. 创建验证命令
  console.log("\n=== 验证合约 ===");
  console.log("请手动运行以下命令验证合约:");
  console.log(`npx hardhat verify --network sepolia ${usdtAddress}`);
  console.log(`npx hardhat verify --network sepolia ${managerAddress} \\
  "${usdtAddress}" \\
  "${propertyValue.toString()}" \\
  "${ipfsHash}" \\
  "${deployer.address}"`);
  console.log(`npx hardhat verify --network sepolia ${tokenAddress} \\
  "Real Estate Property Shares" \\
  "REPS" \\
  "${deployer.address}" \\
  "${managerAddress}"`);
  
  // 6. 保存部署信息到文件
  const fs = require("fs");
  const deploymentInfo = {
    date: new Date().toISOString(),
    network: "sepolia",
    deployer: deployer.address,
    contracts: {
      MockUSDT: usdtAddress,
      RealEstateManager: managerAddress,
      RealEstateToken: tokenAddress
    },
    transactions: {
      MockUSDT: usdtTxHash,
      RealEstateManager: managerTxHash
    },
    parameters: {
      propertyValue: propertyValue.toString(),
      ipfsHash: ipfsHash
    },
    verificationCommands: [
      `npx hardhat verify --network sepolia ${usdtAddress}`,
      `npx hardhat verify --network sepolia ${managerAddress} "${usdtAddress}" "${propertyValue.toString()}" "${ipfsHash}" "${deployer.address}"`,
      `npx hardhat verify --network sepolia ${tokenAddress} "Real Estate Property Shares" "REPS" "${deployer.address}" "${managerAddress}"`
    ]
  };
  
  fs.writeFileSync("deployment-info.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✅ 部署信息已保存到 deployment-info.json");
  
  // 7. 完整输出
  console.log("\n=== 部署摘要 ===");
  console.log("MockUSDT:\t\t", usdtAddress);
  console.log("RealEstateManager:\t", managerAddress);
  console.log("RealEstateToken:\t", tokenAddress);
  console.log("房产价值:\t\t", hre.ethers.formatUnits(propertyValue, 6), "USDT");
  console.log("IPFS 哈希:\t\t", ipfsHash);
  console.log("\n部署完成! 请手动运行验证命令");
}

main().catch((error) => {
  console.error("🚨 部署失败:", error);
  process.exitCode = 1;
});