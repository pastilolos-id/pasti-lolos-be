// src/exams/exams.service.ts
import { Injectable, NotFoundException,BadRequestException  } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  // --- CRUD EXAMS ---
  async createExam(data: any, userId: number) {
    // Kita pisahkan field yang butuh konversi agar tidak duplikat di spread operator (...)
    const { passing_score, price, ...rest } = data;

    return this.prisma.exams.create({
      data: {
        ...rest, // Sisa data lainnya
        passing_score: passing_score ? parseFloat(passing_score) : null,
        price: price ? parseFloat(price) : 0,
        created_by_user_id: userId, // Diambil dari JWT
      },
    });
  }
  // async createExam(data: any, userId: number) {
  //   return this.prisma.exams.create({
  //     data: {
  //       ...data,
  //       created_by_user_id: userId, // Wajib sesuai tabel [cite: 107]
  //     },
  //   });
  // }

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
        points: data.points ? parseInt(data.points) : 0,
        time_limit_per_question: data.time_limit_per_question ? parseInt(data.time_limit_per_question) : null,
        created_by_user_id: userId, // Diambil otomatis dari JWT
        is_active: data.is_active ?? true,
      },
    });
  }

  // --- MENGHUBUNGKAN SOAL KE UJIAN (Exam_Questions) ---
  async addQuestionToExam(data: any) {
    // 1. Cek dulu apakah koneksi soal dan exam ini sudah ada
    const existing = await this.prisma.exam_questions.findFirst({
      where: {
        exam_id: parseInt(data.exam_id),
        question_id: parseInt(data.question_id),
      },
    });

    if (existing) {
      throw new BadRequestException('Soal ini sudah terdaftar di dalam ujian ini!');
    }

    // 2. Jika belum ada, baru buat
    return this.prisma.exam_questions.create({
      data: {
        exam_id: parseInt(data.exam_id),
        question_id: parseInt(data.question_id),
        order_in_exam: data.order_in_exam ? parseInt(data.order_in_exam) : 1,
        points_for_question: data.points_for_question ? parseFloat(data.points_for_question) : 1.0,
      },
    });
  }
  // async addQuestionToExam(data: any) {
  //   return this.prisma.exam_questions.create({
  //     data: {
  //       exam_id: parseInt(data.exam_id),
  //       question_id: parseInt(data.question_id),
  //       // Jika order_in_exam tidak diisi, otomatis jadi 1
  //       order_in_exam: data.order_in_exam ? parseInt(data.order_in_exam) : 1,
  //       // Jika poin tidak diisi, otomatis jadi 1.0
  //       points_for_question: data.points_for_question ? parseFloat(data.points_for_question) : 1.0,
  //     },
  //   });
  // }

  // --- CRUD ANSWERS ---
  async createAnswer(data: any, userId: number) {
    const answer = await this.prisma.answers.create({
      data: {
        ...data,
        order_number: data.order_number ? parseInt(data.order_number) : 1,
        points_if_selected: data.points_if_selected ? parseInt(data.points_if_selected) : 0,
        last_modified_by: userId,
        is_active: data.is_active ?? true,
      },
    });

    // JIKA jawaban ini ditandai sebagai yang benar (is_correct: true)
    if (data.is_correct === true) {
      await this.prisma.questions.update({
        where: { id: data.question_id },
        data: { correct_answer_id: answer.id },
      });
    }

    return answer;
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
  // 1. Ambil data User Exam untuk mendapatkan exam_id-nya
  const userExam = await this.prisma.user_exams.findUnique({
    where: { id: userExamId },
    select: { id: true, exam_id: true }
  });

  if (!userExam) {
    throw new NotFoundException(`Sesi ujian ID ${userExamId} tidak ditemukan`);
  }

  // 2. Ambil semua jawaban user beserta bobot poin dari tabel linker (exam_questions)
  // Kita join ke tabel answers untuk cek is_correct dan exam_questions untuk ambil poin dinamis
  const userAnswers = await this.prisma.user_exam_answers.findMany({
    where: { user_exam_id: userExamId },
    include: {
      // Join ke tabel jawaban yang dipilih user
      selected_answer: {
        select: { is_correct: true }
      },
      // Join ke tabel soal -> exam_questions untuk ambil poin khusus ujian ini
      question: {
        include: {
          exam_questions: {
            where: { exam_id: userExam.exam_id }
          }
        }
      }
    }
  });

  if (!userAnswers.length) {
    throw new NotFoundException('Tidak ada jawaban yang ditemukan untuk sesi ini');
  }

  // 3. Hitung total skor dengan casting Number() untuk akurasi desimal
  const totalScore = userAnswers.reduce((acc, curr) => {
    // Cek apakah jawaban yang dipilih user benar
    const isCorrect = curr.selected_answer?.is_correct || false;
    
    if (isCorrect) {
      // Ambil poin dari tabel exam_questions (linker), default ke 0 jika tidak ada
      const point = Number(curr.question.exam_questions[0]?.points_for_question || 0);
      return acc + point;
    }
    
    return acc;
  }, 0);

  // 4. Update status dan skor akhir ke tabel user_exams
  return this.prisma.user_exams.update({
    where: { id: userExamId },
    data: {
      end_time: new Date(),
      submission_time: new Date(),
      score: totalScore,           // Menyimpan hasil kalkulasi Number()
      is_completed: true,
      status: 'submitted'          // Mengubah status dari 'In Progress' ke 'submitted'
    }
  });
}


}