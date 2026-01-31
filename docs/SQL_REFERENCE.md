# 📐 Database Schema - SQL Reference

## Tahfidz Bootcamp - SQLite Schema

File ini berisi SQL DDL (Data Definition Language) untuk referensi struktur database.

---

## 🗃️ Create Tables

### Users

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'teacher', 'student', 'parent')),
    parent_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    phone TEXT,
    address TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_parent_id ON users(parent_id);
```

### Classes

```sql
CREATE TABLE classes (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    name TEXT NOT NULL,
    description TEXT,
    teacher_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    schedule TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);
```

### Class Members

```sql
CREATE TABLE class_members (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(class_id, student_id)
);

CREATE INDEX idx_class_members_class_id ON class_members(class_id);
CREATE INDEX idx_class_members_student_id ON class_members(student_id);
```

### Surahs

```sql
CREATE TABLE surahs (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    arabic_name TEXT NOT NULL,
    total_ayahs INTEGER NOT NULL,
    juz TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Attendance

```sql
CREATE TABLE attendance (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
    session_type TEXT NOT NULL CHECK (session_type IN ('subuh', 'ziyadah', 'murojaah', 'tahsin')),
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'sick', 'leave', 'late')),
    proof_url TEXT,
    notes TEXT,
    date TEXT NOT NULL,
    recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    synced_at TEXT,
    sync_source TEXT DEFAULT 'app' CHECK (sync_source IN ('app', 'web', 'gsheet')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_class_id ON attendance(class_id);
CREATE INDEX idx_attendance_session_type ON attendance(session_type);
```

### Memorization Logs

```sql
CREATE TABLE memorization_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('ziyadah', 'murojaah')),
    surah_id INTEGER NOT NULL REFERENCES surahs(id),
    start_ayah INTEGER NOT NULL,
    end_ayah INTEGER NOT NULL,
    teacher_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
    session_date TEXT NOT NULL,
    notes TEXT,
    synced_at TEXT,
    sync_source TEXT DEFAULT 'app' CHECK (sync_source IN ('app', 'web', 'gsheet')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (end_ayah >= start_ayah)
);

CREATE INDEX idx_memorization_logs_student_id ON memorization_logs(student_id);
CREATE INDEX idx_memorization_logs_session_date ON memorization_logs(session_date);
CREATE INDEX idx_memorization_logs_surah_id ON memorization_logs(surah_id);
CREATE INDEX idx_memorization_logs_type ON memorization_logs(type);
```

### Assessments

```sql
CREATE TABLE assessments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    log_id TEXT NOT NULL UNIQUE REFERENCES memorization_logs(id) ON DELETE CASCADE,
    tajwid_score REAL NOT NULL DEFAULT 0 CHECK (tajwid_score >= 0 AND tajwid_score <= 100),
    fashohah_score REAL NOT NULL DEFAULT 0 CHECK (fashohah_score >= 0 AND fashohah_score <= 100),
    fluency_score REAL NOT NULL DEFAULT 0 CHECK (fluency_score >= 0 AND fluency_score <= 100),
    total_score REAL NOT NULL DEFAULT 0,
    grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D', 'E')),
    notes TEXT,
    assessed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_assessments_log_id ON assessments(log_id);
CREATE INDEX idx_assessments_grade ON assessments(grade);
```

### Sync Logs

```sql
CREATE TABLE sync_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    payload TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    sync_error TEXT,
    synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sync_logs_status ON sync_logs(sync_status);
CREATE INDEX idx_sync_logs_table_record ON sync_logs(table_name, record_id);
```

### Exams (Ujian)

```sql
CREATE TABLE exams (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    name TEXT NOT NULL,
    description TEXT,
    exam_type TEXT NOT NULL CHECK (exam_type IN ('mid_semester', 'end_semester', 'monthly', 'weekly', 'placement')),
    class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
    surah_id INTEGER REFERENCES surahs(id),
    start_surah INTEGER,
    end_surah INTEGER,
    start_ayah INTEGER,
    end_ayah INTEGER,
    exam_date TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    semester TEXT NOT NULL CHECK (semester IN ('1', '2')),
    passing_score REAL NOT NULL DEFAULT 70,
    max_score REAL NOT NULL DEFAULT 100,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_exams_class_id ON exams(class_id);
CREATE INDEX idx_exams_exam_date ON exams(exam_date);
CREATE INDEX idx_exams_academic_year ON exams(academic_year, semester);
CREATE INDEX idx_exams_exam_type ON exams(exam_type);
```

### Exam Results (Hasil Ujian)

```sql
CREATE TABLE exam_results (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hafalan_score REAL NOT NULL DEFAULT 0 CHECK (hafalan_score >= 0 AND hafalan_score <= 100),
    tajwid_score REAL NOT NULL DEFAULT 0 CHECK (tajwid_score >= 0 AND tajwid_score <= 100),
    fashohah_score REAL NOT NULL DEFAULT 0 CHECK (fashohah_score >= 0 AND fashohah_score <= 100),
    fluency_score REAL NOT NULL DEFAULT 0 CHECK (fluency_score >= 0 AND fluency_score <= 100),
    makhorijul_huruf_score REAL CHECK (makhorijul_huruf_score >= 0 AND makhorijul_huruf_score <= 100),
    tartil_score REAL CHECK (tartil_score >= 0 AND tartil_score <= 100),
    total_score REAL NOT NULL DEFAULT 0,
    grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D', 'E')),
    is_passed INTEGER NOT NULL DEFAULT 0,
    rank INTEGER,
    examiner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    feedback TEXT,
    exam_taken_at TEXT DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(exam_id, student_id)
);

CREATE INDEX idx_exam_results_exam_id ON exam_results(exam_id);
CREATE INDEX idx_exam_results_student_id ON exam_results(student_id);
CREATE INDEX idx_exam_results_grade ON exam_results(grade);
CREATE INDEX idx_exam_results_rank ON exam_results(rank);
```

### Reports (Raport)

```sql
CREATE TABLE reports (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
    teacher_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    academic_year TEXT NOT NULL,
    semester TEXT NOT NULL CHECK (semester IN ('1', '2')),

    -- Attendance Summary
    total_sessions INTEGER DEFAULT 0,
    present_count INTEGER DEFAULT 0,
    absent_count INTEGER DEFAULT 0,
    sick_count INTEGER DEFAULT 0,
    leave_count INTEGER DEFAULT 0,
    late_count INTEGER DEFAULT 0,
    attendance_percentage REAL DEFAULT 0,

    -- Tahfidz Progress
    total_ayahs_memorized INTEGER DEFAULT 0,
    total_new_ayahs INTEGER DEFAULT 0,
    total_murojaah_sessions INTEGER DEFAULT 0,
    current_surah INTEGER REFERENCES surahs(id),
    current_ayah INTEGER,
    progress_percentage REAL DEFAULT 0,

    -- Daily Assessment Scores
    avg_tajwid_score REAL DEFAULT 0,
    avg_fashohah_score REAL DEFAULT 0,
    avg_fluency_score REAL DEFAULT 0,
    avg_total_score REAL DEFAULT 0,

    -- Exam Scores
    mid_semester_score REAL,
    end_semester_score REAL,
    final_score REAL DEFAULT 0,
    final_grade TEXT CHECK (final_grade IN ('A', 'B', 'C', 'D', 'E')),

    -- Ranking
    class_rank INTEGER,
    total_students INTEGER,

    -- Status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

    -- Notes
    teacher_notes TEXT,
    recommendations TEXT,
    target_ayahs INTEGER,

    -- Approval
    approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TEXT,
    published_at TEXT,

    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(student_id, academic_year, semester)
);

CREATE INDEX idx_reports_student_id ON reports(student_id);
CREATE INDEX idx_reports_class_id ON reports(class_id);
CREATE INDEX idx_reports_academic_year ON reports(academic_year, semester);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_class_rank ON reports(class_id, class_rank);
```

---

## 📊 Common Queries

### Get Student Progress

```sql
-- Total ayahs memorized by student
SELECT
    u.id,
    u.name,
    SUM(ml.end_ayah - ml.start_ayah + 1) as total_ayahs,
    ROUND(SUM(ml.end_ayah - ml.start_ayah + 1) * 100.0 / 6236, 2) as percentage
FROM users u
LEFT JOIN memorization_logs ml ON u.id = ml.student_id AND ml.type = 'ziyadah'
WHERE u.role = 'student'
GROUP BY u.id, u.name
ORDER BY total_ayahs DESC;
```

### Attendance Summary by Month

```sql
-- Monthly attendance for a student
SELECT
    strftime('%Y-%m', date) as month,
    COUNT(*) as total_sessions,
    SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) as present,
    SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
    SUM(CASE WHEN status = 'sick' THEN 1 ELSE 0 END) as sick,
    SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave,
    ROUND(SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as attendance_rate
FROM attendance
WHERE student_id = :student_id
GROUP BY strftime('%Y-%m', date)
ORDER BY month DESC;
```

### Average Scores by Student

```sql
-- Average assessment scores
SELECT
    u.id,
    u.name,
    ROUND(AVG(a.tajwid_score), 2) as avg_tajwid,
    ROUND(AVG(a.fashohah_score), 2) as avg_fashohah,
    ROUND(AVG(a.fluency_score), 2) as avg_fluency,
    ROUND(AVG(a.total_score), 2) as avg_total,
    COUNT(*) as total_assessments
FROM users u
JOIN memorization_logs ml ON u.id = ml.student_id
JOIN assessments a ON ml.id = a.log_id
WHERE u.role = 'student'
GROUP BY u.id, u.name
ORDER BY avg_total DESC;
```

### Get Parent's Children

```sql
-- Get all children of a parent
SELECT
    c.id,
    c.name,
    c.email,
    (SELECT COUNT(*) FROM memorization_logs WHERE student_id = c.id AND type = 'ziyadah') as total_hafalan,
    (SELECT COUNT(*) FROM attendance WHERE student_id = c.id AND status = 'present') as total_hadir
FROM users c
WHERE c.parent_id = :parent_id AND c.role = 'student';
```

### Surah Progress

```sql
-- Get memorization progress per surah
SELECT
    s.id,
    s.name,
    s.arabic_name,
    s.total_ayahs,
    COALESCE(SUM(ml.end_ayah - ml.start_ayah + 1), 0) as memorized_ayahs,
    ROUND(COALESCE(SUM(ml.end_ayah - ml.start_ayah + 1), 0) * 100.0 / s.total_ayahs, 2) as percentage
FROM surahs s
LEFT JOIN memorization_logs ml ON s.id = ml.surah_id
    AND ml.student_id = :student_id
    AND ml.type = 'ziyadah'
GROUP BY s.id, s.name, s.arabic_name, s.total_ayahs
ORDER BY s.id;
```

### Leaderboard

```sql
-- Top 10 students by total ayahs memorized
SELECT
    u.id,
    u.name,
    SUM(ml.end_ayah - ml.start_ayah + 1) as total_ayahs
FROM users u
JOIN memorization_logs ml ON u.id = ml.student_id
WHERE ml.type = 'ziyadah'
GROUP BY u.id, u.name
ORDER BY total_ayahs DESC
LIMIT 10;
```

### Class Statistics

```sql
-- Get class statistics
SELECT
    c.id,
    c.name,
    (SELECT name FROM users WHERE id = c.teacher_id) as teacher_name,
    (SELECT COUNT(*) FROM class_members WHERE class_id = c.id) as total_students,
    (SELECT COUNT(*) FROM attendance WHERE class_id = c.id AND date = date('now')) as today_attendance
FROM classes c
WHERE c.is_active = 1;
```

### Exam Results with Ranking

```sql
-- Get exam results with ranking
SELECT
    er.id,
    er.student_id,
    u.name as student_name,
    er.hafalan_score,
    er.tajwid_score,
    er.fashohah_score,
    er.fluency_score,
    er.total_score,
    er.grade,
    er.is_passed,
    RANK() OVER (ORDER BY er.total_score DESC) as rank
FROM exam_results er
JOIN users u ON er.student_id = u.id
WHERE er.exam_id = :exam_id
ORDER BY er.total_score DESC;
```

### Student Exam History

```sql
-- Get all exams and scores for a student
SELECT
    e.id as exam_id,
    e.name as exam_name,
    e.exam_type,
    e.exam_date,
    e.academic_year,
    e.semester,
    er.total_score,
    er.grade,
    er.is_passed,
    er.rank
FROM exams e
JOIN exam_results er ON e.id = er.exam_id
WHERE er.student_id = :student_id
ORDER BY e.exam_date DESC;
```

### Generate Report Data

```sql
-- Get data for report generation
SELECT
    u.id as student_id,
    u.name as student_name,

    -- Attendance
    (SELECT COUNT(*) FROM attendance WHERE student_id = u.id
        AND strftime('%Y', date) || '/' || (CAST(strftime('%Y', date) AS INTEGER) + 1) = :academic_year
        AND CASE WHEN :semester = '1' THEN strftime('%m', date) BETWEEN '07' AND '12'
                 ELSE strftime('%m', date) BETWEEN '01' AND '06' END) as total_sessions,
    (SELECT COUNT(*) FROM attendance WHERE student_id = u.id AND status = 'present'
        AND strftime('%Y', date) || '/' || (CAST(strftime('%Y', date) AS INTEGER) + 1) = :academic_year) as present_count,

    -- Tahfidz Progress
    (SELECT COALESCE(SUM(end_ayah - start_ayah + 1), 0) FROM memorization_logs
        WHERE student_id = u.id AND type = 'ziyadah') as total_ayahs,

    -- Assessment Scores
    (SELECT ROUND(AVG(a.tajwid_score), 2) FROM assessments a
        JOIN memorization_logs ml ON a.log_id = ml.id
        WHERE ml.student_id = u.id) as avg_tajwid,
    (SELECT ROUND(AVG(a.fashohah_score), 2) FROM assessments a
        JOIN memorization_logs ml ON a.log_id = ml.id
        WHERE ml.student_id = u.id) as avg_fashohah,
    (SELECT ROUND(AVG(a.fluency_score), 2) FROM assessments a
        JOIN memorization_logs ml ON a.log_id = ml.id
        WHERE ml.student_id = u.id) as avg_fluency,

    -- Exam Scores
    (SELECT total_score FROM exam_results er
        JOIN exams e ON er.exam_id = e.id
        WHERE er.student_id = u.id AND e.exam_type = 'mid_semester'
        AND e.academic_year = :academic_year AND e.semester = :semester) as mid_semester_score,
    (SELECT total_score FROM exam_results er
        JOIN exams e ON er.exam_id = e.id
        WHERE er.student_id = u.id AND e.exam_type = 'end_semester'
        AND e.academic_year = :academic_year AND e.semester = :semester) as end_semester_score

FROM users u
WHERE u.role = 'student' AND u.is_active = 1;
```

### Report Summary by Class

```sql
-- Get published reports summary by class
SELECT
    c.id as class_id,
    c.name as class_name,
    COUNT(r.id) as total_reports,
    SUM(CASE WHEN r.status = 'draft' THEN 1 ELSE 0 END) as draft_count,
    SUM(CASE WHEN r.status = 'published' THEN 1 ELSE 0 END) as published_count,
    ROUND(AVG(r.final_score), 2) as avg_final_score,
    ROUND(AVG(r.attendance_percentage), 2) as avg_attendance
FROM classes c
LEFT JOIN reports r ON c.id = r.class_id
WHERE r.academic_year = :academic_year AND r.semester = :semester
GROUP BY c.id, c.name;
```

---

## 🔄 Triggers (Optional)

### Auto-update updated_at

```sql
-- Trigger for auto-updating updated_at
CREATE TRIGGER update_users_timestamp
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_classes_timestamp
AFTER UPDATE ON classes
BEGIN
    UPDATE classes SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_attendance_timestamp
AFTER UPDATE ON attendance
BEGIN
    UPDATE attendance SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_memorization_logs_timestamp
AFTER UPDATE ON memorization_logs
BEGIN
    UPDATE memorization_logs SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_assessments_timestamp
AFTER UPDATE ON assessments
BEGIN
    UPDATE assessments SET updated_at = datetime('now') WHERE id = NEW.id;
END;
```

### Auto-calculate Assessment Total Score

```sql
-- Trigger for auto-calculating total_score and grade
CREATE TRIGGER calculate_assessment_score
BEFORE INSERT ON assessments
BEGIN
    SELECT RAISE(ABORT, 'Scores must be calculated')
    WHERE NEW.total_score != (NEW.tajwid_score + NEW.fashohah_score + NEW.fluency_score) / 3.0;
END;
```

---

## 🧹 Maintenance Queries

### Cleanup Old Sync Logs

```sql
-- Delete sync logs older than 30 days
DELETE FROM sync_logs
WHERE created_at < datetime('now', '-30 days')
  AND sync_status = 'synced';
```

### Vacuum Database

```sql
-- Optimize database size
VACUUM;
```

### Check Database Integrity

```sql
-- Check foreign key constraints
PRAGMA foreign_key_check;

-- Check database integrity
PRAGMA integrity_check;
```

---

_SQL Reference untuk Tahfidz Bootcamp API v1.1.0_
