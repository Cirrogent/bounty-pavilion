const express = require('express');
const { query, get, run } = require('../models/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 获取所有留言（公开，按时间倒序）
router.get('/', async (req, res) => {
  try {
    const messages = await query(`
      SELECT m.*, u.username 
      FROM messages m 
      JOIN users u ON m.user_id = u.id 
      WHERE m.parent_id IS NULL
      ORDER BY m.created_at DESC
    `);
    
    res.json(messages);
  } catch (error) {
    console.error('获取留言失败:', error);
    res.status(500).json({ error: '获取留言失败' });
  }
});

// 创建留言（需要登录）
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '留言内容不能为空' });
    }
    
    if (content.length > 1000) {
      return res.status(400).json({ error: '留言内容不能超过1000字' });
    }
    
    const result = await run(
      'INSERT INTO messages (user_id, content) VALUES (?, ?)',
      [req.user.id, content.trim()]
    );
    
    const newMessage = await get(`
      SELECT m.*, u.username 
      FROM messages m 
      JOIN users u ON m.user_id = u.id 
      WHERE m.id = ?
    `, [result.id]);
    
    res.status(201).json({
      message: '留言发布成功',
      message: newMessage
    });
  } catch (error) {
    console.error('发布留言失败:', error);
    res.status(500).json({ error: '发布留言失败' });
  }
});

// 回复留言（需要登录）
router.post('/:id/reply', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    const parentId = req.params.id;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '回复内容不能为空' });
    }
    
    if (content.length > 500) {
      return res.status(400).json({ error: '回复内容不能超过500字' });
    }
    
    // 检查父留言是否存在
    const parentMessage = await get('SELECT * FROM messages WHERE id = ?', [parentId]);
    if (!parentMessage) {
      return res.status(404).json({ error: '要回复的留言不存在' });
    }
    
    const result = await run(
      'INSERT INTO messages (user_id, content, parent_id) VALUES (?, ?, ?)',
      [req.user.id, content.trim(), parentId]
    );
    
    const newReply = await get(`
      SELECT m.*, u.username 
      FROM messages m 
      JOIN users u ON m.user_id = u.id 
      WHERE m.id = ?
    `, [result.id]);
    
    res.status(201).json({
      message: '回复发布成功',
      reply: newReply
    });
  } catch (error) {
    console.error('发布回复失败:', error);
    res.status(500).json({ error: '发布回复失败' });
  }
});

// 删除留言（需要登录，只能删除自己的留言或管理员可以删除任何留言）
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const message = await get('SELECT * FROM messages WHERE id = ?', [req.params.id]);
    
    if (!message) {
      return res.status(404).json({ error: '留言不存在' });
    }
    
    // 检查权限（只能删除自己的留言，管理员可以删除任何留言）
    if (message.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '只能删除自己的留言' });
    }
    
    // 删除留言及其所有回复
    await run('DELETE FROM messages WHERE id = ? OR parent_id = ?', [req.params.id, req.params.id]);
    
    res.json({ message: '留言删除成功' });
  } catch (error) {
    console.error('删除留言失败:', error);
    res.status(500).json({ error: '删除留言失败' });
  }
});

// 获取某个留言的回复（公开）
router.get('/:id/replies', async (req, res) => {
  try {
    const replies = await query(`
      SELECT m.*, u.username 
      FROM messages m 
      JOIN users u ON m.user_id = u.id 
      WHERE m.parent_id = ?
      ORDER BY m.created_at ASC
    `, [req.params.id]);
    
    res.json(replies);
  } catch (error) {
    console.error('获取回复失败:', error);
    res.status(500).json({ error: '获取回复失败' });
  }
});

module.exports = router;
