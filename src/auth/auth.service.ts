// src/auth/auth.service.ts
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
        passwordHash: hashedPassword, // camelCase
        userRoleId: 4, // camelCase
        status: 'active',
      },
    });
  }

  // LOGIN MANUAL
  async validateUser(email: string, pass: string) {
    const user = await this.prisma.users.findUnique({ where: { email } });
    
    // Pastikan menggunakan user.passwordHash (camelCase)
    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      return this.generateToken(user);
    }
    throw new UnauthorizedException('Email atau password salah');
  }

  // LOGIN GOOGLE (Otomatis daftar kalau belum ada)
  async validateGoogleUser(googleUser: any) {
    let user = await this.prisma.users.findFirst({
      where: { 
        OR: [
          { googleId: googleUser.googleId }, // camelCase
          { email: googleUser.email }
        ] 
      }
    });

    if (!user) {
      user = await this.prisma.users.create({
        data: {
          email: googleUser.email,
          googleId: googleUser.googleId, // camelCase
          username: googleUser.email.split('@')[0] + Math.floor(Math.random() * 1000),
          passwordHash: '', // camelCase
          firstName: googleUser.firstName, // camelCase
          lastName: googleUser.lastName, // camelCase
          profilePictureUrl: googleUser.picture, // camelCase
          userRoleId: 4, // camelCase
          status: 'active',
        },
      });
    }
    return this.generateToken(user);
  }

  async generateToken(user: any) {
    // Gunakan user.userRoleId (camelCase)
    const payload = { sub: user.id, email: user.email, role: user.userRoleId };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.userRoleId 
      }
    };
  }
}