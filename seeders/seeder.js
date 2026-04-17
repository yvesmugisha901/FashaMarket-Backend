// ============================================================
//  backend/seeders/seeder.js
//  Neon PostgreSQL E-Commerce Seeder
//  Run: node seeders/seeder.js
// ============================================================

import pkg from "pg";
import { faker } from "@faker-js/faker";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
});

const CONFIG = {
    SELLERS: 8,
    BUYERS: 20,
    PRODUCTS_PER_SELLER: 6,
    ORDERS: 40,
};

const CONDITIONS = ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"];
const PROD_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SOLD"];
const ORDER_STATUSES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];
const PAY_METHODS = ["MOMO", "BANK_TRANSFER", "CASH_ON_DELIVERY", "CARD"];

const CATEGORY_NAMES = [
    "Electronics", "Clothing & Apparel", "Books & Stationery", "Home & Garden",
    "Sports & Outdoors", "Health & Beauty", "Toys & Games", "Automotive",
    "Food & Groceries", "Furniture",
];

const makeImages = () =>
    Array.from(
        { length: faker.number.int({ min: 2, max: 5 }) },
        () => `https://picsum.photos/seed/${faker.string.alphanumeric(7)}/640/480`
    );

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seedUsers(client) {
    console.log("\n👤  Seeding users...");
    const sellers = [], buyers = [];

    for (let i = 0; i < CONFIG.SELLERS + CONFIG.BUYERS; i++) {
        const role = i < CONFIG.SELLERS ? "SELLER" : "BUYER";
        const first = faker.person.firstName();
        const last = faker.person.lastName();

        const res = await client.query(
            `INSERT INTO users (name, email, phone, password_hash, role, verified_status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [
                `${first} ${last}`,
                `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
                `+250 7${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(3)}`,
                "$2b$10$seedplaceholderpasswordhashonly.donotuse",
                role,
                faker.datatype.boolean({ probability: 0.8 }),
                faker.date.past({ years: 2 }),
            ]
        );
        role === "SELLER" ? sellers.push(res.rows[0].id) : buyers.push(res.rows[0].id);
    }

    console.log(`   ✅ ${sellers.length} sellers, ${buyers.length} buyers`);
    return { sellers, buyers };
}

async function seedCategories(client) {
    console.log("\n🗂️   Seeding categories...");
    const ids = [];
    for (const name of CATEGORY_NAMES) {
        const res = await client.query(
            `INSERT INTO categories (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
            [name]
        );
        ids.push(res.rows[0].id);
    }
    console.log(`   ✅ ${ids.length} categories`);
    return ids;
}

async function seedProducts(client, sellers, categoryIds) {
    console.log("\n📦  Seeding products...");
    const productIds = [];

    for (const sellerId of sellers) {
        for (let i = 0; i < CONFIG.PRODUCTS_PER_SELLER; i++) {
            const sellerAgreed = faker.datatype.boolean({ probability: 0.75 });
            const res = await client.query(
                `INSERT INTO products
           (seller_id, title, description, price, condition, status,
            category_id, images, created_at, seller_agreed, seller_agreed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
                [
                    sellerId,
                    faker.commerce.productName(),
                    faker.commerce.productDescription(),
                    parseFloat(faker.commerce.price({ min: 500, max: 500000 })),
                    pick(CONDITIONS),
                    pick(PROD_STATUSES),
                    pick(categoryIds),
                    makeImages(),
                    faker.date.past({ years: 1 }),
                    sellerAgreed,
                    sellerAgreed ? faker.date.recent({ days: 60 }) : null,
                ]
            );
            productIds.push(res.rows[0].id);
        }
    }
    console.log(`   ✅ ${productIds.length} products`);
    return productIds;
}

async function seedOrders(client, buyers, productIds) {
    console.log("\n🛒  Seeding orders...");
    const orderIds = [];
    const usedPairs = new Set();
    let attempts = 0;

    while (orderIds.length < CONFIG.ORDERS && attempts < CONFIG.ORDERS * 10) {
        attempts++;
        const buyerId = pick(buyers), productId = pick(productIds);
        const key = `${buyerId}:${productId}`;
        if (usedPairs.has(key)) continue;
        usedPairs.add(key);

        const status = pick(ORDER_STATUSES);
        const base = parseFloat(faker.commerce.price({ min: 500, max: 300000 }));
        const rate = parseFloat((Math.random() * 15 + 5).toFixed(2));
        const comm = parseFloat((base * rate / 100).toFixed(2));
        const isDelivered = status === "DELIVERED";

        const res = await client.query(
            `INSERT INTO orders
         (user_id, product_id, status, payment_method, created_at,
          commission_rate, commission_amount, seller_amount,
          payment_reference, payment_confirmed_at, confirmed_received)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
            [
                buyerId, productId, status, pick(PAY_METHODS),
                faker.date.past({ years: 1 }),
                rate, comm, parseFloat((base - comm).toFixed(2)),
                faker.string.alphanumeric(12).toUpperCase(),
                isDelivered ? faker.date.recent({ days: 60 }) : null,
                isDelivered,
            ]
        );
        orderIds.push(res.rows[0].id);
    }
    console.log(`   ✅ ${orderIds.length} orders`);
    return orderIds;
}

async function seedReviews(client) {
    console.log("\n⭐  Seeding reviews...");
    const check = await client.query(`SELECT to_regclass('public.reviews') AS tbl`);
    if (!check.rows[0].tbl) { console.log("   ⚠️  reviews table not found — skipping"); return; }

    const { rows } = await client.query(
        `SELECT id, product_id, user_id FROM orders WHERE status = 'DELIVERED'`
    );
    if (!rows.length) { console.log("   ⚠️  No delivered orders — skipping reviews"); return; }

    let count = 0;
    for (const o of rows) {
        await client.query(
            `INSERT INTO reviews (product_id, user_id, order_id, rating, comment, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
            [
                o.product_id, o.user_id, o.id,
                faker.number.int({ min: 1, max: 5 }),
                faker.helpers.maybe(() => faker.lorem.sentences({ min: 1, max: 3 }), { probability: 0.8 }),
                faker.date.recent({ days: 90 }),
            ]
        );
        count++;
    }
    console.log(`   ✅ ${count} reviews`);
}

async function main() {
    if (process.env.NODE_ENV === "production") {
        console.error("🚫  Blocked in production!"); process.exit(1);
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🌱  Neon PostgreSQL E-Commerce Seeder");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { sellers, buyers } = await seedUsers(client);
        const categoryIds = await seedCategories(client);
        const productIds = await seedProducts(client, sellers, categoryIds);
        await seedOrders(client, buyers, productIds);
        await seedReviews(client);
        await client.query("COMMIT");
        console.log("\n🎉  Seeding complete! Check your Neon dashboard.\n");
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("\n❌  Failed — all changes rolled back.");
        console.error("   Error:", err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

main();