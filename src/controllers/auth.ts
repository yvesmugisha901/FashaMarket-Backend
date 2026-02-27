import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../config/db'
import { sendWelcomeEmail } from '../config/email'

export const register = async (req: Request, res: Response) => {
    const validationError = checkValidation(req, res)
    if (validationError) return validationError

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
        // Send welcome email (non-blocking)
        sendWelcomeEmail(email, name, role || 'BUYER').catch(console.error)

        return res.status(201).json({ token, user })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const login = async (req: Request, res: Response) => {
    const validationError = checkValidation(req, res)
    if (validationError) return validationError

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
export const updateProfile = async (req: any, res: Response) => {
    const { name, phone } = req.body
    try {
        const result = await pool.query(
            `UPDATE users SET name = $1, phone = $2 WHERE id = $3
       RETURNING id, name, email, phone, role, verified_status, created_at`,
            [name, phone, req.user.id]
        )
        return res.json({ data: result.rows[0], message: 'Profile updated' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const changePassword = async (req: any, res: Response) => {
    const { current_password, new_password } = req.body
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE id = $1',
            [req.user.id]
        )
        const user = result.rows[0]

        const valid = await bcrypt.compare(current_password, user.password_hash)
        if (!valid) {
            return res.status(400).json({ message: 'Current password is incorrect' })
        }

        if (new_password.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' })
        }

        const newHash = await bcrypt.hash(new_password, 10)
        await pool.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [newHash, req.user.id]
        )

        return res.json({ message: 'Password changed successfully' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}
import { body, validationResult } from 'express-validator'

export const validateRegister = [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name too short'),
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['BUYER', 'SELLER']).withMessage('Invalid role'),
]

export const validateLogin = [
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
]

const checkValidation = (req: any, res: any) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
    }
    return null
}