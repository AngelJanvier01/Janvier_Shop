const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const PUBLIC_FILES = ['index.html', 'catalogo.html', 'contacto.html', 'admin.html', 'footer.html'];

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.json());
app.use('/images', express.static(path.join(ROOT_DIR, 'images')));
app.use('/styles', express.static(path.join(ROOT_DIR, 'styles')));
app.use('/scripts', express.static(path.join(ROOT_DIR, 'scripts')));
app.use('/data', express.static(path.join(ROOT_DIR, 'data')));
app.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

function normalizarTexto(valor) {
    if (valor === null || valor === undefined) {
        return '';
    }
    return String(valor).trim();
}

function normalizarPrecio(valor, requerido = false) {
    if (valor === '' || valor === null || valor === undefined) {
        return requerido ? Number.NaN : null;
    }
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : Number.NaN;
}

function normalizarImagenes(imagenes) {
    if (!Array.isArray(imagenes)) {
        return [];
    }
    return imagenes
        .map((img) => normalizarTexto(img))
        .filter(Boolean);
}

function validarPayloadProducto(payload) {
    const producto = {
        marca: normalizarTexto(payload.marca),
        modelo: normalizarTexto(payload.modelo),
        codigo: normalizarTexto(payload.codigo),
        precioCompra: normalizarPrecio(payload.precioCompra),
        precioVenta: normalizarPrecio(payload.precioVenta, true),
        descripcion: normalizarTexto(payload.descripcion),
        clasificacion: normalizarTexto(payload.clasificacion),
        departamento: normalizarTexto(payload.departamento),
        imagenes: normalizarImagenes(payload.imagenes)
    };

    const errores = [];
    if (!producto.marca) errores.push('marca');
    if (!producto.modelo) errores.push('modelo');
    if (!producto.clasificacion) errores.push('clasificacion');
    if (!producto.departamento) errores.push('departamento');

    if (Number.isNaN(producto.precioVenta) || producto.precioVenta < 0) {
        errores.push('precioVenta');
    }
    if (Number.isNaN(producto.precioCompra) || producto.precioCompra < 0) {
        errores.push('precioCompra');
    }

    return { producto, errores };
}

function insertarImagenes(productId, imagenes, callback) {
    if (!imagenes.length) {
        callback();
        return;
    }

    const stmt = db.prepare('INSERT INTO product_images (product_id, image_url) VALUES (?, ?)');
    let pending = imagenes.length;
    let finalizado = false;

    function finalizar(err) {
        if (finalizado) {
            return;
        }
        finalizado = true;
        stmt.finalize(() => callback(err));
    }

    imagenes.forEach((img) => {
        stmt.run(productId, img, (err) => {
            if (err) {
                finalizar(err);
                return;
            }
            pending -= 1;
            if (pending === 0) {
                finalizar();
            }
        });
    });
}

app.get('/api/productos', (req, res) => {
    const query = `SELECT p.*, GROUP_CONCAT(i.image_url) AS images
                   FROM products p
                   LEFT JOIN product_images i ON p.id = i.product_id
                   GROUP BY p.id
                   ORDER BY p.id DESC`;

    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'No fue posible consultar los productos.' });
            return;
        }

        const productos = rows.map((row) => ({
            id: row.id,
            marca: row.marca,
            modelo: row.modelo,
            codigo: row.codigo,
            precioCompra: row.precio_compra,
            precioVenta: row.precio_venta,
            descripcion: row.descripcion,
            clasificacion: row.clasificacion,
            departamento: row.departamento,
            imagenes: row.images ? row.images.split(',').map((img) => img.trim()).filter(Boolean) : []
        }));

        res.json({ productos });
    });
});

app.post('/api/productos', (req, res) => {
    const { producto, errores } = validarPayloadProducto(req.body || {});
    if (errores.length) {
        res.status(400).json({ error: 'Datos inválidos', campos: errores });
        return;
    }

    const sql = `INSERT INTO products (
                    marca, modelo, codigo, precio_compra, precio_venta, descripcion, clasificacion, departamento
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(
        sql,
        [
            producto.marca,
            producto.modelo,
            producto.codigo,
            producto.precioCompra,
            producto.precioVenta,
            producto.descripcion,
            producto.clasificacion,
            producto.departamento
        ],
        function onInsert(err) {
            if (err) {
                res.status(500).json({ error: 'No fue posible crear el producto.' });
                return;
            }

            const productId = this.lastID;
            insertarImagenes(productId, producto.imagenes, (insertErr) => {
                if (insertErr) {
                    res.status(500).json({ error: 'Producto creado, pero hubo un error al guardar imágenes.' });
                    return;
                }
                res.status(201).json({ id: productId });
            });
        }
    );
});

app.put('/api/productos/:id', (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
        res.status(400).json({ error: 'ID de producto inválido.' });
        return;
    }

    const { producto, errores } = validarPayloadProducto(req.body || {});
    if (errores.length) {
        res.status(400).json({ error: 'Datos inválidos', campos: errores });
        return;
    }

    const sql = `UPDATE products
                 SET marca = ?, modelo = ?, codigo = ?, precio_compra = ?, precio_venta = ?, descripcion = ?, clasificacion = ?, departamento = ?
                 WHERE id = ?`;

    db.run(
        sql,
        [
            producto.marca,
            producto.modelo,
            producto.codigo,
            producto.precioCompra,
            producto.precioVenta,
            producto.descripcion,
            producto.clasificacion,
            producto.departamento,
            productId
        ],
        function onUpdate(err) {
            if (err) {
                res.status(500).json({ error: 'No fue posible actualizar el producto.' });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Producto no encontrado.' });
                return;
            }

            db.run('DELETE FROM product_images WHERE product_id = ?', [productId], (deleteErr) => {
                if (deleteErr) {
                    res.status(500).json({ error: 'No fue posible actualizar las imágenes del producto.' });
                    return;
                }

                insertarImagenes(productId, producto.imagenes, (insertErr) => {
                    if (insertErr) {
                        res.status(500).json({ error: 'Producto actualizado, pero hubo un error al guardar imágenes.' });
                        return;
                    }
                    res.json({ updated: true });
                });
            });
        }
    );
});

app.delete('/api/productos/:id', (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
        res.status(400).json({ error: 'ID de producto inválido.' });
        return;
    }

    db.run('DELETE FROM product_images WHERE product_id = ?', [productId], (imagesErr) => {
        if (imagesErr) {
            res.status(500).json({ error: 'No fue posible eliminar imágenes del producto.' });
            return;
        }

        db.run('DELETE FROM products WHERE id = ?', [productId], function onDelete(err) {
            if (err) {
                res.status(500).json({ error: 'No fue posible eliminar el producto.' });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Producto no encontrado.' });
                return;
            }
            res.json({ deleted: true });
        });
    });
});

app.post('/api/productos/:id/images', upload.array('imagenes'), (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
        res.status(400).json({ error: 'ID de producto inválido.' });
        return;
    }

    const imagenes = Array.isArray(req.files)
        ? req.files.map((file) => `/uploads/${file.filename}`)
        : [];

    if (!imagenes.length) {
        res.status(400).json({ error: 'No se recibieron imágenes.' });
        return;
    }

    insertarImagenes(productId, imagenes, (err) => {
        if (err) {
            res.status(500).json({ error: 'No fue posible guardar las imágenes.' });
            return;
        }
        res.json({ uploaded: imagenes.length });
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

PUBLIC_FILES.forEach((file) => {
    app.get(`/${file}`, (req, res) => {
        res.sendFile(path.join(ROOT_DIR, file));
    });
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        res.status(400).json({ error: 'Error al subir archivo.', detalle: err.message });
        return;
    }
    if (err) {
        res.status(500).json({ error: 'Error interno del servidor.' });
        return;
    }
    next();
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
