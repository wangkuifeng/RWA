// 合约地址配置
const USDT_ADDRESS = "0x66efc7Ac39dB9f78f2613C86a1b16Cd7570D1B64";
const MANAGER_ADDRESS = "0x324A4EDE05C92B8b6BF65cb06869a5B6FE72a2Ee";
const TOKEN_ADDRESS = "0xa30c529a674a1C9416630D1Ce4021fdE6377ba22";

console.log("app.js 已加载");

// 全局变量
let usdtContract, managerContract, tokenContract;
let provider, signer, currentAccount;

// DOM 元素引用变量
let connectBtn, buyBtn, claimBtn, depositBtn, redeemBtn;
let accountAddress, usdtBalance, tokenBalance, dividendBalance, propertyValue, ipfsLink, lockEnd;
let logContainer;

// 初始化
async function init() {
    console.log("初始化开始...");
    
    // 获取DOM元素
    connectBtn = document.getElementById('connect-wallet');
    buyBtn = document.getElementById('buy-btn');
    claimBtn = document.getElementById('claim-btn');
    depositBtn = document.getElementById('deposit-btn');
    redeemBtn = document.getElementById('redeem-btn');
    accountAddress = document.getElementById('account-address');
    usdtBalance = document.getElementById('usdt-balance');
    tokenBalance = document.getElementById('token-balance');
    dividendBalance = document.getElementById('dividend-balance');
    propertyValue = document.getElementById('property-value');
    ipfsLink = document.getElementById('ipfs-link');
    lockEnd = document.getElementById('lock-end');
    logContainer = document.getElementById('log-container');
    
    // 初始化事件监听器
    setupEventListeners();
    
    // 检查是否已安装MetaMask
    if (window.ethereum) {
        console.log("检测到 MetaMask");
        provider = new ethers.providers.Web3Provider(window.ethereum);
        
        try {
            // 检查是否已连接钱包
            const accounts = await provider.listAccounts();
            if (accounts.length > 0) {
                console.log("已有连接账户", accounts[0]);
                await connectWallet(false); // 自动连接不显示提示
            }
            
            // 监听账户变化
            window.ethereum.on('accountsChanged', (accounts) => {
                console.log("账户变化:", accounts);
                if (accounts.length > 0) {
                    connectWallet(false);
                } else {
                    disconnectWallet();
                }
            });
            
            // 监听链变化
            window.ethereum.on('chainChanged', (chainId) => {
                console.log("链已变更:", chainId);
                window.location.reload();
            });
            
        } catch (error) {
            console.error("初始化错误:", error);
            logMessage(`初始化错误: ${error.message}`, 'error');
        }
    } else {
        console.log("未检测到 MetaMask");
        logMessage('请安装MetaMask钱包以使用此应用', 'error');
    }
}

function setupEventListeners() {
    console.log("设置事件监听器...");
    
    if (connectBtn) {
        connectBtn.addEventListener('click', () => connectWallet(true));
        console.log("连接钱包事件已绑定");
    }
    
    if (buyBtn) buyBtn.addEventListener('click', buyShares);
    if (claimBtn) claimBtn.addEventListener('click', claimDividend);
    if (depositBtn) depositBtn.addEventListener('click', depositDividend);
    if (redeemBtn) redeemBtn.addEventListener('click', redeemShares);
    
    console.log("事件监听器设置完成");
}

async function connectWallet(isManual = true) {
    console.log("连接钱包函数被调用，手动模式:", isManual);
    
    try {
        // 更新按钮状态
        if (connectBtn) {
            connectBtn.textContent = '连接中...';
            connectBtn.disabled = true;
        }
        
        logMessage(isManual ? '正在连接钱包...' : '自动连接钱包...', 'info');
        
        // 请求账户访问 - 添加超时处理
        const accounts = await Promise.race([
            window.ethereum.request({ method: 'eth_requestAccounts' }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('连接超时: MetaMask未响应')), 30000)
            )
        ]);
        
        console.log("获取到账户:", accounts);
        
        if (!accounts || accounts.length === 0) {
            throw new Error('未获取到账户');
        }
        
        currentAccount = accounts[0];
        signer = provider.getSigner();
        
        // 更新UI
        if (connectBtn) {
            connectBtn.textContent = '已连接';
            connectBtn.disabled = false;
        }
        
        if (accountAddress) {
            accountAddress.textContent = `${currentAccount.substring(0, 6)}...${currentAccount.substring(38)}`;
        }
        
        logMessage('钱包连接成功!', 'success');
        
        // 初始化合约实例
        console.log("初始化合约实例...");
        usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
        managerContract = new ethers.Contract(MANAGER_ADDRESS, MANAGER_ABI, signer);
        tokenContract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
        console.log("合约实例创建完成");
        
        // 加载数据
        await loadData();
        
    } catch (error) {
        console.error("连接钱包错误:", error);
        
        // 恢复按钮状态
        if (connectBtn) {
            connectBtn.textContent = '连接钱包';
            connectBtn.disabled = false;
        }
        
        // 特殊错误处理
        let errorMsg = `钱包连接失败: ${error.message}`;
        
        if (error.code === 4001) {
            errorMsg = '您已取消钱包连接';
        } else if (error.code === -32002) {
            errorMsg = '已有待处理的连接请求，请在MetaMask中处理';
        } else if (error.message.includes('超时')) {
            errorMsg = '连接超时：请检查MetaMask是否正常运行';
        }
        
        logMessage(errorMsg, 'error');
    }
}

// 其余函数保持不变（disconnectWallet, loadData, clearData, buyShares, claimDividend, depositDividend, redeemShares, logMessage, formatCurrency）

// 合约ABI（简化版）
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
    "function ipfsHash() view returns (string)"
];

const TOKEN_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function lockEndTime() view returns (uint256)"
];

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM已加载完成，开始初始化应用");
    init();
});