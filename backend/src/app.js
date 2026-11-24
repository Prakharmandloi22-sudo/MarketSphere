const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { rateLimit } = require('./middleware/rateLimiter');
const db = require('./database/db');

// Route imports
const authRouter = require('./modules/auth/auth.router');
const sellerRouter = require('./modules/seller/seller.router');
const catalogRouter = require('./modules/catalog/catalog.router');
const inventoryRouter = require('./modules/inventory/inventory.router');
const cartRouter = require('./modules/cart/cart.router');
const checkoutRouter = require('./modules/checkout/checkout.router');
const orderRouter = require('./modules/order/order.router');
const promotionRouter = require('./modules/promotion/promotion.router');
const paymentRouter = require('./modules/payment/payment.router');
const shippingRouter = require('./modules/shipping/shipping.router');
const returnsRouter = require('./modules/returns/returns.router');
const reviewRouter = require('./modules/review/review.router');
const settlementRouter = require('./modules/settlement/settlement.router');

const app = express();

// Security and Logging
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));

// Payment webhook requires raw body for HMAC signature verification
app.use('/api/v1/payments/webhook', express.raw({ type: '*/*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Request ID and Correlation Middleware
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
});

// Global Rate Limiting
app.use(rateLimit({ windowMs: 60000, max: 200 }));

// Health and Readiness Check
app.get('/api/v1/health', async (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    service: 'marketsphere-backend',
    version: '1.0.0',
    database: {
      type: db.usePostgres() ? 'postgresql' : 'in-memory-transactional',
      status: 'connected'
    },
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
  });
});

// Metrics Endpoint (Prometheus / Monitoring standard)
app.get('/api/v1/metrics', (req, res) => {
  const mem = process.memoryUsage();
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP node_uptime_seconds The process uptime in seconds
# TYPE node_uptime_seconds gauge
node_uptime_seconds ${Math.floor(process.uptime())}
# HELP node_memory_rss_bytes Process RSS memory in bytes
# TYPE node_memory_rss_bytes gauge
node_memory_rss_bytes ${mem.rss}
# HELP marketsphere_orders_total Total orders count
# TYPE marketsphere_orders_total counter
marketsphere_orders_total ${db.memoryDb.find('orders').length}
# HELP marketsphere_users_total Total users count
# TYPE marketsphere_users_total counter
marketsphere_users_total ${db.memoryDb.find('users').length}
  `.trim());
});

// Mount Module APIs
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/sellers', sellerRouter);
app.use('/api/v1/catalog', catalogRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/checkout', checkoutRouter);
app.use('/api/v1/orders', orderRouter);
app.use('/api/v1/promotions', promotionRouter);
app.use('/api/v1/payments', paymentRouter);
app.use('/api/v1/shipping', shippingRouter);
app.use('/api/v1/returns', returnsRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/settlements', settlementRouter);

// 404 & Centralized Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
