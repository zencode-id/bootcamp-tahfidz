import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import "dotenv/config";

// Import routes
import authRoutes from "./routes/auth.js";
import syncRoutes from "./routes/sync.js";
import tahfidzRoutes from "./routes/tahfidz.js";
import statsRoutes from "./routes/stats.js";
import classRoutes from "./routes/classes.js";
import examRoutes from "./routes/exams.js";
import reportRoutes from "./routes/reports.js";
import { db } from "./lib/gasClient.js";

// Import DB to initialize on startup
// import "./db/index.js"; // Removed for GAS migration

// Create Hono app
const app = new Hono();

// ============================================
// MIDDLEWARE
// ============================================

// CORS
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow requests with no origin (mobile apps, curl, etc)
      if (!origin) return origin;

      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://bootcamp-tahfidz-client.vercel.app",
        "https://bootcamp-tahfidz.vercel.app",
      ];

      // Allow Vercel preview deployments
      if (origin.endsWith(".vercel.app") || allowedOrigins.includes(origin)) {
        return origin;
      }

      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    credentials: true,
  }),
);

// Logger
app.use("*", logger());

// Pretty JSON in development
if (process.env.NODE_ENV !== "production") {
  app.use("*", prettyJSON());
}

// ============================================
// ERROR HANDLING
// ============================================
app.onError((err, c) => {
  console.error("Error:", err);

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return c.json(
      {
        success: false,
        error: "Validation Error",
        details: err.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      },
      400,
    );
  }

  // Handle HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json(
      {
        success: false,
        error: err.message,
      },
      err.status,
    );
  }

  // Handle unknown errors
  return c.json(
    {
      success: false,
      error:
        process.env.NODE_ENV === "production"
          ? "Internal Server Error"
          : err.message,
    },
    500,
  );
});

// ============================================
// HEALTH CHECK
// ============================================
app.get("/", (c) => {
  return c.json({
    success: true,
    message: "Tahfidz Bootcamp API",
    version: "1.0.0",
    endpoints: {
      auth: "/auth",
      sync: "/sync",
      tahfidz: "/sync/tahfidz",
      stats: "/stats",
      classes: "/classes",
      exams: "/exams",
      reports: "/reports",
      // webhook: "/webhook",
    },
  });
});



app.get("/health", async (c) => {
  let dbStatus = "unknown";
  let latency = 0;
  try {
     const start = Date.now();
     // Test DB connection with minimal query
     await db.users.findMany({}, 1);
     latency = Date.now() - start;
     dbStatus = "connected";
  } catch (e: any) {
     console.error("Health DB check failed:", e);
     dbStatus = `disconnected: ${e.message}`;
  }

  return c.json({
    success: true,
    status: dbStatus === "connected" ? "healthy" : "degraded",
    db: dbStatus,
    latency: `${latency}ms`,
    timestamp: new Date().toISOString(),
    env: {
       // Safe to show if var exists (true/false)
       gas_url_configured: !!process.env.GAS_WEBHOOK_URL
    }
  });
});

// ============================================
// MOUNT ROUTES
// ============================================
app.route("/auth", authRoutes);
app.route("/sync", syncRoutes);
app.route("/sync/tahfidz", tahfidzRoutes);
app.route("/stats", statsRoutes);
app.route("/classes", classRoutes);
app.route("/exams", examRoutes);
app.route("/reports", reportRoutes);
app.route("/reports", reportRoutes);
// app.route("/webhook", webhookRoutes);

// ============================================
// 404 HANDLER
// ============================================
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: "Not Found",
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404,
  );
});

// ============================================
// START SERVER
// ============================================
const port = parseInt(process.env.PORT || "3000", 10);

console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🕋 TAHFIDZ BOOTCAMP API                             ║
║                                                       ║
║   Server running on http://localhost:${port}             ║
║   Environment: ${process.env.NODE_ENV || "development"}                        ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`);

// Only start local server if not running on Vercel
if (!process.env.VERCEL) {
  serve({
    fetch: app.fetch,
    port,
  });
}

export default app;
