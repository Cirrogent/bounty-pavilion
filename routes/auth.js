const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, run, query } = require('../models/db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { initTransporter, sendVerificationCode, sendPasswordResetCode } = require('../utils/email');
const { notifyNewUser } = require('../utils/adminNotify');

const router = express.Router();

// 生成6位验证码
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送邮箱验证码（注册用）
router.post('/send-code', async (req, res) => {
  try {
    const { email, username } = req.body;

    if (!email) {
      return res.status(400).json({ error: '请输入邮箱地址' });
    }

    // 简单邮箱格式校验
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    // 检查邮箱是否已注册（已注册走 users 表，未注册走 temp_registrations 表）
    const existingUser = await get('SELECT id, email_verified FROM users WHERE email = ?', [email]);
    
    // 生成验证码
    const code = generateCode();
    
    // 统一使用 JS 本地时间（ISO格式），避免 SQLite CURRENT_TIMESTAMP 是 UTC 导致时区偏差
    const nowISO = new Date().toISOString();

    if (existingUser) {
      // 已注册用户：更新验证码到 users 表（用于重新验证邮箱）
      await run('UPDATE users SET verification_code = ?, updated_at = ? WHERE id = ?', [code, nowISO, existingUser.id]);
    } else {
      // 未注册用户：操作 temp_registrations 表
      const tempUser = await get('SELECT id, created_at FROM temp_registrations WHERE email = ?', [email]);
      if (tempUser) {
        // 防止频繁发送（60秒冷却）
        const lastSent = new Date(tempUser.created_at || nowISO);
        if (Date.now() - lastSent.getTime() < 60 * 1000) {
          return res.status(429).json({ error: '验证码发送太频繁，请 60 秒后再试' });
        }
        await run('UPDATE temp_registrations SET verification_code = ?, created_at = ? WHERE email = ?', [code, nowISO, email]);
      } else {
        // 创建临时注册记录（手动指定 created_at 为本地 ISO 时间）
        await run(
          'INSERT INTO temp_registrations (email, verification_code, created_at) VALUES (?, ?, ?)',
          [email, code, nowISO]
        );
      }
    }

    // 发送邮件
    const result = await sendVerificationCode(email, code, username || '');

    res.json({ 
      message: '验证码已发送',
      mode: result.mode
    });
  } catch (error) {
    console.error('发送验证码错误:', error);
    res.status(500).json({ error: '发送验证码失败' });
  }
});

// 注册（需要先验证邮箱）
router.post('/register', async (req, res) => {
  try {
    const { username, account, email, password, confirmPassword, verificationCode } = req.body;

    // 验证输入
    if (!username || !account || !email || !password) {
      return res.status(400).json({ error: '请填写完整的注册信息' });
    }

    if (username.length < 1 || username.length > 20) {
      return res.status(400).json({ error: '名称长度应在1-20个字符之间' });
    }

    if (account.length < 3 || account.length > 20) {
      return res.status(400).json({ error: '账号长度应在3-20个字符之间' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少为6位' });
    }

    // 确认密码校验
    if (password !== confirmPassword) {
      return res.status(400).json({ error: '两次输入的密码不一致' });
    }

    // 验证邮箱验证码（先查 temp_registrations，再查 users）
    let tempUser = await get('SELECT * FROM temp_registrations WHERE email = ? AND verification_code = ?', [email, verificationCode]);
    let codeSource = 'temp'; // 标记验证码来源

    if (!tempUser) {
      // temp_registrations 里没有，检查 users 表（已注册用户重新验证邮箱的场景）
      tempUser = await get('SELECT id, updated_at FROM users WHERE email = ? AND verification_code = ?', [email, verificationCode]);
      codeSource = 'user';
    }

    if (!tempUser) {
      // 两张表都没有匹配的验证码
      const inTemp = await get('SELECT id FROM temp_registrations WHERE email = ?', [email]);
      const inUsers = await get('SELECT id FROM users WHERE email = ?', [email]);
      if (inTemp || inUsers) {
        return res.status(400).json({ error: '验证码错误，请检查后重新输入' });
      }
      return res.status(400).json({ error: '未发送验证码，请先获取验证码' });
    }

    // 检查验证码是否过期（3分钟）
    // 注意：数据库中的时间现在统一存为 JS new Date().toISOString() 格式，直接 new Date() 解析即可
    const timeField = codeSource === 'temp' ? 'created_at' : 'updated_at';
    const codeTime = new Date(tempUser[timeField] || Date.now());
    const elapsed = Date.now() - codeTime.getTime();
    if (elapsed > 3 * 60 * 1000) {
      return res.status(400).json({ error: '验证码已过期（3分钟有效），请重新获取' });
    }

    // 检查名称、账号或邮箱是否已存在
    const existingUser = await get('SELECT * FROM users WHERE username = ? OR email = ?', [account, email]);
    if (existingUser) {
      if (existingUser.username === account) {
        return res.status(400).json({ error: '该账号已被注册' });
      }
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    // 检查名称（display_name）是否已被使用
    const existingName = await get('SELECT id FROM users WHERE display_name = ? AND display_name IS NOT NULL', [username]);
    if (existingName) {
      return res.status(400).json({ error: '该名称已被使用，请换一个' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户（邮箱已验证，username字段存账号，email存邮箱，显示名称也存入username备用）
    const result = await run(
      'INSERT INTO users (username, display_name, email, password, email_verified) VALUES (?, ?, ?, ?, 1)',
      [account, username, email, hashedPassword]
    );

    // 清理临时注册记录 / 清除 users 表验证码
    if (codeSource === 'temp') {
      await run('DELETE FROM temp_registrations WHERE email = ?', [email]);
    } else {
      await run('UPDATE users SET verification_code = NULL WHERE id = ?', [tempUser.id]);
    }

    // 通知管理员有新用户注册（异步，不阻塞注册流程）
    notifyNewUser(username, email).catch(() => {});

    // 生成Token
    const token = jwt.sign(
      { userId: result.id, username: account },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: result.id,
        username: account,
        display_name: username,
        email,
        role: 'user',
        email_verified: true
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// ========== 忘记密码 ==========

// 发送密码重置验证码
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: '请输入邮箱地址' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    // 查找用户
    const user = await get('SELECT id, username, updated_at FROM users WHERE email = ?', [email]);
    if (!user) {
      // 安全考虑：不暴露用户是否存在，但也不发送邮件
      return res.json({ message: '如果该邮箱已注册，验证码将发送到您的邮箱' });
    }

    // 防止频繁发送（60秒冷却）
    const storedCode = await get('SELECT verification_code FROM users WHERE id = ?', [user.id]);
    if (storedCode && storedCode.verification_code && user.updated_at) {
      const lastUpdate = new Date(user.updated_at);
      if (Date.now() - lastUpdate.getTime() < 60 * 1000) {
        return res.status(429).json({ error: '验证码发送太频繁，请 60 秒后再试' });
      }
    }

    const code = generateCode();
    // 存储重置验证码，手动指定 updated_at 为本地 ISO 时间
    const nowISO = new Date().toISOString();
    await run('UPDATE users SET verification_code = ?, updated_at = ? WHERE id = ?', [code, nowISO, user.id]);

    // 发送邮件
    await sendPasswordResetCode(email, code, user.username);

    res.json({ message: '如果该邮箱已注册，验证码将发送到您的邮箱' });
  } catch (error) {
    console.error('忘记密码错误:', error);
    res.status(500).json({ error: '发送验证码失败' });
  }
});

// 通过验证码重置密码
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码长度至少为6位' });
    }

    // 验证邮箱和验证码
    const user = await get('SELECT id, updated_at, verification_code FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ error: '邮箱不存在' });
    }

    if (user.verification_code !== code) {
      return res.status(400).json({ error: '验证码错误，请检查后重新输入' });
    }

    // 检查验证码是否过期（3分钟）
    const codeTime = new Date(user.updated_at || Date.now());
    const elapsed = Date.now() - codeTime.getTime();
    if (elapsed > 3 * 60 * 1000) {
      return res.status(400).json({ error: '验证码已过期（3分钟有效），请重新获取' });
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码并清除验证码
    await run('UPDATE users SET password = ?, verification_code = NULL WHERE id = ?', [hashedPassword, user.id]);

    res.json({ message: '密码重置成功，请使用新密码登录' });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ error: '重置密码失败' });
  }
});

// ========== 登录 ==========

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '请填写用户名和密码' });
    }

    // 查找用户（支持用户名或邮箱登录）
    const user = await get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成Token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name || user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        email_verified: user.email_verified
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await get('SELECT id, username, display_name, email, role, avatar, email_verified, created_at FROM users WHERE id = ?', [req.user.id]);
    res.json({ user });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 修改密码
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码长度至少为6位' });
    }

    // 获取当前用户完整信息（包括密码）
    const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    
    // 验证当前密码
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '当前密码错误' });
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// 上传头像
router.post('/upload-avatar', authenticateToken, async (req, res) => {
  try {
    if (!req.files || !req.files.avatar) {
      return res.status(400).json({ error: '请选择头像文件' });
    }

    const avatar = req.files.avatar;

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(avatar.mimetype)) {
      return res.status(400).json({ error: '只支持 JPG、PNG、GIF、WebP 格式的图片' });
    }

    // 验证文件大小（最大2MB）
    if (avatar.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: '头像文件大小不能超过2MB' });
    }

    // 生成文件名
    const ext = avatar.name.split('.').pop();
    const filename = `avatar_${req.user.id}_${Date.now()}.${ext}`;
    
    // 上传目录
    const uploadsDir = process.env.RAILWAY_ENVIRONMENT ? '/tmp/uploads/avatars' : require('path').join(__dirname, '..', 'uploads', 'avatars');
    const fs = require('fs');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = require('path').join(uploadsDir, filename);
    await avatar.mv(filePath);

    // 更新数据库
    const avatarUrl = `/uploads/avatars/${filename}`;
    await run('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.id]);

    res.json({ 
      message: '头像上传成功',
      avatar: avatarUrl
    });
  } catch (error) {
    console.error('上传头像错误:', error);
    res.status(500).json({ error: '上传头像失败' });
  }
});

module.exports = router;
