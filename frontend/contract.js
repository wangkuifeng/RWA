// ====================== 合约配置 ======================
const MOCK_USDT_ADDRESS = "0x2E9e09057408A7a1035e6A871e5F73848b4379B1";
const MANAGER_ADDRESS = "0x0D2e0d1975a394980Af3cee5aec969ac73251F6A";
const INITIAL_PROPERTY_VALUE = 1000000; // 100万 USDT
const IPFS_HASH = "QmRYfrZ4yobkBMUD3Y4d4NV28ZeTUFCBwWSm1Z3B2Ndkca";

// 合约ABI（修复版）
const USDT_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)",
    "function transfer(address, uint256) returns (bool)",
    "function decimals() view returns (uint8)",
    "function mint(address to, uint256 amount) external",
    "function owner() view returns (address)"  // 修复：使用owner()代替admin()
];

const MANAGER_ABI = [
    "function buyShares(uint256)",
    "function redeemShares(uint256)",
    "function claimDividend()",
    "function depositDividend(uint256)",
    "function setPropertyValue(uint256)",
    "function setIPFSHash(string)",
    "function getClaimableDividend(address) view returns (uint256)",
    "function propertyValue() view returns (uint256)",
    "function ipfsHash() view returns (string)",
    "function minPurchaseAmount() view returns (uint256)",
    "function getPropertyToken() view returns (address)",
    "function owner() view returns (address)"  // 添加owner()函数
];

const TOKEN_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address, uint256) returns (bool)",
    "function lockEndTime() view returns (uint256)",
    "function startTime() view returns (uint256)",
    "function decimals() view returns (uint8)"
];

// Sepolia网络配置
const SEPOLIA_CHAIN_ID = "0xaa36a7";
const SEPOLIA_RPC_URL = "https://rpc.sepolia.org";