const express = require('express');
const path = require('path');
const fs = require('fs');
const { query, get, run } = require('../models/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { createNotification } = require('./notifications');

const router = express.Router();

// 获取所有用户（管理员）
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await query(`
      SELECT id, username, email, role, avatar, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);
    
    res.json(users);
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 修改用户角色（管理员）
router.put('/users/:userId/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const targetUserId = req.params.userId;
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }
    
    // 不能修改自己的角色
    if (targetUserId == req.user.id) {
      return res.status(400).json({ error: '不能修改自己的角色' });
    }
    
    const targetUser = await get('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    await run(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, targetUserId]
    );
    
    res.json({
      message: `用户 ${targetUser.username} 的角色已修改为 ${role === 'admin' ? '管理员' : '普通用户'}`,
      user: {
        id: targetUserId,
        username: targetUser.username,
        role
      }
    });
  } catch (error) {
    console.error('修改用户角色失败:', error);
    res.status(500).json({ error: '修改用户角色失败' });
  }
});

// 删除用户（管理员）
router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    
    // 不能删除自己
    if (targetUserId == req.user.id) {
      return res.status(400).json({ error: '不能删除自己的账户' });
    }
    
    const targetUser = await get('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 不能删除超级管理员（admin）
    if (targetUser.username === 'admin') {
      return res.status(400).json({ error: '不能删除超级管理员账户' });
    }
    
    // 删除用户及其相关数据
    await run('DELETE FROM messages WHERE user_id = ?', [targetUserId]);
    await run('DELETE FROM modpack_requests WHERE user_id = ?', [targetUserId]);
    await run('DELETE FROM users WHERE id = ?', [targetUserId]);
    
    res.json({
      message: `用户 ${targetUser.username} 已被删除`
    });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

module.exports = router;
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = {};
    
    // 用户统计
    const userStats = await get(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
        COUNT(CASE WHEN role = 'user' THEN 1 END) as user_count
      FROM users
    `);
    stats.users = userStats;
    
    // 整合包统计
    const modpackStats = await get(`
      SELECT 
        COUNT(*) as total_modpacks,
        SUM(views) as total_views,
        SUM(downloads) as total_downloads
      FROM modpacks
    `);
    stats.modpacks = modpackStats;
    
    // 留言统计
    const messageStats = await get(`
      SELECT COUNT(*) as total_messages FROM messages WHERE parent_id IS NULL
    `);
    stats.messages = messageStats;
    
    // 成员统计
    const memberStats = await get('SELECT COUNT(*) as total_members FROM members');
    stats.members = memberStats;
    
    // 待处理申请统计
    const pendingRequests = await get(`
      SELECT COUNT(*) as pending_requests FROM modpack_requests WHERE status = 'pending'
    `);
    stats.pendingRequests = pendingRequests.pending_requests;
    
    res.json(stats);
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({ error: '获取统计信息失败' });
  }
});

// 获取待审核的整合包（管理员）
router.get('/pending-modpacks', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pendingModpacks = await query(`
      SELECT m.*, u.username as author_name 
      FROM modpacks m 
      LEFT JOIN users u ON m.author_id = u.id 
      WHERE m.status = 'pending'
      ORDER BY m.created_at DESC
    `);
    
    res.json(pendingModpacks);
  } catch (error) {
    console.error('获取待审核整合包失败:', error);
    res.status(500).json({ error: '获取待审核整合包失败' });
  }
});

// 批准待审核整合包（管理员）
router.put('/pending-modpacks/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const modpack = await get('SELECT * FROM modpacks WHERE id = ? AND status = ?', [req.params.id, 'pending']);
    
    if (!modpack) {
      return res.status(404).json({ error: '待审核整合包不存在' });
    }
    
    await run(
      'UPDATE modpacks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['published', req.params.id]
    );
    
    // 通知整合包作者
    if (modpack.author_id) {
      await createNotification(
        modpack.author_id,
        'modpack_approved',
        '整合包审核通过',
        `你提交的整合包「${modpack.name}」已通过审核，现已发布！`,
        modpack.id,
        'modpack'
      );
    }
    
    res.json({
      message: '整合包已批准发布',
      modpackId: req.params.id
    });
  } catch (error) {
    console.error('批准整合包失败:', error);
    res.status(500).json({ error: '批准整合包失败' });
  }
});

// 拒绝待审核整合包（管理员）
router.put('/pending-modpacks/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const modpack = await get('SELECT * FROM modpacks WHERE id = ? AND status = ?', [req.params.id, 'pending']);
    
    if (!modpack) {
      return res.status(404).json({ error: '待审核整合包不存在' });
    }
    
    // 删除图片文件
    if (modpack.image_url) {
      const imagePath = path.join(__dirname, '..', modpack.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    // 通知整合包作者
    if (modpack.author_id) {
      await createNotification(
        modpack.author_id,
        'modpack_rejected',
        '整合包审核未通过',
        `你提交的整合包「${modpack.name}」未通过审核，请修改后重新提交。`,
        modpack.id,
        'modpack'
      );
    }
    
    await run('DELETE FROM modpacks WHERE id = ?', [req.params.id]);
    
    res.json({
      message: '整合包已拒绝并删除',
      modpackId: req.params.id
    });
  } catch (error) {
    console.error('拒绝整合包失败:', error);
    res.status(500).json({ error: '拒绝整合包失败' });
  }
});

// 禁言用户（管理员）
router.post('/users/:userId/ban', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { days } = req.body;
    const targetUserId = req.params.userId;
    const banDays = parseInt(days) || 7;
    
    if (banDays < 1 || banDays > 365) {
      return res.status(400).json({ error: '禁言天数必须在1-365天之间' });
    }
    
    // 不能禁言自己
    if (targetUserId == req.user.id) {
      return res.status(400).json({ error: '不能禁言自己' });
    }
    
    const targetUser = await get('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 不能禁言超级管理员
    if (targetUser.username === 'admin') {
      return res.status(400).json({ error: '不能禁言超级管理员' });
    }
    
    const bannedUntil = new Date();
    bannedUntil.setDate(bannedUntil.getDate() + banDays);
    
    await run(
      'UPDATE users SET banned_until = ? WHERE id = ?',
      [bannedUntil.toISOString(), targetUserId]
    );
    
    res.json({
      message: `用户 ${targetUser.username} 已被禁言 ${banDays} 天`,
      banned_until: bannedUntil
    });
  } catch (error) {
    console.error('禁言用户失败:', error);
    res.status(500).json({ error: '禁言用户失败' });
  }
});

// 解除禁言（管理员）
router.post('/users/:userId/unban', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    
    const targetUser = await get('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    await run(
      'UPDATE users SET banned_until = NULL WHERE id = ?',
      [targetUserId]
    );
    
    res.json({
      message: `用户 ${targetUser.username} 的禁言已解除`
    });
  } catch (error) {
    console.error('解除禁言失败:', error);
    res.status(500).json({ error: '解除禁言失败' });
  }
});

// 获取网站统计信息（管理员）
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = {};
    const userStats = await get(`SELECT COUNT(*) as total_users, COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count, COUNT(CASE WHEN role = 'user' THEN 1 END) as user_count FROM users`);
    stats.users = userStats;
    const modpackStats = await get(`SELECT COUNT(*) as total_modpacks, SUM(views) as total_views, SUM(downloads) as total_downloads FROM modpacks`);
    stats.modpacks = modpackStats;
    const messageStats = await get('SELECT COUNT(*) as total_messages FROM messages WHERE parent_id IS NULL');
    stats.messages = messageStats;
    const memberStats = await get('SELECT COUNT(*) as total_members FROM members');
    stats.members = memberStats;
    const pendingRequests = await get('SELECT COUNT(*) as pending_requests FROM modpack_requests WHERE status = "pending"');
    stats.pendingRequests = pendingRequests.pending_requests;
    res.json(stats);
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({ error: '获取统计信息失败' });
  }
});

module.exports = router;
