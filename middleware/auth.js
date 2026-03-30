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

    // 从数据库获取完整用户信息（包含禁言状态）
    const dbUser = await get('SELECT id, username, display_name, email, role, avatar, banned_until FROM users WHERE id = ?', [user.userId]);
    if (!dbUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 检查禁言状态
    if (dbUser.banned_until) {
      const bannedUntil = new Date(dbUser.banned_until);
      if (new Date() < bannedUntil) {
        const remainingDays = Math.ceil((bannedUntil - new Date()) / (1000 * 60 * 60 * 24));
        return res.status(403).json({ 
          error: `您已被禁言，还剩${remainingDays}天`,
          banned_until: dbUser.banned_until
        });
      }
      // 禁言已过期，自动解除
      const { run } = require('../models/db');
      run('UPDATE users SET banned_until = NULL WHERE id = ?', [dbUser.id]);
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
