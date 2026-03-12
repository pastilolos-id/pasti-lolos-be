// src/common/cloudinary/cloudinary.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: 'dba9gwcs2',
      api_key: '764965293996426',
      api_secret: 'qgqUg_I2dRDWlWD2K5JeVSCNKl8',
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
