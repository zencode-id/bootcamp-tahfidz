import { Hono } from "hono";
import { syncService } from "../services/sync.js";
import { authMiddleware, adminOnly } from "../middleware/auth.js";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const webhook = new Hono();

// ============================================
// GAS WEBHOOK VALIDATION
// ============================================
const GAS_API_KEY = process.env.GAS_API_KEY || "";

// Middleware to validate GAS API key
const validateGASKey = async (c: any, next: any) => {
  const apiKey = c.req.header("X-API-Key") || c.req.query("apiKey");

  if (!apiKey || apiKey !== GAS_API_KEY) {
    throw new HTTPException(401, { message: "Invalid API key" });
  }

  await next();
};

// Webhook payload schema
const gasWebhookSchema = z.object({
  action: z.enum(["create", "update", "delete"]),
  table: z.enum(["attendance", "memorization_logs", "assessments"]),
  data: z.record(z.unknown()),
});

const gasBulkWebhookSchema = z.object({
  items: z.array(gasWebhookSchema),
  source: z.string().optional(),
  timestamp: z.string().optional(),
});

// ============================================
// POST /webhook/gas - Receive updates from Google Sheets
// ============================================
webhook.post(
  "/gas",
  validateGASKey,
  zValidator("json", gasWebhookSchema),
  async (c) => {
    const payload = c.req.valid("json");

    const result = await syncService.handleGASWebhook(payload);

    if (!result.success) {
      throw new HTTPException(400, { message: result.message });
    }

    return c.json({
      success: true,
      message: result.message,
    });
  },
);

// ============================================
// POST /webhook/gas/bulk - Receive bulk updates from Google Sheets
// ============================================
webhook.post(
  "/gas/bulk",
  validateGASKey,
  zValidator("json", gasBulkWebhookSchema),
  async (c) => {
    const { items } = c.req.valid("json");

    const results = {
      success: 0,
      failed: 0,
      errors: [] as { item: number; error: string }[],
    };

    for (let i = 0; i < items.length; i++) {
      const result = await syncService.handleGASWebhook(items[i]);

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({ item: i, error: result.message });
      }
    }

    return c.json({
      success: true,
      message: `Processed ${items.length} items`,
      data: results,
    });
  },
);

// ============================================
// ADMIN SYNC MANAGEMENT ROUTES
// ============================================

// GET /webhook/sync/status - Get sync status (admin only)
webhook.get("/sync/status", authMiddleware, adminOnly, async (c) => {
  const status = await syncService.getSyncStatus();

  return c.json({
    success: true,
    data: status,
  });
});

// POST /webhook/sync/force - Force sync pending items (admin only)
webhook.post("/sync/force", authMiddleware, adminOnly, async (c) => {
  const result = await syncService.forceSync();

  return c.json({
    success: true,
    message: `Synced ${result.syncedCount} items`,
    data: result,
  });
});

export default webhook;
