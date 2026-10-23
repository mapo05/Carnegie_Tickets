import sharp from 'sharp';
import { mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  cleanupExpiredPhotos,
  privatePhotoDirectory,
  withPrivatePhoto,
} from '../app/api/verification/photo-storage';

describe('SEC-03 temporary photo protection', () => {
  const originalEncryptionKey = process.env.STUDENT_PHOTO_ENCRYPTION_KEY;

  afterEach(() => {
    if (originalEncryptionKey === undefined) {
      delete process.env.STUDENT_PHOTO_ENCRYPTION_KEY;
    } else {
      process.env.STUDENT_PHOTO_ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  it('removes image metadata, encrypts the temporary photo, and deletes it after processing.', async () => {
    process.env.STUDENT_PHOTO_ENCRYPTION_KEY = '11'.repeat(32);
    const image = await sharp({
      create: { width: 1, height: 1, channels: 3, background: 'red' },
    }).jpeg().withMetadata({ orientation: 6 }).toBuffer();

    expect((await sharp(image).metadata()).exif).toBeDefined();

    await withPrivatePhoto(image, 'image/jpeg', async (sanitizedPhoto) => {
      expect(privatePhotoDirectory.startsWith(tmpdir())).toBe(true);
      expect((await sharp(sanitizedPhoto).metadata()).exif).toBeUndefined();

      const [filename] = await readdir(privatePhotoDirectory);
      const encryptedPhoto = await readFile(join(privatePhotoDirectory, filename));
      expect(encryptedPhoto.includes(sanitizedPhoto)).toBe(false);
      if (process.platform !== 'win32') {
        expect(((await stat(join(privatePhotoDirectory, filename))).mode & 0o777)).toBe(0o600);
      }
    });

    expect(await readdir(privatePhotoDirectory)).toHaveLength(0);
  });

  it('removes abandoned temporary photos before the 24-hour deadline.', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'carnegie-photo-expiry-'));
    const oldPhoto = join(directory, 'old-photo');
    const recentPhoto = join(directory, 'recent-photo');
    const now = new Date();
    await writeFile(oldPhoto, 'encrypted');
    await writeFile(recentPhoto, 'encrypted');
    await utimes(oldPhoto, new Date(now.getTime() - 23.9 * 60 * 60 * 1000), new Date(now.getTime() - 23.9 * 60 * 60 * 1000));
    await utimes(recentPhoto, new Date(now.getTime() - 23.5 * 60 * 60 * 1000), new Date(now.getTime() - 23.5 * 60 * 60 * 1000));

    try {
      await cleanupExpiredPhotos(directory);
      expect(await readdir(directory)).toEqual(['recent-photo']);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
