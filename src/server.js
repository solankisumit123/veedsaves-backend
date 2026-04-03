const app = require('./app');

const PORT = process.env.PORT || 3001;

// Global Uncaught Exception Handler to prevent server crash
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL ERROR] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`🚀 Advanced veedsaves API running on port ${PORT}`);
  console.log(`📡 Architecture: MVC | Service: Download Backend`);
  console.log(`=================================================\n`);
});
