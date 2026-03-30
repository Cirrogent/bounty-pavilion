const express = require('express');
const { query, get, run } = require('../models/db');
const { authenticateToken } = require('../middleware/auth');
const { detectProfanity } = require('../middleware/profanityFilter');
const { createNotification } = require('./notifications');

const router = express.Router();

// 获取整合包的所有评论（支持嵌套回复）
router.get('/modpack/:modpackId', async (req, res) => {
  try {
    const allComments = await query(`
      SELECT c.*, u.username, u.avatar
      FROM modpack_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.modpack_id = ?
      ORDER BY c.created_at ASC
    `, [req.params.modpackId]);

    // 构建评论树
    const commentMap = {};
    allComments.forEach(comment => {
      comment.replies = [];
      commentMap[comment.id] = comment;
    });

    const rootComments = [];
    allComments.forEach(comment => {
      if (comment.parent_id) {
        if (commentMap[comment.parent_id]) {
          commentMap[comment.parent_id].replies.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });

    res.json(rootComments);
  } catch (error) {
    console.error('获取评论失败:', error);
    res.status(500).json({ error: '获取评论失败' });
  }
});

// 添加评论（检测违禁词，支持回复）
router.post('/', authenticateToken, detectProfanity, async (req, res) => {
  try {
    const { modpackId, content, parent_id } = req.body;
    
    if (!modpackId || !content) {
      return res.status(400).json({ error: '请填写评论内容' });
    }
    
    if (content.trim().length > 500) {
      return res.status(400).json({ error: '评论内容不能超过500字' });
    }

    // 检查父评论是否存在（如果是回复）
    if (parent_id) {
      const parentComment = await get('SELECT * FROM modpack_comments WHERE id = ?', [parent_id]);
      if (!parentComment) {
        return res.status(400).json({ error: '回复的评论不存在' });
      }
      if (parentComment.modpack_id !== modpackId) {
        return res.status(400).json({ error: '评论不匹配' });
      }
    }
    
    const result = await run(
      'INSERT INTO modpack_comments (modpack_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)',
      [modpackId, req.user.id, content.trim(), parent_id || null]
    );
    
    const newComment = await get(`
      SELECT c.*, u.username, u.avatar
      FROM modpack_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [result.id]);

    // 发送通知
    if (parent_id) {
      // 回复评论：通知被回复的人（不通知自己）
      const parentComment = await get('SELECT user_id FROM modpack_comments WHERE id = ?', [parent_id]);
      if (parentComment && parentComment.user_id !== req.user.id) {
        const replierName = newComment.display_name || newComment.username;
        createNotification(
          parentComment.user_id,
          'comment_reply',
          '收到新回复',
          `${replierName} 回复了你的评论：${content.trim().substring(0, 50)}${content.trim().length > 50 ? '...' : ''}`,
          newComment.id,
          'modpack_comment',
          req.user.id
        ).catch(() => {});
      }
    } else {
      // 一级评论：通知整合包作者（不通知自己）
      const modpack = await get('SELECT author_id, name FROM modpacks WHERE id = ?', [modpackId]);
      if (modpack && modpack.author_id !== req.user.id) {
        const commenterName = newComment.display_name || newComment.username;
        createNotification(
          modpack.author_id,
          'comment',
          '整合包收到新评论',
          `${commenterName} 评论了你的整合包《${modpack.name}》：${content.trim().substring(0, 50)}${content.trim().length > 50 ? '...' : ''}`,
          newComment.id,
          'modpack_comment',
          req.user.id
        ).catch(() => {});
      }
    }

    res.status(201).json({
      message: '评论发表成功',
      comment: newComment
    });
  } catch (error) {
    console.error('发表评论失败:', error);
    res.status(500).json({ error: '发表评论失败' });
  }
});

// 删除评论（只能删除自己的评论或管理员可以删除任何评论，级联删除子回复）
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
    
    // 删除评论及其所有子回复
    await run('DELETE FROM modpack_comments WHERE id = ? OR parent_id = ?', [req.params.id, req.params.id]);
    
    res.json({ message: '评论删除成功' });
  } catch (error) {
    console.error('删除评论失败:', error);
    res.status(500).json({ error: '删除评论失败' });
  }
});

// 获取整合包评论发送者信息（用于旧通知补全头像）
router.get('/modpack/:commentId/sender', authenticateToken, async (req, res) => {
  try {
    const comment = await get(
      `SELECT mc.user_id, u.avatar, u.display_name, u.username
       FROM modpack_comments mc
       JOIN users u ON mc.user_id = u.id
       WHERE mc.id = ?`,
      [req.params.commentId]
    );
    if (comment) {
      res.json({ avatar: comment.avatar, display_name: comment.display_name, username: comment.username });
    } else {
      res.json(null);
    }
  } catch (error) {
    res.json(null);
  }
});

// 获取文章评论发送者信息（用于旧通知补全头像）
router.get('/story/:commentId/sender', authenticateToken, async (req, res) => {
  try {
    const db = require('../models/db');
    const comment = db.get(
      `SELECT sc.user_id, u.avatar, u.display_name, u.username
       FROM story_comments sc
       JOIN users u ON sc.user_id = u.id
       WHERE sc.id = ?`,
      [req.params.commentId]
    );
    if (comment) {
      res.json({ avatar: comment.avatar, display_name: comment.display_name, username: comment.username });
    } else {
      res.json(null);
    }
  } catch (error) {
    res.json(null);
  }
});

module.exports = router;
