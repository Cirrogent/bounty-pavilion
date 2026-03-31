const express = require('express');
const path = require('path');
const fs = require('fs');
const { query, get, run } = require('../models/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { notifyNewModpack } = require('../utils/adminNotify');

const router = express.Router();

// 配置文件上传目录
const getUploadDir = () => {
  return process.env.RAILWAY_ENVIRONMENT ? '/tmp/uploads/modpacks' : path.join(__dirname, '..', 'uploads', 'modpacks');
};

// 文件上传处理函数
const handleImageUpload = (req, fileField = 'image') => {
  return new Promise((resolve, reject) => {
    if (!req.files || !req.files[fileField]) {
      return resolve(null);
    }
    
    const file = req.files[fileField];
    const uploadDir = getUploadDir();
    
    // 确保上传目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // 检查文件类型
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.name).toLowerCase();
    
    if (!allowedTypes.includes(ext)) {
      return reject(new Error('只支持jpg、png、gif、webp格式'));
    }
    
    // 检查文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      return reject(new Error('图片不能超过5MB'));
    }
    
    // 生成文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'modpack-' + uniqueSuffix + ext;
    const filepath = path.join(uploadDir, filename);
    
    // 移动文件
    file.mv(filepath, (err) => {
      if (err) {
        return reject(err);
      }
      const imageUrl = `/uploads/modpacks/${filename}`;
      resolve(imageUrl);
    });
  });
};

// 获取所有整合包（公开）- 只显示已发布的，支持分页
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    const modpacks = await query(`
      SELECT m.*, u.username as author_name 
      FROM modpacks m 
      LEFT JOIN users u ON m.author_id = u.id 
      WHERE m.status = 'published'
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const countResult = await query(`SELECT COUNT(*) as total FROM modpacks WHERE status = 'published'`);
    const total = countResult[0].total;

    res.json({
      modpacks,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('获取整合包失败:', error);
    res.status(500).json({ error: '获取整合包失败' });
  }
});

// 获取单个整合包（公开）
router.get('/:id', async (req, res) => {
  try {
    const modpack = await get(`
      SELECT m.*, u.username as author_name 
      FROM modpacks m 
      LEFT JOIN users u ON m.author_id = u.id 
      WHERE m.id = ?
    `, [req.params.id]);
    
    if (!modpack) {
      return res.status(404).json({ error: '整合包不存在' });
    }
    
    // 增加浏览量
    await run('UPDATE modpacks SET views = views + 1 WHERE id = ?', [req.params.id]);
    
    res.json(modpack);
  } catch (error) {
    console.error('获取整合包失败:', error);
    res.status(500).json({ error: '获取整合包失败' });
  }
});

// 创建整合包（管理员）
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, download_link } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: '请填写完整的整合包信息' });
    }
    
    // 处理图片上传
    const image_url = await handleImageUpload(req, 'image');
    
    const result = await run(
      'INSERT INTO modpacks (name, description, image_url, download_link, author_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description, image_url, download_link, req.user.id, 'published']
    );
    
    const newModpack = await get('SELECT * FROM modpacks WHERE id = ?', [result.id]);
    
    res.status(201).json({
      message: '整合包创建成功',
      modpack: newModpack
    });
  } catch (error) {
    console.error('创建整合包失败:', error);
    res.status(500).json({ error: '创建整合包失败' });
  }
});

// 提交待审核整合包（普通用户）
router.post('/pending', authenticateToken, async (req, res) => {
  try {
    const { name, description, download_link } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: '请填写完整的整合包信息' });
    }
    
    // 处理图片上传
    const image_url = await handleImageUpload(req, 'image');
    
    const result = await run(
      'INSERT INTO modpacks (name, description, image_url, download_link, author_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description, image_url, download_link, req.user.id, 'pending']
    );
    
    const newModpack = await get('SELECT * FROM modpacks WHERE id = ?', [result.id]);
    
    // 通知管理员有新整合包待审核
    notifyNewModpack(name, req.user.username).catch(() => {});
    
    res.status(201).json({
      message: '整合包已提交，等待管理员审核',
      modpack: newModpack
    });
  } catch (error) {
    console.error('提交整合包失败:', error);
    res.status(500).json({ error: '提交整合包失败' });
  }
});

// 更新整合包（管理员）
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, download_link } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: '请填写完整的整合包信息' });
    }
    
    const modpack = await get('SELECT * FROM modpacks WHERE id = ?', [req.params.id]);
    if (!modpack) {
      return res.status(404).json({ error: '整合包不存在' });
    }
    
    let image_url = modpack.image_url;
    
    // 如果有新上传的图片
    if (req.files && req.files.image) {
      // 删除旧图片
      if (modpack.image_url) {
        const oldImagePath = process.env.RAILWAY_ENVIRONMENT
          ? path.join('/tmp', modpack.image_url)
          : path.join(__dirname, '..', modpack.image_url);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      // 处理新图片上传
      const newImageUrl = await handleImageUpload(req, 'image');
      image_url = newImageUrl;
    }
    
    await run(
      'UPDATE modpacks SET name = ?, description = ?, image_url = ?, download_link = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, image_url, download_link, req.params.id]
    );
    
    const updatedModpack = await get('SELECT * FROM modpacks WHERE id = ?', [req.params.id]);
    
    res.json({
      message: '整合包更新成功',
      modpack: updatedModpack
    });
  } catch (error) {
    console.error('更新整合包失败:', error);
    res.status(500).json({ error: '更新整合包失败' });
  }
});

// 删除整合包（管理员）
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const modpack = await get('SELECT * FROM modpacks WHERE id = ?', [req.params.id]);
    if (!modpack) {
      return res.status(404).json({ error: '整合包不存在' });
    }
    
    // 删除图片文件
    if (modpack.image_url) {
      const imagePath = process.env.RAILWAY_ENVIRONMENT
        ? path.join('/tmp', modpack.image_url)
        : path.join(__dirname, '..', modpack.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    await run('DELETE FROM modpacks WHERE id = ?', [req.params.id]);
    
    res.json({ message: '整合包删除成功' });
  } catch (error) {
    console.error('删除整合包失败:', error);
    res.status(500).json({ error: '删除整合包失败' });
  }
});

// 下载整合包（公开，但需要记录下载量）
router.post('/:id/download', async (req, res) => {
  try {
    const modpack = await get('SELECT * FROM modpacks WHERE id = ?', [req.params.id]);
    if (!modpack) {
      return res.status(404).json({ error: '整合包不存在' });
    }
    
    if (!modpack.download_link) {
      return res.status(400).json({ error: '该整合包暂无下载链接' });
    }
    
    // 增加下载量
    await run('UPDATE modpacks SET downloads = downloads + 1 WHERE id = ?', [req.params.id]);
    
    res.json({ download_link: modpack.download_link });
  } catch (error) {
    console.error('处理下载请求失败:', error);
    res.status(500).json({ error: '处理下载请求失败' });
  }
});

// 提交修改申请（普通用户）
router.post('/:id/request', authenticateToken, async (req, res) => {
  try {
    const { type, data } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({ error: '请提供完整的修改信息' });
    }
    
    const modpack = await get('SELECT * FROM modpacks WHERE id = ?', [req.params.id]);
    if (!modpack) {
      return res.status(404).json({ error: '整合包不存在' });
    }
    
    const result = await run(
      'INSERT INTO modpack_requests (modpack_id, user_id, type, data) VALUES (?, ?, ?, ?)',
      [req.params.id, req.user.id, type, JSON.stringify(data)]
    );
    
    res.status(201).json({
      message: '修改申请已提交，等待管理员审核',
      requestId: result.id
    });
  } catch (error) {
    console.error('提交修改申请失败:', error);
    res.status(500).json({ error: '提交修改申请失败' });
  }
});

// 获取修改申请（管理员）
router.get('/requests/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const requests = await query(`
      SELECT mr.*, m.name as modpack_name, u.username as requester_name
      FROM modpack_requests mr
      JOIN modpacks m ON mr.modpack_id = m.id
      JOIN users u ON mr.user_id = u.id
      WHERE mr.status = 'pending'
      ORDER BY mr.created_at DESC
    `);
    
    res.json(requests);
  } catch (error) {
    console.error('获取修改申请失败:', error);
    res.status(500).json({ error: '获取修改申请失败' });
  }
});

// 处理修改申请（管理员）
router.post('/requests/:requestId/:action', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { requestId, action } = req.params;
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: '无效的操作' });
    }
    
    const request = await get('SELECT * FROM modpack_requests WHERE id = ?', [requestId]);
    if (!request) {
      return res.status(404).json({ error: '申请不存在' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ error: '该申请已处理过' });
    }
    
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    await run(
      'UPDATE modpack_requests SET status = ? WHERE id = ?',
      [newStatus, requestId]
    );
    
    // 如果批准，应用修改
    if (action === 'approve') {
      const modpackData = JSON.parse(request.data);
      await run(
        'UPDATE modpacks SET name = ?, description = ?, download_link = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [modpackData.name, modpackData.description, modpackData.download_link, request.modpack_id]
      );
    }
    
    res.json({
      message: action === 'approve' ? '申请已批准，修改已应用' : '申请已拒绝'
    });
  } catch (error) {
    console.error('处理修改申请失败:', error);
    res.status(500).json({ error: '处理修改申请失败' });
  }
});

module.exports = router;
