const ChatSession = require('../models/ChatSession.model');
const { runAgentStream } = require('../services/mestAgent.service');
const { sendError, ERROR_CODES } = require('../utils/response');
const { logger } = require('../utils/logger');

async function chat(req, res, next) {
  try {
    const { message, sessionId, context } = req.body;

    if (!message?.trim()) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Message is required.' });
      return;
    }

    // Load or create session
    let session;
    if (sessionId) {
      session = await ChatSession.findOne({ _id: sessionId, admin: req.admin.id });
    }
    if (!session) {
      session = new ChatSession({ admin: req.admin.id, messages: [] });
    }

    // Keep last 20 messages for context (exclude the new user message)
    const historyForAgent = session.messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Add user message to session
    session.messages.push({ role: 'user', content: message.trim() });

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send session ID immediately so client can track it
    sendEvent({ type: 'session', sessionId: session.id });

    let agentResponse = '';
    try {
      agentResponse = await runAgentStream({
        messages: historyForAgent,
        userMessage: message.trim(),
        context: context ?? {},
        onEvent: sendEvent,
      });
    } catch (err) {
      logger.error('Agent error', { err: err.message, stack: err.stack });
      sendEvent({ type: 'error', message: err.message || 'Intelligence service unavailable. Please try again.' });
      res.end();
      return;
    }

    // Persist model response
    session.messages.push({ role: 'assistant', content: agentResponse });
    await session.save();

    res.end();
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
    res.json({ success: true, data: { sessions } });
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
    res.json({ success: true, data: { session } });
  } catch (err) {
    next(err);
  }
}

module.exports = { chat, listSessions, getSession };
