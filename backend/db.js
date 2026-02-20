const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbFile = path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbFile);

db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        marca TEXT,
        modelo TEXT,
        codigo TEXT,
        precio_compra REAL,
        precio_venta REAL,
        descripcion TEXT,
        clasificacion TEXT,
        departamento TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS product_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        image_url TEXT,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES admin_users(id) ON DELETE CASCADE
    )`);

    db.run('CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at)');

    db.run(`CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    )`);
});

module.exports = db;
