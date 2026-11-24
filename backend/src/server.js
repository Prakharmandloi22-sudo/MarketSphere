require('dotenv').config();
const http = require('http');
const app = require('./app');
const { seedDatabase } = require('./database/seed');
const { runMigrations } = require('./database/migrate');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Run schema migrations and seed demo data if in memory mode
    await runMigrations();
    await seedDatabase();

    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(`[MarketSphere] Commerce API running on http://localhost:${PORT}`);
      console.log(`[MarketSphere] Health endpoint: http://localhost:${PORT}/api/v1/health`);
    });

    // Graceful Shutdown Handler
    const shutdown = (signal) => {
      console.log(`[MarketSphere] Received ${signal}. Shutting down gracefully...`);
      server.close(() => {
        console.log('[MarketSphere] Closed remaining active connections.');
        process.exit(0);
      });
      setTimeout(() => {
        console.error('[MarketSphere] Forced shutdown after timeout.');
        process.exit(1);
      }, 5000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    return server;
  } catch (err) {
    console.error('[MarketSphere] Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
