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
│         └──►  ATTENDANCE   │◄─────────────────────────┘         │
│            │               │                                     │
│            │ Subuh/Ziyadah │                                     │
│            │ Murojaah/     │                                     │
│            │ Tahsin        │                                     │
│            └───────────────┘                                     │
│                                                                  │
│         ┌────────────────────┐        ┌──────────────┐          │
│         │  MEMORIZATION_LOGS │───────►│  ASSESSMENTS │          │
│         │                    │        │              │          │
│         │  Ziyadah/Murojaah  │        │ Tajwid       │          │
│         │  Surah + Ayat      │        │ Fashohah     │          │
│         └────────┬───────────┘        │ Fluency      │          │
│                  │                    └──────────────┘          │
│                  │                                               │
│                  ▼                                               │
│         ┌──────────────┐                                        │
│         │    SURAHS    │                                        │
│         │   (1-114)    │                                        │
│         │  Al-Quran    │                                        │
│         └──────────────┘                                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Role-Based Access Control (RBAC)

| Role        | Akses                                        |
| ----------- | -------------------------------------------- |
| **Admin**   | Full access ke semua resource                |
| **Teacher** | Kelola kehadiran & hafalan kelas yang diajar |
| **Parent**  | Lihat data anak-anaknya saja                 |
| **Student** | Lihat data diri sendiri saja                 |

---

## 📊 Statistik Database

| Tabel               | Deskripsi       | Estimasi Data |
| ------------------- | --------------- | ------------- |
| `users`             | Pengguna sistem | 500+          |
| `classes`           | Kelas/Halaqah   | 20+           |
| `surahs`            | Surah Al-Quran  | 114 (static)  |
| `attendance`        | Kehadiran       | +100/hari     |
| `memorization_logs` | Catatan hafalan | +50/hari      |
| `assessments`       | Penilaian       | +50/hari      |

---

## 🚀 Quick Links

- **Base URL**: `http://localhost:3000`
- **Health Check**: `GET /health`
- **API Info**: `GET /`

---

## 📝 Changelog

### v1.0.0 (2026-01-31)

- ✅ Initial release
- ✅ User authentication (JWT)
- ✅ RBAC middleware
- ✅ Attendance CRUD + bulk sync
- ✅ Memorization logs + assessments
- ✅ Progress statistics
- ✅ Google Sheets sync

---

_Dokumentasi ini dibuat untuk Tahfidz Bootcamp API v1.0.0_
