// backend/src/controllers/cart.ts

import { Response } from 'express'
import pool from '../config/db'

// GET /api/cart  — get all cart items for logged-in user
export const getCart = async (req: any, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT
                ci.id             AS cart_item_id,
                ci.added_at,
                p.id              AS product_id,
                p.title,
                p.price,
                p.images,
                p.condition,
                p.status          AS product_status,
                p.stock_quantity,
                u.name            AS seller_name,
                u.verified_status AS seller_verified,
                c.name            AS category_name
             FROM cart_items ci
             JOIN products  p ON ci.product_id  = p.id
             JOIN users     u ON p.seller_id    = u.id
             JOIN categories c ON p.category_id = c.id
             WHERE ci.user_id = $1
             ORDER BY ci.added_at DESC`,
            [req.user.id]
        )
        return res.json({ data: result.rows })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

// POST /api/cart  — add product to cart
export const addToCart = async (req: any, res: Response) => {
    const { product_id } = req.body
    if (!product_id) {
        return res.status(400).json({ message: 'product_id is required' })
    }
    try {
        const product = await pool.query(
            `SELECT id, seller_id, status, stock_quantity FROM products WHERE id = $1`,
            [product_id]
        )
        if (product.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' })
        }

        const p = product.rows[0]

        // ✅ FIX: Check APPROVED *and* SOLD together in one clear block.
        // Previously the APPROVED check fired first (returning 400 for SOLD products),
        // making the stock_quantity / SOLD check below it unreachable dead code.
        // Now: SOLD products are caught by the stock check, PENDING/REJECTED by the status check.
        if (p.stock_quantity <= 0 || p.status === 'SOLD') {
            return res.status(400).json({ message: 'This product is out of stock' })
        }

        if (p.status !== 'APPROVED') {
            return res.status(400).json({ message: 'Product is not available' })
        }

        if (p.seller_id === req.user.id) {
            return res.status(400).json({ message: 'You cannot add your own product to cart' })
        }

        await pool.query(
            `INSERT INTO cart_items (user_id, product_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, product_id) DO NOTHING`,
            [req.user.id, product_id]
        )
        return res.status(201).json({ message: 'Added to cart' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

// DELETE /api/cart/:product_id  — remove item from cart
export const removeFromCart = async (req: any, res: Response) => {
    try {
        await pool.query(
            `DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2`,
            [req.user.id, req.params.product_id]
        )
        return res.json({ message: 'Removed from cart' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

// DELETE /api/cart  — clear entire cart
export const clearCart = async (req: any, res: Response) => {
    try {
        await pool.query(
            `DELETE FROM cart_items WHERE user_id = $1`,
            [req.user.id]
        )
        return res.json({ message: 'Cart cleared' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}