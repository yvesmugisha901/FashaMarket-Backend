import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../config/db'

export const register = async (req: Request, res: Response) => {
    const { name, email, phone, password, role } = req.body

    try {
        // Check if email exists
        const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email])
        if (exists.rows.length > 0) {
            return res.status(400).json({ message: 'Email already in use' })
        }

        const passwordHash = await bcrypt.hash(password, 10)

        const result = await pool.query(
            `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone, role, verified_status, created_at`,
            [name, email, phone, passwordHash, role || 'BUYER']
        )

        const user = result.rows[0]
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '7d' }
        )

        return res.status(201).json({ token, user })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        )

        const user = result.rows[0]
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' })
        }

        const valid = await bcrypt.compare(password, user.password_hash)
        if (!valid) {
            return res.status(400).json({ message: 'Invalid email or password' })
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '7d' }
        )

        const { password_hash, ...safeUser } = user
        return res.json({ token, user: safeUser })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const me = async (req: any, res: Response) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, phone, role, verified_status, created_at FROM users WHERE id = $1',
            [req.user.id]
        )
        return res.json({ data: result.rows[0] })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}