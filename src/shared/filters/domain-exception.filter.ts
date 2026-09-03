import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { DomainError } from '../domain/domain-error';

/**
 * Registry mapping domain error codes to HTTP status codes.
 * This is the ONLY place in the entire app where domain errors
 * are translated into HTTP semantics.
 */
const ERROR_STATUS_MAP: Record<string, HttpStatus> = {
  OTP_COOLDOWN: HttpStatus.TOO_MANY_REQUESTS,
  OTP_EXPIRED: HttpStatus.UNAUTHORIZED,
  OTP_INVALID: HttpStatus.UNAUTHORIZED,
  MAX_ATTEMPTS: HttpStatus.TOO_MANY_REQUESTS,
  INVALID_SESSION: HttpStatus.UNAUTHORIZED,
  INVALID_TOKEN: HttpStatus.UNAUTHORIZED,
  IDENTITY_NOT_FOUND: HttpStatus.UNAUTHORIZED,
  PROFILE_NOT_FOUND: HttpStatus.NOT_FOUND,
};

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      ERROR_STATUS_MAP[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.warn({
      msg: 'Domain error caught',
      code: exception.code,
      error: exception.message,
    });

    response.status(status).json({
      statusCode: status,
      error: exception.code,
      message: exception.message,
    });
  }
}
