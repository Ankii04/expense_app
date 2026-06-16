const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRouter = require('./routes/auth');
const groupsRouter = require('./routes/groups');
const expensesRouter = require('./routes/expenses');
const balancesRouter = require('./routes/balances');
const settlementsRouter = require('./routes/settlements');
const importRouter = require('./routes/import');
const budgetsRouter = require('./routes/budgets');
const lendsRouter = require('./routes/lends');
const recurringRouter = require('./routes/recurring');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173', // standard Vite default local dev
  'http://127.0.0.1:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow all Vercel preview/production deployments (*.vercel.app)
    if (origin.endsWith('.vercel.app')) return callback(null, true);

    // Allow explicitly configured origins
    if (allowedOrigins.indexOf(origin) !== -1 || !process.env.NODE_ENV) {
      return callback(null, true);
    }
    return callback(new Error('CORS blocked this request from unauthorized origin.'), false);
  },
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/groups', groupsRouter);
app.use('/api', expensesRouter); // Mounts /expenses, /groups/:id/expenses
app.use('/api', balancesRouter); // Mounts /groups/:id/balances
app.use('/api', settlementsRouter); // Mounts /groups/:id/settlements
app.use('/api', importRouter); // Mounts /groups/:id/import
app.use('/api/budgets', budgetsRouter);
app.use('/api/lends', lendsRouter);
app.use('/api/recurring', recurringRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('💥 Unhandled Exception:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred.',
  });
});

// Listen on configured port
app.listen(PORT, () => {
  console.log(`🚀 Spendify backend server running on port ${PORT}`);
});
