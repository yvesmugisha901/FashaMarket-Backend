import { Response } from 'express'
import pool from '../config/db'
import { sendOrderConfirmationEmail, sendOrderStatusEmail, sendSellerNotificationEmail } from '../config/email'

const AGREEMENT_TEXT = (productTitle: string, price: number) => `
PURCHASE AGREEMENT — FashaMarket

Product: ${productTitle}
Price: ${price.toLocaleString()} RWF

1. PRODUCT CONDITION
   The product is sold in the condition described on the listing page.

2. RETURN POLICY
   Returns accepted within 48 hours of delivery if product differs from description.

3. DELIVERY TIMELINE
   Delivery within 3 business days from order confirmation.

4. PAYMENT
   Payment due at checkout (Mobile Money) or at delivery (Cash on Delivery).

5. DISPUTE RESOLUTION
   Disputes must be raised within 72 hours of delivery via FashaMarket support.
`.trim()

export const create = async (req: any, res: Response) => {
    const { product_id, payment_method } = req.body
    try {
        const product = await pool.query(
            `SELECT * FROM products WHERE id = $1 AND status = 'APPROVED'`,
            [product_id]
        )
        if (product.rows.length === 0) {
            return res.status(404).json({ message: 'Product not available' })
        }

        const p = product.rows[0]

        const order = await pool.query(
            `INSERT INTO orders (user_id, product_id, payment_method, status)
       VALUES ($1, $2, $3, 'PENDING')
       RETURNING *`,
            [req.user.id, product_id, payment_method]
        )

        await pool.query(
            `INSERT INTO agreements (order_id, agreement_text)
       VALUES ($1, $2)`,
            [order.rows[0].id, AGREEMENT_TEXT(p.title, p.price)]
        )

        // Get buyer and seller details
        const buyer = await pool.query(
            'SELECT name, email FROM users WHERE id = $1',
            [req.user.id]
        )
        const seller = await pool.query(
            'SELECT name, email FROM users WHERE id = $1',
            [p.seller_id]
        )

        // Send emails non-blocking
        sendOrderConfirmationEmail(
            buyer.rows[0].email,
            buyer.rows[0].name,
            order.rows[0].id,
            p.title,
            p.price,
            payment_method
        ).catch(console.error)

        sendSellerNotificationEmail(
            seller.rows[0].email,
            seller.rows[0].name,
            p.title,
            buyer.rows[0].name,
            order.rows[0].id
        ).catch(console.error)

        return res.status(201).json({ data: order.rows[0] })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const signAgreement = async (req: any, res: Response) => {
    const { id } = req.params
    try {
        const order = await pool.query(
            `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
            [id, req.user.id]
        )
        if (order.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' })
        }

        await pool.query(
            `UPDATE orders SET agreement_signed = true WHERE id = $1`,
            [id]
        )
        await pool.query(
            `UPDATE agreements SET signed_at = NOW() WHERE order_id = $1`,
            [id]
        )

        return res.json({ message: 'Agreement signed' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const getById = async (req: any, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT o.*, p.title as product_title, p.price as product_price
       FROM orders o
       JOIN products p ON o.product_id = p.id
       WHERE o.id = $1 AND o.user_id = $2`,
            [req.params.id, req.user.id]
        )
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' })
        }
        return res.json({ data: result.rows[0] })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const myOrders = async (req: any, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT o.*, p.title as product_title, p.price as product_price
       FROM orders o
       JOIN products p ON o.product_id = p.id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
            [req.user.id]
        )
        return res.json({ data: result.rows })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const updateStatus = async (req: any, res: Response) => {
    const { status } = req.body
    try {
        await pool.query(
            `UPDATE orders SET status = $1 WHERE id = $2`,
            [status, req.params.id]
        )

        // Get order details and send email
        const orderData = await pool.query(
            `SELECT o.*, u.name as buyer_name, u.email as buyer_email, p.title as product_title
       FROM orders o
       JOIN users u ON o.user_id = u.id
       JOIN products p ON o.product_id = p.id
       WHERE o.id = $1`,
            [req.params.id]
        )

        if (orderData.rows.length > 0) {
            const o = orderData.rows[0]
            sendOrderStatusEmail(
                o.buyer_email,
                o.buyer_name,
                o.id,
                o.product_title,
                status
            ).catch(console.error)
        }

        return res.json({ message: 'Status updated' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const getAll = async (req: any, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT o.*, p.title as product_title, p.price as product_price,
              u.name as buyer_name
       FROM orders o
       JOIN products p ON o.product_id = p.id
       JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
        )
        return res.json({ data: result.rows })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}