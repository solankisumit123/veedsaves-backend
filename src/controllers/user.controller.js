class UserController {
  async getProfile(req, res) {
    // Boilerplate for future JWT/User DB fetching
    res.json({
        status: 1,
        user: { id: req.user?.id || 'guest', plan: 'free' }
    });
  }
}

module.exports = new UserController();
