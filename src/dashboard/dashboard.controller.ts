import {
  Controller,
  Get,
  UseGuards,
  Req,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiCookieAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';
import type { Request } from 'express';
import type { JwtRequestUser } from 'src/types/express';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private prisma: PrismaService,
    private dashboardService: DashboardService,
  ) {}

  @Get('summary')
  @ApiCookieAuth()
  @UseGuards(AuthGuard('jwt'))
  async getDashboardSummary(@Req() req: Request) {
    const authUser = req.user as JwtRequestUser | undefined;
    if (!authUser?.userId) {
      throw new NotFoundException('User tidak ditemukan');
    }
    const userId = authUser.userId;

    const userRecord = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        username: true,
        firstName: true,
        profilePictureUrl: true,
      },
    });

    if (!userRecord) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const enrolledCourses = await this.prisma.userCourses.count({
      where: { userId: userId },
    });

    const completedExams = await this.prisma.userExams.count({
      where: {
        userId: userId,
        status: 'completed',
      },
    });

    const displayName = userRecord.firstName || userRecord.username;

    return {
      welcomeMessage: `Selamat berjuang di Pasti Lolos, ${displayName}!`,
      user: {
        username: userRecord.username,
        profilePicture: userRecord.profilePictureUrl,
      },
      stats: {
        enrolledCourses,
        completedExams,
      },
    };
  }

  @Get('admin/summary')
  @ApiCookieAuth()
  @UseGuards(AuthGuard('jwt'))
  async getAdminSummary() {
    return this.dashboardService.getAdminSummary();
  }

  @Get('admin/revenue-chart')
  @ApiCookieAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiQuery({
    name: 'period',
    enum: ['daily', 'monthly', 'yearly'],
    required: false,
    description: 'Periode grafik revenue (default: daily)',
  })
  async getRevenueChart(
    @Query('period') period?: 'daily' | 'monthly' | 'yearly',
  ) {
    return this.dashboardService.getRevenueChart(period ?? 'daily');
  }

  @Get('admin/top-sales')
  @ApiCookieAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Jumlah top sale yang ditampilkan (default: 10)',
  })
  async getTopSales(@Query('limit') limit?: string) {
    return this.dashboardService.getTopSales(limit ? parseInt(limit, 10) : 10);
  }
}
