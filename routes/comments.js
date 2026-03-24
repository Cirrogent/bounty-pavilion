const express = require('express');
const { query, get, run } = require('../models/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 获取整合包的所有评论
router.get('/modpack/:modpackId', async (req, res) => {
  try {
    const comments = await query(`
      SELECT c.*, u.username, u.avatar
      FROM modpack_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.modpack_id = ?
      ORDER BY c.created_at DESC
    `, [req.params.modpackId]);
    
    res.json(comments);
  } catch (error) {
    console.error('获取评论失败:', error);
    res.status(500).json({ error: '获取评论失败' });
  }
});

// 添加评论
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { modpackId, content } = req.body;
    
    if (!modpackId || !content) {
      return res.status(400).json({ error: '请填写评论内容' });
    }
    
    if (content.trim().length > 500) {
      return res.status(400).json({ error: '评论内容不能超过500字' });
    }
    
    const result = await run(
      'INSERT INTO modpack_comments (modpack_id, user_id, content) VALUES (?, ?, ?)',
      [modpackId, req.user.id, content.trim()]
    );
    
    const newComment = await get(`
      SELECT c.*, u.username, u.avatar
      FROM modpack_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [result.id]);
    
    res.status(201).json({
      message: '评论发表成功',
      comment: newComment
    });
  } catch (error) {
    console.error('发表评论失败:', error);
    res.status(500).json({ error: '发表评论失败' });
  }
});

// 删除评论（只能删除自己的评论或管理员可以删除任何评论）
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const comment = await get('SELECT * FROM modpack_comments WHERE id = ?', [req.params.id]);
    
    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }
    
    // 检查权限：只能删除自己的评论或管理员
    if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权删除此评论' });
    }
    
    await run('DELETE FROM modpack_comments WHERE id = ?', [req.params.id]);
    
    res.json({ message: '评论删除成功' });
  } catch (error) {
    console.error('删除评论失败:', error);
    res.status(500).json({ error: '删除评论失败' });
  }
});

module.exports = router;
