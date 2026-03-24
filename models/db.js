const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'bounty-pavilion.db');
const db = new sqlite3.Database(dbPath);

// 初始化数据库表
function init() {
  db.serialize(() => {
    // 用户表
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      avatar VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 整合包表
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

    // 成员表
    db.run(`CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(50) NOT NULL,
      avatar_url VARCHAR(255),
      role VARCHAR(50),
      description TEXT,
      join_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 留言表
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      parent_id INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (parent_id) REFERENCES messages(id)
    )`);

    // 修改申请表（普通用户提交修改申请）
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

    // 创建默认管理员账户
    createDefaultAdmin();
  });
}

// 创建默认管理员
async function createDefaultAdmin() {
  const adminUsername = 'admin';
  const adminPassword = 'admin123';
  const adminEmail = 'admin@bountypavilion.com';

  db.get('SELECT * FROM users WHERE username = ?', [adminUsername], async (err, row) => {
    if (!row) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      db.run(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [adminUsername, adminEmail, hashedPassword, 'admin'],
        (err) => {
          if (err) {
            console.error('创建默认管理员失败:', err);
          } else {
            console.log('✅ 默认管理员账户创建成功！');
            console.log(`用户名: ${adminUsername}`);
            console.log(`密码: ${adminPassword}`);
            console.log('⚠️  请登录后立即修改默认密码！');
          }
        }
      );
    }
  });
}

// 查询方法
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

module.exports = {
  db,
  init,
  query,
  get,
  run
};
