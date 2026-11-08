import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { Request, Response } from 'express';
import type { JwtRequestUser } from 'src/types/express';

interface GoogleUserPayload {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  // Body sekarang sudah tervalidasi oleh RegisterDto
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response, // Gunakan passthrough: true agar tetap bisa return object
  ) {
    // 1. Validasi user dan dapatkan token dari service
    const result = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    // 2. Set Cookie
    res.cookie('token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
    });

    // 3. Kembalikan data user (tanpa token di body juga gak apa-apa karena sudah di cookie)
    return {
      message: 'Login berhasil',
      user: result.user,
    };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'), ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  googleAuth() {
    // Biarkan kosong, Passport yang urus redirect-nya
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    try {
      const user = req.user;

      // 1. Cek jika user tidak ada dari Passport
      if (!user) {
        throw new UnauthorizedException('Gagal mendapatkan data dari Google');
      }

      // 2. Proses validasi atau pendaftaran di database
      // Bungkus proses service ke dalam result
      const result = await this.authService.validateGoogleUser(
        user as GoogleUserPayload,
      );

      // 3. Set Cookie jika berhasil
      res.cookie('token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // 4. Redirect ke halaman utama (Home/Dashboard)
      return res.redirect('https://pastilolos.id/home');
    } catch (error) {
      // KALO GAGAL:
      console.error('Google Auth Error:', error);

      // Redirect balik ke login sambil bawa pesan error lewat query param
      // Supaya FE bisa nampilin toast/notifikasi error ke user
      const errorMessage = encodeURIComponent(
        'Login Google gagal, silakan coba lagi.',
      );
      return res.redirect(`https://pastilolos.id/login?error=${errorMessage}`);
    }
  }

  @Get('logout')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  logout(@Res({ passthrough: true }) res: Response) {
    // 1. Hapus cookie dengan cara menimpa nilainya dan set expired ke masa lalu
    res.cookie('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(0), // Set ke tanggal 1 Januari 1970
    });

    // 2. Return response sukses
    return {
      message: 'Logout berhasil',
    };
  }

  @ApiCookieAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('myProfile')
  async getMe(@Req() req: Request) {
    // req.user.userId dapet dari logic JwtStrategy lo[cite: 1, 3]
    const user = req.user as JwtRequestUser | undefined;
    if (!user?.userId) {
      throw new UnauthorizedException('User tidak valid');
    }

    return this.authService.getProfile(user.userId);
  }

  @ApiCookieAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  async updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const user = req.user as JwtRequestUser | undefined;
    if (!user?.userId) {
      throw new UnauthorizedException('User tidak valid');
    }
    return this.authService.updateProfile(user.userId, dto);
  }
}
