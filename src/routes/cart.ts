// backend/src/routes/cart.ts

import { Router } from 'express'
import { getCart, addToCart, removeFromCart, clearCart } from '../controllers/cart'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.use(requireAuth) // all cart routes require login

router.get('/', getCart)
router.post('/', addToCart)
router.delete('/:product_id', removeFromCart)
router.delete('/', clearCart)

export default router