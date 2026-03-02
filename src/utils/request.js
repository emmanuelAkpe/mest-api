function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
}

function getUserAgent(req) {
  return req.headers['user-agent'] ?? 'unknown';
}

module.exports = { getIp, getUserAgent };
