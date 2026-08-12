import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sampleProducts = [
  {
    name: "Bleu de Chanel Parfum 100ml",
    description: "Una fragancia intemporal y de carácter asertivo. Un aroma amaderado aromático con estela cautivadora que evoca libertad.",
    brand: "Chanel",
    sku: "CHN-BLEU-100",
    regularPrice: 650.00,
    salePrice: 589.00,
    costPrice: 380.00,
    categorySlug: "perfumes",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
    stock: 25,
    minStock: 5
  },
  {
    name: "Sauvage Elixir Dior 60ml",
    description: "Concentrado extraordinario impregnado de la icónica frescura de Sauvage con un corazón de especias a medida y lavanda fina.",
    brand: "Dior",
    sku: "DIR-SAUV-060",
    regularPrice: 720.00,
    salePrice: 649.00,
    costPrice: 420.00,
    categorySlug: "perfumes",
    image: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=800&q=80",
    stock: 18,
    minStock: 4
  },
  {
    name: "Baccarat Rouge 540 Maison Francis Kurkdjian",
    description: "Una alquimia poética. Una firma gráfica y condensada al extremo. Las notas de jazmín y azafrán realzan las facetas minerales del ámbar gris.",
    brand: "Maison Francis Kurkdjian",
    sku: "MFK-BAC-070",
    regularPrice: 1450.00,
    salePrice: 1290.00,
    costPrice: 850.00,
    categorySlug: "perfumes",
    image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80",
    stock: 10,
    minStock: 2
  },
  {
    name: "Tom Ford Tobacco Vanille Eau de Parfum 50ml",
    description: "Opulento, cálido e icónico. Una versión moderna de un antiguo club de caballeros británicos rebosante de especias aromáticas.",
    brand: "Tom Ford",
    sku: "TF-TOB-050",
    regularPrice: 980.00,
    salePrice: 880.00,
    costPrice: 580.00,
    categorySlug: "perfumes",
    image: "https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?auto=format&fit=crop&w=800&q=80",
    stock: 14,
    minStock: 3
  },
  {
    name: "Creed Aventus Eau de Parfum 100ml",
    description: "La fragancia sensual, audaz y contemporánea que celebra la fuerza, la visión y el éxito. Inspirada en la vida dramática de un emperador histórico.",
    brand: "Creed",
    sku: "CRD-AVEN-100",
    regularPrice: 1350.00,
    salePrice: 1199.00,
    costPrice: 790.00,
    categorySlug: "perfumes",
    image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=800&q=80",
    stock: 12,
    minStock: 2
  },
  {
    name: "Serum Elixir de Oro 24K Regenerador",
    description: "Sérum facial de lujo infundido con micro-partículas de oro puro de 24K y ácido hialurónico concentrado para una piel radiante.",
    brand: "Exclusive Luxe",
    sku: "EXC-SER-024",
    regularPrice: 280.00,
    salePrice: 220.00,
    costPrice: 110.00,
    categorySlug: "cuidado-personal",
    image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
    stock: 35,
    minStock: 8
  },
  {
    name: "Crema Hidratante Caviar Nuit Platinum",
    description: "Tratamiento nocturno ultra enriquecido con extracto puro de caviar negro y peptidos rejuvenecedores.",
    brand: "Exclusive Luxe",
    sku: "EXC-CRM-CAV",
    regularPrice: 340.00,
    salePrice: 295.00,
    costPrice: 150.00,
    categorySlug: "cuidado-personal",
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
    stock: 20,
    minStock: 5
  },
  {
    name: "Atomizador Recargable de Bolsillo en Titanio Gold",
    description: "Elegante atomizador portátil de 8ml a prueba de fugas, refinado con acabado en titanio dorado pulido.",
    brand: "Exclusive Gear",
    sku: "EXC-ATM-GLD",
    regularPrice: 95.00,
    salePrice: 75.00,
    costPrice: 30.00,
    categorySlug: "accesorios",
    image: "https://images.unsplash.com/photo-1616949755610-8c9bbc08f138?auto=format&fit=crop&w=800&q=80",
    stock: 50,
    minStock: 10
  },
  {
    name: "Cofre de Regalo Edición Limitada Perfumes Niche",
    description: "Set exclusivo compuesto por 5 miniaturas de coleccionista con las fragancias más aclamadas de la perfumería de nicho.",
    brand: "Exclusive Shop",
    sku: "EXC-SET-SET5",
    regularPrice: 450.00,
    salePrice: 399.00,
    costPrice: 220.00,
    categorySlug: "accesorios",
    image: "https://images.unsplash.com/photo-1512777576244-b846ac3d816f?auto=format&fit=crop&w=800&q=80",
    stock: 15,
    minStock: 3
  }
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log("Seeding products...");
    
    // Ensure categories exist
    const catRes = await client.query('SELECT id, slug FROM categories');
    const catMap = {};
    catRes.rows.forEach(c => catMap[c.slug] = c.id);

    for (const prod of sampleProducts) {
      const catId = catMap[prod.categorySlug] || catRes.rows[0]?.id;
      
      // Check if product exists by name or SKU
      const existing = await client.query('SELECT id FROM products WHERE name = $1 OR sku = $2', [prod.name, prod.sku]);
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO products (name, description, brand, sku, regular_price, sale_price, cost_price, category_id, image, stock, min_stock, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)`,
          [prod.name, prod.description, prod.brand, prod.sku, prod.regularPrice, prod.salePrice, prod.costPrice, catId, prod.image, prod.stock, prod.minStock]
        );
        console.log(`[SEED] Added: ${prod.name}`);
      } else {
        await client.query(
          `UPDATE products SET description = $1, brand = $2, regular_price = $3, sale_price = $4, image = $5, stock = $6 WHERE id = $7`,
          [prod.description, prod.brand, prod.regularPrice, prod.salePrice, prod.image, prod.stock, existing.rows[0].id]
        );
        console.log(`[SEED] Updated: ${prod.name}`);
      }
    }
    console.log("Seeding completed successfully!");
  } catch (err) {
    console.error("Seed error:", err);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
