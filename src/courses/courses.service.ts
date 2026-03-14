// src/courses/courses.service.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { Courses, Prisma } from '@prisma/client';
import { CreateLessonDto, LessonFiles } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

interface CourseFiles {
  file?: Express.Multer.File[]; // Thumbnail
  video?: Express.Multer.File[]; // Video Perkenalan
}

interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
  [key: string]: any;
}
@Injectable()
export class CoursesService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  // --- CRUD COURSES ---
  async createCourse(
    data: CreateCourseDto,
    files: CourseFiles,
    userId: number,
  ): Promise<Courses> {
    let thumbnailUri: string | null = null;
    let introVideoUri: string | null = null;

    if (files?.file && files.file[0]) {
      const upload = await this.cloudinary.uploadFile(
        files.file[0],
        'course_thumbnails',
      );
      thumbnailUri = upload.secure_url;
    }
    if (files?.video && files.video[0]) {
      const upload = await this.cloudinary.uploadFile(
        files.video[0],
        'course_intros',
      );
      introVideoUri = upload.secure_url;
    }

    // Siapkan metadata dengan tipe JsonObject agar ESLint diam
    const metadata: Prisma.JsonObject = {
      instructorId: data.instructorId ?? '',
    };

    // Eksekusi langsung tanpa variabel perantara
    return this.prisma.courses.create({
      data: {
        courseTitle: data.courseTitle,
        description: data.description ?? null,
        subjectId: parseInt(data.subjectId, 10),
        // TRIK FINAL: Gunakan type casting 'number' untuk bypass null-check
        // jika data.topic_id ada, atau gunakan logic yang diterima Prisma
        topicId: data.topicId ? parseInt(data.topicId, 10) : undefined,

        price: new Prisma.Decimal(data.price || 0),
        difficultyLevel: data.difficultyLevel,
        thumbnailUrl: thumbnailUri,
        introductionVideoUrl: introVideoUri,
        createdByUserId: userId,
        status: data.status,
        metadataJson: metadata as Prisma.InputJsonValue,
      } as Prisma.CoursesUncheckedCreateInput, // CASTING DI SINI ADALAH KUNCI
    });
  }

  // update course
  async updateCourse(id: number, data: UpdateCourseDto, files: CourseFiles) {
    // 1. Cari data lama untuk dapet public_id file Cloudinary
    const oldCourse = await this.prisma.courses.findUnique({ where: { id } });
    if (!oldCourse) throw new NotFoundException('Course tidak ditemukan');

    let thumbnailUrl = oldCourse.thumbnailUrl;
    let videoUrl = oldCourse.introductionVideoUrl;

    // 2. Handle Update Thumbnail (Jika ada file baru)
    if (files.file?.[0]) {
      // (Opsional) Hapus file lama jika lu simpan public_id di database
      // Jika tidak simpan public_id, lu bisa ekstrak dari URL atau biarkan saja
      const uploadThumb = await this.cloudinary.uploadFile(
        files.file[0],
        'course_thumbnails',
      );
      thumbnailUrl = uploadThumb.secure_url;
    }

    // 3. Handle Update Video
    if (files.video?.[0]) {
      const uploadVideo = await this.cloudinary.uploadFile(
        files.video[0],
        'course_intros',
      );
      videoUrl = uploadVideo.secure_url;
    }

    // 4. Update Database
    return this.prisma.courses.update({
      where: { id },
      data: {
        courseTitle: data.courseTitle, // Pastikan field name di Prisma adalah courseTitle
        description: data.description,
        thumbnailUrl: thumbnailUrl,
        introductionVideoUrl: videoUrl,
        status: data.status,
        difficultyLevel: data.difficultyLevel,
        subjectId: data.subjectId ? parseInt(data.subjectId, 10) : undefined,
        topicId: data.topicId ? parseInt(data.topicId, 10) : undefined,
        price: data.price ? new Prisma.Decimal(data.price) : undefined,
        // Update metadata secara aman
        metadataJson: data.instructorId
          ? {
              ...(oldCourse.metadataJson as object),
              instructorId: data.instructorId,
            }
          : undefined,
      },
    });
  }

  async softDeleteCourse(id: number, userId: number) {
    // 1. Cek apakah course ada
    const course = await this.prisma.courses.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course tidak ditemukan');

    // 2. Update status jadi deleted
    return await this.prisma.courses.update({
      where: { id },
      data: {
        status: 'deleted',
        // Opsional: catat siapa yang menghapus di metadata
        metadataJson: {
          ...(course.metadataJson as object),
          deletedAt: new Date(),
          deletedBy: userId,
        },
      },
    });
  }

  async findAllCourses() {
    return this.prisma.courses.findMany({
      where: {
        status: { not: 'deleted' }, // <--- WAJIB TAMBAHKAN INI
      },
      include: {
        modules: true,
        _count: { select: { modules: true } },
      },
    });
  }

  async findOneCourse(id: number, userId: number) {
    const course = await this.prisma.courses.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { moduleOrder: 'asc' },
          include: {
            lessons: { orderBy: { orderInModule: 'asc' } },
          },
        },
      },
    });

    if (!course) throw new NotFoundException('Course tidak ditemukan');

    // 1. Cek kepemilikan (Cek apakah ada Order yang statusnya 'completed' untuk course ini)
    const hasAccess = await this.prisma.orderItems.findFirst({
      where: {
        courseId: id,
        order: { userId: userId, orderStatus: 'completed' },
      },
    });

    const isOwner = !!hasAccess;

    // 2. Logic Statistik
    const allLessons = course.modules.flatMap((m) => m.lessons);
    const totalLessons = allLessons.length;
    const totalDuration = allLessons.reduce(
      (acc, curr) => acc + (curr.durationMinutes || 0),
      0,
    );

    // 3. Mapping Proteksi Konten
    const protectedModules = course.modules.map((mod, modIdx) => ({
      ...mod,
      lessons: mod.lessons.map((lesson, lessonIdx) => {
        // Akses terbuka jika: Owner OR Lesson Preview OR (Bab 1 & Materi 1)
        const canSeeContent =
          isOwner || lesson.isPreview || (modIdx === 0 && lessonIdx === 0);

        return {
          ...lesson,
          contentUrl: canSeeContent ? lesson.contentUrl : null,
          contentText: canSeeContent
            ? lesson.contentText
            : 'Konten terkunci, silakan lakukan pembayaran.',
          isLocked: !canSeeContent,
        };
      }),
    }));

    return {
      ...course,
      modules: protectedModules,
      statistics: {
        totalModules: course.modules.length,
        totalLessons: totalLessons,
        totalDurationFormatted: `${Math.floor(totalDuration / 60)}j ${totalDuration % 60}m`,
        totalDurationMinutes: totalDuration,
      },
      isSubscribed: isOwner,
    };
  }

  async createOrderAndUploadPayment(
    courseId: number,
    userId: number,
    file: Express.Multer.File,
    paymentMethod: string,
    discountCode?: string,
  ) {
    const course = await this.prisma.courses.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new NotFoundException('Course tidak ditemukan');

    const totalAmount = course.price ?? new Prisma.Decimal(0);
    let discountAmount = new Prisma.Decimal(0);
    let couponId: number | null = null;

    // --- LOGIC DISKON DARI DATABASE ---
    if (discountCode) {
      const coupon = await this.prisma.coupons.findUnique({
        where: { couponCode: discountCode },
      });

      const now = new Date();
      // Perbaikan logika null check pada usesCount
      if (
        coupon &&
        coupon.isActive &&
        now >= coupon.validFrom &&
        now <= coupon.validUntil &&
        (coupon.maxUses === null || (coupon.usesCount ?? 0) < coupon.maxUses)
      ) {
        couponId = coupon.id;
        if (coupon.discountType === 'percentage') {
          discountAmount = totalAmount.mul(Number(coupon.discountValue) / 100);
        } else {
          discountAmount = new Prisma.Decimal(coupon.discountValue);
        }
      } else {
        throw new BadRequestException(
          'Kupon tidak valid atau sudah kadaluarsa',
        );
      }
    }

    const grandTotal = Prisma.Decimal.max(totalAmount.sub(discountAmount), 0);

    return await this.prisma.$transaction(async (tx) => {
      // 1. Buat Order
      const order = await tx.orders.create({
        data: {
          userId: userId,
          totalAmount: totalAmount,
          discountAmount: discountAmount,
          grandTotal: grandTotal,
          couponCode: discountCode || null,
          orderStatus: 'pending',
          paymentStatus: 'pending',
          paymentMethod: paymentMethod,
          orderItems: {
            create: [
              {
                courseId: courseId,
                itemType: 'course',
                itemId: courseId,
                pricePerItem: totalAmount,
                totalPrice: grandTotal,
                itemName: course.courseTitle || 'Kursus',
              },
            ],
          },
        },
      });

      // 2. Update uses_count di tabel coupons (Increment)
      if (couponId) {
        await tx.coupons.update({
          where: { id: couponId },
          data: { usesCount: { increment: 1 } }, // Sesuaikan camelCase/snake_case dengan schema kamu
        });
      }

      // 3. Upload & Create Payment
      const upload = await this.cloudinary.uploadFile(file, 'payment_proofs');

      await tx.payments.create({
        data: {
          orderId: order.id,
          userId: userId,
          paymentMethod: paymentMethod,
          paymentStatus: 'pending',
          amount: grandTotal,
          transactionId: `CRSTX-${Date.now()}-${userId}`,
          receiptUrl: upload.secure_url,
        },
      });

      return {
        message:
          'Bukti pembayaran berhasil dikirim. Admin akan segera memverifikasi.',
        success: true,
        orderId: order.id,
        grandTotal: grandTotal,
        discountAmount: discountAmount,
      };
    });
  }
  // async createOrderAndUploadPayment(
  //   courseId: number,
  //   userId: number,
  //   file: Express.Multer.File,
  //   paymentMethod: string,
  // ) {
  //   const course = await this.prisma.courses.findUnique({
  //     where: { id: courseId },
  //   });
  //   if (!course) throw new NotFoundException('Course tidak ditemukan');

  //   // 1. Buat Order & OrderItem (Transaction)
  //   return await this.prisma.$transaction(async (tx) => {
  //     const order = await tx.orders.create({
  //       data: {
  //         userId: userId,
  //         totalAmount: course.price ?? 0,
  //         grandTotal: course.price ?? 0, // Add grandTotal as required by schema
  //         orderStatus: 'pending',
  //         orderItems: {
  //           create: [
  //             {
  //               courseId: courseId,
  //               itemType: 'course',
  //               itemId: 0,
  //               pricePerItem: '',
  //               totalPrice: course.price ?? 0,
  //               itemName: course.courseTitle || 'Kursus',
  //             },
  //           ],
  //         },
  //       },
  //     });

  //     // 2. Upload Bukti ke Cloudinary
  //     const upload = await this.cloudinary.uploadFile(file, 'payment_proofs');

  //     // 3. Buat Payment Record
  //     await tx.payments.create({
  //       data: {
  //         orderId: order.id,
  //         userId: userId,
  //         paymentMethod: paymentMethod,
  //         paymentStatus: 'pending',
  //         amount: course.price ?? 0,
  //         transactionId: `CRSTX-${Date.now()}`,
  //         // Karena di schema lo mungkin belum ada payment_url,
  //         // pastikan lo simpan link upload.secure_url ke field yang sesuai (misal metadata/notes)
  //         metadataJson: {
  //           receipt_url: upload.secure_url,
  //           cloudinary_id: upload.public_id,
  //           uploaded_at: new Date(),
  //         },
  //       },
  //     });

  //     return {
  //       message:
  //         'Bukti pembayaran berhasil dikirim. Admin akan segera memverifikasi.',
  //       orderId: order.id,
  //       method: paymentMethod,
  //     };
  //   });
  // }

  // --- CRUD MODULES (Bab) ---
  async createModule(
    data: CreateModuleDto,
    file: Express.Multer.File,
    userId: number,
  ) {
    try {
      return await this.prisma.modules.create({
        data: {
          // Konversi string ke Int untuk database
          courseId: parseInt(data.courseId, 10),
          moduleTitle: data.moduleTitle,
          moduleOrder: parseInt(data.moduleOrder, 10),
          description: data.description,
          status: data.status || 'draft',
          // Catat siapa yang membuat/mengubah
          lastModifiedBy: userId,
          // Field opsional lainnya bisa ditambahkan di sini
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(
          'Gagal membuat modul: ' + error.message,
        );
      }

      throw new InternalServerErrorException('Gagal membuat modul');
    }
  }

  // --- CRUD LESSONS (Materi di dalam Bab) ---
  async createLesson(
    data: CreateLessonDto,
    files: LessonFiles,
    userId: number,
  ) {
    let contentUrl: string | null = null;
    let externalAssetId: string | null = null;
    let duration: number | null = null;

    // Definisikan tipe array untuk attachment
    const attachments: Prisma.InputJsonValue[] = [];

    // 1. Handle Video
    if (files?.video?.[0]) {
      const uploadVideo = await this.cloudinary.uploadFile(
        files.video[0],
        'lessons/videos',
      );
      contentUrl = uploadVideo.secure_url;
      externalAssetId = uploadVideo.public_id;

      if (uploadVideo.duration) {
        duration = Math.ceil(uploadVideo.duration / 60);
      }
    }

    // 2. Handle PDF
    if (files?.pdf?.[0]) {
      const uploadPdf = await this.cloudinary.uploadFile(
        files.pdf[0],
        'lessons/attachments',
      );
      attachments.push({
        name: files.pdf[0].originalname,
        url: uploadPdf.secure_url,
        type: 'pdf',
        size: files.pdf[0].size,
      });
    }

    // 3. Handle Tags
    const tagsJson = data.tags
      ? data.tags.split(',').map((tag: string) => tag.trim().replace('#', ''))
      : [];

    return this.prisma.lessons.create({
      data: {
        moduleId: parseInt(data.module_id, 10),
        lessonTitle: data.lesson_title,
        lessonType: data.lesson_type,
        contentText: data.content_text || null,
        contentUrl: contentUrl,
        attachmentsJson: attachments as Prisma.InputJsonValue, // Casting ke Json Prisma
        durationMinutes: duration,
        orderInModule: parseInt(data.order_in_module || '1', 10),
        tags: tagsJson as Prisma.InputJsonValue,
        externalAssetId: externalAssetId,
        lastUpdatedBy: userId,
        status: 'published',
        metadataJson: {
          created_via: 'admin_panel',
        } as Prisma.JsonObject,
      },
    });
  }

  async updateLesson(
    id: number,
    data: UpdateLessonDto, // Ganti any dengan DTO
    file: Express.Multer.File | undefined,
    userId: number,
  ) {
    // 1. Cari data lesson lama
    const oldLesson = await this.prisma.lessons.findUnique({ where: { id } });
    if (!oldLesson) throw new NotFoundException('Lesson tidak ditemukan');

    let contentUrl = oldLesson.contentUrl;
    let externalAssetId = oldLesson.externalAssetId;
    let duration = oldLesson.durationMinutes;

    // 2. Jika ada file baru
    if (file) {
      if (oldLesson.externalAssetId) {
        await this.cloudinary.deleteFile(oldLesson.externalAssetId);
      }

      const upload = await this.cloudinary.uploadFile(file, 'lesson_materials');
      contentUrl = upload.secure_url;
      externalAssetId = upload.public_id;

      if (upload.resource_type === 'video' && upload.duration) {
        duration = Math.ceil(upload.duration / 60);
      }
    }

    // Helper safe parse yang Type-Safe
    const safeParse = (val: string | undefined): Prisma.InputJsonValue => {
      // Jika tidak ada data, gunakan null literal atau casting
      if (!val) return null as unknown as Prisma.InputJsonValue;

      try {
        // Gunakan unknown sebagai jembatan untuk memuaskan ESLint & TS
        return JSON.parse(val) as Prisma.InputJsonValue;
      } catch {
        // Jika gagal parse, kembalikan string aslinya sebagai JSON value
        return val as Prisma.InputJsonValue;
      }
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
        orderInModule: data.order_in_module
          ? parseInt(data.order_in_module, 10)
          : undefined,
        isPreview: data.is_preview === 'true' || data.is_preview === true,
        status: data.status,
        // Menggunakan tipe data yang benar untuk kolom JSON
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

  async createSubject(
    data: CreateSubjectDto,
    file: Express.Multer.File | undefined,
  ) {
    let iconUrl: string | null = null;

    // 1. Handle Upload Icon (Single Process)
    if (file) {
      const upload = (await this.cloudinary.uploadFile(
        file,
        'subject_icons',
      )) as CloudinaryResponse;
      iconUrl = upload.secure_url;
    }

    // 2. Helper Safe Parse (Type-Safe)
    const safeParse = (str: string | undefined): Prisma.InputJsonValue => {
      if (!str) return null as unknown as Prisma.InputJsonValue;
      try {
        return JSON.parse(str) as Prisma.InputJsonValue;
      } catch {
        return str as Prisma.InputJsonValue;
      }
    };

    // 3. Simpan ke Database
    return this.prisma.subjects.create({
      data: {
        subjectName: data.subject_name,
        description: data.description || null,
        iconUrl: iconUrl,
        isActive: data.is_active === 'true',

        // Parse Angka dengan Radix dan Fallback yang Aman
        totalQuestionsCount: parseInt(data.total_questions_count || '0', 10),
        totalCoursesCount: parseInt(data.total_courses_count || '0', 10),
        averageDifficulty: parseFloat(data.average_difficulty || '0.0'),

        // Kolom Teks
        relatedFieldOfStudy: data.related_field_of_study || null,
        syllabusOutline: data.syllabus_outline || null,
        suggestedGradeLevels: data.suggested_grade_levels || null,
        commonMisconceptions: data.common_misconceptions || null,
        keyConcepts: data.key_concepts || null,
        learningObjectives: data.learning_objectives || null,
        assessmentMethods: data.assessment_methods || null,
        internalNotes: data.internal_notes || null,

        // Audit & JSON
        lastReviewedBy: data.last_reviewed_by
          ? parseInt(data.last_reviewed_by, 10)
          : null,
        externalResourceLinks: safeParse(data.external_resource_links),
        metadataJson: safeParse(data.metadata_json),
      },
    });
  }

  async findAllSubjects() {
    return this.prisma.subjects.findMany({
      where: { isActive: true }, // Ubah ke camelCase
      include: { _count: { select: { courses: true } } },
    });
  }

  async updateSubject(id: number, data: UpdateSubjectDto) {
    // 1. Cek dulu apakah subject ada (opsional tapi disarankan)
    const subject = await this.prisma.subjects.findUnique({
      where: { id },
    });

    if (!subject) {
      throw new NotFoundException(`Subject dengan ID ${id} tidak ditemukan`);
    }

    // 2. Update dengan data yang sudah ter-type
    return this.prisma.subjects.update({
      where: { id },
      data: {
        subjectName: data.subjectName,
        description: data.description,
        isActive: data.isActive,
        iconUrl: data.iconUrl,
        // Prisma otomatis akan mengabaikan field yang undefined
      },
    });
  }

  async deleteSubject(id: number) {
    return this.prisma.subjects.delete({ where: { id } });
  }

  async createTopic(data: CreateTopicDto, userId: number) {
    return this.prisma.topics.create({
      data: {
        topicName: data.topicName,
        subjectId: data.subjectId,
        description: data.description || null,
        // Parsing angka dengan aman (radix 10 untuk integer)
        averageScore: data.averageScore ? parseFloat(data.averageScore) : 0,
        quizAverageScore: data.quizAverageScore
          ? parseFloat(data.quizAverageScore)
          : 0,

        totalQuestionsCount: data.totalQuestionsCount
          ? parseInt(data.totalQuestionsCount, 10)
          : 0,
        totalLessonsCount: data.totalLessonsCount
          ? parseInt(data.totalLessonsCount, 10)
          : 0,
        lastUpdatedBy: userId,
        // Metadata atau status default jika ada
        // status: 'active',
      },
    });
  }

  async getOrStartCourse(userId: number, courseId: number) {
    const course = await this.prisma.courses.findUnique({
      where: { id: courseId },
      select: { id: true, courseTitle: true }, // Ubah ke camelCase
    });
    if (!course) throw new NotFoundException('Kursus tidak ditemukan');

    // Menggunakan userCourses (Prisma biasanya otomatis camelCase untuk nama model)
    const enrollment = await this.prisma.userCourses.upsert({
      where: {
        userId_courseId: { userId: userId, courseId: courseId }, // Index unique camelCase
      },
      update: {
        lastAccessedAt: new Date(),
      },
      create: {
        userId: userId,
        courseId: courseId,
        status: 'in_progress',
        progressPercentage: 0,
        enrollmentDate: new Date(),
        lastAccessedAt: new Date(),
      },
    });

    const lastAccessed = await this.prisma.progressTracking.findFirst({
      where: { userId: userId, courseId: courseId },
      orderBy: { lastAccessedTimestamp: 'desc' },
      select: { lessonId: true },
    });

    if (!lastAccessed) {
      const firstLesson = await this.prisma.lessons.findFirst({
        where: { module: { courseId: courseId } },
        orderBy: [{ module: { moduleOrder: 'asc' } }, { orderInModule: 'asc' }],
        select: { id: true },
      });

      return {
        message: 'Mulai kursus baru',
        enrollment,
        resumeLessonId: firstLesson?.id || null,
      };
    }

    return {
      message: 'Melanjutkan kursus',
      enrollment,
      resumeLessonId: lastAccessed.lessonId,
    };
  }

  async updateProgress(userId: number, lessonId: number) {
    const lesson = await this.prisma.lessons.findUnique({
      where: { id: lessonId },
      include: { module: true },
    });

    if (!lesson) throw new NotFoundException('Lesson tidak ditemukan');
    const courseId = lesson.module.courseId;

    await this.prisma.progressTracking.upsert({
      where: {
        userId_lessonId: { userId: userId, lessonId: lessonId },
      },
      update: { isCompleted: true, completionTimestamp: new Date() },
      create: {
        userId: userId,
        lessonId: lessonId,
        courseId: courseId,
        moduleId: lesson.moduleId,
        isCompleted: true,
        completionTimestamp: new Date(),
      },
    });

    const totalLessons = await this.prisma.lessons.count({
      where: { module: { courseId: courseId } },
    });

    const completedLessons = await this.prisma.progressTracking.count({
      where: { userId: userId, courseId: courseId, isCompleted: true },
    });

    const percentage = (completedLessons / totalLessons) * 100;

    return await this.prisma.userCourses.update({
      where: {
        userId_courseId: { userId: userId, courseId: courseId },
      },
      data: {
        progressPercentage: percentage,
        status: percentage === 100 ? 'completed' : 'in_progress',
        lastAccessedAt: new Date(),
        completionDate: percentage === 100 ? new Date() : null,
      },
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
              },
            },
          },
        },
      },
    });
  }

  async approvePayment(orderId: number) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Update status Payment
      await tx.payments.updateMany({
        where: { orderId: orderId },
        data: { paymentStatus: 'completed' },
      });

      // 2. Update status Order jadi completed
      // Ini yang akan membuka gembok konten di findOneCourse
      return await tx.orders.update({
        where: { id: orderId },
        data: { orderStatus: 'completed' },
      });
    });
  }
}
