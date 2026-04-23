import { Controller, Get, UseGuards, Req , Param, ParseIntPipe, Patch, Body} from '@nestjs/common';
import { StudentsService } from './students.service';
import { AuthGuard } from '@nestjs/passport';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('students')
@UseGuards(AuthGuard('jwt'))
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('dashboard/exams')
  async getMyExams(@Req() req: any) {
    return this.studentsService.getMyExams(req.user.id);
  }

  @Get('dashboard/attempts')
  async getMyAttempts(@Req() req: any) {
    return this.studentsService.getMyAttempts(req.user.id);
  }

  @Get('profile')
  async getProfile(@Req() req: any) {
    const id = req.user.userId || req.user.id || req.user.sub;
    return this.studentsService.getProfileStats(id);
  }

  @Get('attempts/:id/review')
    async getReview(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.studentsService.getExamReview(id, req.user.id);
  }

  @Get('exams/:id/leaderboard')
    async getLeaderboard(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.getLeaderboard(id);
  }

  @Patch('profile')
    async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.studentsService.updateProfile(req.user.id, dto);
  }

}