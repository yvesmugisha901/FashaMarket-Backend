import { Router } from 'express'
import pool from '../config/db'

const router = Router()

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name FROM categories ORDER BY name')
        return res.json({ data: result.rows })
    } catch (err) {
        return res.status(500).json({ message: 'Server error' })
    }
})

export default router