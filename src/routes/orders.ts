import { Router } from 'express'
import { create, signAgreement, getById, myOrders, updateStatus, getAll } from '../controllers/orders'
import { requireAuth, requireAdmin } from '../middleware/auth'

const router = Router()

router.post('/', requireAuth, create)
router.get('/my', requireAuth, myOrders)
router.get('/:id', requireAuth, getById)
router.post('/:id/sign-agreement', requireAuth, signAgreement)
router.patch('/:id/status', requireAuth, requireAdmin, updateStatus)

export default router