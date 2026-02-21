import { Request, Response } from 'express'
import pool from '../config/db'

export const getAll = async (req: Request, res: Response) => {
    const { search, condition, category_id, min_price, max_price, page = 1, limit = 20 } = req.query

    try {
        let query = `
      SELECT p.*, u.name as seller_name, u.verified_status as seller_verified, c.name as category_name
      FROM products p
      JOIN users u ON p.seller_id = u.id
      JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'APPROVED'
    `
        const params: any[] = []
        let i = 1

        if (search) { query += ` AND p.title ILIKE $${i++}`; params.push(`%${search}%`) }
        if (condition) { query += ` AND p.condition = $${i++}`; params.push(condition) }
        if (category_id) { query += ` AND p.category_id = $${i++}`; params.push(category_id) }
        if (min_price) { query += ` AND p.price >= $${i++}`; params.push(min_price) }
        if (max_price) { query += ` AND p.price <= $${i++}`; params.push(max_price) }

        const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) as t`, params)
        const total = parseInt(countResult.rows[0].count)

        const offset = (Number(page) - 1) * Number(limit)
        query += ` ORDER BY p.created_at DESC LIMIT $${i++} OFFSET $${i++}`
        params.push(limit, offset)

        const result = await pool.query(query, params)
        return res.json({ data: result.rows, total, page: Number(page), limit: Number(limit) })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const getById = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT p.*, u.name as seller_name, u.verified_status as seller_verified, c.name as category_name
       FROM products p
       JOIN users u ON p.seller_id = u.id
       JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
            [req.params.id]
        )
        if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' })
        return res.json({ data: result.rows[0] })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const create = async (req: any, res: Response) => {
    const { title, description, price, condition, category_id, images } = req.body
    try {
        const result = await pool.query(
            `INSERT INTO products (seller_id, title, description, price, condition, category_id, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [req.user.id, title, description, price, condition, category_id, images || []]
        )
        return res.status(201).json({ data: result.rows[0] })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const approve = async (req: Request, res: Response) => {
    try {
        await pool.query(`UPDATE products SET status = 'APPROVED' WHERE id = $1`, [req.params.id])
        return res.json({ message: 'Product approved' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const reject = async (req: Request, res: Response) => {
    try {
        await pool.query(`UPDATE products SET status = 'REJECTED' WHERE id = $1`, [req.params.id])
        return res.json({ message: 'Product rejected' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const getPending = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT p.*, u.name as seller_name, c.name as category_name
       FROM products p
       JOIN users u ON p.seller_id = u.id
       JOIN categories c ON p.category_id = c.id
       WHERE p.status = 'PENDING'
       ORDER BY p.created_at ASC`
        )
        return res.json({ data: result.rows })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const myListings = async (req: any, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT p.*, c.name as category_name
       FROM products p
       JOIN categories c ON p.category_id = c.id
       WHERE p.seller_id = $1
       ORDER BY p.created_at DESC`,
            [req.user.id]
        )
        return res.json({ data: result.rows })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const deleteProduct = async (req: any, res: Response) => {
    try {
        await pool.query(
            `DELETE FROM products WHERE id = $1 AND seller_id = $2`,
            [req.params.id, req.user.id]
        )
        return res.json({ message: 'Deleted' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}