const Notification = require('../models/Notification.model')
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response')

async function list(req, res) {
  try {
    const { cohort, unread } = req.query
    const filter = {}
    if (cohort) filter.cohort = cohort
    if (unread === 'true') filter.isRead = false

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    const unreadCount = await Notification.countDocuments({ ...filter, isRead: false })

    sendSuccess(res, 200, {
      data: { notifications, unreadCount },
      message: 'Notifications fetched.',
    })
  } catch (err) {
    sendError(res, 500, { code: ERROR_CODES.INTERNAL_ERROR, message: err.message })
  }
}

async function markRead(req, res) {
  try {
    const notification = await Notification.findById(req.params.id)
    if (!notification) {
      return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Notification not found.' })
    }
    notification.isRead = true
    notification.readAt = new Date()
    await notification.save()
    sendSuccess(res, 200, { data: notification, message: 'Marked as read.' })
  } catch (err) {
    sendError(res, 500, { code: ERROR_CODES.INTERNAL_ERROR, message: err.message })
  }
}

async function markAllRead(req, res) {
  try {
    const { cohort } = req.body
    const filter = { isRead: false }
    if (cohort) filter.cohort = cohort
    await Notification.updateMany(filter, { isRead: true, readAt: new Date() })
    sendSuccess(res, 200, { data: {}, message: 'All notifications marked as read.' })
  } catch (err) {
    sendError(res, 500, { code: ERROR_CODES.INTERNAL_ERROR, message: err.message })
  }
}

module.exports = { list, markRead, markAllRead }
