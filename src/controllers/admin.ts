// backend/src/controllers/admin.ts

import { Request, Response } from 'express'
import pool from '../config/db'
import { sendProductApprovedEmail, sendProductRejectedEmail } from '../config/email'

const logAction = async (
    adminId: string,
    action: string,
    targetType: string,
    targetId: string,
    details: string
) => {
    await pool.query(
        `INSERT INTO audit_logs (admin_id, action, target_type, target_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [adminId, action, targetType, targetId, details]
    )
}

export const getStats = async (req: any, res: Response) => {
    try {
        const [users, products, orders] = await Promise.all([
            pool.query(`SELECT COUNT(*) FROM users WHERE role != 'ADMIN'`),
            pool.query(`SELECT COUNT(*) FROM products`),
            pool.query(`SELECT COUNT(*) FROM orders`),
        ])

        const pendingProducts = await pool.query(
            `SELECT COUNT(*) FROM products WHERE status = 'PENDING'`
        )
        const pendingOrders = await pool.query(
            `SELECT COUNT(*) FROM orders WHERE status = 'PENDING'`
        )
        const todayOrders = await pool.query(
            `SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE`
        )

        // ✅ FIX: Use DELIVERED (fully complete) not PAID (payment confirmed but not yet received)
        // Your order flow: PENDING → AWAITING_CONFIRMATION → PAID → SHIPPED → DELIVERED
        // commission_amount = price * 10% stored at order creation — already correct per-order
        // total_revenue = commission_amount + seller_amount = full product price (GMV)
        // total_commission = platform's 10% cut only
        const revenue = await pool.query(
            `SELECT
                COALESCE(SUM(commission_amount + seller_amount), 0) AS total_revenue,
                COALESCE(SUM(commission_amount), 0)                 AS total_commission
             FROM orders
             WHERE status = 'DELIVERED'`
        )

        return res.json({
            data: {
                total_users: parseInt(users.rows[0].count),
                total_products: parseInt(products.rows[0].count),
                total_orders: parseInt(orders.rows[0].count),
                total_revenue: parseFloat(revenue.rows[0].total_revenue),
                total_commission: parseFloat(revenue.rows[0].total_commission),
                pending_products: parseInt(pendingProducts.rows[0].count),
                pending_orders: parseInt(pendingOrders.rows[0].count),
                today_orders: parseInt(todayOrders.rows[0].count),
            }
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const getAllUsers = async (req: any, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, phone, role, verified_status, created_at,
                (SELECT COUNT(*) FROM products WHERE seller_id = users.id) as product_count,
                (SELECT COUNT(*) FROM orders   WHERE user_id   = users.id) as order_count
             FROM users
             ORDER BY created_at DESC`
        )
        return res.json({ data: result.rows })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const verifySeller = async (req: any, res: Response) => {
    const { id } = req.params
    try {
        await pool.query(`UPDATE users SET verified_status = true WHERE id = $1`, [id])
        await logAction(req.user.id, 'VERIFY_SELLER', 'user', id, 'Seller verified')
        return res.json({ message: 'Seller verified' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const suspendUser = async (req: any, res: Response) => {
    const { id } = req.params
    try {
        await pool.query(`UPDATE users SET verified_status = false WHERE id = $1`, [id])
        await logAction(req.user.id, 'SUSPEND_USER', 'user', id, 'User suspended')
        return res.json({ message: 'User suspended' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const changeUserRole = async (req: any, res: Response) => {
    const { id } = req.params
    const { role } = req.body
    try {
        await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, id])
        await logAction(req.user.id, 'CHANGE_ROLE', 'user', id, `Role changed to ${role}`)
        return res.json({ message: 'Role updated' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const getAllProducts = async (req: any, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT p.*, u.name as seller_name, c.name as category_name
             FROM products p
             JOIN users u      ON p.seller_id   = u.id
             JOIN categories c ON p.category_id = c.id
             ORDER BY p.created_at DESC`
        )
        return res.json({ data: result.rows })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const approveProduct = async (req: any, res: Response) => {
    const { id } = req.params
    try {
        await pool.query(`UPDATE products SET status = 'APPROVED' WHERE id = $1`, [id])
        await logAction(req.user.id, 'APPROVE_PRODUCT', 'product', id, 'Product approved')

        const product = await pool.query(
            `SELECT p.title, u.name, u.email
             FROM products p JOIN users u ON p.seller_id = u.id
             WHERE p.id = $1`,
            [id]
        )
        if (product.rows.length > 0) {
            const p = product.rows[0]
            sendProductApprovedEmail(p.email, p.name, p.title).catch(console.error)
        }
        return res.json({ message: 'Product approved' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const rejectProduct = async (req: any, res: Response) => {
    const { id } = req.params
    try {
        await pool.query(`UPDATE products SET status = 'REJECTED' WHERE id = $1`, [id])
        await logAction(req.user.id, 'REJECT_PRODUCT', 'product', id, 'Product rejected')

        const product = await pool.query(
            `SELECT p.title, u.name, u.email
             FROM products p JOIN users u ON p.seller_id = u.id
             WHERE p.id = $1`,
            [id]
        )
        if (product.rows.length > 0) {
            const p = product.rows[0]
            sendProductRejectedEmail(p.email, p.name, p.title).catch(console.error)
        }
        return res.json({ message: 'Product rejected' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const getAllOrders = async (req: any, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT
                o.*,
                p.title AS product_title,
                p.price AS product_price,
                u.name  AS buyer_name,
                u.phone AS buyer_phone,
                o.payment_reference,
                o.payment_confirmed_at
             FROM orders o
             JOIN products p ON o.product_id = p.id
             JOIN users    u ON o.user_id    = u.id
             ORDER BY o.created_at DESC`
        )
        return res.json({ data: result.rows })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const updateOrderStatus = async (req: any, res: Response) => {
    const { id } = req.params
    const { status } = req.body
    try {
        await pool.query(`UPDATE orders SET status = $1 WHERE id = $2`, [status, id])
        await logAction(req.user.id, 'UPDATE_ORDER_STATUS', 'order', id, `Status set to ${status}`)
        return res.json({ message: 'Order status updated' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const getAuditLogs = async (req: any, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT a.*, u.name as admin_name
             FROM audit_logs a
             JOIN users u ON a.admin_id = u.id
             ORDER BY a.created_at DESC
             LIMIT 200`
        )
        return res.json({ data: result.rows })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const getRevenueReport = async (req: any, res: Response) => {
    try {
        // ✅ Also use DELIVERED to stay consistent with stats card
        const daily = await pool.query(
            `SELECT
                DATE(o.created_at)                          AS date,
                COUNT(*)                                    AS order_count,
                SUM(o.commission_amount + o.seller_amount)  AS revenue,
                SUM(o.commission_amount)                    AS commission
             FROM orders o
             WHERE o.status = 'DELIVERED'
             AND o.created_at >= NOW() - INTERVAL '30 days'
             GROUP BY DATE(o.created_at)
             ORDER BY date DESC`
        )

        const byCategory = await pool.query(
            `SELECT
                c.name                                      AS category,
                COUNT(*)                                    AS sales,
                SUM(o.commission_amount + o.seller_amount)  AS revenue,
                SUM(o.commission_amount)                    AS commission
             FROM orders o
             JOIN products   p ON o.product_id  = p.id
             JOIN categories c ON p.category_id = c.id
             WHERE o.status = 'DELIVERED'
             GROUP BY c.name
             ORDER BY revenue DESC`
        )

        return res.json({
            data: {
                daily: daily.rows,
                by_category: byCategory.rows,
            }
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}