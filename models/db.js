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
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (modpack_id) REFERENCES modpacks(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

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
