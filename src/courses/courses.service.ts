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
}