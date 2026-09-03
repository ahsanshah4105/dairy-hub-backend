/**
 * Base class for all domain errors.
 * Domain errors are pure TypeScript — no HTTP, no framework imports.
 * The presentation layer (ExceptionFilter) maps these to HTTP responses.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
