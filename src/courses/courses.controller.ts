// src/courses/courses.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Patch,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UploadedFiles,
  Delete,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { CoursesService } from './courses.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateCourseDto } from './dto/create-course.dto';
import * as createLessonDto from './dto/create-lesson.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { GetUser } from '../common/decorators/get-user.decorator';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { CreateTopicDto } from './dto/create-topic.dto';
import { CompleteLessonDto } from './dto/complete-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators';

export interface CourseFiles {
  file?: Express.Multer.File[]; // Thumbnail
  video?: Express.Multer.File[]; // Video Perkenalan
}
interface RequestWithUser extends Request {
  user: {
    userId: number;
    email: string;
    roles: string[];
  };
}
@Controller('courses')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post('create')
  @Roles('admin', 'kontributor')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 }, // Untuk Thumbnail
      { name: 'video', maxCount: 1 }, // Untuk Video Perkenalan
    ]),
  )
  async create(
    @UploadedFiles() files: CourseFiles, // Pake @UploadedFiles (jamak)
    @Body() createCourseDto: CreateCourseDto,
    @GetUser('userId') userId: number,
  ) {
    return this.coursesService.createCourse(createCourseDto, files, userId);
  }

  @Patch(':id')
  @Roles('admin', 'kontributor')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 }, // Untuk Thumbnail
      { name: 'video', maxCount: 1 }, // Untuk Video Perkenalan
    ]),
  )
  async update(
    @Param('id') id: string,
    @UploadedFiles()
    files: { file?: Express.Multer.File[]; video?: Express.Multer.File[] },
    @Body() updateCourseDto: UpdateCourseDto,
  ) {
    const courseId = parseInt(id, 10);
    if (isNaN(courseId)) {
      throw new BadRequestException('ID Course harus berupa angka');
    }

    // Pastikan urutan argumen sesuai dengan Service: (id, data, files)
    return await this.coursesService.updateCourse(
      courseId,
      updateCourseDto,
      files,
    );
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() req: RequestWithUser, // Menggunakan interface yang kita bahas tadi
  ) {
    const courseId = parseInt(id, 10);
    if (isNaN(courseId)) {
      throw new BadRequestException('ID Course tidak valid');
    }

    await this.coursesService.softDeleteCourse(courseId, req.user.userId);
    return {
      success: true,
      message: `Course dengan ID ${id} berhasil dipindahkan ke tempat sampah (soft delete).`,
    };
  }

  @Get()
  findAll() {
    return this.coursesService.findAllCourses();
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @GetUser('userId') userId: number) {
    return this.coursesService.findOneCourse(+id, userId);
  }

  @Post('module-create')
  @Roles('admin', 'kontributor')
  @UseInterceptors(FileInterceptor('file')) // Nama field di Postman harus 'file'
  async createModule(
    @UploadedFile() file: Express.Multer.File,
    @Body() createModuleDto: CreateModuleDto,
    @GetUser('userId') userId: number,
  ) {
    return this.coursesService.createModule(createModuleDto, file, userId);
  }

  @Post('lesson')
  @Roles('admin', 'kontributor')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'video', maxCount: 1 },
      { name: 'pdf', maxCount: 1 },
    ]),
  )
  async createLesson(
    @UploadedFiles() files: createLessonDto.LessonFiles,
    @Body() dto: createLessonDto.CreateLessonDto,
    @Req() req: Request & { user: { userId: number } },
  ) {
    return await this.coursesService.createLesson(dto, files, req.user.userId);
  }

  @Post('subjects')
  @Roles('admin', 'kontributor')
  @UseInterceptors(FileInterceptor('file'))
  async createSubject(
    @UploadedFile() file: Express.Multer.File,
    @Body() createSubjectDto: CreateSubjectDto,
  ) {
    return this.coursesService.createSubject(createSubjectDto, file);
  }

  @Get('subjects')
  findAllSubjects() {
    return this.coursesService.findAllSubjects();
  }

  @Patch('subjects/:id')
  updateSubject(@Param('id') id: string, @Body() body: UpdateSubjectDto) {
    return this.coursesService.updateSubject(+id, body);
  }

  @Post('topics')
  @Roles('admin', 'kontributor')
  createTopic(@Body() body: CreateTopicDto, @Req() req: RequestWithUser) {
    return this.coursesService.createTopic(body, req.user.userId);
  }

  @Post('lesson-complete')
  @Roles('murid')
  async completeLesson(
    @Body() body: CompleteLessonDto,
    @Req() req: RequestWithUser,
  ) {
    return this.coursesService.updateProgress(req.user.userId, body.lesson_id);
  }

  @Post('start-or-resume')
  @Roles('murid')
  async handleStart(
    @Body('course_id') courseId: number,
    @Req() req: RequestWithUser,
  ) {
    return this.coursesService.getOrStartCourse(req.user.userId, courseId);
  }

  @Patch('lesson/:id')
  @UseInterceptors(FileInterceptor('file'))
  async updateLesson(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UpdateLessonDto,
    @Req() req: RequestWithUser,
  ) {
    return this.coursesService.updateLesson(+id, body, file, req.user.userId);
  }

  @Post('checkout')
  @Roles('murid')
  @UseInterceptors(FileInterceptor('file'))
  async checkout(
    @UploadedFile() file: Express.Multer.File,
    @Body() checkoutDto: CheckoutDto,
    @Req() req: RequestWithUser,
  ) {
    if (!file) {
      throw new BadRequestException('Bukti pembayaran wajib diunggah');
    }

    return this.coursesService.createOrderAndUploadPayment(
      +checkoutDto.courseId,
      req.user.userId,
      file,
      checkoutDto.paymentMethod,
      checkoutDto.discountCode,
    );
  }

  @Delete('modules/:id')
  @Roles('admin', 'kontributor')
  async removeModule(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.coursesService.softDeleteModule(+id, req.user.userId);
  }

  @Delete('lessons/:id')
  @Roles('admin', 'kontributor')
  async removeLesson(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.coursesService.softDeleteLesson(+id, req.user.userId);
  }
}
