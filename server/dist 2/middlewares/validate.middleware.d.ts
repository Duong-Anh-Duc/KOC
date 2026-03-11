import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
/**
 * Middleware factory to validate request body/query/params with Zod schemas
 */
export declare const validate: (schema: ZodSchema, source?: "body" | "query" | "params") => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validate.middleware.d.ts.map