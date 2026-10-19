import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Las imágenes se reciben en memoria y se guardan en MongoDB (ver MediaService).
 * SVG queda afuera porque puede contener scripts.
 */
export function imageUploadOptions(maxMb: number, files = 1): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024, files },
    fileFilter: (_req, file, cb) =>
      IMAGE_TYPES.includes(file.mimetype)
        ? cb(null, true)
        : cb(new BadRequestException('Formato no permitido. Usá JPG, PNG, WEBP o GIF'), false),
  };
}

/** URL pública de una imagen guardada en la colección `media`. */
export const mediaUrl = (id?: unknown) => (id ? `/api/media/${String(id)}` : null);
