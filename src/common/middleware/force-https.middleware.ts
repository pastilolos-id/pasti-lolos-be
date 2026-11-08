import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ForceHttpsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Paksa protokol menjadi https jika di environment production
    if (process.env.NODE_ENV === 'production') {
      req.headers['x-forwarded-proto'] = 'https';
    }
    next();
  }
}