import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { Request } from 'express';

// Interface untuk payload JWT agar tidak 'any'
interface JwtPayload {
  userId: number; // userId
  email: string;
  roles: string[]; // Array string karena di DB lo pake junction user_role
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Custom extractor dari cookie
      jwtFromRequest: (req: Request): string | null => {
        if (req && req.cookies) {
          // 'token' adalah nama cookie yang kita set di controller
          return (req.cookies as Record<string, string>)['token'] || null;
        }
        return null;
      },
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secret_key', // Gunakan default atau error handling
    });
  }

  // Payload sudah bertipe JwtPayload, bukan any lagi
  validate(payload: JwtPayload) {
    return {
      // userId: payload.sub,
      // email: payload.email,
      // role: payload.role,
      userId: payload.userId, // Sesuai dengan payload.userId di AuthService
      email: payload.email, 
      roles: payload.roles
    };
  }
}
