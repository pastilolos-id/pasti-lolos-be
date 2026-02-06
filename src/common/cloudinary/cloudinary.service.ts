// src/common/cloudinary/cloudinary.service.ts
import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
const streamifier = require('streamifier');

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
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!file || !file.buffer) {
      return reject(new Error('File buffer kosong!'));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto', // PDF, video, image
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
}

// src/common/cloudinary/cloudinary.service.ts

async deleteFile(publicId: string) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) return reject(error);
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