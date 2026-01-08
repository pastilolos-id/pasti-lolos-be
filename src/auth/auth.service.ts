import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  // REGISTER MANUAL
  async register(data: any) {
    const exists = await this.prisma.users.findUnique({ where: { email: data.email } });
    if (exists) throw new BadRequestException('Email sudah terdaftar');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.prisma.users.create({
      data: {
        email: data.email,
        username: data.username,
        password_hash: hashedPassword,
        user_role_id: 1, // Pastikan role ID 1 ada
        status: 'active',
      },
    });
  }

  // LOGIN MANUAL
  async validateUser(email: string, pass: string) {
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (user && (await bcrypt.compare(pass, user.password_hash))) {
      return this.generateToken(user);
    }
    throw new UnauthorizedException('Email atau password salah');
  }

  // LOGIN GOOGLE (Otomatis daftar kalau belum ada)
  async validateGoogleUser(googleUser: any) {
    let user = await this.prisma.users.findFirst({
      where: { OR: [{ google_id: googleUser.google_id }, { email: googleUser.email }] }
    });

    if (!user) {
      user = await this.prisma.users.create({
        data: {
          email: googleUser.email,
          google_id: googleUser.google_id,
          username: googleUser.email.split('@')[0] + Math.floor(Math.random() * 1000),
          password_hash: '', 
          first_name: googleUser.firstName,
          last_name: googleUser.lastName,
          profile_picture_url: googleUser.picture,
          user_role_id: 1,
          status: 'active',
        },
      });
    }
    return this.generateToken(user);
  }

  async generateToken(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.user_role_id };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id: user.id, username: user.username, role: user.user_role_id }
    };
  }
}