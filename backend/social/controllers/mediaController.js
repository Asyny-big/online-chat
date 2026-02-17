const { createMediaMeta, listMyMedia } = require('../services/mediaService');
const { sendServiceError } = require('../utils/controller');

async function createMedia(req, res) {
  try {
    const result = await createMediaMeta({
      ownerId: req.userId,
      type: req.body?.type,
      path: req.body?.path,
      thumb: req.body?.thumb,
      width: req.body?.width,
      height: req.body?.height,
      size: req.body?.size
    });
    return res.status(201).json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to create media');
  }
}

async function getMyMedia(req, res) {
  try {
    const result = await listMyMedia({
      ownerId: req.userId,
      cursor: req.query?.cursor,
      limit: req.query?.limit
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to load media');
  }
}

module.exports = {
  createMedia,
  getMyMedia
};
