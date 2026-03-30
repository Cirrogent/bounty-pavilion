const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// 数据库路径：Railway上使用/tmp持久化目录，本地使用项目根目录
const dataDir = process.env.RAILWAY_ENVIRONMENT ? '/tmp/data' : path.join(__dirname, '..');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'bounty-pavilion.db');
console.log(`📁 数据库路径: ${dbPath}`);

let db = null;

// 初始化数据库
async function init() {
  const SQL = await initSqlJs();

  // 加载或创建数据库
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
    console.log('✅ 数据库加载成功');
  } else {
    db = new SQL.Database();
    console.log('✅ 新数据库创建成功');
  }

  // 创建表
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    avatar VARCHAR(255),
    avatar_required BOOLEAN DEFAULT 0,
    email_verified BOOLEAN DEFAULT 0,
    verification_code VARCHAR(10),
    banned_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS modpacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    image_url VARCHAR(255),
    download_link VARCHAR(255),
    author_id INTEGER,
    status VARCHAR(20) DEFAULT 'published',
    views INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,
    avatar_url VARCHAR(255),
    role VARCHAR(50),
    description TEXT,
    join_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES messages(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS modpack_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modpack_id INTEGER,
    user_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,
    data TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (modpack_id) REFERENCES modpacks(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS modpack_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modpack_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (modpack_id) REFERENCES modpacks(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES modpack_comments(id)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_modpack_comments_parent ON modpack_comments(parent_id)`);

  db.run(`CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(255),
    author_id INTEGER NOT NULL,
    category VARCHAR(20) DEFAULT 'gossip',
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    heat INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'published',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);
  
  // 更新已有文章的热度字段（兼容旧数据库）
  try { db.run(`ALTER TABLE stories ADD COLUMN heat INTEGER DEFAULT 0`); } catch(e) {}
  
  // 创建触发器：评论时增加热度（+1）
  try {
    db.run(`CREATE TRIGGER IF NOT EXISTS update_story_heat_on_comment
    AFTER INSERT ON story_comments
    FOR EACH ROW
    BEGIN
      UPDATE stories SET heat = heat + 1 WHERE id = NEW.story_id;
    END`);
  } catch(e) { console.log('评论触发器已存在或创建失败:', e.message); }
  
  // 创建触发器：点赞时增加热度（+2）
  try {
    db.run(`CREATE TRIGGER IF NOT EXISTS update_story_heat_on_like
    AFTER UPDATE ON stories
    FOR EACH ROW
    WHEN NEW.likes > OLD.likes
    BEGIN
      UPDATE stories SET heat = heat + 2 WHERE id = NEW.id;
    END`);
  } catch(e) { console.log('点赞触发器已存在或创建失败:', e.message); }

  db.run(`CREATE TABLE IF NOT EXISTS story_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES stories(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES story_comments(id)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_story_comments_parent ON story_comments(parent_id)`);

  db.run(`CREATE TABLE IF NOT EXISTS temp_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(100) UNIQUE NOT NULL,
    verification_code VARCHAR(10) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    related_id INTEGER,
    related_type VARCHAR(20),
    sender_id INTEGER,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)`);

  // 珍宝阁 - 相册表
  db.run(`CREATE TABLE IF NOT EXISTS gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    image_url VARCHAR(255),
    file_type VARCHAR(10) DEFAULT 'image',
    uploader_id INTEGER NOT NULL,
    uploader_name VARCHAR(50),
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'published',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploader_id) REFERENCES users(id)
  )`);

  // 珍宝阁 - 评论表
  db.run(`CREATE TABLE IF NOT EXISTS gallery_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gallery_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gallery_id) REFERENCES gallery(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES gallery_comments(id)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_gallery_comments_parent ON gallery_comments(parent_id)`);

  // 珍宝阁 - 上传申请表
  db.run(`CREATE TABLE IF NOT EXISTS gallery_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    image_url VARCHAR(255),
    file_type VARCHAR(10) DEFAULT 'image',
    status VARCHAR(20) DEFAULT 'pending',
    reject_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // 兼容旧数据库：确保字段存在
  try { db.run(`ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN verification_code VARCHAR(10)`); } catch(e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN avatar VARCHAR(255)`); } catch(e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN banned_until DATETIME`); } catch(e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN display_name VARCHAR(50)`); } catch(e) {}
  try { db.run(`ALTER TABLE notifications ADD COLUMN sender_id INTEGER`); } catch(e) {}

  // 保存数据库到文件
  saveDb();

  // 创建默认管理员
  await createDefaultAdmin();
}

// 保存数据库到文件
function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// 创建默认管理员
async function createDefaultAdmin() {
  const adminUsername = 'admin';
  const adminPassword = 'admin123';
  const adminEmail = 'admin@bountypavilion.com';

  const result = query('SELECT * FROM users WHERE username = ?', [adminUsername]);
  if (result.length === 0) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [adminUsername, adminEmail, hashedPassword, 'admin']
    );
    console.log('✅ 默认管理员账户创建成功！');
    console.log(`用户名: ${adminUsername}`);
    console.log(`密码: ${adminPassword}`);
    console.log('⚠️  请登录后立即修改默认密码！');
  }
}

// 查询方法 - 返回行数组
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// 获取单行
function get(sql, params = []) {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// 执行写入操作
function run(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastId = query("SELECT last_insert_rowid() as id")[0].id;
  saveDb(); // 每次写入后保存
  return { id: lastId, changes };
}

module.exports = {
  db,
  init,
  query,
  get,
  run
};
