import { Router } from 'express'
import { getAll, getById, create, approve, reject, getPending, myListings, deleteProduct } from '../controllers/products'
import { requireAuth, requireAdmin } from '../middleware/auth'

const router = Router()

router.get('/', getAll)
router.get('/my', requireAuth, myListings)
router.post('/', requireAuth, create)
router.patch('/:id/approve', requireAuth, requireAdmin, approve)
router.patch('/:id/reject', requireAuth, requireAdmin, reject)
router.delete('/:id', requireAuth, deleteProduct)
router.get('/:id', getById)

export default router