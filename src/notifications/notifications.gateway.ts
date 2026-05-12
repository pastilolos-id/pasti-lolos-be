import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable } from '@nestjs/common';

interface JwtPayload {
  userId?: number;
  email?: string;
  roles?: string[];
}

function extractWsToken(client: Socket): string | null {
  const auth = client.handshake.auth as { token?: string };
  if (auth?.token && typeof auth.token === 'string') return auth.token;

  const authHeader = client.handshake.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookie = client.handshake.headers.cookie;
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export type NotificationRealtimePayload = {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export type NotificationReadPayload =
  | { id: number; isRead: boolean }
  | { allRead: true };

@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.18.33:3000',
    ],
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  roomFor(userId: number): string {
    return `user:${userId}`;
  }

  handleConnection(client: Socket): void {
    const token = extractWsToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const userId = payload.userId;
      if (userId == null || typeof userId !== 'number') {
        client.disconnect(true);
        return;
      }
      (client.data as { userId?: number }).userId = userId;
      void client.join(this.roomFor(userId));
    } catch {
      client.disconnect(true);
    }
  }

  emitToUser(userId: number, payload: NotificationRealtimePayload): void {
    this.server.to(this.roomFor(userId)).emit('notification', payload);
  }

  /** FE: update badge / row tanpa polling (bukan notifikasi baru). */
  emitNotificationRead(userId: number, payload: NotificationReadPayload): void {
    this.server.to(this.roomFor(userId)).emit('notification:read', payload);
  }
}
