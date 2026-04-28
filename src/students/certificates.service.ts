import { Injectable, NotFoundException } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  async generateExamCertificate(userExamId: number, res: Response) {
    const attempt = await this.prisma.userExams.findUnique({
      where: { id: userExamId },
      include: { 
        user: true, 
        exam: true 
      },
    });

    if (!attempt || attempt.status !== 'submitted') {
      throw new NotFoundException('Data ujian tidak ditemukan atau belum selesai');
    }

    const doc = new PDFDocument({ layout: 'landscape', size: 'A4' });

    // Set Header Response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Sertifikat-${attempt.id}.pdf`);

    doc.pipe(res);

    // --- DESAIN SERTIFIKAT ---
    // Frame luar
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();

    // Konten
    doc.fontSize(40).text('SERTIFIKAT KELULUSAN', { align: 'center' }).moveDown();
    doc.fontSize(20).text('Diberikan kepada:', { align: 'center' }).moveDown(0.5);
    
    // Nama User
    doc.fontSize(35).font('Helvetica-Bold').text(attempt.user.firstName + ' ' + (attempt.user.lastName || ''), { align: 'center' }).moveDown();
    
    doc.fontSize(18).font('Helvetica').text(`Atas keberhasilannya menyelesaikan ujian:`, { align: 'center' });
    doc.fontSize(22).font('Helvetica-Bold').text(`${attempt.exam.examName}`, { align: 'center' }).moveDown();

    doc.fontSize(16).font('Helvetica').text(`Skor Akhir: ${attempt.score}`, { align: 'center' }).moveDown(2);

    // Footer
    doc.fontSize(12).text(`Diterbitkan pada: ${new Date().toLocaleDateString('id-ID')}`, { align: 'right' });
    doc.text('Pasti Lolos Indonesia', { align: 'right' });

    doc.end();
  }
}