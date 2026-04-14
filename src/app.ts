import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
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

app.set('trust proxy', 1)

/**
 * SECURITY HEADERS
 */
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
}))

/**
 * CORS FIX (Vercel + Local + Postman safe)
 */
const allowedOrigins = [
    'https://fashamarket.vercel.app',
    'https://fasha-market-frontend-4q2piabh1-yves-projects-49262b89.vercel.app',
    'http://localhost:5173'
]

app.use(cors({
    origin: function (origin, callback) {
        // allow Postman / server-to-server requests
        if (!origin) return callback(null, true)

        if (allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            // IMPORTANT: do NOT throw error (this breaks CORS preflight)
            callback(null, false)
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}))
/**
 * BODY PARSING
 */
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * RATE LIMITERS
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
})

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: 'Too many login attempts. Please wait 15 minutes and try again.' },
    standardHeaders: true,
    legacyHeaders: false,
})

const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { message: 'Too many uploads, slow down.' },
})

app.use(globalLimiter)

/**
 * ROOT ROUTE (for browser testing)
 */
app.get('/', (req, res) => {
    res.json({
        message: 'FashaMarket API is running 🚀',
        health: '/api/health',
        status: 'OK'
    })
})

/**
 * HEALTH CHECK
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

/**
 * ROUTES
 */
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/upload', uploadLimiter, uploadRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/reviews', reviewRoutes)

/**
 * ERROR HANDLER
 */
app.use(errorHandler)

/**
 * START SERVER
 */
const PORT = Number(process.env.PORT) || 5000

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`Environment: ${process.env.NODE_ENV}`)
    console.log(`Database URL exists: ${!!process.env.DATABASE_URL}`)
    console.log(`JWT Secret exists: ${!!process.env.JWT_SECRET}`)
})

/**
 * PROCESS HANDLERS
 */
process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err)
})

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err)
})

export default app