const profileService = require('../services/profileService');
const { sendServiceError } = require('../utils/controller');

async function getProfile(req, res) {
  try {
    const result = await profileService.getProfileBundle({
      viewerUserId: req.userId,
      profileUserId: req.params.userId,
      cursor: req.query?.cursor,
      limit: req.query?.limit
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to load profile');
  }
}

module.exports = {
  getProfile
};
