import type { JwtPayload } from '@veloxdesk/common';
import { UserEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Socket } from 'socket.io';
import { Repository } from 'typeorm';

@Injectable()
export class WsAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  // Socket.IO connections aren't HTTP requests, so the usual JwtAuthGuard
  // (Passport, per-request) doesn't apply — the token is verified once at
  // handshake time instead, using the same JWT_ACCESS_SECRET user-service
  // signs with. This only stops a NEW connection attempt from a deactivated
  // account — an already-open socket needs an explicit push to close (see
  // ChatGateway.forceDisconnectUser, driven by UsersService.deactivate).
  async authenticate(client: Socket): Promise<JwtPayload | null> {
    const token = client.handshake.auth?.['token'] ?? client.handshake.query?.['token'];
    if (typeof token !== 'string' || !token) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      const user = await this.users.findOne({ where: { id: payload.sub }, select: ['id'] });
      return user ? payload : null;
    } catch {
      return null;
    }
  }
}
