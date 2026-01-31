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
  USERS: "Users",
  CLASSES: "Classes",
  ATTENDANCE: "Attendance",
  MEMORIZATION_LOGS: "MemorizationLogs",
  ASSESSMENTS: "Assessments",
  EXAMS: "Exams",
  EXAM_RESULTS: "ExamResults",
  REPORTS: "Reports",
  SYNC_LOG: "SyncLog",
};

// Column headers for each sheet
const HEADERS = {
  USERS: [
    "id",
    "name",
    "email",
    "role",
    "parentId",
    "phone",
    "address",
    "isActive",
    "createdAt",
    "updatedAt",
  ],
  CLASSES: [
    "id",
    "name",
    "description",
    "teacherId",
    "teacherName",
    "schedule",
    "isActive",
    "createdAt",
    "updatedAt",
  ],
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
  EXAMS: [
    "id",
    "name",
    "description",
    "examType",
    "classId",
    "surahId",
    "startSurah",
    "endSurah",
    "startAyah",
    "endAyah",
    "examDate",
    "academicYear",
    "semester",
    "passingScore",
    "maxScore",
    "createdBy",
    "isActive",
    "createdAt",
    "updatedAt",
  ],
  EXAM_RESULTS: [
    "id",
    "examId",
    "studentId",
    "hafalanScore",
    "tajwidScore",
    "fashohahScore",
    "fluencyScore",
    "makhorijulHurufScore",
    "tartilScore",
    "totalScore",
    "grade",
    "isPassed",
    "rank",
    "examinerId",
    "notes",
    "feedback",
    "examTakenAt",
    "createdAt",
    "updatedAt",
  ],
  REPORTS: [
    "id",
    "studentId",
    "classId",
    "teacherId",
    "academicYear",
    "semester",
    "totalSessions",
    "presentCount",
    "absentCount",
    "sickCount",
    "leaveCount",
    "lateCount",
    "attendancePercentage",
    "totalAyahsMemorized",
    "totalNewAyahs",
    "totalMurojaahSessions",
    "currentSurah",
    "currentAyah",
    "progressPercentage",
    "avgTajwidScore",
    "avgFashohahScore",
    "avgFluencyScore",
    "avgTotalScore",
    "midSemesterScore",
    "endSemesterScore",
    "finalScore",
    "finalGrade",
    "classRank",
    "totalStudents",
    "status",
    "teacherNotes",
    "recommendations",
    "targetAyahs",
    "approvedBy",
    "approvedAt",
    "publishedAt",
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
    case "users":
      sheetName = SHEETS.USERS;
      headers = HEADERS.USERS;
      break;
    case "classes":
      sheetName = SHEETS.CLASSES;
      headers = HEADERS.CLASSES;
      break;
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
    case "exams":
      sheetName = SHEETS.EXAMS;
      headers = HEADERS.EXAMS;
      break;
    case "exam_results":
      sheetName = SHEETS.EXAM_RESULTS;
      headers = HEADERS.EXAM_RESULTS;
      break;
    case "reports":
      sheetName = SHEETS.REPORTS;
      headers = HEADERS.REPORTS;
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
 * NOTE: This is a helper function - do not run directly!
 * Use setupSheets() instead.
 */
function getOrCreateSheet(name, headers) {
  // Safety check - this function requires parameters
  if (!name || !headers) {
    throw new Error(
      "This is a helper function. Please run setupSheets() instead.",
    );
  }

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
  const syncableSheets = [
    SHEETS.USERS,
    SHEETS.CLASSES,
    SHEETS.ATTENDANCE,
    SHEETS.MEMORIZATION_LOGS,
    SHEETS.ASSESSMENTS,
    SHEETS.EXAMS,
    SHEETS.EXAM_RESULTS,
    SHEETS.REPORTS,
  ];

  if (!syncableSheets.includes(sheetName)) {
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
    let value = rowData[i];

    // Normalize boolean fields (isActive)
    if (h === "isActive") {
      if (
        value === true ||
        value === "TRUE" ||
        value === 1 ||
        value === "ON" ||
        value === "Active"
      ) {
        value = true;
      } else {
        value = false;
      }
    }

    data[h] = value;
  });

  // Determine table name
  let tableName;
  switch (sheetName) {
    case SHEETS.USERS:
      tableName = "users";
      break;
    case SHEETS.CLASSES:
      tableName = "classes";
      break;
    case SHEETS.ATTENDANCE:
      tableName = "attendance";
      break;
    case SHEETS.MEMORIZATION_LOGS:
      tableName = "memorization_logs";
      break;
    case SHEETS.ASSESSMENTS:
      tableName = "assessments";
      break;
    case SHEETS.EXAMS:
      tableName = "exams";
      break;
    case SHEETS.EXAM_RESULTS:
      tableName = "exam_results";
      break;
    case SHEETS.REPORTS:
      tableName = "reports";
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
      name: SHEETS.USERS,
      table: "users",
      headers: HEADERS.USERS,
    },
    {
      name: SHEETS.CLASSES,
      table: "classes",
      headers: HEADERS.CLASSES,
    },
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
    {
      name: SHEETS.EXAMS,
      table: "exams",
      headers: HEADERS.EXAMS,
    },
    {
      name: SHEETS.EXAM_RESULTS,
      table: "exam_results",
      headers: HEADERS.EXAM_RESULTS,
    },
    {
      name: SHEETS.REPORTS,
      table: "reports",
      headers: HEADERS.REPORTS,
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
        let value = values[i][j];

        // Normalize boolean fields (isActive)
        if (h === "isActive") {
          if (
            value === true ||
            value === "TRUE" ||
            value === 1 ||
            value === "ON" ||
            value === "Active"
          ) {
            value = true;
          } else {
            value = false;
          }
        }

        data[h] = value;
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

/**
 * SETUP SHEETS - Run this first to create all required sheets
 * Go to Apps Script Editor > Run > setupSheets
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Define all sheets with their headers
  const sheetsConfig = [
    {
      name: SHEETS.USERS,
      headers: HEADERS.USERS,
      description: "Data pengguna (Teacher, Student, Parent, Admin)",
    },
    {
      name: SHEETS.CLASSES,
      headers: HEADERS.CLASSES,
      description: "Data kelas/halaqah",
    },
    {
      name: SHEETS.ATTENDANCE,
      headers: HEADERS.ATTENDANCE,
      description: "Catatan kehadiran santri",
    },
    {
      name: SHEETS.MEMORIZATION_LOGS,
      headers: HEADERS.MEMORIZATION_LOGS,
      description: "Catatan hafalan (ziyadah/murojaah)",
    },
    {
      name: SHEETS.ASSESSMENTS,
      headers: HEADERS.ASSESSMENTS,
      description: "Penilaian hafalan harian",
    },
    {
      name: SHEETS.EXAMS,
      headers: HEADERS.EXAMS,
      description: "Data ujian tahfidz",
    },
    {
      name: SHEETS.EXAM_RESULTS,
      headers: HEADERS.EXAM_RESULTS,
      description: "Hasil ujian per santri",
    },
    {
      name: SHEETS.REPORTS,
      headers: HEADERS.REPORTS,
      description: "Raport semester santri",
    },
    {
      name: SHEETS.SYNC_LOG,
      headers: ["Timestamp", "Action", "Source", "Details"],
      description: "Log sinkronisasi",
    },
  ];

  const createdSheets = [];
  const existingSheets = [];

  for (const config of sheetsConfig) {
    let sheet = ss.getSheetByName(config.name);

    if (!sheet) {
      // Create new sheet
      sheet = ss.insertSheet(config.name);
      createdSheets.push(config.name);
    } else {
      existingSheets.push(config.name);
    }

    // Set headers
    sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);

    // Format headers
    const headerRange = sheet.getRange(1, 1, 1, config.headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4285f4");
    headerRange.setFontColor("#ffffff");
    headerRange.setHorizontalAlignment("center");

    // Freeze header row
    sheet.setFrozenRows(1);

    // Auto-resize columns
    for (let i = 1; i <= config.headers.length; i++) {
      sheet.autoResizeColumn(i);
    }

    // Set minimum column width
    for (let i = 1; i <= config.headers.length; i++) {
      if (sheet.getColumnWidth(i) < 100) {
        sheet.setColumnWidth(i, 100);
      }
    }
  }

  // Create README sheet with instructions
  let readmeSheet = ss.getSheetByName("README");
  if (!readmeSheet) {
    readmeSheet = ss.insertSheet("README");

    const instructions = [
      ["🕋 TAHFIDZ BOOTCAMP - GOOGLE SHEETS SYNC"],
      [""],
      ["📋 SHEETS YANG TERSEDIA:"],
      ["1. Users - Data pengguna (Teacher, Student, Parent, Admin)"],
      ["2. Classes - Data kelas/halaqah"],
      ["3. Attendance - Catatan kehadiran santri"],
      ["4. MemorizationLogs - Catatan hafalan (ziyadah/murojaah)"],
      ["5. Assessments - Penilaian hafalan"],
      ["6. Exams - Data ujian"],
      ["7. ExamResults - Hasil ujian"],
      ["8. Reports - Raport semester"],
      ["9. SyncLog - Log aktivitas sinkronisasi"],
      [""],
      ["⚙️ KONFIGURASI:"],
      ["1. Buka Extensions > Apps Script"],
      ["2. Edit CONFIG.API_KEY dengan key yang sama di .env"],
      ["3. Edit CONFIG.API_ENDPOINT dengan URL backend Anda"],
      ["4. Deploy > New Deployment > Web App"],
      [""],
      ["🔄 SINKRONISASI:"],
      ["- Data otomatis sync saat ada edit di sheet"],
      ["- Jalankan manualSyncToAPI() untuk sync manual"],
      [""],
      ["📝 CATATAN:"],
      ["- Jangan hapus atau rename sheet yang sudah ada"],
      ["- Jangan edit kolom ID secara manual"],
      ["- Baris pertama (header) tidak boleh diubah"],
    ];

    readmeSheet.getRange(1, 1, instructions.length, 1).setValues(instructions);
    readmeSheet.getRange(1, 1).setFontSize(14).setFontWeight("bold");
    readmeSheet.setColumnWidth(1, 500);

    createdSheets.push("README");
  }

  // Move README to first position
  ss.setActiveSheet(readmeSheet);
  ss.moveActiveSheet(1);

  // Log result
  const result = {
    created: createdSheets,
    existing: existingSheets,
    total: sheetsConfig.length + 1,
  };

  Logger.log("Setup completed: " + JSON.stringify(result));

  // Show alert
  SpreadsheetApp.getUi().alert(
    "Setup Selesai! ✅\n\n" +
      "Sheet dibuat: " +
      createdSheets.join(", ") +
      "\n" +
      "Sheet sudah ada: " +
      existingSheets.join(", ") +
      "\n\n" +
      "Selanjutnya:\n" +
      "1. Buka Extensions > Apps Script\n" +
      "2. Edit CONFIG (API_KEY dan API_ENDPOINT)\n" +
      "3. Deploy sebagai Web App",
  );

  return result;
}

/**
 * Create custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🕋 Tahfidz Sync")
    .addItem("📋 Setup Sheets", "setupSheets")
    .addItem("🔄 Manual Sync to API", "manualSyncToAPI")
    .addItem("📊 View Sync Log", "viewSyncLog")
    .addSeparator()
    .addItem("ℹ️ About", "showAbout")
    .addToUi();
}

/**
 * View sync log
 */
function viewSyncLog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(SHEETS.SYNC_LOG);

  if (logSheet) {
    ss.setActiveSheet(logSheet);
  } else {
    SpreadsheetApp.getUi().alert(
      "SyncLog sheet tidak ditemukan. Jalankan Setup Sheets terlebih dahulu.",
    );
  }
}

/**
 * Show about dialog
 */
function showAbout() {
  const html = HtmlService.createHtmlOutput(
    `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>🕋 Tahfidz Bootcamp Sync</h2>
      <p><strong>Version:</strong> 1.0.0</p>
      <p><strong>Description:</strong> Google Sheets integration for Tahfidz Bootcamp API</p>
      <hr>
      <h3>Features:</h3>
      <ul>
        <li>✅ Bidirectional sync with backend</li>
        <li>✅ Auto-sync on edit</li>
        <li>✅ Manual sync support</li>
        <li>✅ Sync logging</li>
      </ul>
      <hr>
      <p><em>© 2026 Zencode ID</em></p>
    </div>
  `,
  )
    .setWidth(400)
    .setHeight(350);

  SpreadsheetApp.getUi().showModalDialog(html, "About Tahfidz Sync");
}
