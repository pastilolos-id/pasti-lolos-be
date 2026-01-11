// src/courses/courses.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards, Req ,Patch} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('courses')
@UseGuards(AuthGuard('jwt'))
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  // 1. Create Course
  @Post()
  @UseGuards(AuthGuard('jwt')) 
  create(@Body() body: any, @Req() req) {
    return this.coursesService.createCourse(body, req.user.userId);
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
  createModule(@Body() body: any) {
    return this.coursesService.createModule(body);
  }

  // 5. Create Lesson (Materi/Video/Teks)
  @Post('lesson')
  @UseGuards(AuthGuard('jwt')) 
  createLesson(@Body() body: any) {
    return this.coursesService.createLesson(body);
  }

    // 1. Create Subject

    @Post('subjects')
    @UseGuards(AuthGuard('jwt')) 
    createSubject(@Body() body: any) {
    return this.coursesService.createSubject(body);
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

  

}