const crypto = require('crypto');
const ChatSession = require('../models/ChatSession.model');
const { runAgentStream } = require('../services/mestAgent.service');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');
const { logger } = require('../utils/logger');

// In-memory job store — keyed by jobId, TTL 15 min
const jobs = new Map();

setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 5 * 60 * 1000);

async function chat(req, res, next) {
  try {
    const { message, sessionId, context } = req.body;

    if (!message?.trim()) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Message is required.' });
      return;
    }

    let session;
    if (sessionId) {
      session = await ChatSession.findOne({ _id: sessionId, admin: req.admin.id });
    }
    if (!session) {
      session = new ChatSession({ admin: req.admin.id, messages: [] });
    }

    const historyForAgent = session.messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    session.messages.push({ role: 'user', content: message.trim() });
    await session.save();

    const jobId = crypto.randomUUID();
    jobs.set(jobId, {
      adminId: req.admin.id.toString(),
      events: [],
      done: false,
      createdAt: Date.now(),
    });

    // Respond immediately — no long-lived connection
    sendSuccess(res, 200, { data: { jobId, sessionId: session.id } });

    // Run agent in the background
    const job = jobs.get(jobId);
    runAgentStream({
      messages: historyForAgent,
      userMessage: message.trim(),
      context: context ?? {},
      onEvent: (event) => job.events.push(event),
    })
      .then(async (agentResponse) => {
        session.messages.push({ role: 'model', content: agentResponse });
        await session.save();
      })
      .catch((err) => {
        logger.error('Agent error', { err: err.message, stack: err.stack });
        job.events.push({ type: 'error', message: err.message || 'Intelligence service unavailable.' });
      })
      .finally(() => {
        job.done = true;
      });
  } catch (err) {
    next(err);
  }
}

async function pollJob(req, res, next) {
  try {
    const { jobId } = req.params;
    const cursor = parseInt(req.query.cursor ?? '0', 10);

    const job = jobs.get(jobId);
    if (!job) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Job not found or expired.' });
      return;
    }

    if (job.adminId !== req.admin.id.toString()) {
      sendError(res, 403, { code: ERROR_CODES.FORBIDDEN, message: 'Forbidden.' });
      return;
    }

    const newEvents = job.events.slice(cursor);

    sendSuccess(res, 200, {
      data: { events: newEvents, cursor: job.events.length, done: job.done },
    });
  } catch (err) {
    next(err);
  }
}

async function listSessions(req, res, next) {
  try {
    const sessions = await ChatSession.find({ admin: req.admin.id })
      .select('title createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(20);
    sendSuccess(res, 200, { data: { sessions } });
  } catch (err) {
    next(err);
  }
}

async function getSession(req, res, next) {
  try {
    const session = await ChatSession.findOne({ _id: req.params.id, admin: req.admin.id });
    if (!session) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Session not found.' });
      return;
    }
    sendSuccess(res, 200, { data: { session } });
  } catch (err) {
    next(err);
  }
}

module.exports = { chat, pollJob, listSessions, getSession };
