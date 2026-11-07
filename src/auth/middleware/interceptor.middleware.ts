import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import * as jwt from 'jsonwebtoken';

/**
 * Soft-decodes the bearer token (if present) and attaches the payload to
 * `request.user`, without rejecting the request. Route protection itself is
 * enforced by AuthGuard - this only makes the caller's identity available to
 * controllers/services further down the chain.
 */
@Injectable()
export class AuthInterceptor implements NestInterceptor {
  constructor(private configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const secret = this.configService.get<string>('JWT_SECRET');
        request.user = jwt.verify(token, secret);
      } catch (err) {
        // Invalid/expired token - leave request.user unset, AuthGuard decides access.
      }
    }

    return next.handle();
  }
}
