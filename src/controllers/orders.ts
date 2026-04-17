import { Response } from 'express'
import pool from '../config/db'
import {
    sendOrderConfirmationEmail,
    sendOrderStatusEmail,
    sendSellerNotificationEmail
} from '../config/email'

const AGREEMENT_TEXT = (productTitle: string, price: number, buyerName: string, sellerName: string) => `
PURCHASE AGREEMENT — FashaMarket

Date: ${new Date().toLocaleDateString()}
Product: ${productTitle}
Price: ${price.toLocaleString()} RWF
Buyer: ${buyerName}
Seller: ${sellerName}

1. PRODUCT CONDITION
   The product is sold in the condition described on the listing page.
   The seller confirms the product matches the listing description.

2. PAYMENT TERMS
   Full payment of ${price.toLocaleString()} RWF is required before delivery.
   Payment via Mobile Money or Cash on Delivery as selected at checkout.

3. RETURN POLICY
   Returns accepted within 48 hours of delivery if product differs significantly
   from the description. Buyer must provide photo evidence.

4. DELIVERY TIMELINE
   Seller must ship within 2 business days of payment confirmation.
   Estimated delivery: 1-3 business days after shipping.

5. DISPUTE RESOLUTION
   Disputes must be raised within 72 hours of delivery via FashaMarket support.
   FashaMarket admin will mediate all disputes as final arbitrator.

6. AGREEMENT
   Both parties agree to the above terms by signing this agreement.
   This agreement is binding once the buyer has signed.
`.trim()

// ── Fixed: removed stock_quantity check & settings table lookup ──────────────
export const create = async (req: any, res: Response) => {
    const { product_id, payment_method } = req.body
    try {
        // FIX 1: Removed stock_quantity from SELECT — column doesn't exist in schema
        const product = await pool.query(
            `SELECT p.id, p.title, p.price, p.seller_id, p.status,
                    u.name as seller_name
             FROM products p
             JOIN users u ON p.seller_id = u.id
             WHERE p.id = $1 AND p.status = 'APPROVED'`,
            [product_id]
        )

        if (product.rows.length === 0) {
            return res.status(404).json({ message: 'Product not available' })
        }

        const p = product.rows[0]

        if (p.seller_id === req.user.id) {
            return res.status(400).json({ message: 'You cannot buy your own product' })
        }

        // FIX 2: Removed stock_quantity <= 0 check — column doesn't exist
        // FIX 3: Check if product already has a PENDING/ACTIVE order (replaces stock check)
        const existingOrder = await pool.query(
            `SELECT id FROM orders
             WHERE product_id = $1
               AND status NOT IN ('CANCELLED', 'DELIVERED')
             LIMIT 1`,
            [product_id]
        )
        if (existingOrder.rows.length > 0) {
            return res.status(400).json({ message: 'This product already has an active order.' })
        }

        const buyer = await pool.query(
            'SELECT name, email FROM users WHERE id = $1',
            [req.user.id]
        )
        const buyerName = buyer.rows[0].name

        // FIX 4: Removed settings table query — hardcode 10% commission rate
        // (add a settings table later if you need dynamic rates)
        const commissionRate = 10
        const commissionAmount = (p.price * commissionRate) / 100
        const sellerAmount = p.price - commissionAmount

        // FIX 5: Removed stock_quantity UPDATE — column doesn't exist
        // Mark product as SOLD when order is created to prevent double orders
        await pool.query(
            `UPDATE products SET status = 'SOLD' WHERE id = $1`,
            [product_id]
        )

        const order = await pool.query(
            `INSERT INTO orders
               (user_id, product_id, payment_method, status,
                commission_rate, commission_amount, seller_amount)
             VALUES ($1, $2, $3, 'PENDING', $4, $5, $6)
             RETURNING *`,
            [req.user.id, product_id, payment_method, commissionRate, commissionAmount, sellerAmount]
        )

        await pool.query(
            `INSERT INTO agreements (order_id, agreement_text, seller_id)
             VALUES ($1, $2, $3)`,
            [order.rows[0].id, AGREEMENT_TEXT(p.title, p.price, buyerName, p.seller_name), p.seller_id]
        )

        const seller = await pool.query(
            'SELECT name, email FROM users WHERE id = $1',
            [p.seller_id]
        )

        sendOrderConfirmationEmail(
            buyer.rows[0].email,
            buyerName,
            order.rows[0].id,
            p.title,
            p.price,
            payment_method
        ).catch(console.error)

        sendSellerNotificationEmail(
            seller.rows[0].email,
            seller.rows[0].name,
            p.title,
            buyerName,
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
        await pool.query(`UPDATE orders SET agreement_signed = true WHERE id = $1`, [id])
        await pool.query(`UPDATE agreements SET signed_at = NOW() WHERE order_id = $1`, [id])
        return res.json({ message: 'Agreement signed by buyer' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const sellerSignAgreement = async (req: any, res: Response) => {
    const { id } = req.params
    try {
        const agreement = await pool.query(
            `SELECT a.* FROM agreements a
             JOIN orders o ON a.order_id = o.id
             WHERE a.order_id = $1 AND a.seller_id = $2`,
            [id, req.user.id]
        )
        if (agreement.rows.length === 0) {
            return res.status(404).json({ message: 'Agreement not found' })
        }
        await pool.query(
            `UPDATE agreements SET seller_signed_at = NOW() WHERE order_id = $1`,
            [id]
        )
        return res.json({ message: 'Agreement signed by seller' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const submitPaymentProof = async (req: any, res: Response) => {
    const { id } = req.params
    const { payment_reference } = req.body
    try {
        const order = await pool.query(
            `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
            [id, req.user.id]
        )
        if (order.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' })
        }
        if (!order.rows[0].agreement_signed) {
            return res.status(400).json({ message: 'Please sign the agreement first' })
        }
        await pool.query(
            `UPDATE orders SET payment_reference = $1, status = 'AWAITING_CONFIRMATION' WHERE id = $2`,
            [payment_reference, id]
        )
        return res.json({ message: 'Payment proof submitted. Admin will confirm within 24 hours.' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const confirmPayment = async (req: any, res: Response) => {
    const { id } = req.params
    try {
        await pool.query(
            `UPDATE orders SET status = 'PAID', payment_confirmed_at = NOW() WHERE id = $1`,
            [id]
        )
        const orderData = await pool.query(
            `SELECT o.*, u.name as buyer_name, u.email as buyer_email, p.title as product_title
             FROM orders o
             JOIN users u ON o.user_id = u.id
             JOIN products p ON o.product_id = p.id
             WHERE o.id = $1`,
            [id]
        )
        if (orderData.rows.length > 0) {
            const o = orderData.rows[0]
            sendOrderStatusEmail(o.buyer_email, o.buyer_name, o.id, o.product_title, 'PAID').catch(console.error)
        }
        return res.json({ message: 'Payment confirmed' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const confirmReceived = async (req: any, res: Response) => {
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
            `UPDATE orders SET confirmed_received = true, status = 'DELIVERED' WHERE id = $1`,
            [id]
        )
        const orderData = await pool.query(
            `SELECT o.*, u.name as buyer_name, u.email as buyer_email, p.title as product_title
             FROM orders o JOIN users u ON o.user_id = u.id
             JOIN products p ON o.product_id = p.id
             WHERE o.id = $1`,
            [id]
        )
        if (orderData.rows.length > 0) {
            const o = orderData.rows[0]
            sendOrderStatusEmail(o.buyer_email, o.buyer_name, o.id, o.product_title, 'DELIVERED').catch(console.error)
        }
        return res.json({ message: 'Delivery confirmed' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const getById = async (req: any, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT o.*,
                    p.title as product_title, p.price as product_price,
                    p.images as product_images, p.seller_id,
                    u.name as seller_name,
                    a.agreement_text, a.signed_at as buyer_signed_at,
                    a.seller_signed_at
             FROM orders o
             JOIN products p ON o.product_id = p.id
             JOIN users u ON p.seller_id = u.id
             LEFT JOIN agreements a ON a.order_id = o.id
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
            `SELECT o.*, p.title as product_title, p.price as product_price,
                    p.images as product_images
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

// FIX 6: Removed stock_quantity from sellerOrders SELECT — column doesn't exist
export const sellerOrders = async (req: any, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT o.*,
                    p.title as product_title, p.price as product_price,
                    p.condition as product_condition,
                    u.name as buyer_name, u.phone as buyer_phone, u.email as buyer_email,
                    a.signed_at as buyer_signed_at, a.seller_signed_at
             FROM orders o
             JOIN products p ON o.product_id = p.id
             JOIN users u ON o.user_id = u.id
             LEFT JOIN agreements a ON a.order_id = o.id
             WHERE p.seller_id = $1
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
        const orderData = await pool.query(
            `SELECT o.*, u.name as buyer_name, u.email as buyer_email, p.title as product_title
             FROM orders o JOIN users u ON o.user_id = u.id
             JOIN products p ON o.product_id = p.id
             WHERE o.id = $1`,
            [req.params.id]
        )
        if (orderData.rows.length > 0) {
            const o = orderData.rows[0]
            sendOrderStatusEmail(o.buyer_email, o.buyer_name, o.id, o.product_title, status).catch(console.error)
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
                    u.name as buyer_name,
                    a.signed_at as buyer_signed_at,
                    a.seller_signed_at,
                    a.agreement_text
             FROM orders o
             JOIN products p ON o.product_id = p.id
             JOIN users u ON o.user_id = u.id
             LEFT JOIN agreements a ON a.order_id = o.id
             ORDER BY o.created_at DESC`
        )
        return res.json({ data: result.rows })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}

export const confirmCashReceived = async (req: any, res: Response) => {
    const { id } = req.params
    try {
        const order = await pool.query(
            `SELECT o.* FROM orders o
             JOIN products p ON o.product_id = p.id
             WHERE o.id = $1 AND p.seller_id = $2`,
            [id, req.user.id]
        )
        if (order.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' })
        }
        if (order.rows[0].payment_method !== 'COD') {
            return res.status(400).json({ message: 'Not a cash on delivery order' })
        }
        await pool.query(
            `UPDATE orders SET status = 'PAID', payment_confirmed_at = NOW(),
             payment_reference = 'CASH_ON_DELIVERY' WHERE id = $1`,
            [id]
        )
        return res.json({ message: 'Cash payment confirmed' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server error' })
    }
}