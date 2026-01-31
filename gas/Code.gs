/**
 * Google Apps Script for Tahfidz Bootcamp - Google Sheets Sync
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet with the following sheets:
 *    - Attendance
 *    - MemorizationLogs
 *    - Assessments
 *    - SyncLog
 *
 * 2. Go to Extensions > Apps Script
 * 3. Paste this entire code
 * 4. Deploy > New Deployment > Web App
 *    - Execute as: Me
 *    - Who has access: Anyone (or restrict as needed)
 *
 * 5. Copy the Web App URL and set it as GAS_WEBHOOK_URL in your .env
 * 6. Set the API_KEY below and use it in your .env as GAS_API_KEY
 */

// Configuration
const CONFIG = {
  API_KEY: "your-api-key-here", // Must match GAS_API_KEY in .env
  API_ENDPOINT: "http://your-server-url:3000/webhook/gas", // Your backend URL
  SPREADSHEET_ID: SpreadsheetApp.getActiveSpreadsheet().getId(),
};

// Sheet names
const SHEETS = {
  ATTENDANCE: "Attendance",
  MEMORIZATION_LOGS: "MemorizationLogs",
  ASSESSMENTS: "Assessments",
  SYNC_LOG: "SyncLog",
};

// Column headers for each sheet
const HEADERS = {
  ATTENDANCE: [
    "id",
    "studentId",
    "classId",
    "sessionType",
    "status",
    "proofUrl",
    "notes",
    "date",
    "recordedBy",
    "syncedAt",
    "createdAt",
    "updatedAt",
  ],
  MEMORIZATION_LOGS: [
    "id",
    "studentId",
    "type",
    "surahId",
    "startAyah",
    "endAyah",
    "teacherId",
    "classId",
    "sessionDate",
    "notes",
    "syncedAt",
    "createdAt",
    "updatedAt",
  ],
  ASSESSMENTS: [
    "id",
    "logId",
    "tajwidScore",
    "fashohahScore",
    "fluencyScore",
    "totalScore",
    "grade",
    "notes",
    "assessedBy",
    "createdAt",
    "updatedAt",
  ],
};

/**
 * Handle POST requests from the backend API
 */
function doPost(e) {
  try {
    // Validate API key
    const apiKey = e.parameter.apiKey || getHeader(e, "X-API-Key");
    if (apiKey !== CONFIG.API_KEY) {
      return createResponse(401, {
        success: false,
        message: "Invalid API key",
      });
    }

    const payload = JSON.parse(e.postData.contents);
    const { items, source, timestamp } = payload;

    if (!items || !Array.isArray(items)) {
      return createResponse(400, {
        success: false,
        message: "Invalid payload",
      });
    }

    let processed = 0;
    let errors = [];

    for (const item of items) {
      try {
        processItem(item);
        processed++;
      } catch (error) {
        errors.push({ id: item.data?.id, error: error.message });
      }
    }

    logSync("RECEIVE", source || "api", { processed, errors: errors.length });

    return createResponse(200, {
      success: true,
      message: `Processed ${processed} items`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logSync("ERROR", "api", { error: error.message });
    return createResponse(500, { success: false, message: error.message });
  }
}

/**
 * Handle GET requests (health check)
 */
function doGet(e) {
  return createResponse(200, {
    success: true,
    message: "Tahfidz GAS Sync Service",
    version: "1.0.0",
  });
}

/**
 * Process a single sync item
 */
function processItem(item) {
  const { action, table, data } = item;

  let sheetName;
  let headers;

  switch (table) {
    case "attendance":
      sheetName = SHEETS.ATTENDANCE;
      headers = HEADERS.ATTENDANCE;
      break;
    case "memorization_logs":
      sheetName = SHEETS.MEMORIZATION_LOGS;
      headers = HEADERS.MEMORIZATION_LOGS;
      break;
    case "assessments":
      sheetName = SHEETS.ASSESSMENTS;
      headers = HEADERS.ASSESSMENTS;
      break;
    default:
      throw new Error(`Unknown table: ${table}`);
  }

  const sheet = getOrCreateSheet(sheetName, headers);

  switch (action) {
    case "create":
      insertRow(sheet, headers, data);
      break;
    case "update":
      updateRow(sheet, headers, data);
      break;
    case "delete":
      deleteRow(sheet, data.id);
      break;
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Get or create a sheet with headers
 */
function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Insert a new row
 */
function insertRow(sheet, headers, data) {
  const row = headers.map((h) => data[h] || "");
  sheet.appendRow(row);
}

/**
 * Update an existing row by ID
 */
function updateRow(sheet, headers, data) {
  const id = data.id;
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  // Find the ID column (should be first)
  const idColIndex = headers.indexOf("id");

  for (let i = 1; i < values.length; i++) {
    if (values[i][idColIndex] === id) {
      const newRow = headers.map((h) =>
        data[h] !== undefined ? data[h] : values[i][headers.indexOf(h)],
      );
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([newRow]);
      return;
    }
  }

  // If not found, insert as new
  insertRow(sheet, headers, data);
}

/**
 * Delete a row by ID
 */
function deleteRow(sheet, id) {
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

/**
 * Trigger: Send changes from Google Sheets to API
 * Set up a trigger in Apps Script to run this on edit
 */
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();

  // Only sync specific sheets
  if (
    ![SHEETS.ATTENDANCE, SHEETS.MEMORIZATION_LOGS, SHEETS.ASSESSMENTS].includes(
      sheetName,
    )
  ) {
    return;
  }

  const range = e.range;
  const row = range.getRow();

  // Don't sync header row
  if (row === 1) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet
    .getRange(row, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  const data = {};
  headers.forEach((h, i) => {
    data[h] = rowData[i];
  });

  // Determine table name
  let tableName;
  switch (sheetName) {
    case SHEETS.ATTENDANCE:
      tableName = "attendance";
      break;
    case SHEETS.MEMORIZATION_LOGS:
      tableName = "memorization_logs";
      break;
    case SHEETS.ASSESSMENTS:
      tableName = "assessments";
      break;
  }

  // Send to API
  sendToAPI({
    action: "update",
    table: tableName,
    data: data,
  });
}

/**
 * Send data to the backend API
 */
function sendToAPI(payload) {
  try {
    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "X-API-Key": CONFIG.API_KEY,
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(CONFIG.API_ENDPOINT, options);
    const result = JSON.parse(response.getContentText());

    logSync("SEND", "gsheet", {
      table: payload.table,
      action: payload.action,
      success: result.success,
    });

    return result;
  } catch (error) {
    logSync("ERROR", "gsheet", { error: error.message });
    return { success: false, message: error.message };
  }
}

/**
 * Log sync activity
 */
function logSync(action, source, details) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName(SHEETS.SYNC_LOG);

  if (!logSheet) {
    logSheet = ss.insertSheet(SHEETS.SYNC_LOG);
    logSheet
      .getRange(1, 1, 1, 4)
      .setValues([["Timestamp", "Action", "Source", "Details"]]);
    logSheet.getRange(1, 1, 1, 4).setFontWeight("bold");
  }

  logSheet.appendRow([
    new Date().toISOString(),
    action,
    source,
    JSON.stringify(details),
  ]);
}

/**
 * Helper: Get header from request
 */
function getHeader(e, name) {
  if (e.parameter && e.parameter[name]) {
    return e.parameter[name];
  }
  return null;
}

/**
 * Helper: Create JSON response
 */
function createResponse(status, data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/**
 * Manual sync function - can be run from Apps Script editor
 * Syncs all data from sheets to API
 */
function manualSyncToAPI() {
  const sheets = [
    {
      name: SHEETS.ATTENDANCE,
      table: "attendance",
      headers: HEADERS.ATTENDANCE,
    },
    {
      name: SHEETS.MEMORIZATION_LOGS,
      table: "memorization_logs",
      headers: HEADERS.MEMORIZATION_LOGS,
    },
    {
      name: SHEETS.ASSESSMENTS,
      table: "assessments",
      headers: HEADERS.ASSESSMENTS,
    },
  ];

  for (const { name, table, headers } of sheets) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!sheet) continue;

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    // Skip header row
    for (let i = 1; i < values.length; i++) {
      const data = {};
      headers.forEach((h, j) => {
        data[h] = values[i][j];
      });

      if (data.id) {
        sendToAPI({
          action: "update",
          table: table,
          data: data,
        });
      }
    }
  }

  logSync("MANUAL_SYNC", "gsheet", { sheets: sheets.map((s) => s.name) });
}
