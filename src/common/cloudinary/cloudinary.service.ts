// src/common/cloudinary/cloudinary.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import streamifier from 'streamifier';
import type { RemoteImageUploadResult } from './remote-image-upload.types';

export type { RemoteImageUploadResult } from './remote-image-upload.types';

function isPrivateOrLoopbackIpv4(host: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split('.').map((p) => parseInt(p, 10));
  if (parts.some((n) => n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/** Host yang dipakai di dokumentasi RFC — tidak ada di DNS publik nyata. */
function isReservedDocumentationHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  const roots = new Set([
    'example.com',
    'example.net',
    'example.org',
    'example.edu',
    'invalid',
    'test',
  ]);
  if (roots.has(h)) return true;
  if (
    h.endsWith('.example.com') ||
    h.endsWith('.example.net') ||
    h.endsWith('.example.org')
  ) {
    return true;
  }
  return false;
}

function formatRemoteImageFetchFailure(
  cloudinaryMessage: string,
  sourceUrl: string,
): string {
  const raw = cloudinaryMessage || '';
  const lower = raw.toLowerCase();

  if (lower.includes('err_dns_fail') || /\bdns\b/.test(lower)) {
    return (
      'URL gambar tidak bisa dijangkau dari internet (gagal DNS). ' +
      'Pastikan domain benar-benar aktif dan file bisa diakses lewat HTTPS tanpa login. ' +
      'Hindari URL contoh seperti *example.com (mis. cdn.example.com).'
    );
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return 'URL gambar mengembalikan 404 — file tidak ada di path tersebut.';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'Waktu tunggu mengambil gambar dari URL habis — coba lagi atau gunakan host yang lebih cepat.';
  }

  const short = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
  return `Gagal mengambil gambar dari URL (${sourceUrl}): ${short}`;
}

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: 'dba9gwcs2',
      api_key: '764965293996426',
      api_secret: 'qgqUg_I2dRDWlWD2K5JeVSCNKl8',
    });
  }

  /** Tolak URL yang berisiko SSRF (skema/host/IP privat). */
  assertSafeRemoteAssetUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      throw new BadRequestException('URL aset tidak valid');
    }
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new BadRequestException('Hanya URL http(s) yang diperbolehkan');
    }
    const host = parsed.hostname.toLowerCase();
    if (isReservedDocumentationHost(host)) {
      throw new BadRequestException(
        `Host "${host}" adalah domain contoh (RFC) — tidak ada di internet nyata. ` +
          'Ganti imageUrl dengan URL gambar Anda yang valid (CDN, bucket, atau upload dulu ke penyedia file).',
      );
    }
    if (
      host === 'localhost' ||
      host === '::1' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local')
    ) {
      throw new BadRequestException('Host URL tidak diperbolehkan');
    }
    if (isPrivateOrLoopbackIpv4(host)) {
      throw new BadRequestException('Alamat IP privat tidak diperbolehkan');
    }
  }

  /**
   * Upload gambar dari URL publik ke Cloudinary (fetch oleh Cloudinary).
   */
  async uploadFromRemoteUrl(
    url: string,
    folder: string = 'pasti-lolos/question-images',
  ): Promise<RemoteImageUploadResult> {
    const trimmed = url.trim();
    this.assertSafeRemoteAssetUrl(trimmed);

    return new Promise((resolve, reject) => {
      void cloudinary.uploader.upload(
        trimmed,
        {
          folder,
          resource_type: 'image',
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error) {
            return reject(
              new BadRequestException(
                formatRemoteImageFetchFailure(
                  typeof error.message === 'string' ? error.message : '',
                  trimmed,
                ),
              ),
            );
          }
          if (!result) {
            return reject(new BadRequestException('Respons Cloudinary kosong'));
          }
          const secure = result.secure_url;
          if (typeof secure !== 'string' || secure.length === 0) {
            return reject(
              new BadRequestException('Respons Cloudinary tanpa secure_url'),
            );
          }
          resolve({ secureUrl: secure });
        },
      );
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'pasti-lolos/uploads',
  ): Promise<UploadApiResponse> {
    // Ganti any jadi UploadApiResponse
    return new Promise((resolve, reject) => {
      // 1. Validasi awal
      if (!file || !file.buffer) {
        return reject(new BadRequestException('File buffer kosong!'));
      }

      // 2. Buat Upload Stream dengan type yang jelas
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error) {
            // Fix: Pastikan reject selalu mengirimkan objek Error
            return reject(
              new Error(error.message || 'Cloudinary Upload Error'),
            );
          }
          if (!result) {
            return reject(new Error('Cloudinary result is undefined'));
          }
          resolve(result);
        },
      );

      // 3. Fix: no-unsafe-call & no-unsafe-member-access pada streamifier
      // Kita cast streamifier ke interface yang dikenali TS
      const stream = streamifier as {
        createReadStream: (buffer: Buffer) => NodeJS.ReadableStream;
      };

      stream.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  // src/common/cloudinary/cloudinary.service.ts

  async deleteFile(publicId: string) {
    return new Promise((resolve, reject) => {
      void cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          // Pastikan yang di-reject adalah instance dari Error
          return reject(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
        resolve(result);
      });
    });
  }
  //   async uploadFile(file: Express.Multer.File, folder: string = 'learning-assets') {
  //     return new Promise((resolve, reject) => {
  //       const uploadStream = cloudinary.uploader.upload_stream(
  //         {
  //           folder: folder,
  //           resource_type: 'auto', // 'auto' supaya bisa PDF, Video, atau Gambar
  //           timeout: 10000,
  //         },
  //         (error, result) => {
  //           if (error) return reject(error);
  //           resolve(result);
  //         },
  //       );

  //       streamifier.createReadStream(file.buffer).pipe(uploadStream);
  //     });
  //   }
}
