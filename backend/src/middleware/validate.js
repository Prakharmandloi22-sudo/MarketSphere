/**
 * Zod Schema Request Validation Middleware
 */
function validateRequest(schema) {
  return (req, res, next) => {
    try {
      if (schema.body && req.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query && req.query) {
        req.query = schema.query.parse(req.query);
      }
      if (schema.params && req.params) {
        req.params = schema.params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err.errors) {
        const formatted = err.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }));
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload',
            details: formatted
          }
        });
      }
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: err.message }
      });
    }
  };
}

module.exports = { validateRequest };
