/**
 * Role-Based Access Control (RBAC) & Tenant Isolation Middleware
 */
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`
        }
      });
    }

    next();
  };
}

module.exports = {
  requireRoles,
  requireAdmin: requireRoles('admin'),
  requireSeller: requireRoles('seller', 'admin'),
  requireWarehouse: requireRoles('warehouse', 'admin'),
  requireSupport: requireRoles('support', 'admin'),
  requireCustomer: requireRoles('customer', 'admin')
};
