/**
 * Request validation schemas and middleware using Zod.
 *
 * Provides:
 *  - validateBody(schema)  — middleware that parses req.body against a Zod schema
 *  - validateQuery(schema) — middleware that parses req.query against a Zod schema
 *  - Shared schemas for common fields (userId, reportId, limit, patientContext)
 */

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import logger from './logger';

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

/** Optional user ID — non-empty string when present */
export const optionalUserId = z
  .string()
  .trim()
  .min(1, 'userId must not be empty if provided')
  .optional();

/** Report ID — UUID v4 format */
export const reportIdParam = z.object({
  reportId: z
    .string()
    .uuid('reportId must be a valid UUID'),
});

/** Patient context — optional free-text up to 5 000 chars */
export const patientContextField = z
  .string()
  .trim()
  .max(5_000, 'Patient context must be 5 000 characters or less')
  .optional();

// ---------------------------------------------------------------------------
// Endpoint-specific schemas
// ---------------------------------------------------------------------------

/** POST /api/analyze — non-file body fields */
export const analyzeBodySchema = z.object({
  userId: optionalUserId,
  patientContext: patientContextField,
  localOnly: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : v)),
});

/** GET /api/reports — query params */
export const getReportsQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/, 'limit must be a positive integer')
    .transform(Number)
    .refine((n) => n >= 1 && n <= 500, 'limit must be between 1 and 500')
    .optional(),
  userId: optionalUserId,
});

/** GET /api/patient-context — query params */
export const patientContextQuerySchema = z.object({
  userId: optionalUserId,
});

/** POST /api/patient-context — body */
export const savePatientContextBodySchema = z.object({
  context: z
    .string()
    .trim()
    .max(5_000, 'Patient context must be 5 000 characters or less'),
  userId: optionalUserId,
});

// ---------------------------------------------------------------------------
// Middleware factories
// ---------------------------------------------------------------------------

type ZodSchema = z.ZodTypeAny;

/**
 * Returns Express middleware that validates req.body against `schema`.
 * Responds 400 with structured errors on failure.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((e: z.core.$ZodIssue) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      logger.warn('Request body validation failed', { path: req.path, errors });
      res.status(400).json({ success: false, error: 'Invalid request', details: errors });
      return;
    }
    // Merge validated (coerced/transformed) values back onto req.body
    Object.assign(req.body, result.data);
    next();
  };
}

/**
 * Returns Express middleware that validates req.query against `schema`.
 * Responds 400 with structured errors on failure.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.issues.map((e: z.core.$ZodIssue) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      logger.warn('Request query validation failed', { path: req.path, errors });
      res.status(400).json({ success: false, error: 'Invalid request', details: errors });
      return;
    }
    // Merge validated values back onto req.query (cast required due to Express types)
    Object.assign(req.query, result.data);
    next();
  };
}

/**
 * Returns Express middleware that validates req.params against `schema`.
 * Responds 400 with structured errors on failure.
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errors = result.error.issues.map((e: z.core.$ZodIssue) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      logger.warn('Request params validation failed', { path: req.path, errors });
      res.status(400).json({ success: false, error: 'Invalid request', details: errors });
      return;
    }
    next();
  };
}
