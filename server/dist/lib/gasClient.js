import Database from "better-sqlite3";
import { nanoid } from "nanoid";
import fs from "node:fs";
// Ensure data directory exists
if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data");
}
const sqlite = new Database("./data/tahfidz.db");
// Initialize tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    isActive INTEGER DEFAULT 1,
    phone TEXT,
    address TEXT,
    parentId TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS teacher_profiles (
    id TEXT PRIMARY KEY,
    userId TEXT UNIQUE NOT NULL,
    nip TEXT,
    specialization TEXT,
    startDate TEXT,
    totalHafalan INTEGER,
    photoUrl TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    code TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt TEXT
  );
`);
// Generic Table Helper
class Table {
    tableName;
    constructor(tableName) {
        this.tableName = tableName;
    }
    async findFirst(where) {
        const keys = Object.keys(where);
        if (keys.length === 0)
            return null;
        const condition = keys.map(k => `${k} = ?`).join(" AND ");
        const values = Object.values(where);
        const row = sqlite.prepare(`SELECT * FROM ${this.tableName} WHERE ${condition} LIMIT 1`).get(...values);
        // Normalize booleans for 'users'
        if (row && this.tableName === 'users') {
            row.isActive = row.isActive === 1;
        }
        return row || null;
    }
    async findMany(where, limit = 100) {
        let query = `SELECT * FROM ${this.tableName}`;
        const keys = Object.keys(where);
        const values = Object.values(where);
        if (keys.length > 0) {
            const condition = keys.map(k => `${k} = ?`).join(" AND ");
            query += ` WHERE ${condition}`;
        }
        query += ` LIMIT ?`;
        const rows = sqlite.prepare(query).all(...values, limit);
        if (this.tableName === 'users') {
            return rows.map((r) => ({ ...r, isActive: r.isActive === 1 }));
        }
        return rows;
    }
    async create(data) {
        const id = data.id || nanoid();
        const now = new Date().toISOString();
        const finalData = { ...data, id, createdAt: now, updatedAt: now };
        if (this.tableName === 'users') {
            finalData.isActive = finalData.isActive ? 1 : 0;
        }
        const keys = Object.keys(finalData);
        const placeholders = keys.map(() => "?").join(", ");
        const values = Object.values(finalData);
        const stmt = sqlite.prepare(`INSERT INTO ${this.tableName} (${keys.join(", ")}) VALUES (${placeholders})`);
        stmt.run(...values);
        // Return the created object
        // Re-construct boolean
        if (this.tableName === 'users') {
            const { isActive, ...rest } = finalData;
            return { ...rest, isActive: !!isActive };
        }
        return finalData;
    }
    async update(id, data) {
        const now = new Date().toISOString();
        const finalData = { ...data, updatedAt: now };
        if (this.tableName === 'users' && finalData.isActive !== undefined) {
            finalData.isActive = finalData.isActive ? 1 : 0;
        }
        const keys = Object.keys(finalData);
        const setClause = keys.map(k => `${k} = ?`).join(", ");
        const values = Object.values(finalData);
        const stmt = sqlite.prepare(`UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`);
        stmt.run(...values, id);
        // Fetch updated
        return this.findFirst({ id });
    }
    async delete(id) {
        const stmt = sqlite.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
        const info = stmt.run(id);
        return info.changes > 0;
    }
}
// Export db object matching GAS interface
export const db = {
    users: new Table("users"),
    otpCodes: new Table("otp_codes"),
    teacherProfiles: new Table("teacher_profiles"),
    // Mock tables for other routes
    classes: new Table("classes"),
    assessments: new Table("assessments"),
    dataQuran: new Table("data_quran"),
    exams: new Table("exams"),
    students: new Table("students"),
    reports: new Table("reports"),
    stats: new Table("stats"),
    sync: new Table("sync"),
    notifications: new Table("notifications"),
};
