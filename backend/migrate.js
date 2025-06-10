const fs = require('fs');
const path = require('path');
const db = require('./db');

const jsonPath = path.join(__dirname, '..', 'data', 'productos.json');
const raw = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);

function insertarProducto(prod) {
  return new Promise((resolve, reject) => {
    const { marca, modelo, codigo, precioCompra, precioVenta, descripcion, clasificacion, departamento, imagen } = prod;
    const sql = `INSERT INTO products (marca, modelo, codigo, precio_compra, precio_venta, descripcion, clasificacion, departamento)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [marca, modelo, codigo, precioCompra, precioVenta, descripcion, clasificacion, departamento], function(err) {
      if (err) return reject(err);
      const id = this.lastID;
      const imagenes = prod.imagenes || (imagen ? [imagen] : []);
      const stmt = db.prepare('INSERT INTO product_images (product_id, image_url) VALUES (?, ?)');
      imagenes.forEach(img => stmt.run(id, img));
      stmt.finalize();
      resolve();
    });
  });
}

(async () => {
  for (const p of data.productos) {
    try {
      await insertarProducto(p);
    } catch (e) {
      console.error('Error insertando', p, e);
    }
  }
  console.log('Migracion completada');
  db.close();
})();
