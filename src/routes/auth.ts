import { Router } from 'express'
import {
    register, login, me, updateProfile, changePassword,
    validateRegister, validateLogin
} from '../controllers/auth'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.post('/register', validateRegister, register)
router.post('/login', validateLogin, login)
router.get('/me', requireAuth, me)
router.patch('/profile', requireAuth, updateProfile)
router.patch('/password', requireAuth, changePassword)

export default router