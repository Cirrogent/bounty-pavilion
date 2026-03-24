const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: '*',  // 允许所有来源访问
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 确保上传目录存在
const uploadsDir = process.env.RAILWAY_ENVIRONMENT ? '/tmp/uploads/modpacks' : path.join(__dirname, 'uploads', 'modpacks');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
console.log(`📁 上传目录: ${uploadsDir}`);

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 限制每个IP 100个请求
});
app.use('/api/', limiter);

// 数据库初始化
const db = require('./models/db');
db.init();

// 路由
const authRoutes = require('./routes/auth');
const modpackRoutes = require('./routes/modpacks');
const memberRoutes = require('./routes/members');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/modpacks', modpackRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

// 静态文件服务 - uploads
const uploadsServeDir = process.env.RAILWAY_ENVIRONMENT ? '/tmp/uploads' : path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsServeDir));

// 前端路由（SPA支持）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '请稍后重试'
  });
});

app.listen(PORT, () => {
  console.log(`🎮 赏金阁服务器启动成功！`);
  console.log(`📡 访问地址: http://localhost:${PORT}`);
  console.log(`🌟 Minecraft整合包分享平台`);
});

module.exports = app;