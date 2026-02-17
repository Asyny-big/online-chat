function sendServiceError(res, error, fallbackMessage = 'Internal server error') {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const body = { error: error?.message || fallbackMessage };
  if (error?.code) body.code = error.code;
  return res.status(status).json(body);
}

module.exports = {
  sendServiceError
};
