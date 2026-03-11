"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
/**
 * Middleware factory to validate request body/query/params with Zod schemas
 */
const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        try {
            const data = schema.parse(req[source]);
            req[source] = data;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const formattedErrors = error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                }));
                const t = req.t;
                res.status(400).json({
                    success: false,
                    message: t ? t('validation.failed') : 'Validation failed',
                    errors: formattedErrors,
                });
                return;
            }
            next(error);
        }
    };
};
exports.validate = validate;
//# sourceMappingURL=validate.middleware.js.map