import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Store uploads in <root>/server/uploads consistently
export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    cb(null, `${cleanBase}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max file size
  }
});

/**
 * POST /api/upload
 * Accepts multipart/form-data with field 'file'
 */
router.post('/', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const forwardedProto = req.headers['x-forwarded-proto'] as string;
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
  const host = req.get('host') || 'localhost:5000';
  const isLocal =
    host.includes('localhost') ||
    host.includes('127.0.0.1') ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.startsWith('172.');

  // If request is made to local dev server, return local URL so browser can load it immediately
  const baseUrl = isLocal
    ? `${protocol}://${host}`
    : (process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : `${protocol}://${host}`);

  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

  return res.status(200).json({
    success: true,
    url: fileUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

export default router;
