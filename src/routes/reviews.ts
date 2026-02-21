import { Router } from 'express'
import { create, getByProduct } from '../controllers/reviews'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.post('/', requireAuth, create)
router.get('/product/:productId', getByProduct)

export default router