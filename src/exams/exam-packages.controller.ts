import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators';
import type { JwtRequestUser } from 'src/types/express';
import { ExamPackagesService } from './exam-packages.service';
import {
  CreateExamPackageDto,
  UpdateExamPackageDto,
} from './dto/create-exam-package.dto';

interface RequestWithUser extends Request {
  user?: JwtRequestUser;
}

@ApiTags('Exam Packages')
@ApiCookieAuth()
@Controller('exam-packages')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ExamPackagesController {
  constructor(private readonly examPackagesService: ExamPackagesService) {}

  private requireUserId(req: RequestWithUser): number {
    const userId = req.user?.userId ?? req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User tidak valid');
    }
    return userId;
  }

  @Post('create')
  @Roles('2', '3')
  create(@Body() body: CreateExamPackageDto, @Req() req: RequestWithUser) {
    return this.examPackagesService.createExamPackage(
      body,
      this.requireUserId(req),
    );
  }

  @Get()
  @Roles('2', '3')
  findAll(
    @Query('category') category?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('status') status?: string,
  ) {
    return this.examPackagesService.findAllExamPackagesAdmin(
      category,
      +page || 1,
      +limit || 10,
      status,
    );
  }

  @Get(':id/exams')
  @Roles('2', '3')
  findExamsByPackage(@Param('id') id: string) {
    return this.examPackagesService.findExamsByPackageId(+id);
  }

  @Get(':id')
  @Roles('2', '3')
  findOne(@Param('id') id: string) {
    return this.examPackagesService.findOneExamPackage(+id);
  }

  @Patch('update/:id')
  @Roles('2', '3')
  update(
    @Param('id') id: string,
    @Body() body: UpdateExamPackageDto,
    @Req() req: RequestWithUser,
  ) {
    return this.examPackagesService.updateExamPackage(
      +id,
      this.requireUserId(req),
      body,
    );
  }

  @Delete('delete/:id')
  @Roles('2')
  remove(@Param('id') id: string) {
    return this.examPackagesService.softDeleteExamPackage(+id);
  }
}
