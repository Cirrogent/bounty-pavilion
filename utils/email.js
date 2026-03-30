const nodemailer = require('nodemailer');

// 邮件配置
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.qq.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT) || 465;
const SMTP_SECURE = process.env.SMTP_SECURE !== 'false'; // 默认 true (SSL)
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

let transporter = null;

// 初始化邮件 transporter
function initTransporter() {
  if (!SMTP_USER || !SMTP_PASS) {
    console.log('⚠️  邮件服务未配置（缺少 SMTP_USER 或 SMTP_PASS），将使用控制台模式');
    return false;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  return true;
}

// 通用邮件发送
async function sendEmail({ to, subject, html }) {
  if (!transporter) {
    // 降级为控制台输出
    console.log('📧 ============ 邮件（控制台模式） ============');
    console.log(`📧 收件人: ${to}`);
    console.log(`📧 主题: ${subject}`);
    console.log(`📧 内容预览: ${html.substring(0, 200)}...`);
    console.log('📧 ============================================');
    return { success: true, mode: 'console' };
  }

  try {
    const info = await transporter.sendMail({
      from: `"赏金阁" <${EMAIL_FROM}>`,
      to,
      subject,
      html
    });
    console.log(`✅ 邮件已发送至 ${to}: ${info.messageId}`);
    return { success: true, mode: 'smtp', messageId: info.messageId };
  } catch (error) {
    console.error(`❌ 邮件发送失败 (${to}):`, error.message);
    return { success: false, error: error.message };
  }
}

// 验证码邮件模板
function verificationCodeTemplate(code, username) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; background: #1a1a2e; font-family: 'Microsoft YaHei', sans-serif; }
        .container { max-width: 500px; margin: 40px auto; background: #16213e; border-radius: 12px; overflow: hidden; border: 1px solid #0f3460; }
        .header { background: linear-gradient(135deg, #0f3460, #533483); padding: 30px; text-align: center; }
        .header h1 { color: #e94560; margin: 0; font-size: 24px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .header p { color: #a8a8b3; margin: 8px 0 0; font-size: 14px; }
        .content { padding: 30px; text-align: center; }
        .content p { color: #c4c4d4; font-size: 15px; line-height: 1.8; }
        .code-box { display: inline-block; background: #0f3460; border: 2px dashed #e94560; border-radius: 8px; padding: 16px 40px; margin: 20px 0; }
        .code { font-size: 36px; font-weight: bold; color: #e94560; letter-spacing: 8px; font-family: 'Courier New', monospace; }
        .footer { padding: 20px 30px; text-align: center; border-top: 1px solid #0f3460; }
        .footer p { color: #666; font-size: 12px; margin: 4px 0; }
        .footer a { color: #e94560; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚔️ 赏金阁</h1>
          <p>Minecraft 整合包分享平台</p>
        </div>
        <div class="content">
          <p>${username ? `你好，<strong>${username}</strong>！` : '你好！'}</p>
          <p>你正在注册赏金阁账户，请在 3 分钟内输入以下验证码完成验证：</p>
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          <p style="font-size: 12px; color: #888;">如果这不是你的操作，请忽略此邮件。</p>
        </div>
        <div class="footer">
          <p>此邮件由系统自动发送，请勿直接回复。</p>
          <p>© 2026 赏金阁 Bounty Pavilion</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// 密码重置邮件模板
function passwordResetTemplate(code, username) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; background: #1a1a2e; font-family: 'Microsoft YaHei', sans-serif; }
        .container { max-width: 500px; margin: 40px auto; background: #16213e; border-radius: 12px; overflow: hidden; border: 1px solid #0f3460; }
        .header { background: linear-gradient(135deg, #0f3460, #533483); padding: 30px; text-align: center; }
        .header h1 { color: #e94560; margin: 0; font-size: 24px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .header p { color: #a8a8b3; margin: 8px 0 0; font-size: 14px; }
        .content { padding: 30px; text-align: center; }
        .content p { color: #c4c4d4; font-size: 15px; line-height: 1.8; }
        .code-box { display: inline-block; background: #0f3460; border: 2px dashed #f0a500; border-radius: 8px; padding: 16px 40px; margin: 20px 0; }
        .code { font-size: 36px; font-weight: bold; color: #f0a500; letter-spacing: 8px; font-family: 'Courier New', monospace; }
        .warning { background: rgba(233,69,96,0.1); border-left: 3px solid #e94560; padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0; }
        .warning p { color: #e94560; font-size: 13px; margin: 0; }
        .footer { padding: 20px 30px; text-align: center; border-top: 1px solid #0f3460; }
        .footer p { color: #666; font-size: 12px; margin: 4px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚔️ 赏金阁</h1>
          <p>密码重置请求</p>
        </div>
        <div class="content">
          <p>${username ? `<strong>${username}</strong>，` : ''}我们收到了你的密码重置请求。</p>
          <p>请在 3 分钟内输入以下验证码来重置密码：</p>
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          <div class="warning">
            <p>⚠️ 如果你没有发起此请求，请忽略此邮件，你的密码不会被更改。</p>
          </div>
        </div>
        <div class="footer">
          <p>此邮件由系统自动发送，请勿直接回复。</p>
          <p>© 2026 赏金阁 Bounty Pavilion</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// 管理员通知邮件模板
function adminNotificationTemplate(title, content, items) {
  const itemsHtml = items ? items.map(item => `
    <tr>
      <td style="padding: 10px 16px; border-bottom: 1px solid #0f3460; color: #c4c4d4;">${item.label}</td>
      <td style="padding: 10px 16px; border-bottom: 1px solid #0f3460; color: #e94560; font-weight: bold;">${item.value}</td>
    </tr>
  `).join('') : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; background: #1a1a2e; font-family: 'Microsoft YaHei', sans-serif; }
        .container { max-width: 500px; margin: 40px auto; background: #16213e; border-radius: 12px; overflow: hidden; border: 1px solid #0f3460; }
        .header { background: linear-gradient(135deg, #0f3460, #533483); padding: 30px; text-align: center; }
        .header h1 { color: #e94560; margin: 0; font-size: 22px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .header p { color: #a8a8b3; margin: 8px 0 0; font-size: 14px; }
        .content { padding: 30px; }
        .content p { color: #c4c4d4; font-size: 15px; line-height: 1.8; }
        .detail-table { width: 100%; border-collapse: collapse; margin: 16px 0; background: #0f3460; border-radius: 8px; overflow: hidden; }
        .btn { display: inline-block; background: #e94560; color: #fff; padding: 10px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 16px; }
        .footer { padding: 20px 30px; text-align: center; border-top: 1px solid #0f3460; }
        .footer p { color: #666; font-size: 12px; margin: 4px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 ${title}</h1>
          <p>赏金阁管理通知</p>
        </div>
        <div class="content">
          <p>${content}</p>
          ${itemsHtml ? `
          <table class="detail-table">
            <tbody>${itemsHtml}</tbody>
          </table>` : ''}
          <p style="color: #888; font-size: 13px; margin-top: 20px;">时间：${new Date().toLocaleString('zh-CN')}</p>
        </div>
        <div class="footer">
          <p>此邮件由赏金阁系统自动发送</p>
          <p>© 2026 赏金阁 Bounty Pavilion</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// 快捷方法
async function sendVerificationCode(to, code, username) {
  return sendEmail({
    to,
    subject: '【赏金阁】注册验证码',
    html: verificationCodeTemplate(code, username)
  });
}

async function sendPasswordResetCode(to, code, username) {
  return sendEmail({
    to,
    subject: '【赏金阁】密码重置验证码',
    html: passwordResetTemplate(code, username)
  });
}

async function sendAdminNotification(to, title, content, items) {
  return sendEmail({
    to,
    subject: `【赏金阁管理】${title}`,
    html: adminNotificationTemplate(title, content, items)
  });
}

module.exports = {
  initTransporter,
  sendEmail,
  sendVerificationCode,
  sendPasswordResetCode,
  sendAdminNotification
};
