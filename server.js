import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'exclusive_shop_jwt_secret_neon_2026';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL variable is not set.");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(cors());
app.use(express.json());

// Initialize Database Schema & Seed Data
async function initDB() {
  const client = await pool.connect();
  try {
    console.log("Connecting to Neon PostgreSQL...");

    // Create Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL UNIQUE,
        slug VARCHAR(120) NOT NULL UNIQUE,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        description TEXT NOT NULL,
        brand VARCHAR(100),
        sku VARCHAR(100),
        regular_price NUMERIC(10, 2) NOT NULL,
        sale_price NUMERIC(10, 2),
        cost_price NUMERIC(10, 2),
        category_id INT REFERENCES categories(id) ON DELETE SET NULL,
        image TEXT,
        stock INT NOT NULL DEFAULT 0,
        min_stock INT NOT NULL DEFAULT 0,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(150) NOT NULL,
        customer_email VARCHAR(150) NOT NULL,
        customer_phone VARCHAR(50),
        delivery_method VARCHAR(50),
        address TEXT,
        payment_method VARCHAR(50),
        items JSONB NOT NULL,
        subtotal NUMERIC(10, 2) NOT NULL,
        shipping_cost NUMERIC(10, 2) DEFAULT 0,
        total NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pendiente',
        payment_status VARCHAR(50) DEFAULT 'pendiente',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed Admin User if not existing
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@exclusiveshop.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

    const userCheck = await client.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
    if (userCheck.rows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      await client.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
        [adminEmail, hashedPassword, 'admin']
      );
      console.log(`[SEED] Created default admin user: ${adminEmail}`);
    }

    // Seed Default Categories if empty
    const catCheck = await client.query('SELECT COUNT(*) FROM categories');
    if (parseInt(catCheck.rows[0].count, 10) === 0) {
      const defaultCategories = [
        { name: 'Perfumes', slug: 'perfumes' },
        { name: 'Cuidado Personal', slug: 'cuidado-personal' },
        { name: 'Accesorios', slug: 'accesorios' }
      ];
      for (const cat of defaultCategories) {
        await client.query('INSERT INTO categories (name, slug, active) VALUES ($1, $2, true)', [cat.name, cat.slug]);
      }
      console.log('[SEED] Created default categories');
    }

    console.log("Database initialized successfully!");
  } catch (err) {
    console.error("Database initialization error:", err);
  } finally {
    client.release();
  }
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token de acceso requerido' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
    req.user = user;
    next();
  });
}

// --- REST API ENDPOINTS ---

// Auth Endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña requeridos' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Categories API
app.get('/api/categories', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    res.json(rows.map(c => ({
      id: c.id.toString(),
      name: c.name,
      slug: c.slug,
      isActive: c.active
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    const { name, slug, active } = req.body;
    const isActive = active !== undefined ? active : true;
    const catSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { rows } = await pool.query(
      'INSERT INTO categories (name, slug, active) VALUES ($1, $2, $3) RETURNING *',
      [name, catSlug, isActive]
    );
    const c = rows[0];
    res.status(201).json({ id: c.id.toString(), name: c.name, slug: c.slug, isActive: c.active });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, active } = req.body;
    const catSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { rows } = await pool.query(
      'UPDATE categories SET name = $1, slug = $2, active = $3 WHERE id = $4 RETURNING *',
      [name, catSlug, active, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    const c = rows[0];
    res.json({ id: c.id.toString(), name: c.name, slug: c.slug, isActive: c.active });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Products API
app.get('/api/products', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json(rows.map(p => ({
      id: p.id.toString(),
      name: p.name,
      description: p.description,
      brand: p.brand || '',
      sku: p.sku || '',
      regularPrice: parseFloat(p.regular_price),
      salePrice: p.sale_price ? parseFloat(p.sale_price) : null,
      costPrice: p.cost_price ? parseFloat(p.cost_price) : null,
      price: p.sale_price ? parseFloat(p.sale_price) : parseFloat(p.regular_price),
      categoryId: p.category_id ? p.category_id.toString() : '',
      image: p.image || '',
      stock: parseInt(p.stock, 10),
      minStock: parseInt(p.min_stock, 10),
      isActive: p.active
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    const p = rows[0];
    res.json({
      id: p.id.toString(),
      name: p.name,
      description: p.description,
      brand: p.brand || '',
      sku: p.sku || '',
      regularPrice: parseFloat(p.regular_price),
      salePrice: p.sale_price ? parseFloat(p.sale_price) : null,
      costPrice: p.cost_price ? parseFloat(p.cost_price) : null,
      price: p.sale_price ? parseFloat(p.sale_price) : parseFloat(p.regular_price),
      categoryId: p.category_id ? p.category_id.toString() : '',
      image: p.image || '',
      stock: parseInt(p.stock, 10),
      minStock: parseInt(p.min_stock, 10),
      isActive: p.active
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { name, description, brand, sku, regularPrice, salePrice, costPrice, categoryId, image, stock, minStock, active } = req.body;
    const regPrice = parseFloat(regularPrice);
    const salPrice = salePrice ? parseFloat(salePrice) : null;
    const cstPrice = costPrice ? parseFloat(costPrice) : null;
    const catId = categoryId ? parseInt(categoryId, 10) : null;
    const stk = stock !== undefined ? parseInt(stock, 10) : 0;
    const minStk = minStock !== undefined ? parseInt(minStock, 10) : 0;
    const isActive = active !== undefined ? active : true;

    const { rows } = await pool.query(
      `INSERT INTO products (name, description, brand, sku, regular_price, sale_price, cost_price, category_id, image, stock, min_stock, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [name, description, brand || '', sku || '', regPrice, salPrice, cstPrice, catId, image || '', stk, minStk, isActive]
    );
    const p = rows[0];
    res.status(201).json({
      id: p.id.toString(),
      name: p.name,
      description: p.description,
      brand: p.brand || '',
      sku: p.sku || '',
      regularPrice: parseFloat(p.regular_price),
      salePrice: p.sale_price ? parseFloat(p.sale_price) : null,
      costPrice: p.cost_price ? parseFloat(p.cost_price) : null,
      price: p.sale_price ? parseFloat(p.sale_price) : parseFloat(p.regular_price),
      categoryId: p.category_id ? p.category_id.toString() : '',
      image: p.image || '',
      stock: parseInt(p.stock, 10),
      minStock: parseInt(p.min_stock, 10),
      isActive: p.active
    });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, brand, sku, regularPrice, salePrice, costPrice, categoryId, image, minStock, active } = req.body;
    const regPrice = parseFloat(regularPrice);
    const salPrice = salePrice ? parseFloat(salePrice) : null;
    const cstPrice = costPrice ? parseFloat(costPrice) : null;
    const catId = categoryId ? parseInt(categoryId, 10) : null;
    const minStk = minStock !== undefined ? parseInt(minStock, 10) : 0;

    const { rows } = await pool.query(
      `UPDATE products SET name = $1, description = $2, brand = $3, sku = $4, regular_price = $5,
       sale_price = $6, cost_price = $7, category_id = $8, image = $9, min_stock = $10, active = $11
       WHERE id = $12 RETURNING *`,
      [name, description, brand || '', sku || '', regPrice, salPrice, cstPrice, catId, image || '', minStk, active, id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    const p = rows[0];
    res.json({
      id: p.id.toString(),
      name: p.name,
      description: p.description,
      brand: p.brand || '',
      sku: p.sku || '',
      regularPrice: parseFloat(p.regular_price),
      salePrice: p.sale_price ? parseFloat(p.sale_price) : null,
      costPrice: p.cost_price ? parseFloat(p.cost_price) : null,
      price: p.sale_price ? parseFloat(p.sale_price) : parseFloat(p.regular_price),
      categoryId: p.category_id ? p.category_id.toString() : '',
      image: p.image || '',
      stock: parseInt(p.stock, 10),
      minStock: parseInt(p.min_stock, 10),
      isActive: p.active
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Inventory API
app.patch('/api/inventory/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;
    const { rows } = await pool.query(
      'UPDATE products SET stock = $1 WHERE id = $2 RETURNING *',
      [parseInt(stock, 10), id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ success: true, stock: rows[0].stock });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Orders API
app.post('/api/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customerName, customerEmail, customerPhone, deliveryMethod, address, paymentMethod, items, subtotal, shippingCost, total } = req.body;

    // Verify stock and update inventory
    for (const item of items) {
      const prodRes = await client.query('SELECT stock FROM products WHERE id = $1 FOR UPDATE', [item.id]);
      if (prodRes.rows.length === 0) throw new Error(`Producto id ${item.id} no encontrado`);
      const currentStock = prodRes.rows[0].stock;
      if (currentStock < item.quantity) {
        throw new Error(`Stock insuficiente para el producto ${item.name}`);
      }
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.id]);
    }

    const { rows } = await client.query(
      `INSERT INTO orders (customer_name, customer_email, customer_phone, delivery_method, address, payment_method, items, subtotal, shipping_cost, total, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pendiente', 'pendiente') RETURNING *`,
      [customerName, customerEmail, customerPhone || '', deliveryMethod || '', address || '', paymentMethod || '', JSON.stringify(items), subtotal, shippingCost || 0, total]
    );

    await client.query('COMMIT');
    const o = rows[0];
    res.status(201).json({ id: o.id.toString(), message: 'Pedido creado exitosamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders ORDER BY id DESC');
    res.json(rows.map(o => ({
      id: o.id.toString(),
      customerName: o.customer_name,
      customerEmail: o.customer_email,
      customerPhone: o.customer_phone,
      deliveryMethod: o.delivery_method,
      address: o.address,
      paymentMethod: o.payment_method,
      items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items,
      subtotal: parseFloat(o.subtotal),
      shippingCost: parseFloat(o.shipping_cost),
      total: parseFloat(o.total),
      status: o.status,
      paymentStatus: o.payment_status,
      createdAt: o.created_at
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus } = req.body;
    let query = 'UPDATE orders SET ';
    const params = [];
    if (status) {
      params.push(status);
      query += `status = $${params.length}`;
    }
    if (paymentStatus) {
      if (params.length > 0) query += ', ';
      params.push(paymentStatus);
      query += `payment_status = $${params.length}`;
    }
    params.push(id);
    query += ` WHERE id = $${params.length} RETURNING *`;

    const { rows } = await pool.query(query, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ success: true, order: rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Metrics API
app.get('/api/admin/metrics', authenticateToken, async (req, res) => {
  try {
    const productsRes = await pool.query('SELECT * FROM products');
    const ordersRes = await pool.query('SELECT * FROM orders');

    const products = productsRes.rows;
    const orders = ordersRes.rows;

    let salesTotal = 0;
    let costTotal = 0;
    let grossProfit = 0;
    let ordersCount = orders.length;

    orders.forEach(o => {
      if (o.status !== 'cancelado') {
        salesTotal += parseFloat(o.total);
        const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
        items.forEach(item => {
          const prod = products.find(p => p.id.toString() === item.id.toString());
          if (prod && prod.cost_price) {
            costTotal += parseFloat(prod.cost_price) * item.quantity;
          }
        });
      }
    });

    grossProfit = salesTotal - costTotal;

    let stockTotal = 0;
    let lowStockCount = 0;
    products.forEach(p => {
      stockTotal += parseInt(p.stock, 10);
      if (parseInt(p.stock, 10) <= parseInt(p.min_stock, 10)) {
        lowStockCount++;
      }
    });

    let pendingPaymentsCount = orders.filter(o => o.payment_status === 'pendiente').length;

    res.json({
      salesTotal,
      grossProfit,
      costTotal,
      ordersCount,
      customersCount: new Set(orders.map(o => o.customer_email)).size,
      stockTotal,
      pendingPaymentsCount,
      lowStockCount,
      orderStatusSummary: {
        pendiente: orders.filter(o => o.status === 'pendiente').length,
        completado: orders.filter(o => o.status === 'completado').length,
        cancelado: orders.filter(o => o.status === 'cancelado').length
      },
      paymentStatusSummary: {
        pendiente: orders.filter(o => o.payment_status === 'pendiente').length,
        pagado: orders.filter(o => o.payment_status === 'pagado').length,
        rechazado: orders.filter(o => o.payment_status === 'rechazado').length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Static File Server with extension resolution
app.use(express.static(__dirname, {
  extensions: ['html', 'htm']
}));

// Fallback router for static HTML pages
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint API no encontrado' });
  }

  const requestedPath = req.path === '/' ? '/index.html' : req.path;
  const filePath = path.join(__dirname, requestedPath);
  const htmlPath = filePath.endsWith('.html') ? filePath : `${filePath}.html`;

  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    } else if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) {
      return res.sendFile(htmlPath);
    } else {
      return res.sendFile(path.join(__dirname, 'index.html'));
    }
  } catch (e) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// Start Server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to start server:", err);
});
