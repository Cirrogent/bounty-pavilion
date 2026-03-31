const express = require('express');
const { db, run, query, get } = require('../models/db');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { detectProfanity, detectImageProfanity } = require('../middleware/profanityFilter');
const { notifyNewStory } = require('../utils/adminNotify');
const { createNotification } = require('./notifications');

const router = express.Router();

// 上传目录
const uploadsDir = process.env.RAILWAY_ENVIRONMENT ? '/tmp/uploads/stories' : path.join(__dirname, '..', 'uploads', 'stories');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 获取所有野史趣事（公开的）
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const category = req.query.category || 'all';
    const sort = req.query.sort || 'latest';
    const search = req.query.search || '';

    let whereClause = "WHERE stories.status = 'published'";
    let params = [];

    // 分类筛选
    if (category !== 'all') {
      whereClause += " AND stories.category = ?";
      params.push(category);
    }

    // 搜索
    if (search) {
      whereClause += " AND (stories.title LIKE ? OR users.username LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    // 排序
    let orderBy = 'stories.created_at DESC';
    if (sort === 'hot') {
      orderBy = 'stories.likes DESC, stories.views DESC';
    }

    params.push(limit, offset);

    const stories = query(
      `SELECT stories.*, users.username as author_name 
       FROM stories 
       JOIN users ON stories.author_id = users.id 
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      params
    );

    const totalResult = query(
      `SELECT COUNT(*) as count FROM stories 
       JOIN users ON stories.author_id = users.id 
       ${whereClause}`,
      params.slice(0, -2)
    );
    const total = totalResult[0].count;

    res.json({
      stories,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取野史趣事失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取单个野史趣事详情
router.get('/:id', async (req, res) => {
  try {
    const storyId = parseInt(req.params.id);
    
    // 增加浏览量
    run('UPDATE stories SET views = views + 1 WHERE id = ?', [storyId]);

    const story = get(
      `SELECT stories.*, users.username as author_name 
       FROM stories 
       JOIN users ON stories.author_id = users.id 
       WHERE stories.id = ?`,
      [storyId]
    );

    if (!story) {
      return res.status(404).json({ error: '野史趣事不存在' });
    }

    res.json(story);
  } catch (error) {
    console.error('获取野史趣事详情失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 发布新的野史趣事（需要登录，检测违禁词）
router.post('/', authenticateToken, detectProfanity, async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const image_url = req.body.image_url || null;

    if (!title || !content) {
      return res.status(400).json({ error: '标题和内容不能为空' });
    }

    if (title.length > 200) {
      return res.status(400).json({ error: '标题不能超过200字' });
    }

    if (!category || !['gossip', 'novel'].includes(category)) {
      return res.status(400).json({ error: '请选择分类' });
    }

    const result = run(
      'INSERT INTO stories (title, content, image_url, author_id, category) VALUES (?, ?, ?, ?, ?)',
      [title, content, image_url, req.user.id, category]
    );

    const story = get('SELECT * FROM stories WHERE id = ?', [result.id]);
    
    // 通知管理员有新爆料文章
    notifyNewStory(title, req.user.username).catch(() => {});
    
    res.json({ message: '发布成功', story });
  } catch (error) {
    console.error('发布野史趣事失败:', error);
    res.status(500).json({ error: '发布失败' });
  }
});

// 上传图片（需要登录，检测图片内容）
router.post('/upload-image', authenticateToken, detectImageProfanity, async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ error: '请选择图片' });
    }

    const image = req.files.image;
    const ext = path.extname(image.name);
    const filename = `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
    const filepath = path.join(uploadsDir, filename);

    // 检查文件类型
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!allowedTypes.includes(ext.toLowerCase())) {
      return res.status(400).json({ error: '只支持jpg、png、gif、webp格式' });
    }

    // 检查文件大小（5MB）
    if (image.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: '图片不能超过5MB' });
    }

    await image.mv(filepath);
    const imageUrl = `/uploads/stories/${filename}`;

    res.json({ imageUrl });
  } catch (error) {
    console.error('上传图片失败:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

// 点赞
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const storyId = parseInt(req.params.id);
    
    run('UPDATE stories SET likes = likes + 1 WHERE id = ?', [storyId]);
    
    const story = get('SELECT likes, author_id, title FROM stories WHERE id = ?', [storyId]);
    
    // 通知文章作者（不通知自己）
    if (story && story.author_id !== req.user.id) {
      const likerName = req.user.display_name || req.user.username;
      createNotification(
        story.author_id,
        'like',
        '收到新点赞',
        `${likerName} 赞了你的文章《${story.title}》`,
        storyId,
        'story',
        req.user.id
      ).catch(() => {});
    }
    
    res.json({ likes: story.likes, message: '点赞成功' });
  } catch (error) {
    console.error('点赞失败:', error);
    res.status(500).json({ error: '点赞失败' });
  }
});

// 获取文章评论（支持回复，支持分页）
router.get('/:id/comments', async (req, res) => {
  try {
    const storyId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 获取根评论（支持分页）
    const rootComments = query(
      `SELECT sc.*, u.username, u.avatar, u.role 
       FROM story_comments sc
       JOIN users u ON sc.user_id = u.id
       WHERE sc.story_id = ? AND sc.parent_id IS NULL
       ORDER BY sc.created_at ASC
       LIMIT ? OFFSET ?`,
      [storyId, limit, offset]
    );

    // 获取所有子评论（不分页，全部返回）
    const allReplies = query(
      `SELECT sc.*, u.username, u.avatar, u.role 
       FROM story_comments sc
       JOIN users u ON sc.user_id = u.id
       WHERE sc.story_id = ? AND sc.parent_id IS NOT NULL
       ORDER BY sc.created_at ASC`,
      [storyId]
    );

    // 构建评论树
    const commentMap = {};
    rootComments.forEach(comment => {
      comment.replies = [];
      commentMap[comment.id] = comment;
    });
    allReplies.forEach(comment => {
      comment.replies = [];
      commentMap[comment.id] = comment;
    });

    // 将子评论挂到父评论下
    allReplies.forEach(comment => {
      if (comment.parent_id && commentMap[comment.parent_id]) {
        commentMap[comment.parent_id].replies.push(comment);
      }
    });

    // 获取总评论数用于分页
    const countResult = query(
      'SELECT COUNT(*) as total FROM story_comments WHERE story_id = ? AND parent_id IS NULL',
      [storyId]
    );
    const total = countResult[0].total;

    res.json({
      comments: rootComments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('获取评论失败:', error);
    res.status(500).json({ error: '获取评论失败' });
  }
});

// 发布评论（需要登录，检测违禁词）
router.post('/:id/comments', authenticateToken, detectProfanity, async (req, res) => {
  try {
    const storyId = parseInt(req.params.id);
    const { content, parent_id } = req.body;
    const image_url = req.body.image_url || null;

    if (!content) {
      return res.status(400).json({ error: '评论内容不能为空' });
    }

    // 检查父评论是否存在（如果是回复）
    if (parent_id) {
      const parentComment = get('SELECT * FROM story_comments WHERE id = ?', [parent_id]);
      if (!parentComment) {
        return res.status(400).json({ error: '回复的评论不存在' });
      }
      if (parentComment.story_id !== storyId) {
        return res.status(400).json({ error: '评论不匹配' });
      }
    }

    const result = run(
      'INSERT INTO story_comments (story_id, user_id, content, image_url, parent_id) VALUES (?, ?, ?, ?, ?)',
      [storyId, req.user.id, content, image_url, parent_id || null]
    );

    const comment = get(
      `SELECT sc.*, u.username, u.display_name, u.avatar, u.role 
       FROM story_comments sc
       JOIN users u ON sc.user_id = u.id
       WHERE sc.id = ?`,
      [result.id]
    );

    // 发送通知
    if (parent_id) {
      // 回复评论：通知被回复的人（不通知自己）
      const parentComment = get('SELECT user_id FROM story_comments WHERE id = ?', [parent_id]);
      if (parentComment && parentComment.user_id !== req.user.id) {
        const replierName = comment.display_name || comment.username;
        createNotification(
          parentComment.user_id,
          'comment_reply',
          '收到新回复',
          `${replierName} 回复了你的评论：${content.trim().substring(0, 50)}${content.trim().length > 50 ? '...' : ''}`,
          comment.id,
          'story_comment',
          req.user.id
        ).catch(() => {});
      }
    } else {
      // 一级评论：通知文章作者（不通知自己）
      const story = get('SELECT author_id, title FROM stories WHERE id = ?', [storyId]);
      if (story && story.author_id !== req.user.id) {
        const commenterName = comment.display_name || comment.username;
        createNotification(
          story.author_id,
          'comment',
          '文章收到新评论',
          `${commenterName} 评论了你的文章《${story.title}》：${content.trim().substring(0, 50)}${content.trim().length > 50 ? '...' : ''}`,
          comment.id,
          'story_comment',
          req.user.id
        ).catch(() => {});
      }
    }

    res.json({ message: '评论发布成功', comment });
  } catch (error) {
    console.error('发布评论失败:', error);
    res.status(500).json({ error: '发布评论失败' });
  }
});

// 删除评论（管理员或评论作者可以删除）
router.delete('/:storyId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const comment = get('SELECT * FROM story_comments WHERE id = ?', [commentId]);

    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    // 管理员可以删除任何评论，作者只能删除自己的评论
    if (req.user.role !== 'admin' && comment.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权删除该评论' });
    }

    // 删除评论图片
    if (comment.image_url) {
      const filename = path.basename(comment.image_url);
      const imagePath = path.join(uploadsDir, filename);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    run('DELETE FROM story_comments WHERE id = ?', [commentId]);
    res.json({ message: '评论删除成功' });
  } catch (error) {
    console.error('删除评论失败:', error);
    res.status(500).json({ error: '删除评论失败' });
  }
});

// 删除野史趣事（管理员或作者可以删除）
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const storyId = parseInt(req.params.id);
    const story = get('SELECT * FROM stories WHERE id = ?', [storyId]);

    if (!story) {
      return res.status(404).json({ error: '野史趣事不存在' });
    }

    // 管理员可以删除任何文章，作者只能删除自己的文章
    if (req.user.role !== 'admin' && story.author_id !== req.user.id) {
      return res.status(403).json({ error: '无权删除' });
    }

    // 删除文章图片
    if (story.image_url) {
      const filename = path.basename(story.image_url);
      const imagePath = path.join(uploadsDir, filename);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // 删除评论图片
    const comments = query('SELECT * FROM story_comments WHERE story_id = ?', [storyId]);
    for (const comment of comments) {
      if (comment.image_url) {
        const filename = path.basename(comment.image_url);
        const imagePath = path.join(uploadsDir, filename);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
    }

    // 删除评论和文章
    run('DELETE FROM story_comments WHERE story_id = ?', [storyId]);
    run('DELETE FROM stories WHERE id = ?', [storyId]);
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除野史趣事失败:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = router;
