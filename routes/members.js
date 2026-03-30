const express = require('express');
const path = require('path');
const fs = require('fs');
const { query, get, run } = require('../models/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 文件上传处理函数
const handleImageUpload = (req, fileField = 'avatar') => {
  return new Promise((resolve, reject) => {
    if (!req.files || !req.files[fileField]) {
      return resolve(null);
    }
    
    const file = req.files[fileField];
    const uploadDir = process.env.RAILWAY_ENVIRONMENT ? '/tmp/uploads/members' : path.join(__dirname, '..', 'uploads', 'members');
    
    // 确保上传目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // 检查文件类型
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.name).toLowerCase();
    
    if (!allowedTypes.includes(ext)) {
      return reject(new Error('只允许上传图片文件（jpg, png, gif, webp）'));
    }
    
    // 检查文件大小（2MB）
    if (file.size > 2 * 1024 * 1024) {
      return reject(new Error('图片不能超过2MB'));
    }
    
    // 生成文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'member-' + uniqueSuffix + ext;
    const filepath = path.join(uploadDir, filename);
    
    // 移动文件
    file.mv(filepath, (err) => {
      if (err) {
        return reject(err);
      }
      const imageUrl = `/uploads/members/${filename}`;
      resolve(imageUrl);
    });
  });
};

// 获取所有成员（公开）
router.get('/', async (req, res) => {
  try {
    const members = await query(`
      SELECT * FROM members 
      ORDER BY join_date DESC, created_at DESC
    `);
    
    res.json(members);
  } catch (error) {
    console.error('获取成员失败:', error);
    res.status(500).json({ error: '获取成员失败' });
  }
});

// 获取单个成员（公开）
router.get('/:id', async (req, res) => {
  try {
    const member = await get('SELECT * FROM members WHERE id = ?', [req.params.id]);
    
    if (!member) {
      return res.status(404).json({ error: '成员不存在' });
    }
    
    res.json(member);
  } catch (error) {
    console.error('获取成员失败:', error);
    res.status(500).json({ error: '获取成员失败' });
  }
});

// 创建成员（管理员）
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, role, description, join_date } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '成员名称不能为空' });
    }
    
    // 处理图片上传
    const avatar_url = await handleImageUpload(req, 'avatar');
    
    const result = await run(
      'INSERT INTO members (name, avatar_url, role, description, join_date) VALUES (?, ?, ?, ?, ?)',
      [name, avatar_url, role || null, description || null, join_date || null]
    );
    
    const newMember = await get('SELECT * FROM members WHERE id = ?', [result.id]);
    
    res.status(201).json({
      message: '成员添加成功',
      member: newMember
    });
  } catch (error) {
    console.error('添加成员失败:', error);
    res.status(500).json({ error: '添加成员失败' });
  }
});

// 更新成员（管理员）
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, role, description, join_date } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '成员名称不能为空' });
    }
    
    const member = await get('SELECT * FROM members WHERE id = ?', [req.params.id]);
    if (!member) {
      return res.status(404).json({ error: '成员不存在' });
    }
    
    let avatar_url = member.avatar_url;
    
    // 如果有新上传的图片
    if (req.files && req.files.avatar) {
      // 删除旧图片
      if (member.avatar_url) {
        const oldImagePath = process.env.RAILWAY_ENVIRONMENT
          ? path.join('/tmp', member.avatar_url)
          : path.join(__dirname, '..', member.avatar_url);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      // 上传新图片
      const newImageUrl = await handleImageUpload(req, 'avatar');
      avatar_url = newImageUrl;
    }
    
    await run(
      'UPDATE members SET name = ?, avatar_url = ?, role = ?, description = ?, join_date = ? WHERE id = ?',
      [name, avatar_url, role || null, description || null, join_date || null, req.params.id]
    );
    
    const updatedMember = await get('SELECT * FROM members WHERE id = ?', [req.params.id]);
    
    res.json({
      message: '成员更新成功',
      member: updatedMember
    });
  } catch (error) {
    console.error('更新成员失败:', error);
    res.status(500).json({ error: '更新成员失败' });
  }
});

// 删除成员（管理员）
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const member = await get('SELECT * FROM members WHERE id = ?', [req.params.id]);
    if (!member) {
      return res.status(404).json({ error: '成员不存在' });
    }
    
    // 删除图片文件
    if (member.avatar_url) {
      const imagePath = process.env.RAILWAY_ENVIRONMENT
        ? path.join('/tmp', member.avatar_url)
        : path.join(__dirname, '..', member.avatar_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    await run('DELETE FROM members WHERE id = ?', [req.params.id]);
    
    res.json({ message: '成员删除成功' });
  } catch (error) {
    console.error('删除成员失败:', error);
    res.status(500).json({ error: '删除成员失败' });
  }
});

module.exports = router;
