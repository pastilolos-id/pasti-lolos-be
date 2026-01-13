// src/courses/courses.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  // --- CRUD COURSES ---
  async createCourse(data: any, userId: number) {
    return this.prisma.courses.create({
      data: {
        ...data,
        created_by_user_id: userId, // Sesuai kolom di tabel 
      },
    });
  }

  async findAllCourses() {
    return this.prisma.courses.findMany({
      include: {
        modules: true, // Relasi ke tabel modules [cite: 12, 57]
        _count: { select: { modules: true } },
      },
    });
  }

  async findOneCourse(id: number) {
    const course = await this.prisma.courses.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            lessons: true, // Relasi modules ke lessons [cite: 11, 56]
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course tidak ditemukan');
    return course;
  }

  // --- CRUD MODULES (Bab) ---
  async createModule(data: any) {
    return this.prisma.modules.create({ data }); // Nama tabel: modules 
  }

  // --- CRUD LESSONS (Materi di dalam Bab) ---
  async createLesson(data: any) {
    return this.prisma.lessons.create({ data }); // Nama tabel: lessons 
  }

  async findLesson(id: number) {
    return this.prisma.lessons.findUnique({ where: { id } });
  }

  async createSubject(data: any) {
    return this.prisma.subjects.create({ data }); 
  }

  async findAllSubjects() {
    return this.prisma.subjects.findMany({
        where: { is_active: true },
        include: { _count: { select: { courses: true } } } // Lihat berapa banyak kursus di tiap subjek
    });
  }

    async updateSubject(id: number, data: any) {
    return this.prisma.subjects.update({ where: { id }, data }); 
    }

    async deleteSubject(id: number) {
    // Hati-hati: Di skema lo, delete subject akan CASCADE ke courses [cite: 49]
    return this.prisma.subjects.delete({ where: { id } });
    }

    async createTopic(data: any, userId: number) {
    return this.prisma.topics.create({
      data: {
        ...data,
        // Pastikan field numerik/boolean sesuai dengan gambar
        average_score: data.average_score ? parseFloat(data.average_score) : 0,
        quiz_average_score: data.quiz_average_score ? parseFloat(data.quiz_average_score) : 0,
        total_questions_count: data.total_questions_count ? parseInt(data.total_questions_count) : 0,
        total_lessons_count: data.total_lessons_count ? parseInt(data.total_lessons_count) : 0,
        last_updated_by: userId, // Sesuai kolom 'last_updated_by' di gambar
      },
    });
  }

  async getOrStartCourse(userId: number, courseId: number) {
    // 1. Validasi keberadaan Kursus
    const course = await this.prisma.courses.findUnique({
      where: { id: courseId },
      select: { id: true, course_title: true }
    });
    if (!course) throw new NotFoundException('Kursus tidak ditemukan');

    // 2. Registrasi / Update Akses Terakhir (User Courses)
    // Sesuai constraint: user_courses_user_id_course_id_key
    const enrollment = await this.prisma.user_courses.upsert({
      where: {
        user_id_course_id: { user_id: userId, course_id: courseId }
      },
      update: { 
        last_accessed_at: new Date() 
      },
      create: {
        user_id: userId,
        course_id: courseId,
        status: 'in_progress',
        progress_percentage: 0,
        enrollment_date: new Date(),
        last_accessed_at: new Date()
      }
    });

    // 3. Logic Resume: Cari materi terakhir yang diakses di progress_tracking
    const lastAccessed = await this.prisma.progress_tracking.findFirst({
      where: { user_id: userId, course_id: courseId },
      orderBy: { last_accessed_timestamp: 'desc' },
      select: { lesson_id: true }
    });

    // 4. Jika belum ada jejak belajar, ambil Lesson pertama dari urutan modul
    if (!lastAccessed) {
      const firstLesson = await this.prisma.lessons.findFirst({
        where: { module: { course_id: courseId } },
        orderBy: [
          { module: { module_order: 'asc' } },
          { order_in_module: 'asc' }
        ],
        select: { id: true }
      });

      return {
        message: 'Mulai kursus baru',
        enrollment,
        resumeLessonId: firstLesson?.id || null
      };
    }

    return {
      message: 'Melanjutkan kursus',
      enrollment,
      resumeLessonId: lastAccessed.lesson_id
    };
  }

  async updateProgress(userId: number, lessonId: number) {
    // 1. Cari tahu lesson ini milik course mana
    const lesson = await this.prisma.lessons.findUnique({
      where: { id: lessonId },
      include: { module: true }
    });

    if (!lesson) throw new NotFoundException('Lesson tidak ditemukan');
    const courseId = lesson.module.course_id;

    // 2. Update Lesson Progress (Detail)
    await this.prisma.progress_tracking.upsert({
      where: {
        user_id_lesson_id: { user_id: userId, lesson_id: lessonId }
      },
      update: { is_completed: true, completion_timestamp: new Date() },
      create: {
        user_id: userId,
        lesson_id: lessonId,
        course_id: courseId,
        module_id: lesson.module_id,
        is_completed: true,
        completion_timestamp: new Date()
      }
    });

    // 3. Hitung Kalkulasi untuk Course Progress
    const totalLessons = await this.prisma.lessons.count({
      where: { module: { course_id: courseId } }
    });

    const completedLessons = await this.prisma.progress_tracking.count({
      where: { user_id: userId, course_id: courseId, is_completed: true }
    });

    const percentage = (completedLessons / totalLessons) * 100;

    // 4. Update Course Progress (Summary)
    return await this.prisma.user_courses.update({
      where: {
        user_id_course_id: { user_id: userId, course_id: courseId }
      },
      data: {
        progress_percentage: percentage,
        status: percentage === 100 ? 'completed' : 'in_progress',
        last_accessed_at: new Date(),
        completion_date: percentage === 100 ? new Date() : null
      }
    });
  }

}