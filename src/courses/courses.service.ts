// src/courses/courses.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';


@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService, 
    private cloudinary: CloudinaryService) {}

  // --- CRUD COURSES ---
  async createCourse(data: any, file: Express.Multer.File, userId: number) {
    let thumbnailUri = data.course_image_url; // Default jika tidak upload

    // 1. Upload Thumbnail ke Cloudinary jika ada
    if (file) {
      const upload = await this.cloudinary.uploadFile(file, 'course_thumbnails');
      thumbnailUri = upload.secure_url;
    }

    // 2. Simpan ke Database
    return this.prisma.courses.create({
      data: {
        courseTitle: data.course_title,
        description: data.course_description,
        
        // Relasi ke Subject (Wajib ada ID Subject yang valid)
        subjectId: parseInt(data.subject_id),
        
        // Detail Kursus
        price: parseFloat(data.price) || 0,
        difficultyLevel: data.level || 'beginner', // beginner, intermediate, advanced
        thumbnailUrl: thumbnailUri,
        
        // Audit
        createdByUserId: userId,
        status: data.status || 'active',

        // Jika di schema lo ada metadata tambahan
        metadataJson: typeof data.metadata_json === 'string' 
          ? JSON.parse(data.metadata_json) 
          : data.metadata_json,
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
          orderBy: { moduleOrder: 'asc' },
          include: {
            lessons: {
              orderBy: { orderInModule: 'asc' },
            },
          },
        },
      },
    });

    if (!course) throw new NotFoundException('Course tidak ditemukan');

    // Logic Fitur 2: Kalkulasi Statistik
    const allLessons = course.modules.flatMap(m => m.lessons);
    const totalLessons = allLessons.length;
    const totalDuration = allLessons.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);

    return {
      ...course,
      statistics: {
        totalModules: course.modules.length,
        totalLessons: totalLessons,
        totalDurationFormatted: `${Math.floor(totalDuration / 60)}j ${totalDuration % 60}m`,
        totalDurationMinutes: totalDuration
      }
    };
  }

  // --- CRUD MODULES (Bab) ---
  async createModule(data: any) {
    return this.prisma.modules.create({ data }); 
  }

  // --- CRUD LESSONS (Materi di dalam Bab) ---
  async createLesson(data: any, file: Express.Multer.File, userId: number) {
    let contentUrl = data.content_url;
    let duration = data.duration_minutes ? parseInt(data.duration_minutes) : null;
    let externalAssetId = null;

    // 1. Jika ada file, upload ke Cloudinary
    if (file) {
      const upload = await this.cloudinary.uploadFile(file, 'lesson_contents');
      contentUrl = upload.secure_url;
      externalAssetId = upload.public_id; // Simpan ID Cloudinary

      // Jika video, ambil durasi otomatis (Cloudinary mengembalikan detik, kita konversi ke menit)
      if (upload.resource_type === 'video' && upload.duration) {
        duration = Math.ceil(upload.duration / 60);
      }
    }

    // Helper safe parse JSON
    const safeParse = (val: any) => {
      try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return val; }
    };

    // 2. Simpan ke Database
    return this.prisma.lessons.create({
      data: {
        moduleId: parseInt(data.module_id),
        lessonTitle: data.lesson_title,
        lessonType: data.lesson_type, // 'video', 'text', 'quiz', dll
        
        contentUrl: contentUrl,
        contentText: data.content_text,
        
        durationMinutes: duration,
        orderInModule: parseInt(data.order_in_module) || 1,
        
        isPreview: data.is_preview === 'true' || data.is_preview === true,
        status: data.status || 'draft',
        
        // Resource & Links
        attachmentsJson: safeParse(data.attachments_json),
        resourceLinksJson: safeParse(data.resource_links_json),
        
        // Additional Info
        notesForLesson: data.notes_for_lesson,
        estimatedReadingTimeMinutes: data.estimated_reading_time_minutes ? parseInt(data.estimated_reading_time_minutes) : null,
        transcriptionText: data.transcription_text,
        
        // Metadata & Audit
        externalAssetId: externalAssetId,
        lastUpdatedBy: userId,
        metadataJson: safeParse(data.metadata_json),
        internalComments: data.internal_comments,
      },
    });
  }


  async updateLesson(id: number, data: any, file: Express.Multer.File, userId: number) {
    // 1. Cari data lesson lama
    const oldLesson = await this.prisma.lessons.findUnique({ where: { id } });
    if (!oldLesson) throw new NotFoundException('Lesson tidak ditemukan');

    let contentUrl = oldLesson.contentUrl;
    let externalAssetId = oldLesson.externalAssetId;
    let duration = oldLesson.durationMinutes;

    // 2. Jika ada file baru yang diupload
    if (file) {
      // Hapus file lama di Cloudinary jika ada public_id-nya
      if (oldLesson.externalAssetId) {
        await this.cloudinary.deleteFile(oldLesson.externalAssetId);
      }

      // Upload file baru
      const upload = await this.cloudinary.uploadFile(file, 'lesson_materials');
      contentUrl = upload.secure_url;
      externalAssetId = upload.public_id;

      if (upload.resource_type === 'video' && upload.duration) {
        duration = Math.ceil(upload.duration / 60);
      }
    }

    const safeParse = (val: any) => {
      try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return val; }
    };

    // 3. Update Database
    return this.prisma.lessons.update({
      where: { id },
      data: {
        lessonTitle: data.lesson_title,
        lessonType: data.lesson_type,
        contentUrl: contentUrl,
        contentText: data.content_text,
        durationMinutes: duration,
        orderInModule: data.order_in_module ? parseInt(data.order_in_module) : undefined,
        isPreview: data.is_preview === 'true' || data.is_preview === true,
        status: data.status,
        attachmentsJson: safeParse(data.attachments_json),
        resourceLinksJson: safeParse(data.resource_links_json),
        externalAssetId: externalAssetId,
        lastUpdatedBy: userId,
      },
    });
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

  async getSyllabus(courseId: number) {
    return this.prisma.courses.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { moduleOrder: 'asc' }, // Biar urut Bab 1, 2, 3
          include: {
            lessons: {
              orderBy: { orderInModule: 'asc' }, // Biar urut materi 1, 2, 3
              select: {
                id: true,
                lessonTitle: true,
                lessonType: true,
                durationMinutes: true,
                isPreview: true, // Penting buat tau mana yang bisa ditonton gratis
              }
            }
          }
        }
      }
    });
  }

}