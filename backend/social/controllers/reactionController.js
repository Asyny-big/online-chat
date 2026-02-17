const reactionService = require('../services/reactionService');
const { sendServiceError } = require('../utils/controller');

async function toggleReaction(req, res) {
  try {
    const result = await reactionService.toggleReaction({
      app: req.app,
      userId: req.userId,
      targetType: req.body?.targetType,
      targetId: req.body?.targetId,
      reaction: req.body?.reaction || 'like'
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to toggle reaction');
  }
}

module.exports = {
  toggleReaction
};
