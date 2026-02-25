import { Router } from 'express'
import {
    create,
    signAgreement,
    sellerSignAgreement,
    submitPaymentProof,
    confirmPayment,
    confirmCashReceived,
    confirmReceived,
    getById,
    myOrders,
    sellerOrders,
    updateStatus,
    getAll
} from '../controllers/orders'
import { requireAuth, requireAdmin } from '../middleware/auth'

const router = Router()

router.post('/', requireAuth, create)
router.get('/my', requireAuth, myOrders)
router.get('/seller', requireAuth, sellerOrders)
router.get('/:id', requireAuth, getById)
router.post('/:id/sign', requireAuth, signAgreement)
router.post('/:id/seller-sign', requireAuth, sellerSignAgreement)
router.post('/:id/payment-proof', requireAuth, submitPaymentProof)
router.post('/:id/confirm-payment', requireAuth, requireAdmin, confirmPayment)
router.post('/:id/confirm-received', requireAuth, confirmReceived)
router.patch('/:id/status', requireAuth, requireAdmin, updateStatus)
router.get('/', requireAuth, requireAdmin, getAll)
router.post('/:id/confirm-cash', requireAuth, confirmCashReceived)

export default router