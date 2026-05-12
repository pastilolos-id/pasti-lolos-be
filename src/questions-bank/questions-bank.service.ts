// src/bank-soal/bank-soal.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

@Injectable()
export class BankSoalService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async uploadBankSoal(file: Express.Multer.File, body: any, userId: number) {
    const upload = await this.cloudinary.uploadFile(file, 'bank_soal_pdfs');

    const thumbnailUrl = upload.secure_url.replace(/\.[^/.]+$/, '.jpg');

    // Simpan ke variable dulu, jangan langsung di-return
    const newAsset = await this.prisma.assets.create({
      data: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        assetName: body.title,

        filePath: upload.secure_url,
        fileType: 'pdf',

        fileSizeBytes: BigInt(upload.bytes),
        uploadedByUserId: userId,

        cdnUrl: upload.secure_url,

        thumbnailPath: thumbnailUrl,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        description: body.description,
        isPublic: true,
        storageProvider: 'cloudinary',
        metadataJson: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          category: body.category,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          subCategory: body.subCategory,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          year: body.year || new Date().getFullYear().toString(),
        },
      },
    });

    // KUNCI 2: Convert hasil return Prisma ke string sebelum dikirim ke Controller
    return {
      ...newAsset,
      fileSizeBytes: newAsset.fileSizeBytes
        ? newAsset.fileSizeBytes.toString()
        : null,
    };
  }

  async getBankSoal(category?: string, subCategory?: string) {
    const where: any = { fileType: 'pdf' };

    if (category || subCategory) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      where.AND = [];
      if (category) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        where.AND.push({
          metadataJson: { path: ['category'], equals: category },
        });
      }
      if (subCategory) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        where.AND.push({
          metadataJson: { path: ['subCategory'], equals: subCategory },
        });
      }
    }

    const data = await this.prisma.assets.findMany({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where,
      orderBy: { uploadDate: 'desc' },
    });

    return data.map((item) => ({
      ...item,
      fileSizeBytes: item.fileSizeBytes ? item.fileSizeBytes.toString() : null,
    }));
  }
}
