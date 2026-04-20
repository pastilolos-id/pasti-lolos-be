import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

interface AuthUser {
  userId: number;
  email: string;
  role: string;
}

interface RequestWithUser extends Request {
  user?: AuthUser;
}

export const GetUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
