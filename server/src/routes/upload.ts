import { Hono } from "hono";
import { nanoid } from "nanoid";
import fs from "node:fs";
import path from "node:path";

const upload = new Hono();

// Ensure uploads directory exists
const UPLOAD_DIR = "./uploads";
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

upload.post("/", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"]; // Expecting 'file' key

    if (!file || !(file instanceof File)) {
      return c.json({ success: false, message: "No file uploaded" }, 400);
    }

    const extension = path.extname(file.name);
    const filename = `${nanoid()}${extension}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    const buffer = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));

    // Return URL relative to server
    const url = `/uploads/${filename}`;

    return c.json({
      success: true,
      message: "File uploaded successfully",
      data: { url }
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

export default upload;
