import { NextFunction, Request, Response } from 'express';
import winston from 'winston';
declare const logger: winston.Logger;
/**
 * HTTP Request logger middleware
 */
export declare const requestLogger: (req: Request, res: Response, next: NextFunction) => void;
export default logger;
//# sourceMappingURL=logger.middleware.d.ts.map