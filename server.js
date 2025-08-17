// server.js
const express = require('express');
const app = express();
const path = require('path');

// 提供静态文件服务
app.use(express.static(path.join(__dirname, 'frontend')));

// 处理根路径请求
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('静态文件目录:', path.join(__dirname, 'frontend'));
});