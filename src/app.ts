import "./config/env"; // Must be first — validates env vars
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { logger, morganStream } from "./utils/logger";
import { globalLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
import { sendError, ERROR_CODES } from "./utils/response";
import authRoutes from "./routes/auth.routes";

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
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API routes
app.use("/api/v1/auth", authRoutes);

// 404
app.use((_req: Request, res: Response) => {
  sendError(res, 404, {
    code: ERROR_CODES.NOT_FOUND,
    message: "Route not found.",
  });
});

// Global error handler
app.use(
  errorHandler as (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void,
);

// Start
const PORT = env.PORT;

connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, { env: env.NODE_ENV });
  });
});

export default app;
