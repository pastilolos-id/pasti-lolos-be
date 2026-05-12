import 'express';

export interface JwtRequestUser {
  userId: number;
  id?: number;
  sub?: number;
  email?: string;
  roles?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtRequestUser;
    }
  }
}
