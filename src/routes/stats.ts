import { Hono } from "hono";
import { eq, and, gte, lte, sql, inArray, count } from "drizzle-orm";
import {
  db,
  attendance,
  memorizationLogs,
  assessments,
  surahs,
  users,
} from "../db/index.js";
import {
  authMiddleware,
  canAccessStudent,
  getAccessibleStudentIds,
} from "../middleware/auth.js";
import { paginationSchema, dateRangeSchema } from "../validators/index.js";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

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
  const student = await db.query.users.findFirst({
    where: eq(users.id, studentId),
  });

  if (!student) {
    throw new HTTPException(404, { message: "Student not found" });
  }

  // Get all memorization logs for this student (Ziyadah only for progress)
  const ziyadahLogs = await db.query.memorizationLogs.findMany({
    where: and(
      eq(memorizationLogs.studentId, studentId),
      eq(memorizationLogs.type, "ziyadah"),
    ),
  });

  // Calculate total ayahs memorized (unique ayahs)
  const memorizedAyahs = new Set<string>();

  for (const log of ziyadahLogs) {
    for (let ayah = log.startAyah; ayah <= log.endAyah; ayah++) {
      memorizedAyahs.add(`${log.surahId}:${ayah}`);
    }
  }

  const totalMemorized = memorizedAyahs.size;
  const progressPercentage = (totalMemorized / TOTAL_QURAN_AYAHS) * 100;

  // Calculate Juz completion
  const juzProgress: {
    juz: number;
    percentage: number;
    ayahsMemorized: number;
    totalAyahs: number;
  }[] = [];

  // Simplified Juz ayah counts (approximate)
  const juzAyahCounts: { [key: number]: number } = {
    1: 148,
    2: 111,
    3: 126,
    4: 131,
    5: 124,
    6: 110,
    7: 149,
    8: 142,
    9: 159,
    10: 127,
    11: 151,
    12: 170,
    13: 154,
    14: 227,
    15: 185,
    16: 269,
    17: 190,
    18: 202,
    19: 339,
    20: 171,
    21: 178,
    22: 169,
    23: 357,
    24: 175,
    25: 246,
    26: 195,
    27: 399,
    28: 137,
    29: 431,
    30: 564,
  };

  // Get memorized count per juz (simplified - would need proper juz-ayah mapping)
  for (let juz = 1; juz <= 30; juz++) {
    const totalAyahsInJuz = juzAyahCounts[juz] || 200;
    // This is simplified - in production, you'd have proper juz-ayah mapping
    const ayahsMemorized = Math.min(
      ziyadahLogs
        .filter((log) => {
          const surahJuz = log.surahId <= 2 ? 1 : Math.ceil(log.surahId / 4);
          return Math.abs(surahJuz - juz) <= 1;
        })
        .reduce((sum, log) => sum + (log.endAyah - log.startAyah + 1), 0) / 3,
      totalAyahsInJuz,
    );

    juzProgress.push({
      juz,
      percentage: (ayahsMemorized / totalAyahsInJuz) * 100,
      ayahsMemorized: Math.round(ayahsMemorized),
      totalAyahs: totalAyahsInJuz,
    });
  }

  // Get assessment scores
  const studentLogs = await db.query.memorizationLogs.findMany({
    where: eq(memorizationLogs.studentId, studentId),
  });

  const logIds = studentLogs.map((log) => log.id);

  let avgScores = {
    tajwid: 0,
    fashohah: 0,
    fluency: 0,
    total: 0,
    count: 0,
  };

  if (logIds.length > 0) {
    const studentAssessments = await db.query.assessments.findMany({
      where: inArray(assessments.logId, logIds),
    });

    if (studentAssessments.length > 0) {
      avgScores = {
        tajwid:
          studentAssessments.reduce((sum, a) => sum + a.tajwidScore, 0) /
          studentAssessments.length,
        fashohah:
          studentAssessments.reduce((sum, a) => sum + a.fashohahScore, 0) /
          studentAssessments.length,
        fluency:
          studentAssessments.reduce((sum, a) => sum + a.fluencyScore, 0) /
          studentAssessments.length,
        total:
          studentAssessments.reduce((sum, a) => sum + a.totalScore, 0) /
          studentAssessments.length,
        count: studentAssessments.length,
      };
    }
  }

  // Get recent activity
  const recentLogs = await db.query.memorizationLogs.findMany({
    where: eq(memorizationLogs.studentId, studentId),
    orderBy: (logs, { desc }) => [desc(logs.sessionDate)],
    limit: 10,
  });

  // Get surah progress
  const surahProgress = await db
    .select({
      surahId: memorizationLogs.surahId,
      totalAyahs: sql<number>`SUM(${memorizationLogs.endAyah} - ${memorizationLogs.startAyah} + 1)`,
      sessions: sql<number>`COUNT(*)`,
    })
    .from(memorizationLogs)
    .where(
      and(
        eq(memorizationLogs.studentId, studentId),
        eq(memorizationLogs.type, "ziyadah"),
      ),
    )
    .groupBy(memorizationLogs.surahId);

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
    const student = await db.query.users.findFirst({
      where: eq(users.id, studentId),
    });

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
    const records = await db.query.attendance.findMany({
      where: and(
        eq(attendance.studentId, studentId),
        gte(attendance.date, startDate),
        lte(attendance.date, endDate),
      ),
      orderBy: (att, { asc }) => [asc(att.date)],
    });

    // Build heatmap data
    interface HeatmapDay {
      date: string;
      sessions: {
        type: string;
        status: string;
      }[];
      presentCount: number;
      absentCount: number;
      totalSessions: number;
    }

    const heatmapData: { [date: string]: HeatmapDay } = {};

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
    const monthlySummary: {
      [month: string]: {
        present: number;
        absent: number;
        sick: number;
        leave: number;
        late: number;
        total: number;
        attendanceRate: number;
      };
    } = {};

    for (const record of records) {
      const month = record.date.substring(0, 7); // YYYY-MM

      if (!monthlySummary[month]) {
        monthlySummary[month] = {
          present: 0,
          absent: 0,
          sick: 0,
          leave: 0,
          late: 0,
          total: 0,
          attendanceRate: 0,
        };
      }

      monthlySummary[month][
        record.status as keyof (typeof monthlySummary)[typeof month]
      ]++;
      monthlySummary[month].total++;
    }

    // Calculate attendance rates
    for (const month of Object.keys(monthlySummary)) {
      const { present, late, total } = monthlySummary[month];
      monthlySummary[month].attendanceRate =
        total > 0 ? Math.round(((present + late) / total) * 10000) / 100 : 0;
    }

    // Session type breakdown
    const sessionTypeBreakdown = await db
      .select({
        sessionType: attendance.sessionType,
        status: attendance.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(attendance)
      .where(
        and(
          eq(attendance.studentId, studentId),
          gte(attendance.date, startDate),
          lte(attendance.date, endDate),
        ),
      )
      .groupBy(attendance.sessionType, attendance.status);

    // Overall stats
    const totalRecords = records.length;
    const presentCount = records.filter(
      (r) => r.status === "present" || r.status === "late",
    ).length;
    const overallAttendanceRate =
      totalRecords > 0
        ? Math.round((presentCount / totalRecords) * 10000) / 100
        : 0;

    return c.json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name,
        },
        period: {
          year,
          month: query.month || null,
          startDate,
          endDate,
        },
        overall: {
          totalSessions: totalRecords,
          presentCount,
          absentCount: records.filter((r) => r.status === "absent").length,
          sickCount: records.filter((r) => r.status === "sick").length,
          leaveCount: records.filter((r) => r.status === "leave").length,
          lateCount: records.filter((r) => r.status === "late").length,
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

  // Only teachers and admins can view class stats
  if (auth.user.role !== "admin" && auth.user.role !== "teacher") {
    throw new HTTPException(403, { message: "Access denied" });
  }

  // Get class attendance stats
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const attendanceStats = await db
    .select({
      status: attendance.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(attendance)
    .where(
      and(eq(attendance.classId, classId), gte(attendance.date, thirtyDaysAgo)),
    )
    .groupBy(attendance.status);

  // Get memorization activity
  const memorizationStats = await db
    .select({
      type: memorizationLogs.type,
      totalAyahs: sql<number>`SUM(${memorizationLogs.endAyah} - ${memorizationLogs.startAyah} + 1)`,
      sessions: sql<number>`COUNT(*)`,
    })
    .from(memorizationLogs)
    .where(eq(memorizationLogs.classId, classId))
    .groupBy(memorizationLogs.type);

  return c.json({
    success: true,
    data: {
      classId,
      period: {
        from: thirtyDaysAgo,
        to: today,
      },
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

  // Only teachers and admins can view leaderboard
  if (auth.user.role !== "admin" && auth.user.role !== "teacher") {
    throw new HTTPException(403, { message: "Access denied" });
  }

  let leaderboard: { studentId: string; studentName: string; value: number }[] =
    [];

  if (query.type === "ayahs") {
    // Top students by ayahs memorized
    const result = await db
      .select({
        studentId: memorizationLogs.studentId,
        totalAyahs: sql<number>`SUM(${memorizationLogs.endAyah} - ${memorizationLogs.startAyah} + 1)`,
      })
      .from(memorizationLogs)
      .where(eq(memorizationLogs.type, "ziyadah"))
      .groupBy(memorizationLogs.studentId)
      .orderBy(
        sql`SUM(${memorizationLogs.endAyah} - ${memorizationLogs.startAyah} + 1) DESC`,
      )
      .limit(query.limit);

    for (const row of result) {
      const student = await db.query.users.findFirst({
        where: eq(users.id, row.studentId),
        columns: { name: true },
      });
      leaderboard.push({
        studentId: row.studentId,
        studentName: student?.name || "Unknown",
        value: row.totalAyahs,
      });
    }
  } else if (query.type === "score") {
    // Top students by average score
    const result = await db
      .select({
        studentId: memorizationLogs.studentId,
        avgScore: sql<number>`AVG(${assessments.totalScore})`,
      })
      .from(assessments)
      .innerJoin(memorizationLogs, eq(assessments.logId, memorizationLogs.id))
      .groupBy(memorizationLogs.studentId)
      .orderBy(sql`AVG(${assessments.totalScore}) DESC`)
      .limit(query.limit);

    for (const row of result) {
      const student = await db.query.users.findFirst({
        where: eq(users.id, row.studentId),
        columns: { name: true },
      });
      leaderboard.push({
        studentId: row.studentId,
        studentName: student?.name || "Unknown",
        value: Math.round(row.avgScore * 100) / 100,
      });
    }
  } else {
    // Top students by attendance rate
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const result = await db
      .select({
        studentId: attendance.studentId,
        presentCount: sql<number>`SUM(CASE WHEN ${attendance.status} IN ('present', 'late') THEN 1 ELSE 0 END)`,
        totalCount: sql<number>`COUNT(*)`,
      })
      .from(attendance)
      .where(gte(attendance.date, thirtyDaysAgo))
      .groupBy(attendance.studentId)
      .orderBy(
        sql`SUM(CASE WHEN ${attendance.status} IN ('present', 'late') THEN 1 ELSE 0 END) * 1.0 / COUNT(*) DESC`,
      )
      .limit(query.limit);

    for (const row of result) {
      const student = await db.query.users.findFirst({
        where: eq(users.id, row.studentId),
        columns: { name: true },
      });
      const rate =
        row.totalCount > 0 ? (row.presentCount / row.totalCount) * 100 : 0;
      leaderboard.push({
        studentId: row.studentId,
        studentName: student?.name || "Unknown",
        value: Math.round(rate * 100) / 100,
      });
    }
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
