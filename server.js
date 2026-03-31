const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
const fs = require('fs');

// 加载环境变量
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            if (value) {
                process.env[key.trim()] = value.replace(/^[\"']|[\"']$/g, '');
            }
        }
    });
}

const app = express();
app.set('trust proxy', 1);  // 信任代理（Nginx）的 X-Forwarded-For 头
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
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB（支持视频上传）
  abortOnLimit: true,
  createParentPath: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// API响应禁用缓存，确保数据实时性
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// 确保上传目录存在
const uploadsDir = process.env.RAILWAY_ENVIRONMENT ? '/tmp/uploads/modpacks' : path.join(__dirname, 'uploads', 'modpacks');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const avatarsDir = process.env.RAILWAY_ENVIRONMENT ? '/tmp/uploads/avatars' : path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}
console.log(`📁 上传目录: ${uploadsDir}`);

// 初始化邮件服务
const { initTransporter } = require('./utils/email');
const emailReady = initTransporter();

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
const commentRoutes = require('./routes/comments');
const chatRoutes = require('./routes/chat');
const storyRoutes = require('./routes/stories');
const notificationRoutes = require('./routes/notifications');
const galleryRoutes = require('./routes/gallery');

app.use('/api/auth', authRoutes);
app.use('/api/modpacks', modpackRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/gallery', galleryRoutes);

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
