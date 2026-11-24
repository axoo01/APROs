import { DomainError } from '../../domain';

/** User-facing message for any error thrown by a port (domain errors carry safe messages). */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return err instanceof DomainError ? err.message : fallback;
}
