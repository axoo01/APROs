/** Domain errors mirror the HTTP semantics the future REST adapter will map to (400/403/404/409). */
export abstract class DomainError extends Error {
  abstract readonly code: 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'UNAUTHENTICATED';
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION' as const;
  constructor(
    message: string,
    readonly issues: readonly string[] = [message],
  ) {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN' as const;
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND' as const;
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT' as const;
}

export class UnauthenticatedError extends DomainError {
  readonly code = 'UNAUTHENTICATED' as const;
}
