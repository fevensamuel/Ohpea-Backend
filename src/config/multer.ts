import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';

export const UPLOAD_PATH = process.env.UPLOAD_PATH || './uploads';
export const PRIVATE_UPLOAD_PATH = process.env.PRIVATE_UPLOAD_PATH || './private_uploads';

// Ensure base directories exist
for (const dir of [
  UPLOAD_PATH,
  path.join(UPLOAD_PATH, 'images'),
  path.join(UPLOAD_PATH, 'announcements'),
  path.join(UPLOAD_PATH, 'partners'),
  path.join(UPLOAD_PATH, 'activities'),
  PRIVATE_UPLOAD_PATH,
  path.join(PRIVATE_UPLOAD_PATH, 'members'),
]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Storage for public files
const publicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let sub = 'images';
    if (req.baseUrl.includes('announcements')) sub = 'announcements';
    else if (req.baseUrl.includes('partners')) sub = 'partners';
    else if (req.baseUrl.includes('activities')) sub = 'activities';
    const dest = path.join(UPLOAD_PATH, sub);
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

// Storage for private documents (Member ID and credentials)
const privateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(PRIVATE_UPLOAD_PATH, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `doc-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const fileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and PDF documents are allowed.'));
  }
  cb(null, true);
};

export const uploadPublic = multer({
  storage: publicStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter,
});

export const uploadPrivate = multer({
  storage: privateStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter,
});

export const memberRegistrationUpload = uploadPrivate.fields([
  { name: 'idDocument', maxCount: 1 },
  { name: 'cvCompanyProfile', maxCount: 1 },
  { name: 'academicCertificates', maxCount: 10 },
  { name: 'credentials', maxCount: 5 },
  { name: 'credentialDocs', maxCount: 10 },
]);

export function calculateFileHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
