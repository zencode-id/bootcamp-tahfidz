# 🕋 Tahfidz Bootcamp API

> Backend API untuk Aplikasi Kehadiran Sekolah & Tahfidz (Hafalan Al-Quran)

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Hono](https://img.shields.io/badge/Hono.js-4.0-E36002?style=flat&logo=hono&logoColor=white)](https://hono.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org/)

---

## ✨ Features

| Feature                | Description                                 |
| ---------------------- | ------------------------------------------- |
| 🔐 **Authentication**  | JWT dengan Role-Based Access Control (RBAC) |
| 👥 **User Management** | Admin, Teacher, Student, Parent roles       |
| 📚 **Class/Halaqah**   | Manajemen kelas tahfidz                     |
| ✅ **Attendance**      | Tracking kehadiran dengan offline sync      |
| 📖 **Tahfidz Logs**    | Pencatatan hafalan (Ziyadah/Murojaah)       |
| 📊 **Assessment**      | Penilaian Tajwid, Fashohah, Kelancaran      |
| 📈 **Statistics**      | Progress, heatmap, leaderboard              |
| 🔄 **Google Sheets**   | Sinkronisasi bidirectional                  |

---

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: [Hono.js](https://hono.dev/) - Ultrafast web framework
- **Database**: SQLite with [Drizzle ORM](https://orm.drizzle.team/)
- **Validation**: [Zod](https://zod.dev/)
- **Auth**: JWT + bcrypt
- **Sync**: Google Apps Script integration

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/zencode-id/bootcamp-tahfidz.git
cd bootcamp-tahfidz

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env dan ubah JWT_SECRET!

# Setup database
npm run db:push
npm run db:seed

# Start server
npm run dev
```

Server akan berjalan di **http://localhost:3000**

---

## 📜 Available Scripts

| Script                | Description                           |
| --------------------- | ------------------------------------- |
| `npm run dev`         | Start development server (hot reload) |
| `npm run build`       | Build untuk production                |
| `npm run start`       | Start production server               |
| `npm run db:push`     | Push schema ke database               |
| `npm run db:generate` | Generate migration files              |
| `npm run db:seed`     | Seed data awal                        |
| `npm run db:studio`   | Buka Drizzle Studio                   |

---

## 📡 API Endpoints

### 🔐 Authentication

| Method   | Endpoint          | Description        | Auth  |
| -------- | ----------------- | ------------------ | ----- |
| `POST`   | `/auth/register`  | Register user baru | -     |
| `POST`   | `/auth/login`     | Login              | -     |
| `GET`    | `/auth/me`        | Get profile        | ✅    |
| `PUT`    | `/auth/me`        | Update profile     | ✅    |
| `GET`    | `/auth/users`     | List semua users   | Admin |
| `PUT`    | `/auth/users/:id` | Update user        | Admin |
| `DELETE` | `/auth/users/:id` | Hapus user         | Admin |

### 🏫 Classes

| Method   | Endpoint                          | Description   | Auth          |
| -------- | --------------------------------- | ------------- | ------------- |
| `GET`    | `/classes`                        | List kelas    | ✅            |
| `POST`   | `/classes`                        | Buat kelas    | Admin         |
| `GET`    | `/classes/:id`                    | Detail kelas  | ✅            |
| `PUT`    | `/classes/:id`                    | Update kelas  | Admin         |
| `DELETE` | `/classes/:id`                    | Hapus kelas   | Admin         |
| `POST`   | `/classes/:id/members`            | Tambah santri | Teacher/Admin |
| `DELETE` | `/classes/:id/members/:studentId` | Hapus santri  | Teacher/Admin |

### ✅ Attendance Sync

| Method   | Endpoint               | Description         | Auth          |
| -------- | ---------------------- | ------------------- | ------------- |
| `POST`   | `/sync/attendance`     | Bulk sync kehadiran | Teacher/Admin |
| `GET`    | `/sync/attendance`     | Get data kehadiran  | ✅            |
| `GET`    | `/sync/attendance/:id` | Get single record   | ✅            |
| `PUT`    | `/sync/attendance/:id` | Update kehadiran    | Teacher/Admin |
| `DELETE` | `/sync/attendance/:id` | Hapus kehadiran     | Teacher/Admin |

### 📖 Tahfidz Sync

| Method | Endpoint                    | Description         | Auth          |
| ------ | --------------------------- | ------------------- | ------------- |
| `POST` | `/sync/tahfidz`             | Bulk sync hafalan   | Teacher/Admin |
| `GET`  | `/sync/tahfidz/logs`        | Get catatan hafalan | ✅            |
| `GET`  | `/sync/tahfidz/logs/:id`    | Detail + assessment | ✅            |
| `POST` | `/sync/tahfidz/assessments` | Buat penilaian      | Teacher/Admin |
| `GET`  | `/sync/tahfidz/surahs`      | List 114 surah      | ✅            |

### 📊 Statistics

| Method | Endpoint                       | Description       | Auth          |
| ------ | ------------------------------ | ----------------- | ------------- |
| `GET`  | `/stats/progress/:studentId`   | Progress hafalan  | ✅\*          |
| `GET`  | `/stats/attendance/:studentId` | Heatmap kehadiran | ✅\*          |
| `GET`  | `/stats/class/:classId`        | Statistik kelas   | Teacher/Admin |
| `GET`  | `/stats/leaderboard`           | Leaderboard       | Teacher/Admin |

> \*Santri hanya bisa akses data sendiri, Wali bisa akses data anaknya

### 🔄 Webhooks

| Method | Endpoint               | Description               | Auth    |
| ------ | ---------------------- | ------------------------- | ------- |
| `POST` | `/webhook/gas`         | Terima update dari GSheet | API Key |
| `POST` | `/webhook/gas/bulk`    | Bulk update dari GSheet   | API Key |
| `GET`  | `/webhook/sync/status` | Cek status sync           | Admin   |
| `POST` | `/webhook/sync/force`  | Force sync pending        | Admin   |

---

## 🗄️ Database Schema

```
┌──────────┐     ┌──────────────┐     ┌──────────┐
│  USERS   │────►│ CLASS_MEMBERS│◄────│ CLASSES  │
│          │     └──────────────┘     │          │
│  Admin   │            │             │ Halaqah  │
│  Teacher │◄───────────┼─────────────┤          │
│  Student │            │             └────┬─────┘
│  Parent  │            │                  │
└────┬─────┘            │                  │
     │                  ▼                  │
     │         ┌────────────────┐          │
     └────────►│  ATTENDANCE    │◄─────────┘
               └────────────────┘

     ┌─────────────────────┐     ┌──────────────┐
     │  MEMORIZATION_LOGS  │────►│  ASSESSMENTS │
     │                     │     │              │
     │  Ziyadah/Murojaah   │     │  Tajwid      │
     │  Surah + Ayat       │     │  Fashohah    │
     └──────────┬──────────┘     │  Fluency     │
                │                └──────────────┘
                ▼
         ┌────────────┐
         │   SURAHS   │
         │  (1-114)   │
         └────────────┘
```

📄 Dokumentasi lengkap: [docs/DATABASE.md](./docs/DATABASE.md)

---

## 🔐 Role-Based Access Control

| Role        | Akses                                        |
| ----------- | -------------------------------------------- |
| **Admin**   | Full access ke semua resource                |
| **Teacher** | Kelola kehadiran & hafalan kelas yang diajar |
| **Parent**  | Lihat data anak-anaknya saja                 |
| **Student** | Lihat data diri sendiri saja                 |

---

## 👤 Default Users

Setelah menjalankan `npm run db:seed`:

| Email                 | Password     | Role    |
| --------------------- | ------------ | ------- |
| `admin@tahfidz.app`   | `admin123`   | Admin   |
| `teacher@tahfidz.app` | `teacher123` | Teacher |

---

## 📱 Offline Sync

API mendukung aplikasi offline-first dengan UUID-based sync:

1. **Generate UUID** di client untuk record baru
2. **Simpan lokal** (Dexie.js / SQLite di Flutter)
3. **Sync saat online** via `POST /sync/attendance` atau `POST /sync/tahfidz`
4. **Server upsert** berdasarkan UUID

---

## 📊 Google Sheets Integration

1. Buat Google Sheet dengan sheets: `Attendance`, `MemorizationLogs`, `Assessments`
2. Buka **Extensions > Apps Script**
3. Paste kode dari `gas/Code.gs`
4. Deploy sebagai Web App
5. Set URL di `.env` sebagai `GAS_WEBHOOK_URL`
6. Set API key yang sama di GAS dan `.env`

---

## 📚 Documentation

| Doc                                              | Description          |
| ------------------------------------------------ | -------------------- |
| [docs/DATABASE.md](./docs/DATABASE.md)           | ERD, schema, relasi  |
| [docs/API.md](./docs/API.md)                     | API endpoint lengkap |
| [docs/SQL_REFERENCE.md](./docs/SQL_REFERENCE.md) | SQL DDL & queries    |

---

## 📝 License

ISC © 2026 Zencode ID
