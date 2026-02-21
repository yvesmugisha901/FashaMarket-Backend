import { Router } from 'express'
import {
    getStats, getAllUsers, verifySeller, suspendUser, changeUserRole,
    getAllProducts, approveProduct, rejectProduct,
    getAllOrders, updateOrderStatus,
    getAuditLogs, getRevenueReport
} from '../controllers/admin'
import { requireAuth, requireAdmin } from '../middleware/auth'

const router = Router()

router.use(requireAuth, requireAdmin)

router.get('/stats', getStats)
router.get('/users', getAllUsers)
router.patch('/users/:id/verify', verifySeller)
router.patch('/users/:id/suspend', suspendUser)
router.patch('/users/:id/role', changeUserRole)
router.get('/products', getAllProducts)
router.get('/products/pending', getAllProducts)
router.patch('/products/:id/approve', approveProduct)
router.patch('/products/:id/reject', rejectProduct)
router.get('/orders', getAllOrders)
router.patch('/orders/:id/status', updateOrderStatus)
router.get('/audit-logs', getAuditLogs)
router.get('/revenue', getRevenueReport)

export default router