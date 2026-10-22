/** Lado mayor máximo de las imágenes que se suben (px). */
const MAX_SIDE = 1600;
/** Debajo de este peso, si además no supera MAX_SIDE, la imagen se sube tal cual. */
const SMALL_ENOUGH = 400 * 1024;

/** Máximo de un envío completo: el hosting (Vercel) corta los requests de más de 4,5 MB. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Achica una imagen en el navegador antes de subirla: máximo 1600 px por lado, en WebP
 * (o JPEG si el navegador no codifica WebP). Las fotos de celular pasan de varios MB a unos cientos de KB.
 * Los GIF no se tocan (perderían la animación) y si algo falla se devuelve el archivo original.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SMALL_ENOUGH) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    let blob = await toBlob(canvas, 'image/webp');
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg');
    // Si no se pudo achicar (o quedó más pesada), se sube la original
    if (!blob || blob.size >= file.size) return file;

    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const name = file.name.replace(/\.[^.]+$/, '') + '.' + ext;
    return new File([blob], name, { type: blob.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
