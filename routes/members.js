const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, get, run } = require('../models/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'members');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'member-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 限制2MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件（jpg, png, gif, webp）'));
    }
  }
});

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
router.post('/', authenticateToken, requireAdmin, upload.single('avatar'), async (req, res) => {
  try {
    const { name, role, description, join_date } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '成员名称不能为空' });
    }
    
    const avatar_url = req.file ? `/uploads/members/${req.file.filename}` : null;
    
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
router.put('/:id', authenticateToken, requireAdmin, upload.single('avatar'), async (req, res) => {
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
    if (req.file) {
      // 删除旧图片
      if (member.avatar_url) {
        const oldImagePath = path.join(__dirname, '..', member.avatar_url);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      avatar_url = `/uploads/members/${req.file.filename}`;
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
      const imagePath = path.join(__dirname, '..', member.avatar_url);
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
