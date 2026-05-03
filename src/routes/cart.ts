// backend/src/routes/cart.ts

import { Router } from 'express'
import { getCart, addToCart, removeFromCart, clearCart } from '../controllers/cart'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.use(requireAuth) // all cart routes require login

router.get('/', getCart)
router.post('/', addToCart)

// ✅ FIX: clearCart MUST come before /:product_id
// Express matches routes top-to-bottom — if /:product_id is first,
// DELETE /cart will match it with product_id = undefined, causing the $1 SQL error
router.delete('/', clearCart)
router.delete('/:product_id', removeFromCart)

export default router