import { HTTPException } from "hono/http-exception";
import dotenv from "dotenv";

dotenv.config();

/**
 * CONFIGURATION
 */
const GAS_WEBHOOK_URL = process.env.GAS_WEBHOOK_URL;
const GAS_API_KEY = process.env.GAS_API_KEY;

if (!GAS_WEBHOOK_URL) {
  console.warn("WARNING: GAS_WEBHOOK_URL is not defined in environment variables.");
}

type Action = "create" | "update" | "delete" | "read";

interface GASRequest {
    action?: Action;
    table?: string;
    data?: any;
    query?: any;
    limit?: number;
    apiKey?: string;
    items?: any[];
}

interface GASResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    errors?: any[];
}

/**
 * Generic Client for Google Apps Script Webhook
 */
export class GASClient {
    private tableName: string;

    constructor(tableName: string) {
        this.tableName = tableName;
    }

    private async fetchGAS(payload: GASRequest): Promise<GASResponse> {
        if (!GAS_WEBHOOK_URL) {
             throw new HTTPException(500, { message: "Server misconfiguration: GAS_WEBHOOK_URL missing" });
        }

        try {
             // Add API Key to payload
            const response = await fetch(GAS_WEBHOOK_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": GAS_API_KEY || "",
                },
                body: JSON.stringify(payload),
            });

            const text = await response.text();

            let json;
            try {
                json = JSON.parse(text);
            } catch (e) {
                console.error("GAS RAW RESPONSE:", text);
                throw new Error(`Failed to parse GAS response: ${text.substring(0, 100)}...`);
            }

            if (!response.ok) {
                throw new Error(`GAS Error ${response.status}: ${JSON.stringify(json)}`);
            }

            return json;

        } catch (error: any) {
            console.error("GAS Fetch Error:", error.message);
            throw new HTTPException(502, { message: "Database Service Unavailable" });
        }
    }

    /**
     * Find many records matching a query
     */
    async findMany(query: Record<string, any> = {}, limit: number = 100): Promise<any[]> {
        const response = await this.fetchGAS({
            action: "read",
            table: this.tableName,
            query: query,
             limit: limit
        });

        if (!response.success) {
            console.error(`FindMany Error on ${this.tableName}:`, response.message);
            return [];
        }

        return response.data || [];
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
        // Ensure ID
        if (!data.id) {
             const { v4: uuidv4 } = await import('uuid');
             data.id = uuidv4();
        }

        // Add timestamps
        const now = new Date().toISOString();
        if (!data.createdAt) data.createdAt = now;
        if (!data.updatedAt) data.updatedAt = now;

        // Wrap in items array for Code.gs compatibility
        const response = await this.fetchGAS({
            items: [{
                action: "create",
                table: this.tableName,
                data: data
            }]
        });

        if (!response.success) {
             throw new Error(response.message || "Failed to create record");
        }

        return data;
    }

    /**
     * Update a record
     */
    async update(id: string, data: Record<string, any>): Promise<any> {
         // Add timestamps
        const now = new Date().toISOString();
        data.updatedAt = now;
        data.id = id; // Ensure ID is present

        const response = await this.fetchGAS({
             items: [{
                action: "update",
                table: this.tableName,
                data: data
            }]
        });

         if (!response.success) {
             throw new Error(response.message || "Failed to update record");
        }

        return { id, ...data };
    }

    /**
      * Delete a record
      */
    async delete(id: string): Promise<boolean> {
         const response = await this.fetchGAS({
             items: [{
                 action: "delete",
                 table: this.tableName,
                 data: { id }
             }]
         });

         return response.success;
    }
}

/**
 * Accessor for different "tables"
 */
export const db = {
    users: new GASClient("users"),
    classes: new GASClient("classes"),
    attendance: new GASClient("attendance"),
    memorizationLogs: new GASClient("memorization_logs"),
    assessments: new GASClient("assessments"),
    exams: new GASClient("exams"),
    examResults: new GASClient("exam_results"),
    reports: new GASClient("reports"),
    classMembers: new GASClient("class_members"),
    otpCodes: new GASClient("otp_codes"),
    syncLogs: new GASClient("sync_logs"),
    dataQuran: new GASClient("data_quran"), // Access 114 Surahs
};
