import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Media } from './media.schema';

/** Firmas de archivo ("magic bytes") de los formatos aceptados: no se confía sólo en el mimetype. */
function sniff(data: Buffer): string | null {
  if (data.length < 12) return null;
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'image/png';
  if (data.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
  if (data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

@Injectable()
export class MediaService {
  constructor(@InjectModel(Media.name) private readonly media: Model<Media>) {}

  /** Guarda una imagen subida por un usuario (sólo formatos raster verificados por contenido). */
  async save(file: Express.Multer.File, ownerId: string): Promise<Types.ObjectId> {
    const contentType = sniff(file.buffer);
    if (!contentType) throw new BadRequestException('El archivo no es una imagen válida (JPG, PNG, WEBP o GIF)');
    return this.store(file.buffer, contentType, ownerId);
  }

  /** Guarda contenido ya confiable (lo usa el seed, p. ej. para las ilustraciones SVG). */
  async store(data: Buffer, contentType: string, ownerId?: string | Types.ObjectId): Promise<Types.ObjectId> {
    const doc = await this.media.create({ data, contentType, size: data.length, owner: ownerId });
    return doc._id;
  }

  findOne(id: string) {
    return isValidObjectId(id) ? this.media.findById(id).lean() : null;
  }

  async remove(id?: Types.ObjectId | string | null) {
    if (id) await this.media.deleteOne({ _id: id });
  }
}
