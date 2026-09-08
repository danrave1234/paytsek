import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorBody, ApiErrorCode } from '@payrecord/contracts';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';

const STATUS_BY_CODE: Partial<Record<ApiErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  WORKSPACE_REQUIRED: 400,
  NOT_A_MEMBER: 403,
  OWNER_ONLY: 403,
  COLLECTOR_CREDENTIAL_REVOKED: 401,
  COLLECTOR_SCOPE_VIOLATION: 403,
  VALIDATION_FAILED: 400,
  UNSUPPORTED_API_VERSION: 400,
  PAIRING_CODE_INVALID: 400,
  PAIRING_CODE_EXPIRED: 410,
  PAIRING_ALREADY_CONSUMED: 409,
  PAIRING_RATE_LIMITED: 429,
  PAIRING_NOT_APPROVED: 409,
  SOURCE_ALREADY_HAS_COLLECTOR: 409,
  RECORD_NOT_FOUND: 404,
  RECORD_VOIDED: 409,
  PROOF_UPLOAD_NOT_FINALIZED: 409,
  DUPLICATE_SUBMISSION: 409,
  IDEMPOTENCY_CONFLICT: 409,
  EVENT_NOT_FOUND: 404,
  EVENT_ALREADY_LINKED: 409,
  RECORD_ALREADY_LINKED: 409,
  CANDIDATE_OUT_OF_SCOPE: 403,
  MATCH_CONFLICT: 409,
  CONFIRMATION_REQUIRES_OWNER_APPROVAL: 403,
  QUOTA_EXHAUSTED: 402,
  PLAN_LIMIT_DEVICES: 402,
  PLAN_LIMIT_SOURCES: 402,
  PLAN_LIMIT_MEMBERS: 402,
  PURCHASE_NOT_VERIFIED: 409,
  PURCHASE_ALREADY_APPLIED: 409,
  SUBSCRIPTION_OTHER_WORKSPACE: 409,
  WEBHOOK_UNAUTHORIZED: 401,
  EXPORT_NOT_READY: 409,
  EXPORT_EXPIRED: 410,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
};

export class ApiException extends HttpException {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, STATUS_BY_CODE[code] ?? 400);
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = randomUUID();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiErrorBody = { code: 'INTERNAL', message: 'Internal error', requestId };

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      body = { code: exception.code, message: exception.message, details: exception.details, requestId };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      const message = typeof resp === 'string' ? resp : ((resp as { message?: string | string[] }).message ?? exception.message);
      body = {
        code: status === 404 ? 'NOT_FOUND' : status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 429 ? 'RATE_LIMITED' : 'VALIDATION_FAILED',
        message: Array.isArray(message) ? message.join('; ') : String(message),
        requestId,
      };
    } else {
      // Never leak internals; log with a request id for correlation. Log redaction:
      // messages may contain user data, so only the error name/stack head is logged.
      const err = exception as Error;
      this.logger.error(`[${requestId}] ${err?.name ?? 'Error'}: ${redact(err?.message ?? '')}`);
    }
    res.status(status).json(body);
  }
}

/** Basic log redaction for amounts, phone numbers, long digit runs and emails. */
export function redact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/(\+?63|0)\s?9\d{2}[\s-]?\d{3}[\s-]?\d{4}/g, '[phone]')
    .replace(/\d{8,}/g, '[digits]')
    .replace(/(₱|PHP)\s?[\d,]+(\.\d{1,2})?/gi, '[amount]');
}
