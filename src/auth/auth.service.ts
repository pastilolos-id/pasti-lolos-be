// src/auth/auth.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';

interface GoogleUserPayload {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  picture?: string; // Tanda tanya (?) berarti opsional
}
interface UserFromDb {
  id: number;
  email: string;
  username: string;
  userRoleId: number;
  // tambahkan field lain jika perlu
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}
  // REGISTER MANUAL
  async register(data: RegisterDto) {
    // console.log('Data dari FE:', data);

    // 1. Cek duplikasi email
    const exists = await this.prisma.users.findUnique({
      where: { email: data.email },
    });
    if (exists) throw new BadRequestException('Email sudah terdaftar');

    // 2. Logika pemisahan Nama
    const nameParts = data.fullName.trim().split(' ');
    // TypeScript fix: kasih default '' agar tidak dianggap 'string | undefined'
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ');

    // 3. Hash Password (Gunakan data.password)
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 4. Simpan ke Database
    // confirmPassword OTOMATIS terbuang karena tidak kita masukkan ke blok data di bawah
    return this.prisma.users.create({
      data: {
        email: data.email,
        // Username unik: email prefix + random number
        username: data.email.split('@')[0] + Math.floor(Math.random() * 1000),
        passwordHash: hashedPassword,
        firstName: firstName,
        lastName: lastName,
        phoneNumber: data.phoneNumber,
        isAgreed: data.isAgreed,
        userRoleId: 4,
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
  async validateGoogleUser(googleUser: GoogleUserPayload) {
    let user = await this.prisma.users.findFirst({
      where: {
        OR: [{ googleId: googleUser.googleId }, { email: googleUser.email }],
      },
    });

    if (!user) {
      user = await this.prisma.users.create({
        data: {
          email: googleUser.email,
          googleId: googleUser.googleId,
          username:
            googleUser.email.split('@')[0] + Math.floor(Math.random() * 1000),
          passwordHash: '',
          firstName: googleUser.firstName,
          lastName: googleUser.lastName,
          profilePictureUrl: googleUser.picture || null, // Handle jika foto tidak ada
          userRoleId: 4,
          status: 'active',
        },
      });
    }
    return this.generateToken(user);
  }

  generateToken(user: UserFromDb) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.userRoleId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.userRoleId,
      },
    };
  }
}
