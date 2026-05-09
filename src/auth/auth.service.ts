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
import { UpdateProfileDto } from './dto/update-profile.dto';

interface GoogleUserPayload {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
}

interface AuthResult {
  accessToken: string;
  user: {
    id: number;
    email: string;
    username: string;
    userRoleId: number;
    firstName: string | null;
    lastName: string | null;
    fullName: string;
    profilePictureUrl: string | null;
  };
}

interface TokenUser {
  id: number;
  email: string;
  username: string;
  userRoleId: number;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // REGISTER MANUAL
  async register(data: RegisterDto) {
    const exists = await this.prisma.users.findUnique({
      where: { email: data.email },
    });
    const phoneExists = await this.prisma.users.findFirst({
      where: { phoneNumber: data.phoneNumber },
    });

    if (exists || phoneExists) {
      throw new BadRequestException({
        statusCode: 400,
        errors: {
          ...(exists && { email: ['Email sudah terdaftar'] }),
          ...(phoneExists && { phoneNumber: ['Nomor HP sudah digunakan'] }),
        },
      });
    }

    const nameParts = data.fullName.trim().split(' ');
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    await this.prisma.users.create({
      data: {
        email: data.email,
        username: data.email.split('@')[0] + Math.floor(Math.random() * 1000),
        passwordHash: hashedPassword,
        firstName,
        lastName,
        phoneNumber: data.phoneNumber,
        isAgreed: data.isAgreed,
        userRoleId: 1,
        status: 'active',
      },
    });
    return { message: 'Registrasi berhasil. Silakan login.' };
  }

  // LOGIN MANUAL
  async validateUser(email: string, pass: string): Promise<AuthResult> {
    const user = await this.prisma.users.findUnique({ where: { email } });

    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      // Langsung lempar objek 'user' utuh hasil query Prisma ke generateToken
      return this.generateToken(user);
    }
    throw new UnauthorizedException('Email atau password salah');
  }

  // LOGIN GOOGLE
  async validateGoogleUser(googleUser: GoogleUserPayload): Promise<AuthResult> {
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
          profilePictureUrl: googleUser.picture || null,
          userRoleId: 1,
          status: 'active',
        },
      });
    }
    return this.generateToken(user);
  }

  // FUNGSI PUSAT GENERATE TOKEN[cite: 7]
  generateToken(user: TokenUser): AuthResult {
    const payload = {
      userId: user.id,
      sub: user.id,
      email: user.email,
      roles: [user.userRoleId.toString()],
    };

    // Kalkulasi fullName di satu tempat saja agar konsisten[cite: 7]
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        userRoleId: user.userRoleId,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        fullName: fullName || user.username, // Fallback ke username kalau nama kosong[cite: 7]
        profilePictureUrl: user.profilePictureUrl || null,
      },
    };
  }

  // src/auth/auth.service.ts

  async getProfile(userId: number) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        address: true,
        city: true,
        province: true,
        country: true,
        postalCode: true,
        dateOfBirth: true,
        gender: true,
        profilePictureUrl: true,
        userRoleId: true,
        userRoles: {
          select: {
            roleName: true,
          },
        },
        status: true,
        isAgreed: true,
        agreedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        // Jangan return passwordHash di sini!
      },
    });

    if (!user) throw new UnauthorizedException('User tidak ditemukan');

    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return {
      ...user,
      roleName: user.userRoles.roleName,
      fullName: fullName || user.username,
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const currentUser = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, phoneNumber: true },
    });
    if (!currentUser) {
      throw new UnauthorizedException('User tidak ditemukan');
    }

    if (dto.phoneNumber && dto.phoneNumber !== currentUser.phoneNumber) {
      const phoneExists = await this.prisma.users.findFirst({
        where: {
          phoneNumber: dto.phoneNumber,
          id: { not: userId },
        },
        select: { id: true },
      });
      if (phoneExists) {
        throw new BadRequestException({
          statusCode: 400,
          errors: {
            phoneNumber: ['Nomor HP sudah digunakan'],
          },
        });
      }
    }

    await this.prisma.users.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        address: dto.address,
        city: dto.city,
        province: dto.province,
        country: dto.country,
        postalCode: dto.postalCode,
      },
    });

    const profile = await this.getProfile(userId);
    return {
      success: true,
      message: 'Profil berhasil diperbarui',
      data: profile,
    };
  }
}

// src/auth/auth.service.ts
// import {
//   Injectable,
//   BadRequestException,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service';
// import { JwtService } from '@nestjs/jwt';
// import * as bcrypt from 'bcrypt';
// import { RegisterDto } from './dto/register.dto';

// interface GoogleUserPayload {
//   googleId: string;
//   email: string;
//   firstName: string;
//   lastName: string;
//   profilePictureUrl?: string; // Tanda tanya (?) berarti opsional
// }
// interface AuthResult {
//   accessToken: string;
//   user: {
//     id: number;
//     email: string;
//     username: string;
//     userRoleId: number;
//     firstName?: string; // Opsional, bisa ditambahkan jika ingin dikirim ke FE
//     lastName?: string;  // Opsional, bisa ditambahkan jika ingin dikirim ke FE
//     profilePictureUrl?: string; // Opsional, bisa ditambahkan jika ingin dikirim ke FE
//     fullName?: string; // Opsional, gabungan firstName + lastName
//   };
// }

// @Injectable()
// export class AuthService {
//   constructor(
//     private prisma: PrismaService,
//     private jwtService: JwtService,
//   ) {}
//   // REGISTER MANUAL
//   async register(data: RegisterDto) {
//     // console.log('Data dari FE:', data);

//     // 1. Cek duplikasi email
//     const exists = await this.prisma.users.findUnique({
//       where: { email: data.email },
//     });
//     // Contoh tambahan: Misal lo mau validasi nomor HP unik juga
//     const phoneExists = await this.prisma.users.findFirst({
//       where: { phoneNumber: data.phoneNumber }
//     });

//     if (exists && phoneExists) {
//       throw new BadRequestException({
//         statusCode: 400,
//         errors: {
//           email: ['Email sudah terdaftar, silakan gunakan email lain'],
//           phoneNumber: ['Nomor HP ini sudah digunakan oleh akun lain']
//         }
//       });
//     }

//     if (exists) {
//       throw new BadRequestException({
//         statusCode: 400,
//         errors: {
//           email: ['Email sudah terdaftar, silakan gunakan email lain']
//         }
//       });
//     }

//     if (phoneExists) {
//       throw new BadRequestException({
//         statusCode: 400,
//         errors: {
//           phoneNumber: ['Nomor HP ini sudah digunakan oleh akun lain']
//         }
//       });
//     }

//     // 2. Logika pemisahan Nama
//     const nameParts = data.fullName.trim().split(' ');
//     // TypeScript fix: kasih default '' agar tidak dianggap 'string | undefined'
//     const firstName = nameParts.shift() || '';
//     const lastName = nameParts.join(' ');

//     // 3. Hash Password (Gunakan data.password)
//     const hashedPassword = await bcrypt.hash(data.password, 10);
//     await this.prisma.users.create({
//       data: {
//         email: data.email,
//         // Username unik: email prefix + random number
//         username: data.email.split('@')[0] + Math.floor(Math.random() * 1000),
//         passwordHash: hashedPassword,
//         firstName: firstName,
//         lastName: lastName,
//         phoneNumber: data.phoneNumber,
//         isAgreed: data.isAgreed,
//         userRoleId: 1,
//         status: 'active',
//       },
//     });
//     return { message: 'Registrasi berhasil. Silakan login.' };
//   }

//   // LOGIN MANUAL
//   async validateUser(email: string, pass: string): Promise<AuthResult> {
//     const user = await this.prisma.users.findUnique({ where: { email } });

//     // Pastikan menggunakan user.passwordHash (camelCase)
//     if (user && (await bcrypt.compare(pass, user.passwordHash))) {
//       // TAMBAHKAN firstName dan lastName di bawah ini
//       const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
//       return this.generateToken({
//         id: user.id,
//         email: user.email,
//         username: user.username,
//         userRoleId: user.userRoleId,
//         fullName: fullName,
//         profilePictureUrl: user.profilePictureUrl,
//       });
//     }
//     throw new UnauthorizedException('Email atau password salah');
//   }

//   // LOGIN GOOGLE (Otomatis daftar kalau belum ada)
//   async validateGoogleUser(googleUser: GoogleUserPayload): Promise<AuthResult> {
//     let user = await this.prisma.users.findFirst({
//       where: {
//         OR: [{ googleId: googleUser.googleId }, { email: googleUser.email }],
//       },
//     });

//     if (!user) {
//       user = await this.prisma.users.create({
//         data: {
//           email: googleUser.email,
//           googleId: googleUser.googleId,
//           username:
//             googleUser.email.split('@')[0] + Math.floor(Math.random() * 1000),
//           passwordHash: '',
//           firstName: googleUser.firstName,
//           lastName: googleUser.lastName,
//           profilePictureUrl: googleUser.profilePictureUrl || null, // Handle jika foto tidak ada
//           userRoleId: 1,
//           status: 'active',
//         },
//       });
//     }
//     const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
//     return this.generateToken({
//       id: user.id,
//       email: user.email,
//       username: user.username,
//       userRoleId: user.userRoleId,
//       profilePictureUrl: user.profilePictureUrl,
//       fullName: fullName,
//     });
//   }

//   generateToken(user: any): AuthResult {
//     const payload = {
//       userId: user.id,
//       sub: user.id,
//       email: user.email,
//       roles: [user.userRoleId.toString()],
//     };
//     const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

//     // Pastikan field-field ini ada di object 'user' yang dikirim ke fungsi ini
//     return {
//       accessToken: this.jwtService.sign(payload),
//       user: {
//         id: user.id,
//         email: user.email,
//         username: user.username,
//         userRoleId: user.userRoleId,
//         firstName: user.firstName || null,
//         lastName: user.lastName || null,
//         profilePictureUrl: user.profilePictureUrl || null,
//         fullName: fullName,
//       },
//     };
//   }
//   // generateToken(user: {
//   //   id: number;
//   //   email: string;
//   //   username: string;
//   //   userRoleId: number;
//   // }): AuthResult {
//   //   const payload = {
//   //       userId: user.id, // Tambahkan ini agar req.user.userId tidak undefined
//   //       sub: user.id,
//   //       email: user.email,
//   //       roles: [user.userRoleId.toString()], // BERUBAH KE JAMAK DAN STRING ARRAY
//   //     };

//   //   return {
//   //     accessToken: this.jwtService.sign(payload),
//   //     user: {
//   //       id: user.id,
//   //       email: user.email,
//   //       username: user.username,
//   //       userRoleId: user.userRoleId,
//   //     },
//   //   };
//   // }
// }
