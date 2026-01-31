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

_SQL Reference untuk Tahfidz Bootcamp API v1.0.0_
