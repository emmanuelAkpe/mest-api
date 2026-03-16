require("./config/env"); // Must be first — validates env vars
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { connectDB } = require("./config/db");
const { env } = require("./config/env");
const { logger, morganStream } = require("./utils/logger");
const { globalLimiter } = require("./middleware/rateLimiter");
const { errorHandler } = require("./middleware/errorHandler");
const { sendError, ERROR_CODES } = require("./utils/response");
const authRoutes = require("./routes/auth.routes");
const cohortRoutes = require("./routes/cohort.routes");
const { cohortRouter: traineesCohortRouter, individualRouter: traineesRouter } = require("./routes/trainee.routes");
const { cohortRouter: eventsCohortRouter, individualRouter: eventsRouter } = require("./routes/event.routes");
const { eventRouter: teamsEventRouter, individualRouter: teamsRouter } = require("./routes/team.routes");
const { eventRouter: kpisEventRouter, individualRouter: kpisRouter } = require("./routes/kpi.routes");
const { eventRouter: evalLinksEventRouter, individualRouter: evalLinksRouter } = require("./routes/evaluationLink.routes");
const evaluateRouter = require("./routes/evaluate.routes");
const chatRouter = require("./routes/chat.routes");

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

// Rate limiting (global)
app.use(globalLimiter);

// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HTTP logging via Winston
app.use(morgan("combined", { stream: morganStream }));

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/cohorts", cohortRoutes);
app.use("/api/v1/cohorts/:cohortId/trainees", traineesCohortRouter);
app.use("/api/v1/trainees", traineesRouter);
app.use("/api/v1/cohorts/:cohortId/events", eventsCohortRouter);
app.use("/api/v1/events", eventsRouter);
app.use("/api/v1/events/:eventId/teams", teamsEventRouter);
app.use("/api/v1/teams", teamsRouter);
app.use("/api/v1/events/:eventId/kpis", kpisEventRouter);
app.use("/api/v1/kpis", kpisRouter);
app.use("/api/v1/events/:eventId/evaluation-links", evalLinksEventRouter);
app.use("/api/v1/evaluation-links", evalLinksRouter);
app.use("/api/v1/evaluate", evaluateRouter);
app.use("/api/v1/chat", chatRouter);

// 404
app.use((_req, res) => {
  sendError(res, 404, {
    code: ERROR_CODES.NOT_FOUND,
    message: "Route not found.",
  });
});

// Global error handler
app.use(errorHandler);

// Start
const PORT = env.PORT;

connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, { env: env.NODE_ENV });
  });
});

module.exports = app;
