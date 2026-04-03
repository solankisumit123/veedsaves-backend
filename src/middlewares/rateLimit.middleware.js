const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window`
	standardHeaders: true,
	legacyHeaders: false,
    message: { status: 0, msg: 'Too many requests, please try again later.' }
});

module.exports = apiLimiter;
