import { Controller, Post, Get, Body, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: any) {
    return this.authService.validateUser(body.email, body.password);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res) {
    const result = await this.authService.validateGoogleUser(req.user);
    // Setelah login Google, kirim token ke frontend Next.js
    return res.redirect(`http://localhost:3000/auth-success?token=${result.access_token}`);
  }
  @Get('me')
  @UseGuards(AuthGuard('jwt')) // <--- Ini pelindungnya
  getProfile(@Req() req) {
    // req.user berisi data dari JwtStrategy.validate()
    return {
      message: 'Kamu berhasil mengakses data rahasia',
      user: req.user,
    };
  }
}

// http://localhost:4000/auth/google/callback