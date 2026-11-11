const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const { registerEventHandlers } = require('./events');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Attach the event handlers once, before any route can emit an event
registerEventHandlers();

const app = express();

// Behind Render's proxy: trust the first hop so rate limiting sees real client IPs
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '100kb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({ name: 'CampusFix API', docs: 'See docs/API.md', health: '/api/health' });
});

app.use('/api', require('./routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
