const jwt = require('jsonwebtoken');
const { get } = require('../models/db');

const JWT_SECRET = process.env.JWT_SECRET || 'bounty-pavilion-secret-key-change-in-production';

// 验证Token中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: '登录已过期，请重新登录' });
    }

    // 从数据库获取完整用户信息
    const dbUser = await get('SELECT id, username, email, role, avatar FROM users WHERE id = ?', [user.userId]);
    if (!dbUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    req.user = dbUser;
    next();
  });
}

// 验证管理员权限中间件
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

// 可选认证（用于需要登录但非强制的情况）
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      req.user = null;
      return next();
    }

    const dbUser = await get('SELECT id, username, email, role, avatar FROM users WHERE id = ?', [user.userId]);
    req.user = dbUser || null;
    next();
  });
}

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth,
  JWT_SECRET
};
