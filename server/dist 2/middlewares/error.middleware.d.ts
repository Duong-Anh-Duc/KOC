import { NextFunction, Request, Response } from 'express';
export interface AppError extends Error {
    statusCode: number;
    isOperational: boolean;
}
export declare class ApiError extends Error implements AppError {
    statusCode: number;
    isOperational: boolean;
    constructor(statusCode: number, message: string, isOperational?: boolean);
}
/**
 * Global error handler middleware
 */
export declare const errorHandler: (err: Error | ApiError, req: Request, res: Response, _next: NextFunction) => void;
/**
 * 404 Not Found handler
 */
export declare const notFoundHandler: (req: Request, res: Response) => void;
//# sourceMappingURL=error.middleware.d.ts.map