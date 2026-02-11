import { Hono } from "hono";
import { db } from "../lib/gasClient.js";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, requireRoles } from "../middleware/auth.js";

const schoolRoutes = new Hono();

// Schema for updating school profile
const updateSchoolSchema = z.object({
  name: z.string().min(1, "School name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  logoUrl: z.string().optional(),
});

// GET / - Get school profile
schoolRoutes.get("/", async (c) => {
  try {
    // There should be only one school profile. Try to find it.
    // Since we don't have a specific ID, we can fetch all and take the first one,
    // or just assume a fixed ID if we enforced it.
    // For now, let's fetch list and take the first one.
    const schools = await db.schoolProfiles.findMany({}, 1);

    let school = schools[0];

    // If no school profile exists yet, return null or a default empty object
    if (!school) {
      return c.json({
        success: true,
        data: null,
      });
    }

    return c.json({
      success: true,
      data: school,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: "Failed to fetch school profile",
        details: error.message,
      },
      500
    );
  }
});

// PUT / - Update or Create school profile
schoolRoutes.put(
  "/",
  authMiddleware,
  requireRoles("admin"),
  zValidator("json", updateSchoolSchema),
  async (c) => {
    try {
      const data = c.req.valid("json");

      // Check if profile exists
      const schools = await db.schoolProfiles.findMany({}, 1);
      let school = schools[0]; // Type inference should work now, or we can explicit cast if needed

      if (school) {
        // Update existing
        const updated = await db.schoolProfiles.update(school.id, data);
        return c.json({
          success: true,
          message: "School profile updated successfully",
          data: updated,
        });
      } else {
        // Create new
        const created = await db.schoolProfiles.create(data);
        return c.json({
          success: true,
          message: "School profile created successfully",
          data: created,
        });
      }
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: "Failed to update school profile",
          details: error.message,
        },
        500
      );
    }
  }
);

export default schoolRoutes;
