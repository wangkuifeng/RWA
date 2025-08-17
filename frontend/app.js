// ====================== 全局变量 ======================
let provider, signer, currentAccount;
let usdtContract, managerContract, tokenContract;
let isAdmin = false;
let usdtDecimals = 6;
let tokenDecimals = 18;

// ====================== DOM元素 ======================
const connectBtn = document.getElementById('connect-wallet');
const switchNetworkBtn = document.getElementById('switch-network');
const claimBtn = document.getElementById('claim-btn');
const claimBtn2 = document.getElementById('claim-btn2');
const buyBtn = document.getElementById('buy-btn');
const redeemBtn = document.getElementById('redeem-btn');
const depositBtn = document.getElementById('deposit-btn');
const updatePropertyBtn = document.getElementById('update-property-btn');
const mintUsdtBtn = document.getElementById('mint-usdt-btn');
const clearLogsBtn = document.getElementById('clear-logs');
const logBox = document.getElementById('log-box');
const statusIndicator = document.getElementById('status-indicator');
const connectionStatus = document.getElementById('connection-status');
const accountAddress = document.getElementById('account-address');
const usdtBalance = document.getElementById('usdt-balance');
const tokenBalance = document.getElementById('token-balance');
const dividendBalance = document.getElementById('dividend-balance');
const claimableDividend = document.getElementById('claimable-dividend');
const propertyValue = document.getElementById('property-value');
const minPurchase = document.getElementById('min-purchase');
const minPurchaseLabel = document.getElementById('min-purchase-label');
const lockRemaining = document.getElementById('lock-remaining');
const lockEndDate = document.getElementById('lock-end-date');
const lockStatus = document.getElementById('lock-status');
const ipfsLink = document.getElementById('ipfs-link');
const chainInfo = document.getElementById('chain-info');
const adminSection = document.getElementById('admin-section');
const transactionStatus = document.getElementById('transaction-status');
const statusMessage = document.getElementById('status-message');
const txLink = document.getElementById('tx-link');
const networkIndicator = document.getElementById('network-indicator');
const networkName = document.getElementById('network-name');
const totalValue = document.getElementById('total-value');

// ====================== 初始化函数 ======================
async function init() {
    logMessage("应用程序初始化中...", "info");
    
    // 检查是否安装MetaMask
    if (typeof window.ethereum === 'undefined') {
        logMessage("未检测到MetaMask钱包，请安装MetaMask", "error");
        showCustomAlert('请安装MetaMask钱包以使用此应用','status');
        return;
    }
    
    try {
        // 创建Ethers provider
        provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // 设置合约实例
        usdtContract = new ethers.Contract(MOCK_USDT_ADDRESS, USDT_ABI, provider);
        managerContract = new ethers.Contract(MANAGER_ADDRESS, MANAGER_ABI, provider);
        
        // 设置事件监听器
        setupEventListeners();
        
        // 检查网络
        await checkNetwork();
        
        // 检查是否已连接钱包
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
            await connectWallet(false);
        }
    } catch (error) {
        logMessage(`初始化失败: ${error.message}`, "error");
        console.error("初始化错误:", error);
    }
}

function setupEventListeners() {
    // 连接钱包按钮
    connectBtn.addEventListener('click', () => connectWallet(true));
    
    // 切换网络按钮
    switchNetworkBtn.addEventListener('click', switchToSepolia);
    
    // 功能按钮
    claimBtn.addEventListener('click', claimDividend);
    claimBtn2.addEventListener('click', claimDividend);
    buyBtn.addEventListener('click', buyShares);
    redeemBtn.addEventListener('click', redeemShares);
    depositBtn.addEventListener('click', depositDividend);
    updatePropertyBtn.addEventListener('click', updatePropertyValue);
    mintUsdtBtn.addEventListener('click', mintMockUSDT);
    
    // 其他控件
    clearLogsBtn.addEventListener('click', clearLogs);
    
    // 监听账户变化
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
            connectWallet(false);
        } else {
            disconnectWallet();
        }
    });
    
    // 监听网络变化
    window.ethereum.on('chainChanged', (chainId) => {
        logMessage(`网络已变更: ${chainId}`, "info");
        window.location.reload();
    });
}

// 检查当前网络
async function checkNetwork() {
    try {
        const network = await provider.getNetwork();
        const chainId = `0x${network.chainId.toString(16)}`;
        
        if (chainId === SEPOLIA_CHAIN_ID) {
            networkIndicator.className = 'network-indicator network-connected';
            networkName.textContent = 'Sepolia 测试网';
            chainInfo.textContent = `Sepolia 测试网 (ID: ${network.chainId})`;
            
            // 获取代币合约地址
            const tokenAddress = await managerContract.getPropertyToken();
            tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);
            
            // 获取代币小数位
            usdtDecimals = await usdtContract.decimals();
            tokenDecimals = await tokenContract.decimals();
            
            logMessage(`成功连接到 Sepolia 网络`, "success");
            logMessage(`mUSDT小数位: ${usdtDecimals}, 代币小数位: ${tokenDecimals}`, "debug");
        } else {
            networkIndicator.className = 'network-indicator network-disconnected';
            networkName.textContent = '不兼容的网络';
            chainInfo.textContent = `当前网络 ID: ${network.chainId} (请切换到 Sepolia)`;
            logMessage(`当前网络不是 Sepolia，请切换网络`, "warning");
        }
    } catch (error) {
        logMessage(`网络检测失败: ${error.message}`, "error");
        console.error("网络检测错误:", error);
    }
}

// ====================== 网络切换 ======================
async function switchToSepolia() {
    try {
        logMessage("正在切换到 Sepolia 网络...", "info");
        
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CHAIN_ID }]
        });
        
        logMessage("已切换到 Sepolia 网络", "success");
        window.location.reload();
    } catch (error) {
        if (error.code === 4902) {
            // 网络未添加，尝试添加
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: SEPOLIA_CHAIN_ID,
                        chainName: 'Sepolia Testnet',
                        nativeCurrency: {
                            name: 'Sepolia Ether',
                            symbol: 'SEP',
                            decimals: 18
                        },
                        rpcUrls: [SEPOLIA_RPC_URL],
                        blockExplorerUrls: ['https://sepolia.etherscan.io']
                    }]
                });
                logMessage("Sepolia 网络已添加并切换成功", "success");
                window.location.reload();
            } catch (addError) {
                logMessage(`添加 Sepolia 网络失败: ${addError.message}`, "error");
                console.error("添加网络错误:", addError);
            }
        } else {
            logMessage(`切换网络失败: ${error.message}`, "error");
            console.error("切换网络错误:", error);
        }
    }
}

// ====================== 钱包连接 ======================
async function connectWallet(isUserAction = true) {
    try {
        logMessage("正在连接钱包...", "info");
        
        // 更新UI
        connectBtn.disabled = true;
        connectBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i> 连接中...';
        
        // 请求账户访问
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        currentAccount = accounts[0];
        signer = provider.getSigner();
        
        // 更新合约实例的签名者
        usdtContract = usdtContract.connect(signer);
        managerContract = managerContract.connect(signer);
        if (tokenContract) tokenContract = tokenContract.connect(signer);
        
        // 更新UI
        statusIndicator.className = 'status-indicator status-connected';
        connectionStatus.textContent = '已连接';
        accountAddress.textContent = `${currentAccount.substring(0, 6)}...${currentAccount.substring(38)}`;
        connectBtn.textContent = '✅ 已连接';
        claimBtn.disabled = false;
        claimBtn2.disabled = false;
        
        logMessage(`钱包连接成功: ${currentAccount}`, "success");
        
        // 检查是否是管理员
        await checkAdminStatus();
        
        // 加载数据
        await loadData();
        
    } catch (error) {
        logMessage(`连接失败: ${error.message}`, "error");
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<i class="fas fa-plug"></i> 连接钱包';
        
        if (error.code === 4001) {
            showCustomAlert('您已取消钱包连接请求','status');
        }
    }
}

function disconnectWallet() {
    currentAccount = null;
    statusIndicator.className = 'status-indicator status-disconnected';
    connectionStatus.textContent = '未连接';
    accountAddress.textContent = '未连接';
    connectBtn.disabled = false;
    connectBtn.innerHTML = '<i class="fas fa-plug"></i> 连接钱包';
    claimBtn.disabled = true;
    claimBtn2.disabled = true;
    adminSection.style.display = 'none';
    
    // 重置余额显示
    usdtBalance.textContent = '0.00';
    tokenBalance.textContent = '0.00';
    dividendBalance.textContent = '0.00';
    claimableDividend.textContent = '0.00';
    propertyValue.textContent = '0.00';
    lockRemaining.textContent = '未连接';
    lockEndDate.textContent = '未连接';
    lockStatus.textContent = '未连接';
    ipfsLink.textContent = '未连接';
    ipfsLink.href = '#';
    
    logMessage('钱包已断开', "info");
}

// ====================== 数据加载 ======================
async function loadData() {
    try {
        logMessage("加载钱包数据...", "info");
        
        // 获取mUSDT余额
        const usdtBal = await usdtContract.balanceOf(currentAccount);
        usdtBalance.textContent = formatCurrency(ethers.utils.formatUnits(usdtBal, usdtDecimals));
        
        // 获取代币余额
        if (tokenContract) {
            const tokenBal = await tokenContract.balanceOf(currentAccount);
            tokenBalance.textContent = formatCurrency(ethers.utils.formatUnits(tokenBal, tokenDecimals));
        } else {
            tokenBalance.textContent = "0.00";
            logMessage("代币合约未初始化", "warning");
        }
        
        // 获取可领分红 - 添加错误处理
        try {
            const dividendBal = await managerContract.getClaimableDividend(currentAccount);
            dividendBalance.textContent = formatCurrency(ethers.utils.formatUnits(dividendBal, usdtDecimals));
            claimableDividend.textContent = formatCurrency(ethers.utils.formatUnits(dividendBal, usdtDecimals));
        } catch (error) {
            logMessage(`获取可领分红失败: ${error.message}`, "error");
            dividendBalance.textContent = "0.00";
            claimableDividend.textContent = "0.00";
        }
        
        // 获取房产价值
        try {
            const propValue = await managerContract.propertyValue();
            let propValueFormatted;
            
            if (propValue.eq(0)) {
                // 如果合约中房产价值为0，使用初始值
                propValueFormatted = formatCurrency(INITIAL_PROPERTY_VALUE);
                propertyValue.textContent = propValueFormatted;
                totalValue.textContent = `房产总价值: $${propValueFormatted}`;
                
                // 更新合约中的房产价值
                try {
                    const valueWei = ethers.utils.parseUnits(INITIAL_PROPERTY_VALUE.toString(), usdtDecimals);
                    await managerContract.setPropertyValue(valueWei);
                    logMessage("已设置初始房产价值", "success");
                } catch (error) {
                    logMessage(`设置房产价值失败: ${error.message}`, "error");
                }
            } else {
                propValueFormatted = formatCurrency(ethers.utils.formatUnits(propValue, usdtDecimals));
                propertyValue.textContent = propValueFormatted;
                totalValue.textContent = `房产总价值: $${propValueFormatted}`;
            }
        } catch (error) {
            logMessage(`获取房产价值失败: ${error.message}`, "error");
            propertyValue.textContent = formatCurrency(INITIAL_PROPERTY_VALUE);
            totalValue.textContent = `房产总价值: $${formatCurrency(INITIAL_PROPERTY_VALUE)}`;
        }
        
        // 获取最小购买金额
        try {
            const minPurchaseAmount = await managerContract.minPurchaseAmount();
            const minPurchaseFormatted = formatCurrency(ethers.utils.formatUnits(minPurchaseAmount, usdtDecimals));
            minPurchase.textContent = minPurchaseFormatted;
            minPurchaseLabel.textContent = minPurchaseFormatted;
        } catch (error) {
            logMessage(`获取最小购买金额失败: ${error.message}`, "error");
            minPurchase.textContent = "1000.00";
            minPurchaseLabel.textContent = "1000.00";
        }
        
        // 获取IPFS哈希
        try {
            let ipfsHash = await managerContract.ipfsHash();
            if (!ipfsHash || ipfsHash === "") {
                ipfsHash = IPFS_HASH; // 使用预设的IPFS哈希
                try {
                    await managerContract.setIPFSHash(IPFS_HASH);
                    logMessage("已设置初始IPFS哈希", "success");
                } catch (error) {
                    logMessage(`设置IPFS哈希失败: ${error.message}`, "error");
                }
            }
            ipfsLink.href = `https://ipfs.io/ipfs/${ipfsHash}`;
            ipfsLink.textContent = "查看房产文件";
        } catch (error) {
            logMessage(`获取IPFS哈希失败: ${error.message}`, "error");
            ipfsLink.href = `https://ipfs.io/ipfs/${IPFS_HASH}`;
            ipfsLink.textContent = "查看房产文件";
        }
        
        // 获取锁定期信息
        if (tokenContract) {
            try {
                const lockEndTime = await tokenContract.lockEndTime();
                const startTime = await tokenContract.startTime();
                const currentTime = Math.floor(Date.now() / 1000);
                
                // 计算剩余时间
                if (lockEndTime.gt(0)) {
                    const lockEndTimestamp = lockEndTime.toNumber();
                    
                    if (lockEndTimestamp > currentTime) {
                        const remaining = lockEndTimestamp - currentTime;
                        const days = Math.floor(remaining / (24 * 3600));
                        lockRemaining.textContent = `${days} 天`;
                        lockStatus.textContent = "锁定中";
                    } else {
                        lockRemaining.textContent = "已结束";
                        lockStatus.textContent = "可交易";
                    }
                    
                    // 显示结束日期
                    const endDate = new Date(lockEndTimestamp * 1000);
                    lockEndDate.textContent = endDate.toLocaleDateString();
                } else {
                    lockRemaining.textContent = "未设置";
                    lockEndDate.textContent = "未设置";
                    lockStatus.textContent = "未设置";
                }
            } catch (error) {
                logMessage(`获取锁定期信息失败: ${error.message}`, "error");
                lockRemaining.textContent = "未知";
                lockEndDate.textContent = "未知";
                lockStatus.textContent = "未知";
            }
        }
        
        logMessage("数据加载完成", "success");
        
    } catch (error) {
        logMessage(`数据加载失败: ${error.message}`, "error");
        console.error("数据加载错误:", error);
    }
}

async function checkAdminStatus() {
    try {
        // 检查是否是管理员 - 使用owner()代替admin()
        let adminAddress;
        
        // 尝试从manager合约获取owner
        try {
            adminAddress = await managerContract.owner();
            logMessage(`从Manager合约获取管理员地址: ${adminAddress}`, "info");
        } catch (managerError) {
            logMessage(`从Manager合约获取管理员失败: ${managerError.message}`, "warning");
            
            // 尝试从USDT合约获取owner
            try {
                adminAddress = await usdtContract.owner();
                logMessage(`从USDT合约获取管理员地址: ${adminAddress}`, "info");
            } catch (usdtError) {
                logMessage(`从USDT合约获取管理员失败: ${usdtError.message}`, "error");
                throw new Error("无法获取管理员地址");
            }
        }
        
        if (adminAddress.toLowerCase() === currentAccount.toLowerCase()) {
            isAdmin = true;
            adminSection.style.display = 'block';
            logMessage("管理员功能已启用", "success");
        } else {
            isAdmin = false;
            adminSection.style.display = 'none';
            logMessage("当前账户不是管理员", "info");
        }
    } catch (error) {
        logMessage(`检查管理员状态失败: ${error.message}`, "error");
        isAdmin = false;
        adminSection.style.display = 'none';
    }
}

// ====================== 合约交互 ======================
async function buyShares() {
    const amountInput = document.getElementById('buy-amount');
    const amount = amountInput.value;
    
    if (!amount || amount < 1000) {
        logMessage('请输入至少1000 mUSDT', 'error');
        showCustomAlert('请输入至少1000 mUSDT','status');
        return;
    }
    
    try {
        const amountWei = ethers.utils.parseUnits(amount, usdtDecimals);
        
        // 显示交易状态
        showTransactionStatus('购买交易处理中...');
        
        // 授权合约使用mUSDT - 优化授权流程（先重置为0）
        logMessage('授权合约使用mUSDT...', 'info');
        
        // 步骤1: 重置授权为0
        logMessage('重置授权为0...', 'info');
        const resetTx = await usdtContract.approve(MANAGER_ADDRESS, 0);
        logMessage(`重置授权交易已发送: ${resetTx.hash}`, 'tx');
        await resetTx.wait();
        logMessage('重置授权交易已确认!', 'success');
        
        // 步骤2: 正式授权所需金额
        logMessage('正式授权所需金额...', 'info');
        const approveTx = await usdtContract.approve(MANAGER_ADDRESS, amountWei);
        logMessage(`授权交易已发送: ${approveTx.hash}`, 'tx');
        await approveTx.wait();
        logMessage('授权交易已确认!', 'success');
        
        // 购买代币
        logMessage('购买房产代币中...', 'info');
        const buyTx = await managerContract.buyShares(amountWei);
        
        // 更新交易链接
        showTransactionLink(buyTx.hash);
        logMessage(`购买交易已发送: ${buyTx.hash}`, 'tx');
        
        // 等待交易确认
        await buyTx.wait();
        logMessage('购买成功!', 'success');
        
        // 重置输入框
        amountInput.value = '';
        
        // 更新数据
        await loadData();
        
        // 隐藏交易状态
        hideTransactionStatus();
        
        showCustomAlert('房产代币购买成功！','success');
        
    } catch (error) {
        logMessage(`购买失败: ${error.message}`, 'error');
        hideTransactionStatus();
        console.error("购买错误:", error);
        
        showCustomAlert(`购买失败: ${error.message}`,'failure');
    }
}

async function claimDividend() {
    try {
               // 直接从合约读取最新可领取分红
        const dividendBal = await managerContract.getClaimableDividend(currentAccount);
        const claimableAmount = parseFloat(ethers.utils.formatUnits(dividendBal, usdtDecimals));
         // 添加日志输出
        logMessage(`合约返回的可领取分红金额: ${claimableAmount} mUSDT`, "info");
        
        if (parseFloat(claimableAmount) <= 0.001) { // 考虑精度问题
            logMessage('可领取分红为0，无需操作', 'warning');
            showCustomAlert('当前没有可领取的分红','failure');
            return;

        }

        // 显示交易状态
        showTransactionStatus('领取分红处理中...');
        
        logMessage('领取分红中...', 'info');
        
        // 直接调用claimDividend - 绕过估计gas
        const tx = await managerContract.claimDividend({
            gasLimit: 300000 // 手动设置gas限制
        });
        
        // 显示交易链接
        showTransactionLink(tx.hash);
        logMessage(`领取分红交易已发送: ${tx.hash}`, 'tx');
        
        // 等待交易确认
        await tx.wait();
        logMessage('分红领取成功!', 'success');
        
        // 更新数据
        await loadData();
        
        // 隐藏交易状态
        hideTransactionStatus();
        
        showCustomAlert('分红领取成功！','success');
        
    } catch (error) {
        logMessage(`领取失败: ${error.message}`, 'error');
        hideTransactionStatus();
        console.error("领取错误:", error);
        
        // 提供更友好的错误信息
        if (error.message.includes("No dividend to claim") || 
            error.message.includes("无可领取的分红")) {
            showCustomAlert("领取失败：当前没有可领取的分红",'failure');
        } else {
            showCustomAlert(`领取失败: ${error.message}`,'failure');
        }
    }
}

async function redeemShares() {
    const amountInput = document.getElementById('redeem-amount');
    const amount = amountInput.value;
    
    if (!amount || amount <= 0) {
        logMessage('请输入有效的赎回数量', 'error');
        showCustomAlert('请输入有效的赎回数量','failure');
        return;
    }
    
    try {
        const amountWei = ethers.utils.parseUnits(amount, tokenDecimals);
        
        // 检查锁定期
        if (tokenContract) {
            const lockEndTime = await tokenContract.lockEndTime();
            const currentTime = Math.floor(Date.now() / 1000);
            
            if (lockEndTime.gt(0) && lockEndTime.toNumber() > currentTime) {
                const remaining = lockEndTime.toNumber() - currentTime;
                const days = Math.ceil(remaining / (24 * 3600));
                logMessage(`锁定期未结束，剩余 ${days} 天`, 'warning');
                showCustomAlert(`锁定期未结束，剩余 ${days} 天`,'status');
                return;
            }
        }
        
        // 显示交易状态
        showTransactionStatus('赎回交易处理中...');
        
        logMessage('赎回代币中...', 'info');
        const tx = await managerContract.redeemShares(amountWei);
        
        // 显示交易链接
        showTransactionLink(tx.hash);
        logMessage(`赎回交易已发送: ${tx.hash}`, 'tx');
        
        // 等待交易确认
        await tx.wait();
        logMessage('赎回成功!', 'success');
        
        // 重置输入框
        amountInput.value = '';
        
        // 更新数据
        await loadData();
        
        // 隐藏交易状态
        hideTransactionStatus();
        
        showCustomAlert('代币赎回成功！','success');
        
    } catch (error) {
        logMessage(`赎回失败: ${error.message}`, 'error');
        hideTransactionStatus();
        console.error("赎回错误:", error);
        
        showCustomAlert(`赎回失败: ${error.message}`,'failure');
    }
}

async function depositDividend() {

            const amountInput = document.getElementById('deposit-amount');
            const amount = amountInput.value;
            
            if (!amount || amount <= 0) {
                logMessage('请输入有效的分红金额', 'error');
                showCustomAlert('请输入有效的分红金额','failure');
                return;
            }
            
    
    try {
        const amountWei = ethers.utils.parseUnits(amount, usdtDecimals);
        
        // 显示交易状态
        showTransactionStatus('存入分红处理中...');
        
        // 授权合约使用mUSDT - 优化授权流程（先重置为0）
        logMessage('授权合约使用mUSDT...', 'info');
        
        // 步骤1: 重置授权为0
        logMessage('重置授权为0...', 'info');
        const resetTx = await usdtContract.approve(MANAGER_ADDRESS, 0);
        logMessage(`重置授权交易已发送: ${resetTx.hash}`, 'tx');
        await resetTx.wait();
        logMessage('重置授权交易已确认!', 'success');
        
        // 步骤2: 正式授权所需金额
        logMessage('正式授权所需金额...', 'info');
        const approveTx = await usdtContract.approve(MANAGER_ADDRESS, amountWei);
        logMessage(`授权交易已发送: ${approveTx.hash}`, 'tx');
        await approveTx.wait();
        logMessage('授权交易已确认!', 'success');
        
        // 存入分红
        logMessage('存入分红中...', 'info');
        const depositTx = await managerContract.depositDividend(amountWei);
        
        // 更新交易链接
        showTransactionLink(depositTx.hash);
        logMessage(`存入分红交易已发送: ${depositTx.hash}`, 'tx');
        
        // 等待交易确认
        await depositTx.wait();
        logMessage('分红存入成功!', 'success');
        
        // 重置输入框
        amountInput.value = '';
        
        // 更新数据
        await loadData();
        
        // 隐藏交易状态
        hideTransactionStatus();
        
        showCustomAlert('分红存入成功！','success');
        
    } catch (error) {
        logMessage(`存入失败: ${error.message}`, 'error');
        hideTransactionStatus();
        console.error("存入错误:", error);
        
        showCustomAlert(`存入失败: ${error.message}`,'failure');
    }
}

async function updatePropertyValue() {
    const valueInput = document.getElementById('property-value-input');
    const value = valueInput.value;
    
    if (!value || value <= 0) {
        logMessage('请输入有效的房产价值', 'error');
        showCustomAlert('请输入有效的房产价值','failure');
        return;
    }
    
    try {
        const valueWei = ethers.utils.parseUnits(value, usdtDecimals);
        
        // 显示交易状态
        showTransactionStatus('更新房产价值处理中...');
        
        logMessage('更新房产价值中...', 'info');
        const tx = await managerContract.setPropertyValue(valueWei);
        
        // 显示交易链接
        showTransactionLink(tx.hash);
        logMessage(`更新交易已发送: ${tx.hash}`, 'tx');
        
        // 等待交易确认
        await tx.wait();
        logMessage('房产价值更新成功!', 'success');
        
        // 重置输入框
        valueInput.value = '';
        
        // 更新数据
        await loadData();
        
        // 隐藏交易状态
        hideTransactionStatus();
        
        showCustomAlert('房产价值更新成功！','success');
        
    } catch (error) {
        logMessage(`更新失败: ${error.message}`, 'error');
        hideTransactionStatus();
        console.error("更新错误:", error);
        
        showCustomAlert(`更新失败: ${error.message}`,'failure');
    }
}

// ====================== 铸造mUSDT函数 ======================
async function mintMockUSDT() {
    try {
        // 检查管理员权限
        let adminAddress;
        try {
            adminAddress = await managerContract.owner();
        } catch {
            try {
                adminAddress = await usdtContract.owner();
            } catch {
                logMessage("无法获取管理员地址", "error");
                return;
            }
        }
        
        if (currentAccount.toLowerCase() !== adminAddress.toLowerCase()) {
            logMessage("错误: 只有管理员可以铸造代币", "error");
            showCustomAlert("错误: 只有合约管理员可以铸造代币","failure");
            return;
        }
        
        // 显示交易状态
        showTransactionStatus('铸造测试mUSDT处理中...');
        
        const amount = 100000; // 10万
        const amountWei = ethers.utils.parseUnits(amount.toString(), usdtDecimals);
        
        // 调用mint函数
        logMessage('铸造测试mUSDT...', 'info');
        const tx = await usdtContract.mint(currentAccount, amountWei, {
            gasLimit: 300000 // 防止gas估算问题
        });
        
        // 显示交易链接
        showTransactionLink(tx.hash);
        logMessage(`铸造交易已发送: ${tx.hash}`, 'tx');
        
        // 等待交易确认
        await tx.wait();
        logMessage('铸造测试mUSDT成功!', 'success');
        
        // 更新数据
        await loadData();
        
        // 隐藏交易状态
        hideTransactionStatus();
        
        showCustomAlert('10万 mUSDT 铸造成功！','success');
        
    } catch (error) {
        logMessage(`铸造失败: ${error.message}`, 'error');
        hideTransactionStatus();
        console.error("铸造错误:", error);
        
        // 提供更友好的错误信息
        if (error.message.includes("revert")) {
            showCustomAlert("交易被拒绝：请确认您有铸造权限且合约未暂停",'failure');
        } else {
            showCustomAlert(`铸造失败: ${error.message}`, 'failure');
        }
    }
}

// ====================== 辅助函数 ======================
function logMessage(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.classList.add('log-entry');
    
    const timestamp = new Date().toLocaleTimeString();
    let typeClass = 'log-info';
    
    switch(type) {
        case 'error':
            typeClass = 'log-error';
            break;
        case 'warning':
            typeClass = 'log-warning';
            break;
        case 'tx':
            typeClass = 'log-tx';
            break;
        case 'debug':
            typeClass = 'log-debug';
            break;
    }
    
    logEntry.innerHTML = `
        <span class="timestamp">[${timestamp}]</span>
        <span class="${typeClass}">${message}</span>
    `;
    
    logBox.appendChild(logEntry);
    logBox.scrollTop = logBox.scrollHeight;
}

// 显示美观弹窗
function showCustomAlert(message, type = 'info') {
  const alertElement = document.getElementById('custom-alert');
  const messageElement = document.getElementById('alert-message');
  const icons = document.querySelectorAll('.alert-icon > i');
  
  // 隐藏所有图标
  icons.forEach(icon => icon.style.display = 'none');
  
  // 设置消息内容
  messageElement.textContent = message;
  
  // 根据类型显示对应图标
  switch(type) {
    case 'success':
      document.querySelector('.success-icon').style.display = 'inline-block';
      document.querySelector('.alert-title').textContent = '操作成功';
      break;
    case 'error':
      document.querySelector('.error-icon').style.display = 'inline-block';
      document.querySelector('.alert-title').textContent = '发生错误';
      break;
    case 'info':
    default:
      document.querySelector('.info-icon').style.display = 'inline-block';
      document.querySelector('.alert-title').textContent = '提示';
  }
  
  // 显示弹窗
  alertElement.style.display = 'flex';
}

// 关闭弹窗
function closeCustomAlert() {
  document.getElementById('custom-alert').style.display = 'none';
}

function formatCurrency(amount) {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0.00';
    
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function clearLogs() {
    logBox.innerHTML = '';
    logMessage("日志已清除", "info");
}

function showTransactionStatus(message) {
    statusMessage.textContent = message;
    transactionStatus.style.display = 'block';
    txLink.style.display = 'none';
}

function showTransactionLink(txHash) {
    const explorerUrl = `https://sepolia.etherscan.io/tx/${txHash}`;
    txLink.href = explorerUrl;
    txLink.textContent = "在Etherscan查看";
    txLink.style.display = 'block';
}

function hideTransactionStatus() {
    transactionStatus.style.display = 'none';
}

// 初始化应用
document.addEventListener('DOMContentLoaded', init);