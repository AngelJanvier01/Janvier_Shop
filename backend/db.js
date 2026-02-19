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
});

module.exports = db;
