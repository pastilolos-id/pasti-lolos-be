// src/courses/courses.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';


@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService, 
    private cloudinary: CloudinaryService) {}

  // --- CRUD COURSES ---
  async createCourse(data: any, userId: number) {
    return this.prisma.courses.create({
      data: {
        ...data,
        createdByUserId: userId, 
      },
    });
  }

  async findAllCourses() {
    return this.prisma.courses.findMany({
      include: {
        modules: true, 
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
            lessons: true, 
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course tidak ditemukan');
    return course;
  }

  // --- CRUD MODULES (Bab) ---
  async createModule(data: any) {
    return this.prisma.modules.create({ data }); 
  }

  // --- CRUD LESSONS (Materi di dalam Bab) ---
  async createLesson(data: any) {
    return this.prisma.lessons.create({ data }); 
  }

  async findLesson(id: number) {
    return this.prisma.lessons.findUnique({ where: { id } });
  }

  async createSubject(data: any, file: Express.Multer.File) {
    let iconUrl = data.icon_url;

    // 1. Handle Upload Icon
    if (file) {
      const upload: any = await this.cloudinary.uploadFile(file, 'subject_icons');
      iconUrl = upload.secure_url;
    }

    // 2. Helper untuk parse JSON aman dari form-data
    const safeParse = (str: any) => {
      try {
        return typeof str === 'string' ? JSON.parse(str) : str;
      } catch (e) {
        return str;
      }
    };
    console.log('--- Start Create Subject ---');
    console.log('File Metadata:', file ? { name: file.originalname, size: file.size } : 'No File');

    if (file) {
      console.log('Sedang upload ke Cloudinary...');
      // Jika macet di sini, berarti koneksi ke Cloudinary atau file terlalu besar
      const upload = await this.cloudinary.uploadFile(file, 'subject_icons');
      console.log('Upload Berhasil:', upload.secure_url);
    }
    // 3. Simpan ke Database (Manual Mapping)
    return this.prisma.subjects.create({
      data: {
        subjectName: data.subject_name,
        description: data.description,
        iconUrl: iconUrl,
        isActive: data.is_active === 'true' || data.is_active === true,
        
        // Parse Angka
        totalQuestionsCount: parseInt(data.total_questions_count) || 0,
        totalCoursesCount: parseInt(data.total_courses_count) || 0,
        averageDifficulty: parseFloat(data.average_difficulty) || 0.0,
        
        // Kolom Teks Tambahan
        relatedFieldOfStudy: data.related_field_of_study,
        syllabusOutline: data.syllabus_outline,
        suggestedGradeLevels: data.suggested_grade_levels,
        commonMisconceptions: data.common_misconceptions,
        keyConcepts: data.key_concepts,
        learningObjectives: data.learning_objectives,
        assessmentMethods: data.assessment_methods,
        internalNotes: data.internal_notes,
        
        // Parse JSON & BigInt/Int Audit
        lastReviewedBy: data.last_reviewed_by ? parseInt(data.last_reviewed_by) : null,
        externalResourceLinks: safeParse(data.external_resource_links),
        metadataJson: safeParse(data.metadata_json),
      },
    });
  }

  async findAllSubjects() {
    return this.prisma.subjects.findMany({
        where: { isActive: true }, // Ubah ke camelCase
        include: { _count: { select: { courses: true } } } 
    });
  }

  async updateSubject(id: number, data: any) {
    return this.prisma.subjects.update({ where: { id }, data }); 
  }

  async deleteSubject(id: number) {
    return this.prisma.subjects.delete({ where: { id } });
  }

  async createTopic(data: any, userId: number) {
    return this.prisma.topics.create({
      data: {
        ...data,
        averageScore: data.averageScore ? parseFloat(data.averageScore) : 0,
        quizAverageScore: data.quizAverageScore ? parseFloat(data.quizAverageScore) : 0,
        totalQuestionsCount: data.totalQuestionsCount ? parseInt(data.totalQuestionsCount) : 0,
        totalLessonsCount: data.totalLessonsCount ? parseInt(data.totalLessonsCount) : 0,
        lastUpdatedBy: userId, 
      },
    });
  }

  async getOrStartCourse(userId: number, courseId: number) {
    const course = await this.prisma.courses.findUnique({
      where: { id: courseId },
      select: { id: true, courseTitle: true } // Ubah ke camelCase
    });
    if (!course) throw new NotFoundException('Kursus tidak ditemukan');

    // Menggunakan userCourses (Prisma biasanya otomatis camelCase untuk nama model)
    const enrollment = await this.prisma.userCourses.upsert({
      where: {
        userId_courseId: { userId: userId, courseId: courseId } // Index unique camelCase
      },
      update: { 
        lastAccessedAt: new Date() 
      },
      create: {
        userId: userId,
        courseId: courseId,
        status: 'in_progress',
        progressPercentage: 0,
        enrollmentDate: new Date(),
        lastAccessedAt: new Date()
      }
    });

    const lastAccessed = await this.prisma.progressTracking.findFirst({
      where: { userId: userId, courseId: courseId },
      orderBy: { lastAccessedTimestamp: 'desc' },
      select: { lessonId: true }
    });

    if (!lastAccessed) {
      const firstLesson = await this.prisma.lessons.findFirst({
        where: { module: { courseId: courseId } },
        orderBy: [
          { module: { moduleOrder: 'asc' } },
          { orderInModule: 'asc' }
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
      resumeLessonId: lastAccessed.lessonId
    };
  }

  async updateProgress(userId: number, lessonId: number) {
    const lesson = await this.prisma.lessons.findUnique({
      where: { id: lessonId },
      include: { module: true }
    });

    if (!lesson) throw new NotFoundException('Lesson tidak ditemukan');
    const courseId = lesson.module.courseId;

    await this.prisma.progressTracking.upsert({
      where: {
        userId_lessonId: { userId: userId, lessonId: lessonId }
      },
      update: { isCompleted: true, completionTimestamp: new Date() },
      create: {
        userId: userId,
        lessonId: lessonId,
        courseId: courseId,
        moduleId: lesson.moduleId,
        isCompleted: true,
        completionTimestamp: new Date()
      }
    });

    const totalLessons = await this.prisma.lessons.count({
      where: { module: { courseId: courseId } }
    });

    const completedLessons = await this.prisma.progressTracking.count({
      where: { userId: userId, courseId: courseId, isCompleted: true }
    });

    const percentage = (completedLessons / totalLessons) * 100;

    return await this.prisma.userCourses.update({
      where: {
        userId_courseId: { userId: userId, courseId: courseId }
      },
      data: {
        progressPercentage: percentage,
        status: percentage === 100 ? 'completed' : 'in_progress',
        lastAccessedAt: new Date(),
        completionDate: percentage === 100 ? new Date() : null
      }
    });
  }
}