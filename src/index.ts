import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
// Load environment variables
dotenv.config();
import swaggerUi from "swagger-ui-express";
import pool, { testConnection } from "./config/mysql.config";
import fbAccountRoutes from "./routes/fb-account.route";
import systemRoutes from "./routes/system.route";
import sourceTypeRoutes from "./routes/source-type.route";
import sourceRoutes from "./routes/source.route";
import telegramRoutes from "./routes/telegram.route";
import postRoutes from "./routes/telegram-post.route";
import { generateSwaggerSpec } from "./config/swagger";
import { boostrapTelegram } from "./routes/bot.route";
import { MonitorService } from "./services/monitor.service";
import { ensureMediaDirExists, MEDIA_DIR } from "./utils/media-path";
import { ScrapeService } from "./services/telegram-scrape.service";
import { WebsiteScrapeService } from "./services/website-scrape.service";
import { initTelegram } from "./config/telegram.config";

const app = express();
const PORT = process.env.PORT || 3500;
const HOST = process.env.DB_HOST || "localhost";
const monitorService = new MonitorService();
const scrapeService = new ScrapeService();
const websiteScrapeService = new WebsiteScrapeService();

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Save media after scarpe
ensureMediaDirExists();
app.use("/media", express.static(MEDIA_DIR));

// Set the view engine to EJS with folder for views and dist
app.set("view engine", "ejs");
app.set("views", "./dist/views");
app.set("views", path.join(__dirname, "views"));

// Generate Swagger documentation from routes
const swaggerPaths = {
  // "/api/fb-accounts": {},
  // "/api/fb-accounts/{id}": {},
  // "/api/fb-accounts/bulk/update-status": {},
  // "/api/fb-accounts/bulk/delete": {},
};

// Get swagger paths from ApiRouter
const systemSwaggerPaths = systemRoutes.getSwaggerPaths();
const fbAccountSwaggerPaths = fbAccountRoutes.getSwaggerPaths();
const sourceTypeSwaggerPaths = sourceTypeRoutes.getSwaggerPaths();
const sourceSwaggerPaths = sourceRoutes.getSwaggerPaths();
const telegramSwaggerPaths = telegramRoutes.getSwaggerPaths();
const postSwaggerPaths = postRoutes.getSwaggerPaths();

Object.assign(
  swaggerPaths,
  Object.fromEntries(
    Object.entries(fbAccountSwaggerPaths).map(([path, methods]) => [
      `/api/v1/fb-accounts${path === "/" ? "" : path}`,
      methods,
    ])
  ),
  Object.fromEntries(
    Object.entries(sourceTypeSwaggerPaths).map(([path, methods]) => [
      `/api/v1/source-types${path === "/" ? "" : path}`,
      methods,
    ])
  ),
  Object.fromEntries(
    Object.entries(sourceSwaggerPaths).map(([path, methods]) => [
      `/api/v1/sources${path === "/" ? "" : path}`,
      methods,
    ])
  ),
  Object.fromEntries(
    Object.entries(telegramSwaggerPaths).map(([path, methods]) => [
      `/api/v1/telegrams${path === "/" ? "" : path}`,
      methods,
    ])
  ),
  Object.fromEntries(
    Object.entries(postSwaggerPaths).map(([path, methods]) => [
      `/api/v1/posts${path === "/" ? "" : path}`,
      methods,
    ])
  ),
  Object.fromEntries(
    Object.entries(systemSwaggerPaths).map(([path, methods]) => [
      `/system${path === "/" ? "" : path}`,
      methods,
    ])
  )
);

const swaggerSpec = generateSwaggerSpec(swaggerPaths);

// Swagger UI
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "LTNG Internal API Docs",
  })
);

// Swagger JSON endpoint
app.get("/api-docs.json", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Health check route
app.get("/", (req: Request, res: Response) => {
  res.render("pages/home", {
    success: true,
    message: "LTNG Internal API",
    version: "1.0.0",
    documentation: `http://localhost:${PORT}/api-docs`,
  });
});

// Telegram Routes
boostrapTelegram();

// API Routes
app.use("/system", systemRoutes.getRouter());
app.use("/api/v1/fb-accounts", fbAccountRoutes.getRouter());
app.use("/api/v1/source-types", sourceTypeRoutes.getRouter());
app.use("/api/v1/sources", sourceRoutes.getRouter());
app.use("/api/v1/telegrams", telegramRoutes.getRouter());
app.use("/api/v1/posts", postRoutes.getRouter());

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: "Something went wrong!",
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// Start server with database connection test
const startServer = async () => {
  await testConnection();
  await initTelegram();
  monitorService.start();
  scrapeService.scrapeFromSource();
  // websiteScrapeService.scrapeFromSource();

  app.listen(PORT, () => {
    console.log(`🚀 Server is running on local:  http://localhost:${PORT}`);
    console.log(
      `📚 API Documentation on local: http://localhost:${PORT}/api-docs`
    );
    console.log(
      `📊 API Endpoints on local: http://localhost:${PORT}/api/fb-accounts`
    );
    console.log(`🚀 Server is running on local:  http://${HOST}:${PORT}`);
    console.log(
      `📚 API Documentation on local: http://${HOST}:${PORT}/api-docs`
    );
    console.log(
      `📊 API Endpoints on local: http://${HOST}:${PORT}/api/fb-accounts`
    );
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down gracefully...");
    monitorService.stop();
    pool.end();
    process.exit(0);
  });
};

startServer();
