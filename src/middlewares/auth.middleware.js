const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    // Future JWT logic goes here
    // For now, bypass
    req.user = { id: 'guest' };
    next();
};

module.exports = authMiddleware;
