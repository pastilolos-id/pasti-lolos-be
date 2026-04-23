import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Terjadi kesalahan pada database';

    if (exception.code === 'P2002') {
      status = HttpStatus.CONFLICT;
      message = 'Data ini sudah terdaftar di sistem (Duplicate)';
    }

    if (exception.code === 'P2025') {
      status = HttpStatus.NOT_FOUND;
      message = 'Data tidak ditemukan';
    }

    response.status(status).json({
      statusCode: status,
      message: message,
      error: exception.code,
    });
  }
}