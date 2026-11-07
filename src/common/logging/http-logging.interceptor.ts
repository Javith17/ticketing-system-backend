import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';

const SENSITIVE_KEYS = new Set([
  'password',
  'current_password',
  'new_password',
  'accesstoken',
  'token',
  'authorization',
]);

const MAX_LOG_LENGTH = 2000;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEYS.has(key.toLowerCase())
        ? '***REDACTED***'
        : redact(val);
    }
    return result;
  }
  return value;
}

function safeStringify(value: unknown): string {
  try {
    const json = JSON.stringify(redact(value)) ?? 'undefined';
    return json.length > MAX_LOG_LENGTH
      ? `${json.slice(0, MAX_LOG_LENGTH)}…(truncated)`
      : json;
  } catch {
    return '[unserializable]';
  }
}

/**
 * Derives the conventional source filename for a controller class
 * (e.g. `UsersController` -> `users.controller.ts`), matching this
 * project's one-controller-per-module-per-file layout.
 */
function controllerFileName(controllerName: string): string {
  const base = controllerName.replace(/Controller$/, '');
  const kebab = base.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return `${kebab}.controller.ts`;
}

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const fileName = controllerFileName(context.getClass().name);
    const handlerName = context.getHandler().name;
    const { method, originalUrl } = request;
    const start = Date.now();

    this.logger.log(
      `--> ${method} ${originalUrl} | file=${fileName}#${handlerName} | body=${safeStringify(request.body)}`,
    );

    return next.handle().pipe(
      tap((responseBody) => {
        const duration = Date.now() - start;
        this.logger.log(
          `<-- ${method} ${originalUrl} | file=${fileName}#${handlerName} | status=${response.statusCode} | ${duration}ms | body=${safeStringify(responseBody)}`,
        );
      }),
      catchError((error) => {
        const duration = Date.now() - start;
        const status = error?.status ?? 500;
        const errorBody = error?.response ?? { message: error?.message };
        this.logger.error(
          `<-- ${method} ${originalUrl} | file=${fileName}#${handlerName} | status=${status} | ${duration}ms | body=${safeStringify(errorBody)}`,
        );
        return throwError(() => error);
      }),
    );
  }
}
