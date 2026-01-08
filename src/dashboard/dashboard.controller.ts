// src/dashboard/dashboard.controller.ts
import { Controller, Get, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private prisma: PrismaService) {}

  @Get('summary')
  @UseGuards(AuthGuard('jwt'))
  async getDashboardSummary(@Req() req: any) {
    // Ambil userId dari payload JWT
    const userId = req.user.userId;

    // 1. Ambil info user
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { 
        username: true, 
        first_name: true, 
        profile_picture_url: true 
      }
    });

    // Proteksi: Jika user tidak ada di database, hentikan proses
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    // 2. Ambil jumlah kursus yang diikuti
    const enrolledCourses = await this.prisma.user_courses.count({
      where: { user_id: userId }
    });

    // 3. (Opsional) Ambil jumlah ujian yang selesai (contoh query)
    const completedExams = await this.prisma.user_exams.count({
      where: { 
        user_id: userId,
        status: 'completed' // Sesuaikan dengan field di database Anda
      }
    });

    // Nama yang akan ditampilkan (prioritas first_name, lalu username)
    const displayName = user.first_name || user.username;

    return {
      welcomeMessage: `Selamat berjuang di Pasti Lolos, ${displayName}!`,
      user: {
        username: user.username,
        profilePicture: user.profile_picture_url,
      },
      stats: {
        enrolledCourses,
        completedExams,
      }
    };
  }
}