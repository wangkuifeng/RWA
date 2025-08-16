import { ethers } from 'ethers';
import { logMessage, formatCurrency } from './utils.js';

// 合约地址和ABI（需要替换为您的实际地址）
const USDT_ADDRESS = '0x2E9e09057408A7a1035e6A871e5F73848b4379B1';
const MANAGER_ADDRESS = '0x0D2e0d1975a394980Af3cee5aec969ac73251F6A';
const TOKEN_ADDRESS = '0x29d0D4D7607ec52E695AD6748fAEb8a3C69A7C09';

// 简化版ABI（仅包含演示所需的函数）
const USDT_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)"
];

const MANAGER_ABI = [
    "function buyShares(uint256 usdtAmount)",
    "function redeemShares(uint256 tokenAmount)",
    "function claimDividend()",
    "function depositDividend(uint256 usdtAmount)",
    "function setPropertyValue(uint256 newValue)",
    "function getClaimableDividend(address) view returns (uint256)",
    "function propertyValue() view returns (uint256)",
    "function ipfsHash() view returns (string)",
    "function getPropertyToken() view returns (address)"
];

const TOKEN_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function lockEndTime() view returns (uint256)"
];

// 合约实例
let usdtContract, managerContract, tokenContract;
let provider, signer, currentAccount;

// 初始化合约
export async function initContracts() {
    if (window.ethereum) {
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        
        usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
        managerContract = new ethers.Contract(MANAGER_ADDRESS, MANAGER_ABI, signer);
        tokenContract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
        
        return true;
    } else {
        logMessage('请安装MetaMask钱包!', 'error');
        return false;
    }
}

// 连接到钱包
export async function connectWallet() {
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        currentAccount = accounts[0];
        
        document.getElementById('account-address').textContent = formatAddress(currentAccount);
        document.getElementById('connect-wallet').textContent = '已连接';
        
        logMessage(`钱包已连接: ${formatAddress(currentAccount)}`, 'success');
        
        // 更新余额
        await updateBalances();
        await updatePropertyInfo();
        
        return true;
    } catch (error) {
        logMessage(`连接钱包失败: ${error.message}`, 'error');
        return false;
    }
}

// 更新账户余额
export async function updateBalances() {
    if (!currentAccount) return;
    
    try {
        // 获取USDT余额
        const usdtBalance = await usdtContract.balanceOf(currentAccount);
        document.getElementById('usdt-balance').textContent = formatCurrency(ethers.formatUnits(usdtBalance, 6));
        
        // 获取代币余额
        const tokenBalance = await tokenContract.balanceOf(currentAccount);
        document.getElementById('token-balance').textContent = formatCurrency(ethers.formatUnits(tokenBalance, 18));
        
        // 获取可领分红
        const dividendBalance = await managerContract.getClaimableDividend(currentAccount);
        document.getElementById('dividend-balance').textContent = formatCurrency(ethers.formatUnits(dividendBalance, 6));
        
    } catch (error) {
        logMessage(`获取余额失败: ${error.message}`, 'error');
    }
}

// 更新房产信息
export async function updatePropertyInfo() {
    try {
        // 获取房产价值
        const propertyValue = await managerContract.propertyValue();
        document.getElementById('property-value').textContent = formatCurrency(ethers.formatUnits(propertyValue, 6));
        
        // 获取IPFS哈希
        const ipfsHash = await managerContract.ipfsHash();
        document.getElementById('ipfs-link').href = `https://ipfs.io/ipfs/${ipfsHash}`;
        document.getElementById('ipfs-link').textContent = '查看房产详情';
        
        // 获取锁定结束时间
        const lockEndTime = await tokenContract.lockEndTime();
        const endDate = new Date(lockEndTime * 1000);
        document.getElementById('lock-end').textContent = endDate.toLocaleDateString();
        
    } catch (error) {
        logMessage(`获取房产信息失败: ${error.message}`, 'error');
    }
}

// 购买代币
export async function buyShares() {
    const amountInput = document.getElementById('buy-amount');
    const amount = amountInput.value;
    
    if (!amount || amount < 1000) {
        logMessage('请输入至少1000 USDT', 'warning');
        return;
    }
    
    try {
        const amountWei = ethers.parseUnits(amount, 6);
        
        // 授权Manager合约使用USDT
        const approveTx = await usdtContract.approve(MANAGER_ADDRESS, amountWei);
        await approveTx.wait();
        logMessage('授权成功，等待购买交易确认...');
        
        // 购买代币
        const buyTx = await managerContract.buyShares(amountWei);
        await buyTx.wait();
        
        logMessage('购买成功!', 'success');
        amountInput.value = '';
        
        // 更新余额
        await updateBalances();
        
    } catch (error) {
        logMessage(`购买失败: ${error.message}`, 'error');
    }
}

// 领取分红
export async function claimDividend() {
    try {
        const claimTx = await managerContract.claimDividend();
        await claimTx.wait();
        
        logMessage('分红领取成功!', 'success');
        
        // 更新余额
        await updateBalances();
        
    } catch (error) {
        logMessage(`领取分红失败: ${error.message}`, 'error');
    }
}

// 存入分红
export async function depositDividend() {
    const amountInput = document.getElementById('deposit-amount');
    const amount = amountInput.value;
    
    if (!amount || amount <= 0) {
        logMessage('请输入有效的分红金额', 'warning');
        return;
    }
    
    try {
        const amountWei = ethers.parseUnits(amount, 6);
        
        // 授权Manager合约使用USDT
        const approveTx = await usdtContract.approve(MANAGER_ADDRESS, amountWei);
        await approveTx.wait();
        logMessage('授权成功，等待存入交易确认...');
        
        // 存入分红
        const depositTx = await managerContract.depositDividend(amountWei);
        await depositTx.wait();
        
        logMessage('分红存入成功!', 'success');
        amountInput.value = '';
        
        // 更新余额
        await updateBalances();
        
    } catch (error) {
        logMessage(`存入分红失败: ${error.message}`, 'error');
    }
}

// 赎回代币
export async function redeemShares() {
    const amountInput = document.getElementById('redeem-amount');
    const amount = amountInput.value;
    
    if (!amount || amount <= 0) {
        logMessage('请输入有效的赎回数量', 'warning');
        return;
    }
    
    try {
        const amountWei = ethers.parseUnits(amount, 18);
        const redeemTx = await managerContract.redeemShares(amountWei);
        await redeemTx.wait();
        
        logMessage('赎回成功!', 'success');
        amountInput.value = '';
        
        // 更新余额
        await updateBalances();
        
    } catch (error) {
        logMessage(`赎回失败: ${error.message}`, 'error');
    }
}

// 更新房产价值
export async function updatePropertyValue() {
    const valueInput = document.getElementById('new-property-value');
    const newValue = valueInput.value;
    
    if (!newValue || newValue <= 0) {
        logMessage('请输入有效的房产价值', 'warning');
        return;
    }
    
    try {
        const newValueWei = ethers.parseUnits(newValue, 6);
        const updateTx = await managerContract.setPropertyValue(newValueWei);
        await updateTx.wait();
        
        logMessage('房产价值更新成功!', 'success');
        valueInput.value = '';
        
        // 更新房产信息
        await updatePropertyInfo();
        
    } catch (error) {
        logMessage(`更新房产价值失败: ${error.message}`, 'error');
    }
}