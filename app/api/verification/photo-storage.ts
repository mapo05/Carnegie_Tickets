import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const cleanupInterval = 15 * 60 * 1000;
const photoLifetime = 24 * 60 * 60 * 1000 - cleanupInterval;

export const privatePhotoDirectory = join(tmpdir(), `carnegie-tickets-photos-${process.pid}`);

declare global {
  var carnegiePhotoCleanupTimer: NodeJS.Timeout | undefined;
}

function encryptionKey() {
  const value = process.env.STUDENT_PHOTO_ENCRYPTION_KEY;
  if (!value || !/^[\da-f]{64}$/i.test(value)) {
    throw new Error('STUDENT_PHOTO_ENCRYPTION_KEY must be set to 32 bytes encoded as 64 hexadecimal characters.');
  }
  return Buffer.from(value, 'hex');
}

async function ensurePrivateDirectory(directory: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const directoryInfo = await lstat(directory);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
    throw new Error('Private photo storage must be a real directory.');
  }
  if (process.platform !== 'win32') await chmod(directory, 0o700);
}

export async function cleanupExpiredPhotos(directory = privatePhotoDirectory) {
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }

  const cutoff = Date.now() - photoLifetime;
  await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry);
    const info = await lstat(path);
    if (info.isFile() && info.mtimeMs <= cutoff) await unlink(path);
  }));
}

async function sanitizePhoto(photo: Buffer, mimeType: string) {
  const expectedFormat = mimeType === 'image/jpeg' ? 'jpeg' : mimeType === 'image/png' ? 'png' : undefined;
  if (!expectedFormat) throw new Error('Unsupported student photo format.');

  const image = sharp(photo, { limitInputPixels: 40_000_000 });
  const metadata = await image.metadata();
  if (metadata.format !== expectedFormat) throw new Error('Student photo contents do not match the declared image format.');

  const sanitized = await image
    .rotate()
    .toFormat(expectedFormat)
    .toBuffer();
  return sanitized;
}

function encryptPhoto(photo: Buffer, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(photo), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

function decryptPhoto(encryptedPhoto: Buffer, key: Buffer) {
  const iv = encryptedPhoto.subarray(0, 12);
  const authTag = encryptedPhoto.subarray(12, 28);
  const ciphertext = encryptedPhoto.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export async function withPrivatePhoto<T>(
  photo: Buffer,
  mimeType: string,
  processPhoto: (sanitizedPhoto: Buffer) => Promise<T>,
) {
  const key = encryptionKey();
  const sanitizedPhoto = await sanitizePhoto(photo, mimeType);
  await ensurePrivateDirectory(privatePhotoDirectory);
  await cleanupExpiredPhotos();

  const path = join(privatePhotoDirectory, randomUUID());
  await writeFile(path, encryptPhoto(sanitizedPhoto, key), { flag: 'wx', mode: 0o600 });

  try {
    return await processPhoto(decryptPhoto(await readFile(path), key));
  } finally {
    await unlink(path);
  }
}

if (!globalThis.carnegiePhotoCleanupTimer) {
  globalThis.carnegiePhotoCleanupTimer = setInterval(() => {
    cleanupExpiredPhotos().catch((error: unknown) => {
      console.error('Failed to remove expired temporary student photos.', error);
    });
  }, cleanupInterval);
  if (typeof globalThis.carnegiePhotoCleanupTimer !== 'number') {
    globalThis.carnegiePhotoCleanupTimer.unref();
  }
}

cleanupExpiredPhotos().catch((error: unknown) => {
  console.error('Failed to remove expired temporary student photos.', error);
});
