const express = require('express');
const { query, get, run } = require('../models/db');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { createNotification } = require('./notifications');

const router = express.Router();

// 上传目录
const uploadsDir = process.env.RAILWAY_ENVIRONMENT ? '/tmp/uploads/gallery' : path.join(__dirname, '..', 'uploads', 'gallery');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ==================== 珍宝阁列表 ====================

// 获取所有已发布的照片/视频（公开）
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let whereClause = "WHERE g.status = 'published'";
    let params = [];

    if (search) {
      whereClause += " AND (g.title LIKE ? OR g.description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    params.push(limit, offset);

    const items = query(
      `SELECT g.*, u.display_name as uploader_display, u.avatar as uploader_avatar, u.username as uploader_username
       FROM gallery g
       LEFT JOIN users u ON g.uploader_id = u.id
       ${whereClause}
       ORDER BY g.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    const countResult = get(
      `SELECT COUNT(*) as total FROM gallery g ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({
      items,
      total: countResult ? countResult.total : 0,
      page,
      limit,
      totalPages: Math.ceil((countResult ? countResult.total : 0) / limit)
    });
  } catch (error) {
    console.error('获取珍宝阁列表失败:', error);
    res.status(500).json({ error: '获取列表失败' });
  }
});

// ==================== 管理员上传 ====================

// 管理员直接上传照片/视频
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, description } = req.body;
    const file = req.files ? req.files.file : null;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: '请填写标题' });
    }

    let imageUrl = '';
    let fileType = 'image';

    if (file) {
      const ext = path.extname(file.name).toLowerCase();
      const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
      const videoExts = ['.mp4', '.webm', '.ogg'];

      if (videoExts.includes(ext)) {
        fileType = 'video';
      } else if (!imageExts.includes(ext)) {
        return res.status(400).json({ error: '不支持的文件格式，仅支持图片和视频' });
      }

      const maxImageSize = 10 * 1024 * 1024;
      const maxVideoSize = 50 * 1024 * 1024;
      if (fileType === 'image' && file.size > maxImageSize) {
        return res.status(400).json({ error: '图片大小不能超过10MB' });
      }
      if (fileType === 'video' && file.size > maxVideoSize) {
        return res.status(400).json({ error: '视频大小不能超过50MB' });
      }

      const fileName = `${Date.now()}_${file.name}`;
      const filePath = path.join(uploadsDir, fileName);
      await file.mv(filePath);
      imageUrl = `/uploads/gallery/${fileName}`;
    }

    const result = run(
      'INSERT INTO gallery (title, description, image_url, file_type, uploader_id, uploader_name) VALUES (?, ?, ?, ?, ?, ?)',
      [title.trim(), description || '', imageUrl, fileType, req.user.id, req.user.display_name || req.user.username]
    );

    res.status(201).json({ message: '上传成功', id: result.id });
  } catch (error) {
    console.error('上传珍宝阁失败:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

// ==================== 普通用户上传申请（必须在 /:id 之前） ====================

// 提交上传申请
router.post('/apply', authenticateToken, async (req, res) => {
  try {
    const { title, description } = req.body;
    const file = req.files ? req.files.file : null;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: '请填写标题' });
    }
    if (!file) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }

    const ext = path.extname(file.name).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const videoExts = ['.mp4', '.webm', '.ogg'];

    let fileType = 'image';
    if (videoExts.includes(ext)) {
      fileType = 'video';
    } else if (!imageExts.includes(ext)) {
      return res.status(400).json({ error: '不支持的文件格式' });
    }

    const maxImageSize = 10 * 1024 * 1024;
    const maxVideoSize = 50 * 1024 * 1024;
    if (fileType === 'image' && file.size > maxImageSize) {
      return res.status(400).json({ error: '图片大小不能超过10MB' });
    }
    if (fileType === 'video' && file.size > maxVideoSize) {
      return res.status(400).json({ error: '视频大小不能超过50MB' });
    }

    const fileName = `${Date.now()}_${file.name}`;
    const filePath = path.join(uploadsDir, fileName);
    await file.mv(filePath);
    const imageUrl = `/uploads/gallery/${fileName}`;

    run(
      'INSERT INTO gallery_applications (user_id, title, description, image_url, file_type) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, title.trim(), description || '', imageUrl, fileType]
    );

    res.status(201).json({ message: '申请已提交，请等待管理员审核' });
  } catch (error) {
    console.error('提交上传申请失败:', error);
    res.status(500).json({ error: '提交申请失败' });
  }
});

// 查看自己的申请记录
router.get('/apply/my', authenticateToken, async (req, res) => {
  try {
    const applications = query(
      'SELECT ga.* FROM gallery_applications ga WHERE ga.user_id = ? ORDER BY ga.created_at DESC',
      [req.user.id]
    );
    res.json(applications);
  } catch (error) {
    console.error('获取申请记录失败:', error);
    res.status(500).json({ error: '获取申请记录失败' });
  }
});

// ==================== 管理员审核申请（必须在 /:id 之前） ====================

// 获取所有申请（管理员）
router.get('/admin/applications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const applications = query(
      `SELECT ga.*, u.username, u.display_name, u.avatar
       FROM gallery_applications ga
       JOIN users u ON ga.user_id = u.id
       ORDER BY ga.created_at DESC`
    );
    res.json(applications);
  } catch (error) {
    console.error('获取申请列表失败:', error);
    res.status(500).json({ error: '获取申请列表失败' });
  }
});

// 审核通过
router.post('/admin/applications/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const app = get('SELECT * FROM gallery_applications WHERE id = ?', [req.params.id]);
    if (!app) {
      return res.status(404).json({ error: '申请不存在' });
    }

    const result = run(
      'INSERT INTO gallery (title, description, image_url, file_type, uploader_id, uploader_name) VALUES (?, ?, ?, ?, ?, ?)',
      [app.title, app.description, app.image_url, app.file_type, app.user_id, null]
    );

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    run('UPDATE gallery_applications SET status = ?, reviewed_at = ? WHERE id = ?', ['approved', now, req.params.id]);

    createNotification(
      app.user_id, 'gallery_approved', '珍宝阁上传通过',
      '你提交的照片「' + app.title + '」已通过审核并发布',
      result.id, 'gallery', req.user.id
    ).catch(() => {});

    res.json({ message: '已通过' });
  } catch (error) {
    console.error('审核通过失败:', error);
    res.status(500).json({ error: '审核失败' });
  }
});

// 审核拒绝
router.post('/admin/applications/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const app = get('SELECT * FROM gallery_applications WHERE id = ?', [req.params.id]);
    if (!app) {
      return res.status(404).json({ error: '申请不存在' });
    }

    if (app.image_url) {
      const fileName = path.basename(app.image_url);
      const filePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    run('UPDATE gallery_applications SET status = ?, reject_reason = ?, reviewed_at = ? WHERE id = ?', ['rejected', reason || '', now, req.params.id]);

    createNotification(
      app.user_id, 'gallery_rejected', '珍宝阁上传未通过',
      '你提交的照片「' + app.title + '」未通过审核' + (reason ? '，原因：' + reason : ''),
      null, null, req.user.id
    ).catch(() => {});

    res.json({ message: '已拒绝' });
  } catch (error) {
    console.error('审核拒绝失败:', error);
    res.status(500).json({ error: '审核失败' });
  }
});

// ==================== 单个详情（/:id） ====================

// 获取单张照片/视频详情
router.get('/:id', async (req, res) => {
  try {
    const item = get(
      `SELECT g.*, u.display_name as uploader_display, u.avatar as uploader_avatar, u.username as uploader_username
       FROM gallery g
       LEFT JOIN users u ON g.uploader_id = u.id
       WHERE g.id = ?`,
      [req.params.id]
    );

    if (!item) {
      return res.status(404).json({ error: '内容不存在' });
    }

    run('UPDATE gallery SET views = views + 1 WHERE id = ?', [req.params.id]);

    res.json(item);
  } catch (error) {
    console.error('获取珍宝阁详情失败:', error);
    res.status(500).json({ error: '获取详情失败' });
  }
});

// 管理员删除照片/视频
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const item = get('SELECT * FROM gallery WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ error: '内容不存在' });
    }

    if (item.image_url) {
      const fileName = path.basename(item.image_url);
      const filePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    run('DELETE FROM gallery_comments WHERE gallery_id = ?', [req.params.id]);
    run('DELETE FROM gallery WHERE id = ?', [req.params.id]);

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除珍宝阁失败:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

// 管理员编辑照片/视频
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, description } = req.body;
    const item = get('SELECT * FROM gallery WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ error: '内容不存在' });
    }

    run(
      'UPDATE gallery SET title = ?, description = ? WHERE id = ?',
      [title || item.title, description !== undefined ? description : item.description, req.params.id]
    );

    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('更新珍宝阁失败:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

// ==================== 评论系统 ====================

// 获取照片/视频的评论
router.get('/:id/comments', async (req, res) => {
  try {
    const comments = query(
      `SELECT gc.*, u.username, u.display_name, u.avatar, u.role
       FROM gallery_comments gc
       JOIN users u ON gc.user_id = u.id
       WHERE gc.gallery_id = ?
       ORDER BY gc.created_at DESC`,
      [req.params.id]
    );
    res.json(comments);
  } catch (error) {
    console.error('获取评论失败:', error);
    res.status(500).json({ error: '获取评论失败' });
  }
});

// 发表评论
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { content, parent_id } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '评论内容不能为空' });
    }

    const galleryItem = get('SELECT * FROM gallery WHERE id = ?', [req.params.id]);
    if (!galleryItem) {
      return res.status(404).json({ error: '内容不存在' });
    }

    const result = run(
      'INSERT INTO gallery_comments (gallery_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)',
      [req.params.id, req.user.id, content.trim(), parent_id || null]
    );

    const comment = query(
      `SELECT gc.*, u.username, u.display_name, u.avatar, u.role
       FROM gallery_comments gc
       JOIN users u ON gc.user_id = u.id
       WHERE gc.id = ?`,
      [result.id]
    );

    // 发送通知
    if (parent_id) {
      const parentComment = get('SELECT user_id FROM gallery_comments WHERE id = ?', [parent_id]);
      if (parentComment && parentComment.user_id !== req.user.id) {
        const name = req.user.display_name || req.user.username;
        createNotification(
          parentComment.user_id, 'comment_reply', '收到新回复',
          name + ' 回复了你的评论：' + content.trim().substring(0, 50),
          result.id, 'gallery_comment', req.user.id
        ).catch(() => {});
      }
    } else {
      if (galleryItem.uploader_id && galleryItem.uploader_id !== req.user.id) {
        const name = req.user.display_name || req.user.username;
        createNotification(
          galleryItem.uploader_id, 'comment', '照片收到新评论',
          name + ' 评论了你的照片「' + galleryItem.title + '」：' + content.trim().substring(0, 50),
          result.id, 'gallery_comment', req.user.id
        ).catch(() => {});
      }
    }

    res.status(201).json({ comment: comment[0] });
  } catch (error) {
    console.error('发表评论失败:', error);
    res.status(500).json({ error: '发表评论失败' });
  }
});

// 删除评论
router.delete('/:galleryId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const comment = get('SELECT * FROM gallery_comments WHERE id = ?', [req.params.commentId]);
    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权删除此评论' });
    }

    run('DELETE FROM gallery_comments WHERE id = ? OR parent_id = ?', [req.params.commentId, req.params.commentId]);
    res.json({ message: '评论删除成功' });
  } catch (error) {
    console.error('删除评论失败:', error);
    res.status(500).json({ error: '删除评论失败' });
  }
});

// ==================== 点赞 ====================

router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const item = get('SELECT * FROM gallery WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ error: '内容不存在' });
    }

    run('UPDATE gallery SET likes = likes + 1 WHERE id = ?', [req.params.id]);

    if (item.uploader_id && item.uploader_id !== req.user.id) {
      const likerName = req.user.display_name || req.user.username;
      createNotification(
        item.uploader_id, 'like', '收到新点赞',
        likerName + ' 赞了你的照片「' + item.title + '」',
        req.params.id, 'gallery', req.user.id
      ).catch(() => {});
    }

    res.json({ message: '点赞成功' });
  } catch (error) {
    console.error('点赞失败:', error);
    res.status(500).json({ error: '点赞失败' });
  }
});

module.exports = router;
