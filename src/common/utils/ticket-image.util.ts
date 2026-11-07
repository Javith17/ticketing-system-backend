import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';

const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function isAllowedImageFile(file: {
  mimetype: string;
  originalname: string;
}): boolean {
  if (ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
    return true;
  }
  // Some clients (mobile apps, certain browsers) send images with a generic
  // application/octet-stream content-type instead of image/*. Fall back to
  // the file extension in that case.
  if (file.mimetype === 'application/octet-stream') {
    return ALLOWED_IMAGE_EXTENSIONS.includes(
      extname(file.originalname).toLowerCase(),
    );
  }
  return false;
}

export const TICKET_IMAGE_MULTER_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (
    _req: unknown,
    file: { mimetype: string; originalname: string },
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!isAllowedImageFile(file)) {
      return callback(
        new BadRequestException('Only image files are allowed'),
        false,
      );
    }
    callback(null, true);
  },
};

/**
 * Writes an uploaded ticket image to disk under uploads/<subfolder>/<ticketId>/,
 * separate subfolders per source so public-QR and mobile-app uploads don't collide.
 */
export function saveTicketImage(
  subfolder: string,
  ticketId: string,
  image: Express.Multer.File,
): string {
  const uploadRoot = process.env.UPLOAD_DIR || './uploads';
  const dir = join(uploadRoot, subfolder, ticketId);
  fs.mkdirSync(dir, { recursive: true });

  const fileName = `${Date.now()}${extname(image.originalname)}`;
  const filePath = join(dir, fileName);
  fs.writeFileSync(filePath, image.buffer);

  return filePath;
}
