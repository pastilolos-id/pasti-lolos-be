// src/exams/exams.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  // --- CRUD EXAMS ---
  async createExam(data: any, userId: number) {
    return this.prisma.exams.create({
      data: {
        ...data,
        created_by_user_id: userId, // Wajib sesuai tabel [cite: 107]
      },
    });
  }

  // Get Exam Lengkap (Exam -> Exam_Questions -> Questions -> Answers)
    async findOneExam(id: number) {
    const exam = await this.prisma.exams.findUnique({
        where: { id },
        include: {
        exam_questions: { 
            orderBy: { 
            order_in_exam: 'asc' 
            },
            include: {
            question: { // Ubah dari 'questions' menjadi 'question' 
                include: {
                answers: true, // Relasi ke tabel answers [cite: 40]
                },
            },
            },
        },
        },
    });

    if (!exam) throw new NotFoundException('Ujian tidak ditemukan');
    return exam;
    }

  // --- CRUD QUESTIONS ---
  async createQuestion(data: any, userId: number) {
    return this.prisma.questions.create({
      data: {
        ...data,
        created_by_user_id: userId, // Wajib sesuai tabel [cite: 121]
      },
    });
  }

  // --- MENGHUBUNGKAN SOAL KE UJIAN (Exam_Questions) ---
  async addQuestionToExam(data: any) {
    return this.prisma.exam_questions.create({
      data: {
        exam_id: data.exam_id,
        question_id: data.question_id,
        order_in_exam: data.order_in_exam,
        points_for_question: data.points_for_question || 1.0,
      },
    });
  }

  // --- CRUD ANSWERS ---
  async createAnswer(data: any) {
    return this.prisma.answers.create({ data });
  }


//   ini fungsi untuk Mekanisme Ujian (User Exam Attempt).
// src/exams/exams.service.ts

async startExam(examId: number, userId: number) {
  return this.prisma.user_exams.create({
    data: {
      exam_id: examId,
      user_id: userId,
      start_time: new Date(),
      status: 'in_progress',
    },
  });
}

async submitAnswer(userExamId: number, questionId: number, answerId: number) {
  // Kita cari dulu apakah jawaban untuk soal ini sudah ada
  const existingAnswer = await this.prisma.user_exam_answers.findFirst({
    where: {
      user_exam_id: userExamId,
      question_id: questionId
    }
  });

  if (existingAnswer) {
    // Jika ada, kita update
    return this.prisma.user_exam_answers.update({
      where: { id: existingAnswer.id },
      data: { 
        selected_answer_id: answerId,
        updated_at: new Date()
      }
    });
  } else {
    // Jika tidak ada, kita buat baru
    return this.prisma.user_exam_answers.create({
      data: {
        user_exam_id: userExamId,
        question_id: questionId,
        selected_answer_id: answerId,
        attempt_number: 1, // Masukkan field yang tadi error 'missing'
      },
    });
  }
}

// src/exams/exams.service.ts

async finishExam(userExamId: number) {
  // 1. Ambil data jawaban user
  const userAnswers = await this.prisma.user_exam_answers.findMany({
    where: { user_exam_id: userExamId }
  });

  if (!userAnswers.length) {
    throw new NotFoundException('Tidak ada jawaban ditemukan');
  }

  // 2. Ambil detail jawaban benar
  const selectedIds = userAnswers
    .map(ua => ua.selected_answer_id)
    .filter(id => id !== null) as number[];

  const correctAnswers = await this.prisma.answers.findMany({
    where: {
      id: { in: selectedIds },
      is_correct: true
    }
  });

  // 3. Hitung total skor
  const totalScore = correctAnswers.reduce((acc, curr) => {
    return acc + (curr.points_if_selected || 0);
  }, 0);

  // 4. Update sesuai nama kolom di model lo: 'score' dan 'is_completed'
  return this.prisma.user_exams.update({
    where: { id: userExamId },
    data: {
      end_time: new Date(),
      submission_time: new Date(), // Sesuai kolom di model lo
      score: totalScore,           // PAKAI 'score' (sesuai model lo)
      is_completed: true,          // PAKAI 'is_completed'
      status: 'submitted'          // Sesuai ENUM di komen model lo
    }
  });
}


}