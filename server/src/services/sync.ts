import {
  db,
  syncLogs,
  attendance,
  memorizationLogs,
  assessments,
} from "../db/index.js";
import { eq, and, inArray } from "drizzle-orm";
import type { NewSyncLog } from "../db/schema.js";

// ============================================
// CONFIGURATION
// ============================================
const GAS_WEBHOOK_URL = process.env.GAS_WEBHOOK_URL || "";
const GAS_API_KEY = process.env.GAS_API_KEY || "";

interface SyncPayload {
  action: "create" | "update" | "delete";
  table: string;
  data: Record<string, unknown>;
  timestamp: string;
}

interface GASResponse {
  success: boolean;
  message?: string;
  sheetRowId?: string;
}

// ============================================
// SYNC SERVICE CLASS
// ============================================
export class SyncService {
  private static instance: SyncService;
  private syncQueue: SyncPayload[] = [];
  private isSyncing: boolean = false;

  private constructor() {}

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  // ============================================
  // QUEUE MANAGEMENT
  // ============================================
  async queueSync(
    tableName: string,
    recordId: string,
    action: "create" | "update" | "delete",
    payload: Record<string, unknown>,
  ): Promise<void> {
    // Create sync log entry
    const syncLog: NewSyncLog = {
      tableName,
      recordId,
      action,
      payload: JSON.stringify(payload),
      syncStatus: "pending",
    };

    await db.insert(syncLogs).values(syncLog);

    // Add to queue
    this.syncQueue.push({
      action,
      table: tableName,
      data: { id: recordId, ...payload },
      timestamp: new Date().toISOString(),
    });

    // Trigger async sync (debounced)
    this.triggerSync();
  }

  private syncTimeout: NodeJS.Timeout | null = null;

  private triggerSync(): void {
    // Debounce sync to batch multiple changes
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => {
      this.processQueue();
    }, 5000); // Wait 5 seconds to batch changes
  }

  // ============================================
  // PROCESS SYNC QUEUE
  // ============================================
  async processQueue(): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0) {
      return;
    }

    if (!GAS_WEBHOOK_URL) {
      console.log("GAS_WEBHOOK_URL not configured, skipping sync");
      return;
    }

    this.isSyncing = true;

    try {
      // Get pending items from queue
      const items = [...this.syncQueue];
      this.syncQueue = [];

      // Send to GAS webhook
      const response = await this.sendToGAS(items);

      if (response.success) {
        // Update sync logs as synced
        const recordIds = items.map((item) => item.data.id as string);
        await db
          .update(syncLogs)
          .set({
            syncStatus: "synced",
            syncedAt: new Date().toISOString(),
          })
          .where(inArray(syncLogs.recordId, recordIds));

        console.log(
          `Successfully synced ${items.length} items to Google Sheets`,
        );
      } else {
        throw new Error(response.message || "Sync failed");
      }
    } catch (error) {
      console.error("Sync error:", error);

      // Mark items as failed
      const failedItems = this.syncQueue;
      for (const item of failedItems) {
        await db
          .update(syncLogs)
          .set({
            syncStatus: "failed",
            syncError: error instanceof Error ? error.message : "Unknown error",
          })
          .where(eq(syncLogs.recordId, item.data.id as string));
      }
    } finally {
      this.isSyncing = false;
    }
  }

  // ============================================
  // SEND TO GOOGLE APPS SCRIPT
  // ============================================
  private async sendToGAS(items: SyncPayload[]): Promise<GASResponse> {
    try {
      const response = await fetch(GAS_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": GAS_API_KEY,
        },
        body: JSON.stringify({
          items,
          source: "tahfidz-api",
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`GAS webhook returned ${response.status}`);
      }

      return (await response.json()) as GASResponse;
    } catch (error) {
      console.error("GAS webhook error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================
  // RECEIVE FROM GOOGLE APPS SCRIPT (Webhook Handler)
  // ============================================
  async handleGASWebhook(payload: {
    action: "create" | "update" | "delete";
    table: string;
    data: Record<string, unknown>;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const { action, table, data } = payload;

      switch (table) {
        case "attendance":
          await this.syncAttendanceFromGSheet(action, data);
          break;
        case "memorization_logs":
          await this.syncMemorizationLogFromGSheet(action, data);
          break;
        case "assessments":
          await this.syncAssessmentFromGSheet(action, data);
          break;
        default:
          return { success: false, message: `Unknown table: ${table}` };
      }

      return {
        success: true,
        message: `Successfully processed ${action} for ${table}`,
      };
    } catch (error) {
      console.error("GAS webhook handler error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================
  // SYNC HANDLERS FROM GSHEET
  // ============================================
  private async syncAttendanceFromGSheet(
    action: "create" | "update" | "delete",
    data: Record<string, unknown>,
  ): Promise<void> {
    const id = data.id as string;

    if (action === "delete") {
      await db.delete(attendance).where(eq(attendance.id, id));
      return;
    }

    const attendanceData = {
      id,
      studentId: data.studentId as string,
      classId: data.classId as string | null,
      sessionType: data.sessionType as
        | "subuh"
        | "ziyadah"
        | "murojaah"
        | "tahsin",
      status: data.status as "present" | "absent" | "sick" | "leave" | "late",
      proofUrl: data.proofUrl as string | null,
      notes: data.notes as string | null,
      date: data.date as string,
      recordedBy: data.recordedBy as string | null,
      syncedAt: new Date().toISOString(),
      syncSource: "gsheet" as const,
    };

    if (action === "create") {
      await db
        .insert(attendance)
        .values(attendanceData)
        .onConflictDoUpdate({
          target: attendance.id,
          set: { ...attendanceData, updatedAt: new Date().toISOString() },
        });
    } else {
      await db
        .update(attendance)
        .set({ ...attendanceData, updatedAt: new Date().toISOString() })
        .where(eq(attendance.id, id));
    }
  }

  private async syncMemorizationLogFromGSheet(
    action: "create" | "update" | "delete",
    data: Record<string, unknown>,
  ): Promise<void> {
    const id = data.id as string;

    if (action === "delete") {
      await db.delete(memorizationLogs).where(eq(memorizationLogs.id, id));
      return;
    }

    const logData = {
      id,
      studentId: data.studentId as string,
      type: data.type as "ziyadah" | "murojaah",
      surahId: data.surahId as number,
      startAyah: data.startAyah as number,
      endAyah: data.endAyah as number,
      teacherId: data.teacherId as string | null,
      classId: data.classId as string | null,
      sessionDate: data.sessionDate as string,
      notes: data.notes as string | null,
      syncedAt: new Date().toISOString(),
      syncSource: "gsheet" as const,
    };

    if (action === "create") {
      await db
        .insert(memorizationLogs)
        .values(logData)
        .onConflictDoUpdate({
          target: memorizationLogs.id,
          set: { ...logData, updatedAt: new Date().toISOString() },
        });
    } else {
      await db
        .update(memorizationLogs)
        .set({ ...logData, updatedAt: new Date().toISOString() })
        .where(eq(memorizationLogs.id, id));
    }
  }

  private async syncAssessmentFromGSheet(
    action: "create" | "update" | "delete",
    data: Record<string, unknown>,
  ): Promise<void> {
    const id = data.id as string;

    if (action === "delete") {
      await db.delete(assessments).where(eq(assessments.id, id));
      return;
    }

    const tajwid = data.tajwidScore as number;
    const fashohah = data.fashohahScore as number;
    const fluency = data.fluencyScore as number;
    const total = (tajwid + fashohah + fluency) / 3;

    const assessmentData = {
      id,
      logId: data.logId as string,
      tajwidScore: tajwid,
      fashohahScore: fashohah,
      fluencyScore: fluency,
      totalScore: total,
      grade: this.calculateGrade(total),
      notes: data.notes as string | null,
      assessedBy: data.assessedBy as string | null,
    };

    if (action === "create") {
      await db
        .insert(assessments)
        .values(assessmentData)
        .onConflictDoUpdate({
          target: assessments.id,
          set: { ...assessmentData, updatedAt: new Date().toISOString() },
        });
    } else {
      await db
        .update(assessments)
        .set({ ...assessmentData, updatedAt: new Date().toISOString() })
        .where(eq(assessments.id, id));
    }
  }

  private calculateGrade(score: number): "A" | "B" | "C" | "D" | "E" {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "E";
  }

  // ============================================
  // MANUAL SYNC TRIGGER
  // ============================================
  async forceSync(): Promise<{ success: boolean; syncedCount: number }> {
    // Get all pending sync logs
    const pending = await db.query.syncLogs.findMany({
      where: eq(syncLogs.syncStatus, "pending"),
    });

    if (pending.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    // Add to queue and process
    for (const log of pending) {
      this.syncQueue.push({
        action: log.action,
        table: log.tableName,
        data: JSON.parse(log.payload || "{}"),
        timestamp: log.createdAt,
      });
    }

    await this.processQueue();

    return { success: true, syncedCount: pending.length };
  }

  // ============================================
  // GET SYNC STATUS
  // ============================================
  async getSyncStatus(): Promise<{
    pending: number;
    synced: number;
    failed: number;
    lastSync: string | null;
  }> {
    const logs = await db.query.syncLogs.findMany({
      orderBy: (logs, { desc }) => [desc(logs.createdAt)],
    });

    const pending = logs.filter((l) => l.syncStatus === "pending").length;
    const synced = logs.filter((l) => l.syncStatus === "synced").length;
    const failed = logs.filter((l) => l.syncStatus === "failed").length;

    const lastSyncedLog = logs.find((l) => l.syncedAt);

    return {
      pending,
      synced,
      failed,
      lastSync: lastSyncedLog?.syncedAt || null,
    };
  }
}

// Export singleton instance
export const syncService = SyncService.getInstance();
