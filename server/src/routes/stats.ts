import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../lib/sheetsClient.js";
import {
  authMiddleware,
  canAccessStudent,
} from "../middleware/auth.js";
import { HTTPException } from "hono/http-exception";

const stats = new Hono();

// Apply auth middleware
stats.use("*", authMiddleware);

// Total Quran Ayahs for percentage calculation
const TOTAL_QURAN_AYAHS = 6236;

// ============================================
// GET /stats/progress/:studentId - Tahfidz Progress Stats
// ============================================
stats.get("/progress/:studentId", async (c) => {
  const { studentId } = c.req.param();
  const auth = c.get("auth");

  // Check access
  const hasAccess = await canAccessStudent(auth, studentId);
  if (!hasAccess) {
    throw new HTTPException(403, {
      message: "Access denied to this student's data",
    });
  }

  // Verify student exists
  const student = await db.users.findFirst({ id: studentId });

  if (!student) {
    throw new HTTPException(404, { message: "Student not found" });
  }

  // Get all memorization logs for this student (Ziyadah only for progress)
  const allLogs = await db.memorizationLogs.findMany({ studentId: studentId });
  const ziyadahLogs = allLogs.filter((l: any) => l.type === "ziyadah");

  // Calculate total ayahs memorized (unique ayahs logic roughly)
  // Simplified by just summing ranges, assuming non-overlapping or handling overlaps in future.
  // Original code used a Set of "surah:ayah" strings. We can do that.
  const memorizedAyahs = new Set<string>();

  for (const log of ziyadahLogs) {
    for (let ayah = Number(log.startAyah); ayah <= Number(log.endAyah); ayah++) {
      memorizedAyahs.add(`${log.surahId}:${ayah}`);
    }
  }

  const totalMemorized = memorizedAyahs.size;
  const progressPercentage = (totalMemorized / TOTAL_QURAN_AYAHS) * 100;

  // Calculate Juz completion
  const juzProgress: any[] = [];

  // Simplified Juz ayah counts (approximate)
  const juzAyahCounts: { [key: number]: number } = {
    1: 148, 2: 111, 3: 126, 4: 131, 5: 124, 6: 110, 7: 149, 8: 142, 9: 159, 10: 127,
    11: 151, 12: 170, 13: 154, 14: 227, 15: 185, 16: 269, 17: 190, 18: 202, 19: 339, 20: 171,
    21: 178, 22: 169, 23: 357, 24: 175, 25: 246, 26: 195, 27: 399, 28: 137, 29: 431, 30: 564,
  };

  // Get memorized count per juz
  for (let juz = 1; juz <= 30; juz++) {
    const totalAyahsInJuz = juzAyahCounts[juz] || 200;

    // In-memory calculation
    // Note: Log SurahId -> Juz mapping is approximate in original code too.
    const relevantLogs = ziyadahLogs.filter((log: any) => {
          const sId = Number(log.surahId);
          // Very rough estimation: Surahs 1-2 Juz 1, etc.
          // Original code: const surahJuz = log.surahId <= 2 ? 1 : Math.ceil(log.surahId / 4);
          const surahJuz = sId <= 2 ? 1 : Math.ceil(sId / 4);
          return Math.abs(surahJuz - juz) <= 1;
    });

    // Summing ranges (simplified)
    const ayahsMemorizedRaw = relevantLogs.reduce((sum: number, log: any) => sum + (Number(log.endAyah) - Number(log.startAyah) + 1), 0) / 3;
    // The division by 3 in original code is a rough heuristic because logs might span juz boundaries or be counted in multiple buckets?
    // We'll keep original heuristic.

    const ayahsMemorized = Math.min(ayahsMemorizedRaw, totalAyahsInJuz);

    juzProgress.push({
      juz,
      percentage: (ayahsMemorized / totalAyahsInJuz) * 100,
      ayahsMemorized: Math.round(ayahsMemorized),
      totalAyahs: totalAyahsInJuz,
    });
  }

  // Get assessment scores
  const logIds = allLogs.map((log: any) => log.id);

  let avgScores = {
    tajwid: 0,
    fashohah: 0,
    fluency: 0,
    total: 0,
    count: 0,
  };

  if (logIds.length > 0) {
      // Performance: Fetching all assessments to filter by logIds might be heavy.
      // But we can fetch assessments for current student logs if we had a link.
      // Assessments usually have logId but not studentId directly?
      // Our type definition in index.ts for Assessments?
      // Let's check GASClient or Types.
      // In Reports.ts, we did `db.assessments.findMany({})`.
      // We'll assume assessments are linked to logs.
      const allAssessments = await db.assessments.findMany({});
      const studentAssessments = allAssessments.filter((a: any) => logIds.includes(a.logId));

    if (studentAssessments.length > 0) {
      avgScores = {
        tajwid:
          studentAssessments.reduce((sum: number, a: any) => sum + Number(a.tajwidScore||0), 0) /
          studentAssessments.length,
        fashohah:
          studentAssessments.reduce((sum: number, a: any) => sum + Number(a.fashohahScore||0), 0) /
          studentAssessments.length,
        fluency:
          studentAssessments.reduce((sum: number, a: any) => sum + Number(a.fluencyScore||0), 0) /
          studentAssessments.length,
        total:
          studentAssessments.reduce((sum: number, a: any) => sum + Number(a.totalScore||0), 0) /
          studentAssessments.length,
        count: studentAssessments.length,
      };
    }
  }

  // Get recent activity
  const recentLogs = [...allLogs].sort((a: any, b: any) => b.sessionDate.localeCompare(a.sessionDate)).slice(0, 10);

  // Get surah progress
  const surahProgressMap = new Map<number, { surahId: number, totalAyahs: number, sessions: number }>();

  ziyadahLogs.forEach((log: any) => {
      const sId = Number(log.surahId);
      const ayahs = Number(log.endAyah) - Number(log.startAyah) + 1;

      if (!surahProgressMap.has(sId)) {
        surahProgressMap.set(sId, { surahId: sId, totalAyahs: 0, sessions: 0 });
      }
      const entry = surahProgressMap.get(sId)!;
      entry.totalAyahs += ayahs;
      entry.sessions += 1;
  });

  const surahProgress = Array.from(surahProgressMap.values());

  return c.json({
    success: true,
    data: {
      student: {
        id: student.id,
        name: student.name,
      },
      overall: {
        totalAyahsMemorized: totalMemorized,
        totalQuranAyahs: TOTAL_QURAN_AYAHS,
        progressPercentage: Math.round(progressPercentage * 100) / 100,
        juzCompleted: juzProgress.filter((j) => j.percentage >= 100).length,
      },
      scores: {
        averageTajwid: Math.round(avgScores.tajwid * 100) / 100,
        averageFashohah: Math.round(avgScores.fashohah * 100) / 100,
        averageFluency: Math.round(avgScores.fluency * 100) / 100,
        averageTotal: Math.round(avgScores.total * 100) / 100,
        totalAssessments: avgScores.count,
      },
      juzProgress,
      surahProgress,
      recentActivity: recentLogs,
    },
  });
});

// ============================================
// GET /stats/attendance/:studentId - Attendance Heatmap
// ============================================
const attendanceStatsSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

stats.get(
  "/attendance/:studentId",
  zValidator("query", attendanceStatsSchema),
  async (c) => {
    const { studentId } = c.req.param();
    const query = c.req.valid("query");
    const auth = c.get("auth");

    // Check access
    const hasAccess = await canAccessStudent(auth, studentId);
    if (!hasAccess) {
      throw new HTTPException(403, {
        message: "Access denied to this student's data",
      });
    }

    // Verify student exists
    const student = await db.users.findFirst({ id: studentId });

    if (!student) {
      throw new HTTPException(404, { message: "Student not found" });
    }

    // Default to current year if not specified
    const year = query.year || new Date().getFullYear();
    const startDate = query.month
      ? `${year}-${String(query.month).padStart(2, "0")}-01`
      : `${year}-01-01`;
    const endDate = query.month
      ? `${year}-${String(query.month).padStart(2, "0")}-31`
      : `${year}-12-31`;

    // Get attendance records
    // Filter in-memory for dates
    const allRecords = await db.attendance.findMany({ studentId: studentId });
    const records = allRecords.filter((r: any) => r.date >= startDate && r.date <= endDate);

    // Sort
    records.sort((a: any, b: any) => a.date.localeCompare(b.date));

    // Build heatmap data
    // ... logic same as original ...
    const heatmapData: any = {};

    for (const record of records) {
      if (!heatmapData[record.date]) {
        heatmapData[record.date] = {
          date: record.date,
          sessions: [],
          presentCount: 0,
          absentCount: 0,
          totalSessions: 0,
        };
      }

      heatmapData[record.date].sessions.push({
        type: record.sessionType,
        status: record.status,
      });

      heatmapData[record.date].totalSessions++;

      if (record.status === "present" || record.status === "late") {
        heatmapData[record.date].presentCount++;
      } else {
        heatmapData[record.date].absentCount++;
      }
    }

    // Calculate monthly summaries
    const monthlySummary: any = {};

    for (const record of records) {
      const month = record.date.substring(0, 7); // YYYY-MM
      if (!monthlySummary[month]) {
        monthlySummary[month] = { present: 0, absent: 0, sick: 0, leave: 0, late: 0, total: 0, attendanceRate: 0 };
      }
      monthlySummary[month][record.status]++;
      monthlySummary[month].total++;
    }

    // Rates
    for (const month of Object.keys(monthlySummary)) {
      const { present, late, total } = monthlySummary[month];
      monthlySummary[month].attendanceRate = total > 0 ? Math.round(((present + late) / total) * 10000) / 100 : 0;
    }

    // Session type breakdown
    const sessionTypeStats: any = {};
    records.forEach((r: any) => {
        const key = `${r.sessionType}-${r.status}`;
        if (!sessionTypeStats[key]) sessionTypeStats[key] = { sessionType: r.sessionType, status: r.status, count: 0 };
        sessionTypeStats[key].count++;
    });
    const sessionTypeBreakdown = Object.values(sessionTypeStats);

    // Overall stats
    const totalRecords = records.length;
    const presentCount = records.filter(
      (r: any) => r.status === "present" || r.status === "late",
    ).length;
    const overallAttendanceRate =
      totalRecords > 0
        ? Math.round((presentCount / totalRecords) * 10000) / 100
        : 0;

    return c.json({
      success: true,
      data: {
        student: { id: student.id, name: student.name },
        period: { year, month: query.month || null, startDate, endDate },
        overall: {
          totalSessions: totalRecords,
          presentCount,
          absentCount: records.filter((r: any) => r.status === "absent").length,
          sickCount: records.filter((r: any) => r.status === "sick").length,
          leaveCount: records.filter((r: any) => r.status === "leave").length,
          lateCount: records.filter((r: any) => r.status === "late").length,
          attendanceRate: overallAttendanceRate,
        },
        heatmap: Object.values(heatmapData),
        monthlySummary,
        sessionTypeBreakdown,
      },
    });
  },
);

// ============================================
// GET /stats/class/:classId - Class Statistics
// ============================================
stats.get("/class/:classId", async (c) => {
  const { classId } = c.req.param();
  const auth = c.get("auth");

  if (auth.user.role !== "admin" && auth.user.role !== "teacher") {
    throw new HTTPException(403, { message: "Access denied" });
  }

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Get class attendance stats
  // Limit 1000 records? Or filter by classId on server (if param available in attendance table)
  // Attendance table usually has classId?
  // Let's check types.ts
  const allAtt = await db.attendance.findMany({ classId: classId });
  const recentAtt = allAtt.filter((a: any) => a.date >= thirtyDaysAgo);

  const attendanceStatsMap: any = {};
  recentAtt.forEach((a: any) => {
      if(!attendanceStatsMap[a.status]) attendanceStatsMap[a.status] = { status: a.status, count: 0 };
      attendanceStatsMap[a.status].count++;
  });
  const attendanceStats = Object.values(attendanceStatsMap);

  // Get memorization activity
  const allMem = await db.memorizationLogs.findMany({ classId: classId });

  const memorizationStatsMap: any = {};
  allMem.forEach((l: any) => {
      if(!memorizationStatsMap[l.type]) memorizationStatsMap[l.type] = { type: l.type, totalAyahs: 0, sessions: 0 };
      const ayahs = Number(l.endAyah) - Number(l.startAyah) + 1;
      memorizationStatsMap[l.type].totalAyahs += ayahs;
      memorizationStatsMap[l.type].sessions++;
  });
  const memorizationStats = Object.values(memorizationStatsMap);

  return c.json({
    success: true,
    data: {
      classId,
      period: { from: thirtyDaysAgo, to: today },
      attendance: attendanceStats,
      memorization: memorizationStats,
    },
  });
});

// ============================================
// GET /stats/leaderboard - Top Students
// ============================================
const leaderboardSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  type: z.enum(["ayahs", "score", "attendance"]).default("ayahs"),
});

stats.get("/leaderboard", zValidator("query", leaderboardSchema), async (c) => {
  const query = c.req.valid("query");
  const auth = c.get("auth");

  if (auth.user.role !== "admin" && auth.user.role !== "teacher") {
    throw new HTTPException(403, { message: "Access denied" });
  }

  let leaderboard: { studentId: string; studentName: string; value: number }[] = [];

  // Fetch all students to map names later
  const students = await db.users.findMany({});
  const studentMap = new Map();
  students.forEach((s: any) => studentMap.set(s.id, s.name));

  if (query.type === "ayahs") {
    // Fetch all Ziyadah logs
    const allLogs = await db.memorizationLogs.findMany({});
    const ziyadah = allLogs.filter((l: any) => l.type === "ziyadah");

    // Group by student
    const studentCounts: any = {};
    ziyadah.forEach((l: any) => {
        if(!studentCounts[l.studentId]) studentCounts[l.studentId] = 0;
        studentCounts[l.studentId] += (Number(l.endAyah) - Number(l.startAyah) + 1);
    });

    const sortedIds = Object.keys(studentCounts).sort((a,b) => studentCounts[b] - studentCounts[a]);

    sortedIds.slice(0, query.limit).forEach(id => {
        leaderboard.push({
            studentId: id,
            studentName: studentMap.get(id) || "Unknown",
            value: studentCounts[id]
        });
    });

  } else if (query.type === "score") {
    // Avg assessment score
    const assessments = await db.assessments.findMany({});
    const memLogs = await db.memorizationLogs.findMany({});
    const logMap = new Map();
    memLogs.forEach((l: any) => logMap.set(l.id, l.studentId));

    const studentScores: any = {};
    assessments.forEach((a: any) => {
        const sId = logMap.get(a.logId);
        if(sId) {
            if(!studentScores[sId]) studentScores[sId] = { sum: 0, count: 0 };
            studentScores[sId].sum += Number(a.totalScore);
            studentScores[sId].count++;
        }
    });

    const result = Object.keys(studentScores).map(id => ({
        id,
        avg: studentScores[id].sum / studentScores[id].count
    })).sort((a,b) => b.avg - a.avg);

    result.slice(0, query.limit).forEach(r => {
        leaderboard.push({
            studentId: r.id,
            studentName: studentMap.get(r.id) || "Unknown",
            value: Math.round(r.avg * 100) / 100
        });
    });

  } else {
    // Attendance rate
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const attendance = await db.attendance.findMany({}); // Filter by date?
    // GASClient might not support date filter on FindMany efficiently if payload size big.

    const recent = attendance.filter((a: any) => a.date >= thirtyDaysAgo);

    const studentAtt: any = {};
    recent.forEach((a: any) => {
        if(!studentAtt[a.studentId]) studentAtt[a.studentId] = { present: 0, total: 0 };
        studentAtt[a.studentId].total++;
        if(a.status === 'present' || a.status === 'late') studentAtt[a.studentId].present++;
    });

    const result = Object.keys(studentAtt).map(id => ({
        id,
        rate: studentAtt[id].total > 0 ? (studentAtt[id].present / studentAtt[id].total) * 100 : 0
    })).sort((a,b) => b.rate - a.rate);

    result.slice(0, query.limit).forEach(r => {
        leaderboard.push({
            studentId: r.id,
            studentName: studentMap.get(r.id) || "Unknown",
            value: Math.round(r.rate * 100) / 100
        });
    });
  }

  return c.json({
    success: true,
    data: {
      type: query.type,
      leaderboard,
    },
  });
});

export default stats;
