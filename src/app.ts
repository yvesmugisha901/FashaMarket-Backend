import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { body, validationResult } from 'express-validator'
import { errorHandler } from './middleware/error'
import authRoutes from './routes/auth'
import productRoutes from './routes/products'
import orderRoutes from './routes/orders'
import adminRoutes from './routes/admin'
import uploadRoutes from './routes/upload'
import categoryRoutes from './routes/categories'
import reviewRoutes from './routes/reviews'

dotenv.config()

const app = express()

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow images
    contentSecurityPolicy: false, // disable CSP for now (frontend handles it)
}))

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}))

// ── Body parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── Rate limiters ─────────────────────────────────────────────────────────────

// Global limiter — all routes
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per 15 min per IP
    message: { message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
})

// Strict limiter — login and register only
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // only 10 login attempts per 15 min
    message: { message: 'Too many login attempts. Please wait 15 minutes and try again.' },
    standardHeaders: true,
    legacyHeaders: false,
})

// Upload limiter
const uploadLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 uploads per minute
    message: { message: 'Too many uploads, slow down.' },
})

app.use(globalLimiter)

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/upload', uploadLimiter, uploadRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/reviews', reviewRoutes)

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(errorHandler)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`Environment: ${process.env.NODE_ENV}`)
    console.log(`Database URL exists: ${!!process.env.DATABASE_URL}`)
    console.log(`JWT Secret exists: ${!!process.env.JWT_SECRET}`)
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err)
})

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err)
})

export default app