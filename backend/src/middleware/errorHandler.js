/**
 * Centralized Safe Error Handling Middleware
 * Ensures sensitive stack traces and credentials are never leaked to clients.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const isProduction = process.env.NODE_ENV === 'production';

  // Log error with correlation request ID
  const requestId = req.headers['x-request-id'] || 'req-' + Math.random().toString(36).substring(7);
  console.error(`[Error] [${requestId}] ${req.method} ${req.originalUrl}:`, err.message);

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.isOperational || !isProduction ? err.message : 'An unexpected error occurred. Please contact support.',
      requestId,
      ...(isProduction ? {} : { stack: err.stack })
    }
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`
    }
  });
}

module.exports = { errorHandler, notFoundHandler };
