const express = require('express');
const path = require('path');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Configuracion de Multer para subir imagenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Obtener todos los productos con sus imagenes
app.get('/api/productos', (req, res) => {
  const query = `SELECT p.*, GROUP_CONCAT(i.image_url) AS images
                 FROM products p
                 LEFT JOIN product_images i ON p.id = i.product_id
                 GROUP BY p.id`;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const productos = rows.map(r => ({
      id: r.id,
      marca: r.marca,
      modelo: r.modelo,
      codigo: r.codigo,
      precioCompra: r.precio_compra,
      precioVenta: r.precio_venta,
      descripcion: r.descripcion,
      clasificacion: r.clasificacion,
      departamento: r.departamento,
      imagenes: r.images ? r.images.split(',') : []
    }));
    res.json({ productos });
  });
});

// Crear un nuevo producto
app.post('/api/productos', (req, res) => {
  const { marca, modelo, codigo, precioCompra, precioVenta, descripcion, clasificacion, departamento, imagenes = [] } = req.body;
  const sql = `INSERT INTO products (marca, modelo, codigo, precio_compra, precio_venta, descripcion, clasificacion, departamento)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [marca, modelo, codigo, precioCompra, precioVenta, descripcion, clasificacion, departamento], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const productId = this.lastID;
    const stmt = db.prepare('INSERT INTO product_images (product_id, image_url) VALUES (?, ?)');
    imagenes.forEach(img => stmt.run(productId, img));
    stmt.finalize();
    res.json({ id: productId });
  });
});

// Actualizar producto
app.put('/api/productos/:id', (req, res) => {
  const { marca, modelo, codigo, precioCompra, precioVenta, descripcion, clasificacion, departamento, imagenes = [] } = req.body;
  const sql = `UPDATE products SET marca=?, modelo=?, codigo=?, precio_compra=?, precio_venta=?, descripcion=?, clasificacion=?, departamento=? WHERE id=?`;
  db.run(sql, [marca, modelo, codigo, precioCompra, precioVenta, descripcion, clasificacion, departamento, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.run('DELETE FROM product_images WHERE product_id=?', [req.params.id], err2 => {
      if (err2) return res.status(500).json({ error: err2.message });
      const stmt = db.prepare('INSERT INTO product_images (product_id, image_url) VALUES (?, ?)');
      imagenes.forEach(img => stmt.run(req.params.id, img));
      stmt.finalize();
      res.json({ updated: true });
    });
  });
});

// Eliminar producto
app.delete('/api/productos/:id', (req, res) => {
  db.run('DELETE FROM products WHERE id=?', [req.params.id], err => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('DELETE FROM product_images WHERE product_id=?', [req.params.id]);
    res.json({ deleted: true });
  });
});

// Subir nuevas imagenes
app.post('/api/productos/:id/images', upload.array('imagenes'), (req, res) => {
  const productId = req.params.id;
  const stmt = db.prepare('INSERT INTO product_images (product_id, image_url) VALUES (?, ?)');
  req.files.forEach(f => stmt.run(productId, '/uploads/' + f.filename));
  stmt.finalize();
  res.json({ uploaded: req.files.length });
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
