# 📚 Database Documentation

## Tahfidz Bootcamp - Relational Database Schema

Dokumentasi lengkap untuk struktur database aplikasi Tahfidz Bootcamp.

---

## 📊 Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ USERS : "parent_of"
    USERS ||--o{ CLASSES : "teaches"
    USERS ||--o{ CLASS_MEMBERS : "enrolled_in"
    USERS ||--o{ ATTENDANCE : "has"
    USERS ||--o{ MEMORIZATION_LOGS : "records"
    USERS ||--o{ ASSESSMENTS : "assesses"
    USERS ||--o{ EXAMS : "creates"
    USERS ||--o{ EXAM_RESULTS : "takes"
    USERS ||--o{ REPORTS : "has"

    CLASSES ||--o{ CLASS_MEMBERS : "has"
    CLASSES ||--o{ ATTENDANCE : "for"
    CLASSES ||--o{ MEMORIZATION_LOGS : "in"
    CLASSES ||--o{ EXAMS : "has"
    CLASSES ||--o{ REPORTS : "generates"

    SURAHS ||--o{ MEMORIZATION_LOGS : "referenced_by"
    SURAHS ||--o{ EXAMS : "covers"

    MEMORIZATION_LOGS ||--o| ASSESSMENTS : "has"

    EXAMS ||--o{ EXAM_RESULTS : "has"

    SYNC_LOGS }o--|| USERS : "tracks"

    USERS {
        uuid id PK
        string name
        string email UK
        string password
        enum role "admin|teacher|student|parent"
        uuid parent_id FK
        string phone
        string address
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    CLASSES {
        uuid id PK
        string name
        string description
        uuid teacher_id FK
        json schedule
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    CLASS_MEMBERS {
        uuid id PK
        uuid class_id FK
        uuid student_id FK
        datetime enrolled_at
        datetime created_at
        datetime updated_at
    }

    SURAHS {
        int id PK "1-114"
        string name
        string arabic_name
        int total_ayahs
        json juz
        datetime created_at
        datetime updated_at
    }

    ATTENDANCE {
        uuid id PK
        uuid student_id FK
        uuid class_id FK
        enum session_type "subuh|ziyadah|murojaah|tahsin"
        enum status "present|absent|sick|leave|late"
        string proof_url
        string notes
        date date
        uuid recorded_by FK
        datetime synced_at
        enum sync_source "app|web|gsheet"
        datetime created_at
        datetime updated_at
    }

    MEMORIZATION_LOGS {
        uuid id PK
        uuid student_id FK
        enum type "ziyadah|murojaah"
        int surah_id FK
        int start_ayah
        int end_ayah
        uuid teacher_id FK
        uuid class_id FK
        date session_date
        string notes
        datetime synced_at
        enum sync_source "app|web|gsheet"
        datetime created_at
        datetime updated_at
    }

    ASSESSMENTS {
        uuid id PK
        uuid log_id FK UK
        float tajwid_score "0-100"
        float fashohah_score "0-100"
        float fluency_score "0-100"
        float total_score
        enum grade "A|B|C|D|E"
        string notes
        uuid assessed_by FK
        datetime created_at
        datetime updated_at
    }

    EXAMS {
        uuid id PK
        string name
        string description
        enum exam_type "mid_semester|end_semester|monthly|weekly|placement"
        uuid class_id FK
        int surah_id FK
        int start_surah FK
        int end_surah FK
        date exam_date
        string academic_year
        enum semester "1|2"
        float passing_score
        float max_score
        uuid created_by FK
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    EXAM_RESULTS {
        uuid id PK
        uuid exam_id FK
        uuid student_id FK
        float hafalan_score
        float tajwid_score
        float fashohah_score
        float fluency_score
        float makhorijul_huruf_score
        float tartil_score
        float total_score
        enum grade "A|B|C|D|E"
        boolean is_passed
        int rank
        uuid examiner_id FK
        string feedback
        datetime exam_taken_at
        datetime created_at
        datetime updated_at
    }

    REPORTS {
        uuid id PK
        uuid student_id FK
        uuid class_id FK
        string academic_year
        enum semester "1|2"
        int total_sessions
        int present_count
        float attendance_percentage
        int total_ayahs_memorized
        float avg_tajwid_score
        float avg_fashohah_score
        float avg_fluency_score
        float mid_semester_score
        float end_semester_score
        float final_score
        enum final_grade "A|B|C|D|E"
        int class_rank
        enum status "draft|published|archived"
        uuid approved_by FK
        datetime published_at
        datetime created_at
        datetime updated_at
    }

    SYNC_LOGS {
        uuid id PK
        string table_name
        uuid record_id
        enum action "create|update|delete"
        json payload
        enum sync_status "pending|synced|failed"
        string sync_error
        datetime synced_at
        datetime created_at
    }
```

---

## 🗂️ Daftar Tabel

| No  | Tabel               | Deskripsi                                 | Jumlah Kolom |
| --- | ------------------- | ----------------------------------------- | ------------ |
| 1   | `users`             | Data pengguna (Admin, Guru, Santri, Wali) | 11           |
| 2   | `classes`           | Data kelas/halaqah                        | 7            |
| 3   | `class_members`     | Relasi santri-kelas                       | 5            |
| 4   | `surahs`            | Data referensi 114 surah Al-Quran         | 6            |
| 5   | `attendance`        | Catatan kehadiran                         | 13           |
| 6   | `memorization_logs` | Catatan hafalan (ziyadah/murojaah)        | 14           |
| 7   | `assessments`       | Penilaian hafalan harian                  | 11           |
| 8   | `exams`             | Data ujian tahfidz                        | 17           |
| 9   | `exam_results`      | Hasil ujian per santri                    | 18           |
| 10  | `reports`           | Raport semester santri                    | 28           |
| 11  | `sync_logs`         | Log sinkronisasi dengan Google Sheets     | 9            |

---

## 📋 Detail Tabel

### 1. Users (Pengguna)

Menyimpan data semua pengguna aplikasi.

| Kolom        | Tipe     | Constraint                  | Deskripsi                              |
| ------------ | -------- | --------------------------- | -------------------------------------- |
| `id`         | UUID     | PK                          | ID unik pengguna                       |
| `name`       | TEXT     | NOT NULL                    | Nama lengkap                           |
| `email`      | TEXT     | NOT NULL, UNIQUE            | Email untuk login                      |
| `password`   | TEXT     | NOT NULL                    | Password (bcrypt hash)                 |
| `role`       | ENUM     | NOT NULL, DEFAULT 'student' | Peran: admin, teacher, student, parent |
| `parent_id`  | UUID     | FK → users.id               | ID orang tua (self-reference)          |
| `phone`      | TEXT     | NULLABLE                    | Nomor telepon                          |
| `address`    | TEXT     | NULLABLE                    | Alamat                                 |
| `is_active`  | BOOLEAN  | DEFAULT true                | Status aktif akun                      |
| `created_at` | DATETIME | DEFAULT now()               | Waktu dibuat                           |
| `updated_at` | DATETIME | DEFAULT now()               | Waktu diperbarui                       |

**Relasi:**

- Self-reference: `parent_id` → `users.id` (Wali ke Santri)
- One-to-Many: Satu user bisa mengajar banyak kelas
- One-to-Many: Satu user bisa terdaftar di banyak kelas

---

### 2. Classes (Kelas/Halaqah)

Menyimpan data kelas atau halaqah tahfidz.

| Kolom         | Tipe     | Constraint    | Deskripsi            |
| ------------- | -------- | ------------- | -------------------- |
| `id`          | UUID     | PK            | ID unik kelas        |
| `name`        | TEXT     | NOT NULL      | Nama kelas           |
| `description` | TEXT     | NULLABLE      | Deskripsi kelas      |
| `teacher_id`  | UUID     | FK → users.id | ID guru pengajar     |
| `schedule`    | TEXT     | NULLABLE      | Jadwal (JSON string) |
| `is_active`   | BOOLEAN  | DEFAULT true  | Status aktif kelas   |
| `created_at`  | DATETIME | DEFAULT now() | Waktu dibuat         |
| `updated_at`  | DATETIME | DEFAULT now() | Waktu diperbarui     |

**Relasi:**

- Many-to-One: Banyak kelas bisa diajar satu guru
- One-to-Many: Satu kelas bisa memiliki banyak anggota

---

### 3. Class Members (Anggota Kelas)

Tabel penghubung antara santri dan kelas (Many-to-Many).

| Kolom         | Tipe     | Constraint                | Deskripsi         |
| ------------- | -------- | ------------------------- | ----------------- |
| `id`          | UUID     | PK                        | ID unik           |
| `class_id`    | UUID     | FK → classes.id, NOT NULL | ID kelas          |
| `student_id`  | UUID     | FK → users.id, NOT NULL   | ID santri         |
| `enrolled_at` | DATETIME | DEFAULT now()             | Waktu pendaftaran |
| `created_at`  | DATETIME | DEFAULT now()             | Waktu dibuat      |
| `updated_at`  | DATETIME | DEFAULT now()             | Waktu diperbarui  |

**Relasi:**

- Many-to-One: Ke `classes`
- Many-to-One: Ke `users` (student)

---

### 4. Surahs (Surah Al-Quran)

Data referensi 114 surah dalam Al-Quran.

| Kolom         | Tipe     | Constraint    | Deskripsi               |
| ------------- | -------- | ------------- | ----------------------- |
| `id`          | INTEGER  | PK (1-114)    | Nomor surah             |
| `name`        | TEXT     | NOT NULL      | Nama surah (Latin)      |
| `arabic_name` | TEXT     | NOT NULL      | Nama surah (Arab)       |
| `total_ayahs` | INTEGER  | NOT NULL      | Jumlah ayat             |
| `juz`         | TEXT     | NULLABLE      | Daftar juz (JSON array) |
| `created_at`  | DATETIME | DEFAULT now() | Waktu dibuat            |
| `updated_at`  | DATETIME | DEFAULT now() | Waktu diperbarui        |

**Catatan:** Tabel ini adalah data referensi statis, diisi saat seeding.

---

### 5. Attendance (Kehadiran)

Menyimpan catatan kehadiran santri.

| Kolom          | Tipe     | Constraint              | Deskripsi                                    |
| -------------- | -------- | ----------------------- | -------------------------------------------- |
| `id`           | UUID     | PK                      | ID unik (untuk offline sync)                 |
| `student_id`   | UUID     | FK → users.id, NOT NULL | ID santri                                    |
| `class_id`     | UUID     | FK → classes.id         | ID kelas                                     |
| `session_type` | ENUM     | NOT NULL                | Jenis sesi: subuh, ziyadah, murojaah, tahsin |
| `status`       | ENUM     | NOT NULL                | Status: present, absent, sick, leave, late   |
| `proof_url`    | TEXT     | NULLABLE                | URL bukti (untuk sakit/izin)                 |
| `notes`        | TEXT     | NULLABLE                | Catatan tambahan                             |
| `date`         | TEXT     | NOT NULL                | Tanggal (YYYY-MM-DD)                         |
| `recorded_by`  | UUID     | FK → users.id           | ID pencatat                                  |
| `synced_at`    | DATETIME | NULLABLE                | Waktu sinkronisasi                           |
| `sync_source`  | ENUM     | DEFAULT 'app'           | Sumber: app, web, gsheet                     |
| `created_at`   | DATETIME | DEFAULT now()           | Waktu dibuat                                 |
| `updated_at`   | DATETIME | DEFAULT now()           | Waktu diperbarui                             |

**Relasi:**

- Many-to-One: Ke `users` (student)
- Many-to-One: Ke `classes`
- Many-to-One: Ke `users` (recorded_by)

---

### 6. Memorization Logs (Catatan Hafalan)

Menyimpan catatan hafalan santri (ziyadah/murojaah).

| Kolom          | Tipe     | Constraint               | Deskripsi                                           |
| -------------- | -------- | ------------------------ | --------------------------------------------------- |
| `id`           | UUID     | PK                       | ID unik (untuk offline sync)                        |
| `student_id`   | UUID     | FK → users.id, NOT NULL  | ID santri                                           |
| `type`         | ENUM     | NOT NULL                 | Jenis: ziyadah (hafalan baru), murojaah (muraja'ah) |
| `surah_id`     | INTEGER  | FK → surahs.id, NOT NULL | ID surah                                            |
| `start_ayah`   | INTEGER  | NOT NULL                 | Ayat awal                                           |
| `end_ayah`     | INTEGER  | NOT NULL                 | Ayat akhir                                          |
| `teacher_id`   | UUID     | FK → users.id            | ID guru penguji                                     |
| `class_id`     | UUID     | FK → classes.id          | ID kelas                                            |
| `session_date` | TEXT     | NOT NULL                 | Tanggal sesi (YYYY-MM-DD)                           |
| `notes`        | TEXT     | NULLABLE                 | Catatan                                             |
| `synced_at`    | DATETIME | NULLABLE                 | Waktu sinkronisasi                                  |
| `sync_source`  | ENUM     | DEFAULT 'app'            | Sumber data                                         |
| `created_at`   | DATETIME | DEFAULT now()            | Waktu dibuat                                        |
| `updated_at`   | DATETIME | DEFAULT now()            | Waktu diperbarui                                    |

**Relasi:**

- Many-to-One: Ke `users` (student)
- Many-to-One: Ke `users` (teacher)
- Many-to-One: Ke `surahs`
- Many-to-One: Ke `classes`
- One-to-One: Ke `assessments`

---

### 7. Assessments (Penilaian)

Menyimpan penilaian untuk setiap catatan hafalan.

| Kolom            | Tipe     | Constraint                                  | Deskripsi               |
| ---------------- | -------- | ------------------------------------------- | ----------------------- |
| `id`             | UUID     | PK                                          | ID unik                 |
| `log_id`         | UUID     | FK → memorization_logs.id, NOT NULL, UNIQUE | ID catatan hafalan      |
| `tajwid_score`   | REAL     | NOT NULL, DEFAULT 0                         | Skor tajwid (0-100)     |
| `fashohah_score` | REAL     | NOT NULL, DEFAULT 0                         | Skor fashohah (0-100)   |
| `fluency_score`  | REAL     | NOT NULL, DEFAULT 0                         | Skor kelancaran (0-100) |
| `total_score`    | REAL     | NOT NULL, DEFAULT 0                         | Rata-rata skor          |
| `grade`          | ENUM     | NULLABLE                                    | Nilai: A, B, C, D, E    |
| `notes`          | TEXT     | NULLABLE                                    | Catatan penilai         |
| `assessed_by`    | UUID     | FK → users.id                               | ID penilai              |
| `created_at`     | DATETIME | DEFAULT now()                               | Waktu dibuat            |
| `updated_at`     | DATETIME | DEFAULT now()                               | Waktu diperbarui        |

**Relasi:**

- One-to-One: Ke `memorization_logs` (cascade delete)
- Many-to-One: Ke `users` (assessed_by)

**Rumus Grade:**
| Skor | Grade |
|------|-------|
| ≥ 90 | A |
| ≥ 80 | B |
| ≥ 70 | C |
| ≥ 60 | D |
| < 60 | E |

---

### 8. Sync Logs (Log Sinkronisasi)

Menyimpan log sinkronisasi dengan Google Sheets.

| Kolom         | Tipe     | Constraint        | Deskripsi                       |
| ------------- | -------- | ----------------- | ------------------------------- |
| `id`          | UUID     | PK                | ID unik                         |
| `table_name`  | TEXT     | NOT NULL          | Nama tabel yang disinkronkan    |
| `record_id`   | UUID     | NOT NULL          | ID record yang disinkronkan     |
| `action`      | ENUM     | NOT NULL          | Aksi: create, update, delete    |
| `payload`     | TEXT     | NULLABLE          | Data JSON                       |
| `sync_status` | ENUM     | DEFAULT 'pending' | Status: pending, synced, failed |
| `sync_error`  | TEXT     | NULLABLE          | Pesan error jika gagal          |
| `synced_at`   | DATETIME | NULLABLE          | Waktu sinkronisasi berhasil     |
| `created_at`  | DATETIME | DEFAULT now()     | Waktu dibuat                    |

---

## 🔗 Diagram Relasi

```
┌─────────────────────────────────────────────────────────────────┐
│                           USERS                                  │
│  (Admin, Teacher, Student, Parent)                              │
├─────────────────────────────────────────────────────────────────┤
│                              │                                   │
│         ┌────────────────────┼────────────────────┐              │
│         │                    │                    │              │
│         ▼                    ▼                    ▼              │
│    ┌─────────┐         ┌──────────┐        ┌───────────┐        │
│    │ CLASSES │◄────────│  CLASS   │────────►│ATTENDANCE │        │
│    │         │         │ MEMBERS  │         │           │        │
│    └────┬────┘         └──────────┘         └───────────┘        │
│         │                                                        │
│         │                    ┌──────────────────┐               │
│         │                    │ MEMORIZATION_LOGS│               │
│         └────────────────────►                  │◄───┐          │
│                              │                  │    │          │
│                              └────────┬─────────┘    │          │
│                                       │              │          │
│                                       ▼              │          │
│                              ┌──────────────┐        │          │
│                              │ ASSESSMENTS  │        │          │
│                              └──────────────┘        │          │
│                                                      │          │
│                              ┌──────────────┐        │          │
│                              │   SURAHS     │────────┘          │
│                              │  (1-114)     │                   │
│                              └──────────────┘                   │
│                                                                  │
│                              ┌──────────────┐                   │
│                              │  SYNC_LOGS   │                   │
│                              └──────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Jenis Relasi

| Dari                | Ke                  | Tipe     | Deskripsi                                |
| ------------------- | ------------------- | -------- | ---------------------------------------- |
| `users`             | `users`             | Self 1:N | Wali memiliki banyak anak (santri)       |
| `users`             | `classes`           | 1:N      | Guru mengajar banyak kelas               |
| `users`             | `class_members`     | 1:N      | Santri terdaftar di banyak kelas         |
| `classes`           | `class_members`     | 1:N      | Kelas memiliki banyak anggota            |
| `users`             | `attendance`        | 1:N      | Santri memiliki banyak catatan kehadiran |
| `classes`           | `attendance`        | 1:N      | Kelas memiliki banyak catatan kehadiran  |
| `users`             | `memorization_logs` | 1:N      | Santri memiliki banyak catatan hafalan   |
| `surahs`            | `memorization_logs` | 1:N      | Surah direferensi oleh banyak log        |
| `memorization_logs` | `assessments`       | 1:1      | Setiap log memiliki satu penilaian       |

---

## 🎯 Indeks yang Direkomendasikan

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_parent_id ON users(parent_id);

-- Classes
CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);

-- Class Members
CREATE INDEX idx_class_members_class_id ON class_members(class_id);
CREATE INDEX idx_class_members_student_id ON class_members(student_id);

-- Attendance
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_class_id ON attendance(class_id);

-- Memorization Logs
CREATE INDEX idx_memorization_logs_student_id ON memorization_logs(student_id);
CREATE INDEX idx_memorization_logs_session_date ON memorization_logs(session_date);
CREATE INDEX idx_memorization_logs_surah_id ON memorization_logs(surah_id);

-- Assessments
CREATE INDEX idx_assessments_log_id ON assessments(log_id);

-- Sync Logs
CREATE INDEX idx_sync_logs_status ON sync_logs(sync_status);
CREATE INDEX idx_sync_logs_table_record ON sync_logs(table_name, record_id);
```

---

## 📱 Offline Sync Strategy

### UUID-based Sync

Semua primary key menggunakan **UUID** untuk mendukung sinkronisasi offline:

1. **Client-side UUID Generation**: Aplikasi mobile/web generate UUID lokal
2. **Bulk Sync**: Kirim batch data saat online
3. **Upsert Logic**: Server menggunakan `ON CONFLICT` untuk update jika ada

### Sync Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Mobile     │────►│   Backend    │────►│ Google Sheet │
│  (Dexie/     │◄────│   (SQLite)   │◄────│    (GAS)     │
│   SQLite)    │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
      │                     │                    │
      │  Generate UUID      │  Store & Sync      │  Mirror Data
      │  Store Offline      │  Process Queue     │  Webhook Back
      │  Batch Sync         │                    │
```

---

## 📊 Statistik Data (Contoh)

| Tabel               | Estimasi Record | Growth Rate  |
| ------------------- | --------------- | ------------ |
| `users`             | 500             | +50/tahun    |
| `classes`           | 20              | +5/tahun     |
| `class_members`     | 400             | +50/tahun    |
| `surahs`            | 114             | Static       |
| `attendance`        | 50,000          | +100/hari    |
| `memorization_logs` | 30,000          | +50/hari     |
| `assessments`       | 30,000          | +50/hari     |
| `sync_logs`         | 100,000         | Auto-cleanup |

---

## 🔒 Security Considerations

1. **Password Hashing**: bcrypt dengan salt rounds = 12
2. **UUID**: Mencegah enumeration attack
3. **RBAC**: Role-based access di middleware
4. **Data Ownership**: Parent hanya akses data anaknya
5. **API Key**: Untuk webhook GAS

---

_Dokumentasi ini dihasilkan untuk Tahfidz Bootcamp API v1.0.0_
