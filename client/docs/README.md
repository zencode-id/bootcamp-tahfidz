# 📚 Dokumentasi Tahfidz Bootcamp API

Selamat datang di dokumentasi lengkap untuk Tahfidz Bootcamp API.

---

## 📁 Struktur Dokumentasi

| File                                   | Deskripsi                                                  |
| -------------------------------------- | ---------------------------------------------------------- |
| [DATABASE.md](./DATABASE.md)           | Dokumentasi database relasional, ERD, dan penjelasan tabel |
| [SQL_REFERENCE.md](./SQL_REFERENCE.md) | Referensi SQL DDL, indeks, dan query umum                  |
| [API.md](./API.md)                     | Dokumentasi lengkap REST API endpoints                     |

---

## 🗺️ Entity Relationship Diagram (Preview)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│    ┌──────────┐         ┌──────────────┐         ┌──────────┐   │
│    │  USERS   │◄───────►│ CLASS_MEMBERS│◄────────►│ CLASSES  │   │
│    │          │         └──────────────┘          │          │   │
│    │  Admin   │                                   │ Halaqah  │   │
│    │  Teacher │◄──────────────────────────────────┤          │   │
│    │  Student │                                   └────┬─────┘   │
│    │  Parent  │                                        │         │
│    └────┬─────┘                                        │         │
│         │                                              │         │
│         │  ┌───────────────┐                          │         │
│         ├──►  ATTENDANCE   │◄─────────────────────────┘         │
│         │  │               │                                     │
│         │  │ Subuh/Ziyadah │                                     │
│         │  │ Murojaah/     │                                     │
│         │  │ Tahsin        │                                     │
│         │  └───────────────┘                                     │
│         │                                                        │
│         │  ┌────────────────────┐        ┌──────────────┐       │
│         ├──►  MEMORIZATION_LOGS │───────►│  ASSESSMENTS │       │
│         │  │                    │        │              │       │
│         │  │  Ziyadah/Murojaah  │        │ Tajwid       │       │
│         │  │  Surah + Ayat      │        │ Fashohah     │       │
│         │  └────────┬───────────┘        │ Fluency      │       │
│         │           │                    └──────────────┘       │
│         │           ▼                                            │
│         │  ┌──────────────┐                                     │
│         │  │    SURAHS    │                                     │
│         │  │   (1-114)    │                                     │
│         │  │  Al-Quran    │                                     │
│         │  └──────────────┘                                     │
│         │                                                        │
│         │  ┌──────────────┐        ┌───────────────┐            │
│         ├──►    EXAMS     │───────►│ EXAM_RESULTS  │            │
│         │  │              │        │               │            │
│         │  │ UTS/UAS      │        │ Nilai Ujian   │            │
│         │  │ Bulanan      │        │ Grade/Rank    │            │
│         │  └──────────────┘        └───────────────┘            │
│         │                                                        │
│         │  ┌────────────────────────────────────────┐           │
│         └──►           REPORTS (RAPORT)             │           │
│            │                                        │           │
│            │  Kehadiran + Hafalan + Nilai + Ranking │           │
│            │  Auto-generate + Publish Workflow      │           │
│            └────────────────────────────────────────┘           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Role-Based Access Control (RBAC)

| Role        | Akses                                              |
| ----------- | -------------------------------------------------- |
| **Admin**   | Full access ke semua resource                      |
| **Teacher** | Kelola kehadiran, hafalan, ujian & raport kelasnya |
| **Parent**  | Lihat data anak-anaknya (termasuk raport)          |
| **Student** | Lihat data diri sendiri (termasuk raport)          |

---

## 📊 Statistik Database

| Tabel               | Deskripsi            | Estimasi Data |
| ------------------- | -------------------- | ------------- |
| `users`             | Pengguna sistem      | 500+          |
| `otp_codes`         | Kode verifikasi OTP  | Temp          |
| `classes`           | Kelas/Halaqah        | 20+           |
| `class_members`     | Relasi santri-kelas  | +500          |
| `student_profiles`  | Profil detail santri | +400          |
| `teacher_profiles`  | Profil detail guru   | +20           |
| `class_transfers`   | Perpindahan kelas    | +50/semester  |
| `surahs`            | Surah Al-Quran       | 114 (static)  |
| `attendance`        | Kehadiran            | +100/hari     |
| `memorization_logs` | Catatan hafalan      | +50/hari      |
| `assessments`       | Penilaian harian     | +50/hari      |
| `exams`             | Ujian tahfidz        | +10/semester  |
| `exam_results`      | Hasil ujian          | +500/semester |
| `reports`           | Raport santri        | +500/semester |
| `sync_logs`         | Log sinkronisasi     | +100/hari     |

---

## 🚀 Quick Links

- **Base URL**: `http://localhost:3000`
- **Health Check**: `GET /health`
- **API Info**: `GET /`

### Endpoint Utama

| Endpoint   | Deskripsi                        |
| ---------- | -------------------------------- |
| `/auth`    | Authentication & User Management |
| `/classes` | Manajemen Kelas                  |
| `/sync`    | Attendance & Tahfidz Sync        |
| `/exams`   | Manajemen Ujian & Hasil          |
| `/reports` | Manajemen Raport                 |
| `/stats`   | Statistics & Leaderboard         |
| `/webhook` | Google Sheets Integration        |

---

## 📝 Changelog

### v1.2.0 (2026-02-07)

- ✅ **Auth Flow**: Login langsung tanpa OTP
- ✅ **OTP Verification**: Untuk registrasi dan lupa password
- ✅ **New Endpoints**: verify-registration, forgot-password, reset-password
- ✅ **Class Stats**: Statistik kelas (kehadiran & hafalan)
- ✅ **New Tables**: otp_codes, student_profiles, teacher_profiles, class_transfers
- ✅ **Postman Collection**: 48+ request dengan auth flow baru

### v1.1.0 (2026-01-31)

- ✅ **Exams (Ujian)**: CRUD ujian, input hasil, ranking otomatis
- ✅ **Reports (Raport)**: Auto-generate dari data, publish workflow
- ✅ **Google Sheets**: Sync exams, exam_results, dan reports

### v1.0.0 (2026-01-31)

- ✅ Initial release
- ✅ User authentication (JWT)
- ✅ RBAC middleware
- ✅ Attendance CRUD + bulk sync
- ✅ Memorization logs + assessments
- ✅ Progress statistics
- ✅ Google Sheets sync

---

_Dokumentasi ini dibuat untuk Tahfidz Bootcamp API v1.2.0_
