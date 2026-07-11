class ApplicationError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode || 500;
  }
}

class NotFoundError extends ApplicationError {
  constructor(message) {
    super(message || 'Resource not found', 404);
  }
}

class ValidationError extends ApplicationError {
  constructor(message) {
    super(message || 'Validation failed', 400);
  }
}

class DomainError extends ApplicationError {
  constructor(message) {
    super(message || 'Domain logic error', 400);
  }
}

module.exports = {
  ApplicationError,
  NotFoundError,
  ValidationError,
  DomainError
};
