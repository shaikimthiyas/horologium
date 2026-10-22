/**
 * RFC 7807 Problem Details for HTTP APIs (application/problem+json)
 * Enterprise-grade standardized error responses for Horologium.
 * Specification: https://datatracker.ietf.org/doc/html/rfc7807
 */

export class ProblemError extends Error {
  constructor({
    status = 500,
    title = 'Internal Server Error',
    detail = 'An unexpected error occurred while processing the chronometry telemetry request.',
    type = 'https://horologium.io/errors/internal-error',
    instance = null,
    invalidParams = null,
    extra = {}
  }) {
    super(detail);
    this.name = 'ProblemError';
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.type = type;
    this.instance = instance;
    this.invalidParams = invalidParams;
    this.extra = extra;
  }
}

/**
 * Send an RFC 7807 formatted Problem Details response
 */
export function sendProblem(res, {
  status = 500,
  title = 'Internal Server Error',
  detail = 'An unexpected error occurred.',
  type = 'https://horologium.io/errors/internal-error',
  instance = null,
  invalidParams = null,
  extra = {}
}) {
  const problemPayload = {
    type,
    title,
    status,
    detail,
    instance: instance || res.req?.originalUrl || res.req?.url || null,
    timestampUtc: new Date().toISOString(),
    ...extra
  };

  if (invalidParams && Array.isArray(invalidParams) && invalidParams.length > 0) {
    problemPayload.invalidParams = invalidParams;
  }

  res.setHeader('Content-Type', 'application/problem+json; charset=utf-8');
  return res.status(status).json(problemPayload);
}

/**
 * Express Error Handler Middleware formatting all uncaught errors into RFC 7807
 */
export function problemDetailsErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ProblemError) {
    return sendProblem(res, {
      status: err.status,
      title: err.title,
      detail: err.detail,
      type: err.type,
      instance: err.instance || req.originalUrl,
      invalidParams: err.invalidParams,
      extra: err.extra
    });
  }

  // Handle SyntaxError (e.g. malformed JSON body)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendProblem(res, {
      status: 400,
      title: 'Malformed JSON Payload',
      detail: 'The request body contained invalid JSON syntax that could not be parsed.',
      type: 'https://horologium.io/errors/malformed-json',
      instance: req.originalUrl
    });
  }

  // Fallback for general unhandled errors
  const isProduction = process.env.NODE_ENV === 'production';
  return sendProblem(res, {
    status: err.status || 500,
    title: err.title || 'Internal Server Error',
    detail: isProduction ? 'An unexpected server exception occurred.' : (err.message || 'Server error'),
    type: 'https://horologium.io/errors/internal-error',
    instance: req.originalUrl,
    extra: isProduction ? {} : { stack: err.stack }
  });
}
