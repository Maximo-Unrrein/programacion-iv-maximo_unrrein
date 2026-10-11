import { Controller, Get, Headers, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MediaService } from './media.service';

/** Sirve las imágenes guardadas en MongoDB. Es público porque las etiquetas <img> no envían el token. */
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get(':id')
  async findOne(@Param('id') id: string, @Headers('if-none-match') ifNoneMatch: string | undefined, @Res() res: Response) {
    const etag = `"${id}"`;
    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      // Si alguien abre un archivo directo (p. ej. un SVG del seed), no puede ejecutar scripts
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    });
    // Las imágenes son inmutables: el id alcanza como ETag
    if (ifNoneMatch === etag) return res.status(304).end();

    const media = await this.media.findOne(id);
    if (!media) throw new NotFoundException('Imagen no encontrada');
    res.type(media.contentType).send(toBuffer(media.data));
  }
}

/** Con `lean()` el campo llega como BSON Binary; se convierte a Buffer sin copiar. */
function toBuffer(raw: unknown): Buffer {
  if (Buffer.isBuffer(raw)) return raw;
  const binary = raw as { buffer: Uint8Array; position?: number };
  const bytes = binary.position !== undefined ? binary.buffer.subarray(0, binary.position) : binary.buffer;
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
