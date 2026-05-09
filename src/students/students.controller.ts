import {
  Controller,
  Query,
  Get,
  UseGuards,
  Req,
  Param,
  ParseIntPipe,
  Patch,
  Body,
  Res,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { AuthGuard } from '@nestjs/passport';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CertificatesService } from './certificates.service';
import type { Response } from 'express';
import { Roles } from 'src/common/decorators/roles.decorators';
import type { JwtRequestUser } from 'src/types/express';

interface RequestWithUser extends Express.Request {
  user?: JwtRequestUser;
}

@Controller('students')
@UseGuards(AuthGuard('jwt'))
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly certificatesService: CertificatesService,
  ) {}

  private getUserId(req: RequestWithUser): number {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new Error('User ID tidak ditemukan di request');
    }
    return userId;
  }

  @Get('dashboard')
  @Roles('1') // Hanya untuk role Student
  async getDashboard(
    @Req() req: RequestWithUser,
    @Query('category') category?: string,
  ) {
    return this.studentsService.getDashboardData(category);
  }
  @Get('dashboard/exams')
  async getMyExams(@Req() req: RequestWithUser) {
    return this.studentsService.getMyExams(this.getUserId(req));
  }

  @Get('dashboard/attempts')
  async getMyAttempts(@Req() req: RequestWithUser) {
    return this.studentsService.getMyAttempts(this.getUserId(req));
  }

  @Get('profile')
  async getProfile(@Req() req: RequestWithUser) {
    return this.studentsService.getProfileStats(this.getUserId(req));
  }

  // @Get('attempts/:id/review')
  //   async getReview(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
  //   return this.studentsService.getExamReview(id, req.user.id);
  // }

  @Get('attempts/:id/review')
  async getReview(@Param('id') id: string, @Req() req: RequestWithUser) {
    // +id untuk convert string ke number
    return this.studentsService.getAttemptReview(+id, this.getUserId(req));
  }

  @Get('exams/:id/leaderboard')
  async getLeaderboard(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.studentsService.getLeaderboard(id, this.getUserId(req));
  }

  @Patch('profile')
  async updateProfile(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.studentsService.updateProfile(this.getUserId(req), dto);
  }

  @Get('certificate/:userExamId')
  async downloadCert(@Param('userExamId') id: string, @Res() res: Response) {
    return this.certificatesService.generateExamCertificate(+id, res);
  }

  @Get('purchases')
  async getMyPurchases(
    @Req() req: RequestWithUser,
    @Query('type') type?: string, // Untuk handle filter "Semua", "Tryout", "Materi"[cite: 1]
  ) {
    return this.studentsService.getPurchaseHistory(this.getUserId(req), type);
  }

  @Get('activity')
  async getMyActivity(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = this.getUserId(req);
    return await this.studentsService.getUserActivity(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }
}
