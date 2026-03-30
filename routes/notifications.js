const express = require('express');
const { query, get, run } = require('../models/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 获取用户通知（附带发送者头像和来源信息）
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await query(
      `SELECT n.*,
              s.username as sender_username, s.avatar as sender_avatar, s.display_name as sender_display_name,
              CASE
                WHEN n.related_type = 'story' THEN n.related_id
                WHEN n.related_type = 'story_comment' THEN (SELECT sc.story_id FROM story_comments sc WHERE sc.id = n.related_id LIMIT 1)
                WHEN n.related_type = 'modpack' THEN n.related_id
                WHEN n.related_type = 'modpack_comment' THEN (SELECT mc.modpack_id FROM modpack_comments mc WHERE mc.id = n.related_id LIMIT 1)
                ELSE NULL
              END as source_id,
              CASE
                WHEN n.related_type = 'story' THEN (SELECT title FROM stories WHERE id = n.related_id)
                WHEN n.related_type = 'story_comment' THEN (SELECT title FROM stories WHERE id = (SELECT sc.story_id FROM story_comments sc WHERE sc.id = n.related_id LIMIT 1))
                WHEN n.related_type IN ('modpack', 'modpack_comment') THEN (SELECT name FROM modpacks WHERE id = 
                  CASE 
                    WHEN n.related_type = 'modpack' THEN n.related_id
                    ELSE (SELECT mc.modpack_id FROM modpack_comments mc WHERE mc.id = n.related_id LIMIT 1)
                  END
                )
                ELSE NULL
              END as source_title
       FROM notifications n
       LEFT JOIN users s ON n.sender_id = s.id
       WHERE n.user_id = ? 
       ORDER BY n.created_at DESC 
       LIMIT 50`,
      [req.user.id]
    );
    
    res.json(notifications);
  } catch (error) {
    console.error('获取通知失败:', error);
    res.status(500).json({ error: '获取通知失败' });
  }
});

// 标记通知为已读
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    await run(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [notificationId, req.user.id]
    );
    
    res.json({ message: '已标记为已读' });
  } catch (error) {
    console.error('标记通知已读失败:', error);
    res.status(500).json({ error: '标记失败' });
  }
});

// 标记所有通知为已读
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await run(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [req.user.id]
    );
    
    res.json({ message: '所有通知已标记为已读' });
  } catch (error) {
    console.error('标记所有通知已读失败:', error);
    res.status(500).json({ error: '标记失败' });
  }
});

// 获取未读通知数量
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const result = await get(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    
    res.json({ count: result.count });
  } catch (error) {
    console.error('获取未读通知数量失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 创建通知的工具函数（供其他模块调用）
async function createNotification(userId, type, title, content, relatedId = null, relatedType = null, senderId = null) {
  try {
    await run(
      'INSERT INTO notifications (user_id, type, title, content, related_id, related_type, sender_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, type, title, content, relatedId, relatedType, senderId]
    );
  } catch (error) {
    console.error('创建通知失败:', error);
  }
}

module.exports = router;
module.exports.createNotification = createNotification;