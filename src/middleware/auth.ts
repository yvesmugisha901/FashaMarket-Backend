import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
    user?: { id: string; role: string }
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = header.split(' ')[1]
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; role: string }
        req.user = decoded
        next()
    } catch {
        return res.status(401).json({ message: 'Invalid token' })
    }
}

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden' })
    }
    next()
}