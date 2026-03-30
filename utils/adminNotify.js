/**
 * 管理员邮件通知工具
 * 在关键事件发生时发送邮件通知给管理员
 */

const { get, query } = require('../models/db');
const { sendAdminNotification } = require('../utils/email');

// 网站地址（用于生成链接）
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

/**
 * 获取所有管理员邮箱
 */
async function getAdminEmails() {
  const admins = await query('SELECT email, username FROM users WHERE role = ? AND email IS NOT NULL', ['admin']);
  return admins.map(a => a.email);
}

/**
 * 通知管理员：新用户注册
 */
async function notifyNewUser(username, email) {
  try {
    const emails = await getAdminEmails();
    if (emails.length === 0) return;

    for (const adminEmail of emails) {
      await sendAdminNotification(
        adminEmail,
        '新用户注册',
        `有新用户在赏金阁完成了注册。`,
        [
          { label: '用户名', value: username },
          { label: '邮箱', value: email },
          { label: '注册时间', value: new Date().toLocaleString('zh-CN') }
        ]
      );
    }
  } catch (error) {
    console.error('新用户注册邮件通知失败:', error);
  }
}

/**
 * 通知管理员：新整合包提交
 */
async function notifyNewModpack(modpackName, authorName) {
  try {
    const emails = await getAdminEmails();
    if (emails.length === 0) return;

    for (const adminEmail of emails) {
      await sendAdminNotification(
        adminEmail,
        '新整合包待审核',
        `有用户提交了新的整合包，等待审核。`,
        [
          { label: '整合包名称', value: modpackName },
          { label: '提交者', value: authorName },
          { label: '提交时间', value: new Date().toLocaleString('zh-CN') }
        ]
      );
    }
  } catch (error) {
    console.error('新整合包邮件通知失败:', error);
  }
}

/**
 * 通知管理员：新爆料文章
 */
async function notifyNewStory(title, authorName) {
  try {
    const emails = await getAdminEmails();
    if (emails.length === 0) return;

    for (const adminEmail of emails) {
      await sendAdminNotification(
        adminEmail,
        '新爆料文章',
        `有用户发表了新的爆料文章。`,
        [
          { label: '文章标题', value: title },
          { label: '作者', value: authorName },
          { label: '发布时间', value: new Date().toLocaleString('zh-CN') }
        ]
      );
    }
  } catch (error) {
    console.error('新爆料文章邮件通知失败:', error);
  }
}

/**
 * 通知管理员：新留言
 */
async function notifyNewMessage(content, username) {
  try {
    const emails = await getAdminEmails();
    if (emails.length === 0) return;

    const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;

    for (const adminEmail of emails) {
      await sendAdminNotification(
        adminEmail,
        '新留言',
        `有用户在留言板发表了新留言。`,
        [
          { label: '留言者', value: username },
          { label: '内容', value: preview },
          { label: '时间', value: new Date().toLocaleString('zh-CN') }
        ]
      );
    }
  } catch (error) {
    console.error('新留言邮件通知失败:', error);
  }
}

module.exports = {
  notifyNewUser,
  notifyNewModpack,
  notifyNewStory,
  notifyNewMessage
};
