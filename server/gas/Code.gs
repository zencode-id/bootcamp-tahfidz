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
  API_KEY: "tahfidz-gas-secret-2024-xyz123", // Must match GAS_API_KEY in .env
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
  DATA_QURAN: "Data_Quran",
  SYNC_LOG: "SyncLog",
  SYNC_LOG: "SyncLog",
  OTP_CODES: "OtpCodes",
  CLASS_MEMBERS: "ClassMembers",
};

// Column headers for each sheet
const HEADERS = {
  USERS: [
    "id",
    "name",
    "email",
    "password",
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
  DATA_QURAN: [
    "id",
    "name",
    "arabicName",
    "totalAyahs",
    "revelationType",
    "juz",
  ],
  CLASS_MEMBERS: [
    "id",
    "classId",
    "studentId",
    "joinedAt",
    "createdAt",
    "updatedAt",
  ],
  OTP_CODES: ["id", "userId", "code", "expiresAt", "createdAt", "updatedAt"],
};

/**
 * Handle POST requests from the backend API
 */
function doPost(e) {
  try {
    // Validate API key
    // const apiKey = e.parameter.apiKey || getHeader(e, "X-API-Key");
    // if (apiKey !== CONFIG.API_KEY) {
    //   return createResponse(401, {
    //     success: false,
    //     message: "Invalid API key",
    //   });
    // }

    const payload = JSON.parse(e.postData.contents);

    // Handle READ action
    if (payload.action === "read") {
      return handleRead(payload);
    }

    // Handle BATCH WRITE actions
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
      data: [], // Ensure consistent response structure
    });
  } catch (error) {
    logSync("ERROR", "api", { error: error.message });
    return createResponse(500, { success: false, message: error.message });
  }
}

/**
 * Handle Read Requests
 */
function handleRead(payload) {
  // Validate payload exists
  if (!payload) {
    return createResponse(400, {
      success: false,
      message: "Invalid payload: payload is required",
    });
  }

  const { table, query, limit } = payload;

  try {
    let sheetName;

    // Determine sheet name based on table
    switch (table) {
      case "users":
        sheetName = SHEETS.USERS;
        break;
      case "classes":
        sheetName = SHEETS.CLASSES;
        break;
      case "attendance":
        sheetName = SHEETS.ATTENDANCE;
        break;
      case "memorization_logs":
        sheetName = SHEETS.MEMORIZATION_LOGS;
        break;
      case "assessments":
        sheetName = SHEETS.ASSESSMENTS;
        break;
      case "exams":
        sheetName = SHEETS.EXAMS;
        break;
      case "exam_results":
        sheetName = SHEETS.EXAM_RESULTS;
        break;
      case "reports":
        sheetName = SHEETS.REPORTS;
        break;
      case "otp_codes":
        sheetName = SHEETS.OTP_CODES;
        break;
      case "class_members":
        sheetName = SHEETS.CLASS_MEMBERS;
        break;
      case "data_quran":
        sheetName = SHEETS.DATA_QURAN;
        break;
      default:
        throw new Error(`Unknown table: ${table}`);
    }

    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      return createResponse(404, {
        success: false,
        message: "Sheet not found",
      });
    }

    // Get all data including headers
    const data = sheet.getDataRange().getValues();
    if (data.length < 1)
      return createResponse(200, { success: true, data: [] });

    // Extract headers and map to indices
    const headerRow = data[0];
    const headerMap = {};
    headerRow.forEach((col, index) => {
      // Normalize to lowercase for case-insensitive matching
      if (col) headerMap[String(col).trim().toLowerCase()] = index;
    });

    const rows = data.slice(1); // Skip header
    const results = [];

    // OPTIMIZATION: Get expected headers ONCE, outside the loop
    const expectedHeaders = getHeadersForTable(table);

    // OPTIMIZATION: Pre-compute query key indices for faster filtering
    const queryKeys = query ? Object.keys(query) : [];
    const queryKeyIndices = {};
    queryKeys.forEach(key => {
      queryKeyIndices[key] = headerMap[key.toLowerCase()];
    });

    // Map array to object using dynamic headers
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // OPTIMIZATION: Skip completely empty rows early
      // Check if first column (usually ID) is empty
      if (!row[0] && !row[1]) continue;

      // OPTIMIZATION: Do filtering BEFORE building full object
      // This avoids building objects for rows that don't match
      let match = true;
      if (query && queryKeys.length > 0) {
        for (const key of queryKeys) {
          const colIndex = queryKeyIndices[key];
          if (colIndex !== undefined) {
            const cellValue = row[colIndex];
            const queryValue = query[key];
            // Compare as strings for consistency
            if (String(cellValue).toLowerCase() !== String(queryValue).toLowerCase()) {
              match = false;
              break;
            }
          }
        }
      }

      if (!match) continue;

      // Build object only for matching rows
      const item = {};
      expectedHeaders.forEach((h) => {
        const colIndex = headerMap[h.toLowerCase()];
        if (colIndex !== undefined) {
          item[h] = row[colIndex];
        } else {
          item[h] = null;
        }
      });

      results.push(item);

      if (limit && results.length >= limit) break;
    }

    return createResponse(200, {
      success: true,
      data: results,
    });
  } catch (error) {
    return createResponse(500, { success: false, message: error.message });
  }
}

/**
 * Helper to get expected headers for a table name
 */
function getHeadersForTable(table) {
  switch (table) {
    case "users":
      return HEADERS.USERS;
    case "classes":
      return HEADERS.CLASSES;
    case "attendance":
      return HEADERS.ATTENDANCE;
    case "memorization_logs":
      return HEADERS.MEMORIZATION_LOGS;
    case "assessments":
      return HEADERS.ASSESSMENTS;
    case "exams":
      return HEADERS.EXAMS;
    case "exam_results":
      return HEADERS.EXAM_RESULTS;
    case "reports":
      return HEADERS.REPORTS;
    case "otp_codes":
      return HEADERS.OTP_CODES;
    case "class_members":
      return HEADERS.CLASS_MEMBERS;
    case "data_quran":
      return HEADERS.DATA_QURAN;
    default:
      return [];
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
    case "otp_codes":
      sheetName = SHEETS.OTP_CODES;
      headers = HEADERS.OTP_CODES;
      break;
    case "class_members":
      sheetName = SHEETS.CLASS_MEMBERS;
      headers = HEADERS.CLASS_MEMBERS;
      break;
    case "data_quran":
      sheetName = SHEETS.DATA_QURAN;
      headers = HEADERS.DATA_QURAN;
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
  // Get current headers from sheet to ensure correct order
  const sheetHeaders = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];
  const headerMap = {};
  sheetHeaders.forEach((col, index) => {
    if (col) headerMap[String(col).trim().toLowerCase()] = index;
  });

  // Create row with initialized empty strings
  const row = new Array(sheetHeaders.length).fill("");

  // Fill in data based on header map
  headers.forEach((h) => {
    if (headerMap[h.toLowerCase()] !== undefined && data[h] !== undefined) {
      row[headerMap[h.toLowerCase()]] = data[h];
    }
  });

  // If there are extra fields in data that map to columns in sheet but not in "headers" definition?
  // We stick to 'headers' def for safety.

  sheet.appendRow(row);
}

/**
 * Update an existing row by ID
 */
function updateRow(sheet, headers, data) {
  const id = data.id;
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  if (values.length < 1) return; // Empty sheet

  // Map headers
  const headerRow = values[0];
  const headerMap = {};
  let idColIndex = -1;

  headerRow.forEach((col, index) => {
    const colName = String(col).trim().toLowerCase();
    if (colName) {
      headerMap[colName] = index;
      if (colName === "id") idColIndex = index;
    }
  });

  if (idColIndex === -1) {
    throw new Error("ID column not found in sheet");
  }

  // Find row with matching ID
  for (let i = 1; i < values.length; i++) {
    if (values[i][idColIndex] === id) {
      const currentRow = values[i];
      const newRow = [...currentRow]; // Copy existing row

      // Update fields
      headers.forEach((h) => {
        // Only update if field exists in data AND column exists in sheet
        if (data[h] !== undefined && headerMap[h.toLowerCase()] !== undefined) {
          newRow[headerMap[h.toLowerCase()]] = data[h];
        }
      });

      sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
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
    SHEETS.EXAM_RESULTS,
    SHEETS.REPORTS,
    SHEETS.CLASS_MEMBERS,
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
    case SHEETS.CLASS_MEMBERS:
      tableName = "class_members";
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
      name: SHEETS.DATA_QURAN,
      headers: HEADERS.DATA_QURAN,
      description: "Data 114 surah Al-Quran",
      seedData: true,
    },
    {
      name: SHEETS.SYNC_LOG,
      headers: ["Timestamp", "Action", "Source", "Details"],
      description: "Log sinkronisasi",
    },
    {
      name: SHEETS.OTP_CODES,
      headers: HEADERS.OTP_CODES,
      description: "Kode OTP untuk login",
    },
    {
      name: SHEETS.CLASS_MEMBERS,
      headers: HEADERS.CLASS_MEMBERS,
      description: "Data anggota kelas (Siswa - Kelas)",
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

    // Seed Quran data if needed
    if (config.seedData && config.name === SHEETS.DATA_QURAN) {
      seedQuranData(sheet);
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
 * Seed Quran Data - 114 Surah
 */
function seedQuranData(sheet) {
  // Check if data already exists
  if (sheet.getLastRow() > 1) {
    return; // Data already seeded
  }

  const quranData = [
    [1, "Al-Fatihah", "الفاتحة", 7, "Makkiyah", "1"],
    [2, "Al-Baqarah", "البقرة", 286, "Madaniyah", "1-3"],
    [3, "Ali Imran", "آل عمران", 200, "Madaniyah", "3-4"],
    [4, "An-Nisa", "النساء", 176, "Madaniyah", "4-6"],
    [5, "Al-Maidah", "المائدة", 120, "Madaniyah", "6-7"],
    [6, "Al-Anam", "الأنعام", 165, "Makkiyah", "7-8"],
    [7, "Al-Araf", "الأعراف", 206, "Makkiyah", "8-9"],
    [8, "Al-Anfal", "الأنفال", 75, "Madaniyah", "9-10"],
    [9, "At-Taubah", "التوبة", 129, "Madaniyah", "10-11"],
    [10, "Yunus", "يونس", 109, "Makkiyah", "11"],
    [11, "Hud", "هود", 123, "Makkiyah", "11-12"],
    [12, "Yusuf", "يوسف", 111, "Makkiyah", "12-13"],
    [13, "Ar-Rad", "الرعد", 43, "Madaniyah", "13"],
    [14, "Ibrahim", "إبراهيم", 52, "Makkiyah", "13"],
    [15, "Al-Hijr", "الحجر", 99, "Makkiyah", "14"],
    [16, "An-Nahl", "النحل", 128, "Makkiyah", "14"],
    [17, "Al-Isra", "الإسراء", 111, "Makkiyah", "15"],
    [18, "Al-Kahf", "الكهف", 110, "Makkiyah", "15-16"],
    [19, "Maryam", "مريم", 98, "Makkiyah", "16"],
    [20, "Taha", "طه", 135, "Makkiyah", "16"],
    [21, "Al-Anbiya", "الأنبياء", 112, "Makkiyah", "17"],
    [22, "Al-Hajj", "الحج", 78, "Madaniyah", "17"],
    [23, "Al-Muminun", "المؤمنون", 118, "Makkiyah", "18"],
    [24, "An-Nur", "النور", 64, "Madaniyah", "18"],
    [25, "Al-Furqan", "الفرقان", 77, "Makkiyah", "18-19"],
    [26, "Ash-Shuara", "الشعراء", 227, "Makkiyah", "19"],
    [27, "An-Naml", "النمل", 93, "Makkiyah", "19-20"],
    [28, "Al-Qasas", "القصص", 88, "Makkiyah", "20"],
    [29, "Al-Ankabut", "العنكبوت", 69, "Makkiyah", "20-21"],
    [30, "Ar-Rum", "الروم", 60, "Makkiyah", "21"],
    [31, "Luqman", "لقمان", 34, "Makkiyah", "21"],
    [32, "As-Sajdah", "السجدة", 30, "Makkiyah", "21"],
    [33, "Al-Ahzab", "الأحزاب", 73, "Madaniyah", "21-22"],
    [34, "Saba", "سبأ", 54, "Makkiyah", "22"],
    [35, "Fatir", "فاطر", 45, "Makkiyah", "22"],
    [36, "Ya-Sin", "يس", 83, "Makkiyah", "22-23"],
    [37, "As-Saffat", "الصافات", 182, "Makkiyah", "23"],
    [38, "Sad", "ص", 88, "Makkiyah", "23"],
    [39, "Az-Zumar", "الزمر", 75, "Makkiyah", "23-24"],
    [40, "Ghafir", "غافر", 85, "Makkiyah", "24"],
    [41, "Fussilat", "فصلت", 54, "Makkiyah", "24-25"],
    [42, "Ash-Shura", "الشورى", 53, "Makkiyah", "25"],
    [43, "Az-Zukhruf", "الزخرف", 89, "Makkiyah", "25"],
    [44, "Ad-Dukhan", "الدخان", 59, "Makkiyah", "25"],
    [45, "Al-Jathiyah", "الجاثية", 37, "Makkiyah", "25"],
    [46, "Al-Ahqaf", "الأحقاف", 35, "Makkiyah", "26"],
    [47, "Muhammad", "محمد", 38, "Madaniyah", "26"],
    [48, "Al-Fath", "الفتح", 29, "Madaniyah", "26"],
    [49, "Al-Hujurat", "الحجرات", 18, "Madaniyah", "26"],
    [50, "Qaf", "ق", 45, "Makkiyah", "26"],
    [51, "Adh-Dhariyat", "الذاريات", 60, "Makkiyah", "26-27"],
    [52, "At-Tur", "الطور", 49, "Makkiyah", "27"],
    [53, "An-Najm", "النجم", 62, "Makkiyah", "27"],
    [54, "Al-Qamar", "القمر", 55, "Makkiyah", "27"],
    [55, "Ar-Rahman", "الرحمن", 78, "Madaniyah", "27"],
    [56, "Al-Waqiah", "الواقعة", 96, "Makkiyah", "27"],
    [57, "Al-Hadid", "الحديد", 29, "Madaniyah", "27"],
    [58, "Al-Mujadilah", "المجادلة", 22, "Madaniyah", "28"],
    [59, "Al-Hashr", "الحشر", 24, "Madaniyah", "28"],
    [60, "Al-Mumtahanah", "الممتحنة", 13, "Madaniyah", "28"],
    [61, "As-Saff", "الصف", 14, "Madaniyah", "28"],
    [62, "Al-Jumuah", "الجمعة", 11, "Madaniyah", "28"],
    [63, "Al-Munafiqun", "المنافقون", 11, "Madaniyah", "28"],
    [64, "At-Taghabun", "التغابن", 18, "Madaniyah", "28"],
    [65, "At-Talaq", "الطلاق", 12, "Madaniyah", "28"],
    [66, "At-Tahrim", "التحريم", 12, "Madaniyah", "28"],
    [67, "Al-Mulk", "الملك", 30, "Makkiyah", "29"],
    [68, "Al-Qalam", "القلم", 52, "Makkiyah", "29"],
    [69, "Al-Haqqah", "الحاقة", 52, "Makkiyah", "29"],
    [70, "Al-Maarij", "المعارج", 44, "Makkiyah", "29"],
    [71, "Nuh", "نوح", 28, "Makkiyah", "29"],
    [72, "Al-Jinn", "الجن", 28, "Makkiyah", "29"],
    [73, "Al-Muzzammil", "المزمل", 20, "Makkiyah", "29"],
    [74, "Al-Muddaththir", "المدثر", 56, "Makkiyah", "29"],
    [75, "Al-Qiyamah", "القيامة", 40, "Makkiyah", "29"],
    [76, "Al-Insan", "الإنسان", 31, "Madaniyah", "29"],
    [77, "Al-Mursalat", "المرسلات", 50, "Makkiyah", "29"],
    [78, "An-Naba", "النبأ", 40, "Makkiyah", "30"],
    [79, "An-Naziat", "النازعات", 46, "Makkiyah", "30"],
    [80, "Abasa", "عبس", 42, "Makkiyah", "30"],
    [81, "At-Takwir", "التكوير", 29, "Makkiyah", "30"],
    [82, "Al-Infitar", "الانفطار", 19, "Makkiyah", "30"],
    [83, "Al-Mutaffifin", "المطففين", 36, "Makkiyah", "30"],
    [84, "Al-Inshiqaq", "الانشقاق", 25, "Makkiyah", "30"],
    [85, "Al-Buruj", "البروج", 22, "Makkiyah", "30"],
    [86, "At-Tariq", "الطارق", 17, "Makkiyah", "30"],
    [87, "Al-Ala", "الأعلى", 19, "Makkiyah", "30"],
    [88, "Al-Ghashiyah", "الغاشية", 26, "Makkiyah", "30"],
    [89, "Al-Fajr", "الفجر", 30, "Makkiyah", "30"],
    [90, "Al-Balad", "البلد", 20, "Makkiyah", "30"],
    [91, "Ash-Shams", "الشمس", 15, "Makkiyah", "30"],
    [92, "Al-Lail", "الليل", 21, "Makkiyah", "30"],
    [93, "Ad-Duha", "الضحى", 11, "Makkiyah", "30"],
    [94, "Ash-Sharh", "الشرح", 8, "Makkiyah", "30"],
    [95, "At-Tin", "التين", 8, "Makkiyah", "30"],
    [96, "Al-Alaq", "العلق", 19, "Makkiyah", "30"],
    [97, "Al-Qadr", "القدر", 5, "Makkiyah", "30"],
    [98, "Al-Bayyinah", "البينة", 8, "Madaniyah", "30"],
    [99, "Az-Zalzalah", "الزلزلة", 8, "Madaniyah", "30"],
    [100, "Al-Adiyat", "العاديات", 11, "Makkiyah", "30"],
    [101, "Al-Qariah", "القارعة", 11, "Makkiyah", "30"],
    [102, "At-Takathur", "التكاثر", 8, "Makkiyah", "30"],
    [103, "Al-Asr", "العصر", 3, "Makkiyah", "30"],
    [104, "Al-Humazah", "الهمزة", 9, "Makkiyah", "30"],
    [105, "Al-Fil", "الفيل", 5, "Makkiyah", "30"],
    [106, "Quraish", "قريش", 4, "Makkiyah", "30"],
    [107, "Al-Maun", "الماعون", 7, "Makkiyah", "30"],
    [108, "Al-Kawthar", "الكوثر", 3, "Makkiyah", "30"],
    [109, "Al-Kafirun", "الكافرون", 6, "Makkiyah", "30"],
    [110, "An-Nasr", "النصر", 3, "Madaniyah", "30"],
    [111, "Al-Masad", "المسد", 5, "Makkiyah", "30"],
    [112, "Al-Ikhlas", "الإخلاص", 4, "Makkiyah", "30"],
    [113, "Al-Falaq", "الفلق", 5, "Makkiyah", "30"],
    [114, "An-Nas", "الناس", 6, "Madaniyah", "30"],
  ];

  sheet.getRange(2, 1, quranData.length, 6).setValues(quranData);
  Logger.log("Seeded 114 Surah data to Data_Quran sheet");
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
