import { Request, Response } from 'express'
import pool from '../config/db'

export const create = async (req: any, res: Response) => {
    const { product_id, order_id, rating, comment } = req.body

    try {
        // Verify order exists, belongs to user, and is delivered
        const order = await pool.query(
            `SELECT * FROM orders WHERE id = $1 AND user_id = $2 AND status = 'DELIVERED'`,
            [order_id, req.user.id]
        )
        if (order.rows.length === 0) {
            return res.status(400).json({ message: 'You can only review delivered orders' })
        }

        // Check not already reviewed
        const existing = await pool.query(
            `SELECT id FROM reviews WHERE order_id = $1`,
            [order_id]
        )
        if (existing.rows.length > 0) {
            return res.status(400).json({ message: 'You already reviewed this order' })
        }

        const result = await pool.query(
            `INSERT INTO reviews (product_id, user_id, order_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [product_id, req.user.id, order_id, rating, comment]
        )

        return res.status(201).json({ data: result.rows[0] })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const getByProduct = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT r.*, u.name as user_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC`,
            [req.params.productId]
        )

        const avg = result.rows.length > 0
            ? result.rows.reduce((sum: number, r: any) => sum + r.rating, 0) / result.rows.length
            : 0

        return res.json({
            data: result.rows,
            average: Math.round(avg * 10) / 10,
            total: result.rows.length
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}