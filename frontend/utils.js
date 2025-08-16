// 工具函数

// 格式化数字为货币格式
export function formatCurrency(amount, decimals = 2) {
    return parseFloat(amount).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

// 格式化以太坊地址
export function formatAddress(address) {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// 添加日志消息
export function logMessage(message, type = 'info') {
    const logElement = document.getElementById('log-messages');
    const messageElement = document.createElement('div');
    
    const timestamp = new Date().toLocaleTimeString();
    messageElement.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
    
    switch (type) {
        case 'success':
            messageElement.style.color = '#27ae60';
            break;
        case 'error':
            messageElement.style.color = '#e74c3c';
            break;
        case 'warning':
            messageElement.style.color = '#f39c12';
            break;
    }
    
    logElement.appendChild(messageElement);
    logElement.scrollTop = logElement.scrollHeight;
}

// 初始化事件监听器
export function initEventListeners() {
    document.getElementById('connect-wallet').addEventListener('click', connectWallet);
    document.getElementById('buy-shares').addEventListener('click', buyShares);
    document.getElementById('claim-dividend').addEventListener('click', claimDividend);
    document.getElementById('deposit-dividend').addEventListener('click', depositDividend);
    document.getElementById('redeem-shares').addEventListener('click', redeemShares);
    document.getElementById('update-property-value').addEventListener('click', updatePropertyValue);
}