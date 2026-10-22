/**
 * Horologium Request Schema Validation Middleware (Zod Powered)
 * Enforces strict runtime contract validation on body, query, and params.
 * Converts schema violations into RFC 7807 Problem Details.
 */

import { z } from 'zod';
import { sendProblem } from './problemDetails.js';

/**
 * Creates an Express middleware that validates req.body, req.query, and/or req.params
 * @param {Object} schemas - { body?: z.ZodSchema, query?: z.ZodSchema, params?: z.ZodSchema }
 */
export function validateRequest(schemas) {
  return (req, res, next) => {
    const invalidParams = [];

    // Validate query
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        for (const issue of result.error.issues) {
          invalidParams.push({
            in: 'query',
            name: issue.path.join('.'),
            reason: issue.message,
            code: issue.code
          });
        }
      } else {
        Object.defineProperty(req, 'query', {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true
        });
        req.validatedQuery = result.data;
      }
    }

    // Validate params
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        for (const issue of result.error.issues) {
          invalidParams.push({
            in: 'params',
            name: issue.path.join('.'),
            reason: issue.message,
            code: issue.code
          });
        }
      } else {
        Object.defineProperty(req, 'params', {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true
        });
        req.validatedParams = result.data;
      }
    }

    // Validate body
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        for (const issue of result.error.issues) {
          invalidParams.push({
            in: 'body',
            name: issue.path.join('.'),
            reason: issue.message,
            code: issue.code
          });
        }
      } else {
        req.body = result.data;
        req.validatedBody = result.data;
      }
    }

    if (invalidParams.length > 0) {
      return sendProblem(res, {
        status: 400,
        title: 'Invalid Request Parameters',
        detail: 'One or more request parameters failed validation against schema constraints.',
        type: 'https://horologium.io/errors/invalid-parameters',
        instance: req.originalUrl,
        invalidParams
      });
    }

    next();
  };
}

// Re-export zod for convenient schema definitions
export { z };
