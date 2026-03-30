const fs = require('fs');
const path = require('path');

// 违禁词列表
const PROFANITY_LIST = [
  // 政治敏感词
  '反动', '暴乱', '颠覆', '政权', '推翻', '造反', '革命',
  // 暴力恐怖
  '炸弹', '爆炸', '恐怖袭击', '杀人', '放火', '枪支', '弹药',
  // 色情低俗
  '色情', 'av', '三级', '黄片', '裸聊', '约炮', '卖淫', '嫖娼',
  // 诈骗违法
  '诈骗', '洗钱', '赌博', '毒品', '大麻', '冰毒', '贩毒',
  // 人身攻击
  '傻逼', '煞笔', 'sb', '草泥马', 'cnm', '你妈', '去死', '废物', '脑残',
  // 广告引流
  '加微信', '加我微信', '微信号码', 'QQ号', '加我QQ', '代刷', '代练'
];

// 图片内容检测（简化的基于文件名检测，实际应用中可以使用AI服务）
function checkImageContent(file) {
  const suspiciousPatterns = [
    /\b(nude|porn|sex|xxx|adult)\b/i,
    /\b(暴力|血腥|恐怖|尸体)\b/i
  ];
  
  const filename = file.name || '';
  const mimetype = file.mimetype || '';
  
  // 检查文件名
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(filename)) {
      return false;
    }
  }
  
  // 限制图片类型
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(mimetype)) {
    return false;
  }
  
  return true;
}

// 文本内容检测
function checkTextContent(text) {
  if (!text || typeof text !== 'string') {
    return { isValid: true, filteredText: text };
  }
  
  const lowerText = text.toLowerCase();
  
  // 检查是否包含违禁词
  for (const word of PROFANITY_LIST) {
    if (lowerText.includes(word.toLowerCase())) {
      return { 
        isValid: false, 
        filteredText: text,
        violation: word 
      };
    }
  }
  
  return { isValid: true, filteredText: text };
}

// 检测文本中间件
function detectProfanity(req, res, next) {
  try {
    // 检测请求中的文本字段
    const fieldsToCheck = ['title', 'content', 'comment', 'message', 'description', 'reply'];
    
    for (const field of fieldsToCheck) {
      if (req.body[field]) {
        const result = checkTextContent(req.body[field]);
        if (!result.isValid) {
          return res.status(400).json({ 
            error: `内容包含违禁词"${result.violation}"，请修改后重试`,
            violation: result.violation
          });
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('违禁词检测失败:', error);
    next(); // 即使检测失败也不阻止请求，避免影响用户体验
  }
}

// 检测图片中间件
function detectImageProfanity(req, res, next) {
  try {
    if (req.files && req.files.image) {
      const file = req.files.image;
      if (!checkImageContent(file)) {
        return res.status(400).json({ 
          error: '图片内容不符合规范或文件类型不支持' 
        });
      }
    }
    
    if (req.files) {
      // 检查所有上传的文件
      for (const key in req.files) {
        const file = req.files[key];
        if (Array.isArray(file)) {
          // 多个文件
          for (const f of file) {
            if (!checkImageContent(f)) {
              return res.status(400).json({ 
                error: '图片内容不符合规范或文件类型不支持' 
              });
            }
          }
        } else {
          // 单个文件
          if (!checkImageContent(file)) {
            return res.status(400).json({ 
              error: '图片内容不符合规范或文件类型不支持' 
            });
          }
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('图片检测失败:', error);
    next();
  }
}

module.exports = {
  detectProfanity,
  detectImageProfanity,
  checkTextContent,
  checkImageContent,
  PROFANITY_LIST
};