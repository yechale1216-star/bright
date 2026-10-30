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

// Browser-incompatible video formats
const BLOCKED_VIDEO_EXTS = /\.(avi|wmv|flv|3gp|3g2|rm|rmvb|vob|ts|mts|m2ts)$/i;
const BLOCKED_VIDEO_TYPES = ['video/avi', 'video/x-msvideo', 'video/x-ms-wmv', 'video/flv', 'video/x-flv'];

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max file size
  },
  fileFilter: (_req, file, cb) => {
    // Block browser-incompatible video formats
    if (
      BLOCKED_VIDEO_TYPES.includes(file.mimetype) ||
      (file.mimetype.startsWith('video/') && BLOCKED_VIDEO_EXTS.test(file.originalname))
    ) {
      return cb(new Error('Unsupported video format. Please convert to MP4, WebM, or MOV before uploading.'));
    }
    cb(null, true);
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

  // Backend URL where static files are served from /uploads
  const baseUrl = isLocal
    ? `${protocol}://${host}`
    : (process.env.RENDER_EXTERNAL_URL || (process.env.BACKEND_URL && !process.env.BACKEND_URL.includes('vercel.app') ? process.env.BACKEND_URL : null) || 'https://bright-8uji.onrender.com');

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

// Handle multer errors (including unsupported format)
router.use((err: any, _req: Request, res: Response, next: any) => {
  if (err instanceof multer.MulterError || err.message?.includes('Unsupported video format')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

export default router;
