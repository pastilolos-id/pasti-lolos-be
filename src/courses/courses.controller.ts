// src/courses/courses.controller.ts
import { 
  Controller, Get, Post, Body, Param, UseGuards, Req, Patch, 
  UseInterceptors, UploadedFile 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CoursesService } from './courses.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('courses')
@UseGuards(AuthGuard('jwt'))
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  // 1. Create Course
  @Post()
  @UseGuards(AuthGuard('jwt')) 
  @UseInterceptors(FileInterceptor('file')) // Untuk thumbnail course
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any, 
    @Req() req: any
  ) {
    // Kita kirim body, file, dan userId (dari JWT)
    return this.coursesService.createCourse(body, file, req.user.userId);
  }

  // 2. Get All Courses
  @Get()
  @UseGuards(AuthGuard('jwt')) 
  findAll() {
    return this.coursesService.findAllCourses();
  }

  // 3. Get Detail Course (Termasuk Module & Lesson)
  @Get(':id')
  @UseGuards(AuthGuard('jwt')) 
  findOne(@Param('id') id: string) {
    return this.coursesService.findOneCourse(+id);
  }

  // 4. Create Module (Bab)
  @Post('module')
  @UseGuards(AuthGuard('jwt')) 
  @UseInterceptors(FileInterceptor('file'))
  createModule(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: any
  ){
    return this.coursesService.createModule(body);
  }

  // 5. Create Lesson (Materi/Video/Teks)
  @Post('lesson')
  @UseGuards(AuthGuard('jwt')) 
  @UseInterceptors(FileInterceptor('file')) // File utama (Video/PDF)
  async createLesson(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: any
  ) {
    return this.coursesService.createLesson(body, file, req.user.userId);
  }

    // 1. Create Subject

    @Post('subjects')
    @UseGuards(AuthGuard('jwt')) 
    @UseInterceptors(FileInterceptor('file')) // Key di Postman harus 'file'
    async createSubject(
      @UploadedFile() file: Express.Multer.File,
      @Body() body: any
    ) {
      // Teruskan body dan file ke service
      return this.coursesService.createSubject(body, file);
    }

    // 2. Get All Subjects
    @Get('subjects')
    @UseGuards(AuthGuard('jwt')) 
    findAllSubjects() {
    return this.coursesService.findAllSubjects();
    }

    // 3. Update Subject
    @Patch('subjects/:id')
    @UseGuards(AuthGuard('jwt')) 
    updateSubject(@Param('id') id: string, @Body() body: any) {
    return this.coursesService.updateSubject(+id, body);
    }
  
    @Post('topics')
    createTopic(@Body() body: any, @Req() req) {
      // Mengirim data body dan ID user dari JWT
      return this.coursesService.createTopic(body, req.user.userId);
    }

    @Post('lesson-complete')
    async completeLesson(@Body() body: { lesson_id: number }, @Req() req) {
      // Gunakan req.user.userId agar sinkron dengan JWT payload lo
      return await this.coursesService.updateProgress(req.user.userId, body.lesson_id);
    }

    @Post('start-or-resume')
    async handleStart(@Body('course_id') courseId: number, @Req() req) {
      return await this.coursesService.getOrStartCourse(req.user.userId, courseId);
    }

    @Patch('lesson/:id')
    @UseGuards(AuthGuard('jwt'))
    @UseInterceptors(FileInterceptor('file'))
    async updateLesson(
      @Param('id') id: string,
      @UploadedFile() file: Express.Multer.File,
      @Body() body: any,
      @Req() req: any
    ) {
      return this.coursesService.updateLesson(+id, body, file, req.user.userId);
    }

}