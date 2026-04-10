const Notification = require('../models/Notification.model')

async function createNotification({ type, title, body, link = null, cohort = null }) {
  try {
    await Notification.create({ type, title, body, link, cohort })
  } catch (err) {
    // Non-critical — never crash the calling request
    const { logger } = require('../utils/logger')
    logger.error('Failed to create notification', { err: err.message })
  }
}

module.exports = { createNotification }
