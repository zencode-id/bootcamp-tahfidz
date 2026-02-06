import { google, sheets_v4 } from "googleapis";
import { HTTPException } from "hono/http-exception";
import dotenv from "dotenv";

dotenv.config();

/**
 * CONFIGURATION
 */
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS; // Base64 encoded JSON or path

// Sheet name mapping (must match your Google Sheets tab names)
const SHEET_NAMES: Record<string, string> = {
  users: "Users",
  classes: "Classes",
  attendance: "Attendance",
  memorization_logs: "MemorizationLogs",
  assessments: "Assessments",
  exams: "Exams",
  exam_results: "ExamResults",
  reports: "Reports",
  class_members: "ClassMembers",
  otp_codes: "OTPCodes",
  sync_logs: "SyncLogs",
  data_quran: "DataQuran",
};

// Headers for each table (used as column mapping)
const HEADERS: Record<string, string[]> = {
  users: ["id", "name", "email", "password", "role", "parentId", "phone", "address", "isActive", "createdAt", "updatedAt"],
  classes: ["id", "name", "description", "teacherId", "isActive", "createdAt", "updatedAt"],
  attendance: ["id", "studentId", "classId", "date", "status", "notes", "createdAt", "updatedAt"],
  memorization_logs: ["id", "studentId", "classId", "date", "surah", "startAyat", "endAyat", "type", "grade", "notes", "teacherId", "createdAt", "updatedAt"],
  assessments: ["id", "studentId", "classId", "examId", "score", "grade", "notes", "teacherId", "createdAt", "updatedAt"],
  exams: ["id", "name", "classId", "date", "type", "maxScore", "createdAt", "updatedAt"],
  exam_results: ["id", "examId", "studentId", "score", "grade", "notes", "createdAt", "updatedAt"],
  reports: ["id", "studentId", "classId", "periodStart", "periodEnd", "totalMemorization", "attendancePercentage", "averageScore", "notes", "createdAt", "updatedAt"],
  class_members: ["id", "classId", "studentId", "joinedAt", "createdAt", "updatedAt"],
  otp_codes: ["id", "userId", "code", "expiresAt", "createdAt", "updatedAt"],
  sync_logs: ["id", "action", "source", "timestamp", "data"],
  data_quran: ["id", "number", "name", "nameArabic", "verses", "revelationType", "juz"],
};

let sheetsClient: sheets_v4.Sheets | null = null;

/**
 * Initialize Google Sheets client
 */
async function getSheets(): Promise<sheets_v4.Sheets> {
  if (sheetsClient) return sheetsClient;

  if (!SPREADSHEET_ID) {
    throw new HTTPException(500, { message: "GOOGLE_SPREADSHEET_ID not configured" });
  }

  let credentials: any;

  // Try to parse credentials from environment variable (Base64 encoded)
  if (GOOGLE_CREDENTIALS) {
    try {
      // First try as Base64
      const decoded = Buffer.from(GOOGLE_CREDENTIALS, "base64").toString("utf-8");
      credentials = JSON.parse(decoded);
    } catch {
      // Try as direct JSON string
      try {
        credentials = JSON.parse(GOOGLE_CREDENTIALS);
      } catch {
        // Try as file path
        const fs = await import("fs");
        if (fs.existsSync(GOOGLE_CREDENTIALS)) {
          credentials = JSON.parse(fs.readFileSync(GOOGLE_CREDENTIALS, "utf-8"));
        }
      }
    }
  }

  // Fallback: try credentials.json file
  if (!credentials) {
    const fs = await import("fs");
    const path = await import("path");
    const credPath = path.join(process.cwd(), "credentials.json");
    if (fs.existsSync(credPath)) {
      credentials = JSON.parse(fs.readFileSync(credPath, "utf-8"));
    }
  }

  if (!credentials) {
    throw new HTTPException(500, { message: "Google credentials not found" });
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

/**
 * Generic Client for Google Sheets API
 */
export class SheetsClient {
  private tableName: string;
  private sheetName: string;
  private headers: string[];

  constructor(tableName: string) {
    this.tableName = tableName;
    this.sheetName = SHEET_NAMES[tableName] || tableName;
    this.headers = HEADERS[tableName] || [];
  }

  /**
   * Find many records matching a query
   */
  async findMany(query: Record<string, any> = {}, limit: number = 100): Promise<any[]> {
    try {
      const sheets = await getSheets();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID!,
        range: `${this.sheetName}!A:Z`,
      });

      const rows = response.data.values;
      if (!rows || rows.length < 2) return [];

      const headerRow = rows[0];
      const dataRows = rows.slice(1);
      const results: any[] = [];

      // Build header index map
      const headerMap: Record<string, number> = {};
      headerRow.forEach((h, i) => {
        headerMap[String(h).toLowerCase()] = i;
      });

      // Query key indices for fast filtering
      const queryKeys = Object.keys(query);

      for (const row of dataRows) {
        // Skip empty rows
        if (!row[0] && !row[1]) continue;

        // Filter check
        let match = true;
        for (const key of queryKeys) {
          const colIndex = headerMap[key.toLowerCase()];
          if (colIndex !== undefined) {
            const cellVal = String(row[colIndex] || "").toLowerCase();
            const queryVal = String(query[key]).toLowerCase();
            if (cellVal !== queryVal) {
              match = false;
              break;
            }
          }
        }

        if (!match) continue;

        // Build object
        const item: Record<string, any> = {};
        this.headers.forEach((h) => {
          const colIndex = headerMap[h.toLowerCase()];
          item[h] = colIndex !== undefined ? row[colIndex] : null;
        });

        results.push(item);
        if (results.length >= limit) break;
      }

      return results;
    } catch (error: any) {
      console.error(`[SheetsClient] findMany error on ${this.tableName}:`, error.message);
      throw new HTTPException(502, { message: "Database error" });
    }
  }

  /**
   * Find a single record matching a query
   */
  async findFirst(query: Record<string, any>): Promise<any | null> {
    const results = await this.findMany(query, 1);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Create a new record
   */
  async create(data: Record<string, any>): Promise<any> {
    try {
      const sheets = await getSheets();

      // Ensure ID
      if (!data.id) {
        const { v4: uuidv4 } = await import("uuid");
        data.id = uuidv4();
      }

      // Add timestamps
      const now = new Date().toISOString();
      if (!data.createdAt) data.createdAt = now;
      if (!data.updatedAt) data.updatedAt = now;

      // Build row array based on headers
      const row = this.headers.map((h) => data[h] ?? "");

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID!,
        range: `${this.sheetName}!A:A`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [row],
        },
      });

      return data;
    } catch (error: any) {
      console.error(`[SheetsClient] create error on ${this.tableName}:`, error.message);
      throw new HTTPException(502, { message: "Failed to create record" });
    }
  }

  /**
   * Update a record by ID
   */
  async update(id: string, data: Record<string, any>): Promise<any> {
    try {
      const sheets = await getSheets();

      // Find the row number
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID!,
        range: `${this.sheetName}!A:A`,
      });

      const rows = response.data.values || [];
      let rowIndex = -1;

      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id) {
          rowIndex = i + 1; // 1-indexed
          break;
        }
      }

      if (rowIndex === -1) {
        throw new Error(`Record with id ${id} not found`);
      }

      // Get existing row data
      const existingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID!,
        range: `${this.sheetName}!A${rowIndex}:Z${rowIndex}`,
      });

      const existingRow = existingResponse.data.values?.[0] || [];

      // Merge with new data
      data.updatedAt = new Date().toISOString();
      data.id = id;

      // Get header map
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID!,
        range: `${this.sheetName}!1:1`,
      });
      const headerRow = headerResponse.data.values?.[0] || [];
      const headerMap: Record<string, number> = {};
      headerRow.forEach((h, i) => {
        headerMap[String(h).toLowerCase()] = i;
      });

      // Build updated row
      const updatedRow = [...existingRow];
      Object.entries(data).forEach(([key, value]) => {
        const colIndex = headerMap[key.toLowerCase()];
        if (colIndex !== undefined) {
          updatedRow[colIndex] = value;
        }
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID!,
        range: `${this.sheetName}!A${rowIndex}:Z${rowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [updatedRow],
        },
      });

      return { id, ...data };
    } catch (error: any) {
      console.error(`[SheetsClient] update error on ${this.tableName}:`, error.message);
      throw new HTTPException(502, { message: "Failed to update record" });
    }
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      const sheets = await getSheets();

      // Find the row number
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID!,
        range: `${this.sheetName}!A:A`,
      });

      const rows = response.data.values || [];
      let rowIndex = -1;

      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) {
        return false;
      }

      // Get spreadsheet ID for sheet
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID!,
      });

      const sheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === this.sheetName
      );

      if (!sheet?.properties?.sheetId) {
        throw new Error("Sheet not found");
      }

      // Delete the row
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID!,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheet.properties.sheetId,
                  dimension: "ROWS",
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex,
                },
              },
            },
          ],
        },
      });

      return true;
    } catch (error: any) {
      console.error(`[SheetsClient] delete error on ${this.tableName}:`, error.message);
      return false;
    }
  }
}

/**
 * Accessor for different "tables"
 */
export const db = {
  users: new SheetsClient("users"),
  classes: new SheetsClient("classes"),
  attendance: new SheetsClient("attendance"),
  memorizationLogs: new SheetsClient("memorization_logs"),
  assessments: new SheetsClient("assessments"),
  exams: new SheetsClient("exams"),
  examResults: new SheetsClient("exam_results"),
  reports: new SheetsClient("reports"),
  classMembers: new SheetsClient("class_members"),
  otpCodes: new SheetsClient("otp_codes"),
  syncLogs: new SheetsClient("sync_logs"),
  dataQuran: new SheetsClient("data_quran"),
};
