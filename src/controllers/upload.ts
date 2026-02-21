import { Response } from 'express'
import cloudinary from '../config/cloudinary'

export const uploadImage = async (req: any, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file provided' })
        }

        const result = await new Promise<any>((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { folder: 'fashamarket/products', quality: 'auto', fetch_format: 'auto' },
                (error, result) => {
                    if (error) reject(error)
                    else resolve(result)
                }
            ).end(req.file.buffer)
        })

        return res.json({ url: result.secure_url })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Upload failed' })
    }
}