const { getUserFeedPage } = require('../services/feedService');
const { sendServiceError } = require('../utils/controller');

async function getFeed(req, res) {
  try {
    const result = await getUserFeedPage({
      userId: req.userId,
      cursor: req.query?.cursor,
      limit: req.query?.limit
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to load feed');
  }
}

module.exports = {
  getFeed
};
