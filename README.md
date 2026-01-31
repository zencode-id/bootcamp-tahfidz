# Tahfidz Bootcamp API 🕋

Backend API for School Attendance & Tahfidz (Quran Memorization) Bootcamp Application.

## Tech Stack

- **Runtime/Framework**: Hono.js (Node.js)
- **Database**: SQLite with Drizzle ORM
- **Validation**: Zod
- **Authentication**: JWT with RBAC
- **Sync**: Google Sheets integration via Google Apps Script

## Features

- 🔐 JWT Authentication with Role-Based Access Control (RBAC)
- 👥 User management (Admin, Teacher, Student, Parent)
- 📚 Class/Halaqah management
- ✅ Attendance tracking with offline sync support
- 📖 Quran memorization (Tahfidz) logging
- 📊 Assessment scoring (Tajwid, Fashohah, Fluency)
- 📈 Progress statistics and leaderboards
- 🔄 Google Sheets bidirectional sync

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd tahfidz-bootcamp-api

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your settings
# Important: Change JWT_SECRET!

# Push database schema
npm run db:push

# Seed the database
npm run db:seed

# Start development server
npm run dev
```

### Available Scripts

| Script                | Description                              |
| --------------------- | ---------------------------------------- |
| `npm run dev`         | Start development server with hot reload |
| `npm run build`       | Build for production                     |
| `npm run start`       | Start production server                  |
| `npm run db:push`     | Push schema changes to database          |
| `npm run db:generate` | Generate migration files                 |
| `npm run db:seed`     | Seed database with initial data          |
| `npm run db:studio`   | Open Drizzle Studio                      |

## API Endpoints

### Authentication

| Method | Endpoint          | Description                 | Auth  |
| ------ | ----------------- | --------------------------- | ----- |
| POST   | `/auth/register`  | Register new user           | -     |
| POST   | `/auth/login`     | Login                       | -     |
| GET    | `/auth/me`        | Get current user profile    | ✅    |
| PUT    | `/auth/me`        | Update current user profile | ✅    |
| GET    | `/auth/users`     | List all users              | Admin |
| GET    | `/auth/users/:id` | Get user by ID              | Admin |
| PUT    | `/auth/users/:id` | Update user                 | Admin |
| PATCH  | `/auth/users/:id` | Partial update user         | Admin |
| DELETE | `/auth/users/:id` | Delete user                 | Admin |

### Classes

| Method | Endpoint                          | Description          | Auth          |
| ------ | --------------------------------- | -------------------- | ------------- |
| GET    | `/classes`                        | List classes         | ✅            |
| POST   | `/classes`                        | Create class         | Admin         |
| GET    | `/classes/:id`                    | Get class details    | ✅            |
| PUT    | `/classes/:id`                    | Update class         | Admin         |
| PATCH  | `/classes/:id`                    | Partial update class | Admin         |
| DELETE | `/classes/:id`                    | Delete class         | Admin         |
| POST   | `/classes/:id/members`            | Add student to class | Teacher/Admin |
| DELETE | `/classes/:id/members/:studentId` | Remove student       | Teacher/Admin |

### Attendance Sync

| Method | Endpoint               | Description            | Auth          |
| ------ | ---------------------- | ---------------------- | ------------- |
| POST   | `/sync/attendance`     | Bulk sync attendance   | Teacher/Admin |
| GET    | `/sync/attendance`     | Get attendance records | ✅            |
| GET    | `/sync/attendance/:id` | Get single attendance  | ✅            |
| PUT    | `/sync/attendance/:id` | Update attendance      | Teacher/Admin |
| PATCH  | `/sync/attendance/:id` | Partial update         | Teacher/Admin |
| DELETE | `/sync/attendance/:id` | Delete attendance      | Teacher/Admin |

### Tahfidz Sync

| Method | Endpoint                        | Description                    | Auth          |
| ------ | ------------------------------- | ------------------------------ | ------------- |
| POST   | `/sync/tahfidz`                 | Bulk sync logs & assessments   | Teacher/Admin |
| GET    | `/sync/tahfidz/logs`            | Get memorization logs          | ✅            |
| GET    | `/sync/tahfidz/logs/:id`        | Get single log with assessment | ✅            |
| PUT    | `/sync/tahfidz/logs/:id`        | Update log                     | Teacher/Admin |
| PATCH  | `/sync/tahfidz/logs/:id`        | Partial update log             | Teacher/Admin |
| DELETE | `/sync/tahfidz/logs/:id`        | Delete log                     | Teacher/Admin |
| POST   | `/sync/tahfidz/assessments`     | Create assessment              | Teacher/Admin |
| PUT    | `/sync/tahfidz/assessments/:id` | Update assessment              | Teacher/Admin |
| PATCH  | `/sync/tahfidz/assessments/:id` | Partial update                 | Teacher/Admin |
| DELETE | `/sync/tahfidz/assessments/:id` | Delete assessment              | Teacher/Admin |
| GET    | `/sync/tahfidz/surahs`          | Get all surahs                 | ✅            |

### Statistics

| Method | Endpoint                       | Description            | Auth          |
| ------ | ------------------------------ | ---------------------- | ------------- |
| GET    | `/stats/progress/:studentId`   | Get tahfidz progress   | ✅\*          |
| GET    | `/stats/attendance/:studentId` | Get attendance heatmap | ✅\*          |
| GET    | `/stats/class/:classId`        | Get class statistics   | Teacher/Admin |
| GET    | `/stats/leaderboard`           | Get leaderboard        | Teacher/Admin |

\*Students can only access their own data, Parents can access their children's data

### Webhooks

| Method | Endpoint               | Description            | Auth    |
| ------ | ---------------------- | ---------------------- | ------- |
| POST   | `/webhook/gas`         | Receive GSheet updates | API Key |
| POST   | `/webhook/gas/bulk`    | Receive bulk updates   | API Key |
| GET    | `/webhook/sync/status` | Get sync status        | Admin   |
| POST   | `/webhook/sync/force`  | Force sync pending     | Admin   |

## Database Schema

### Users

- id (UUID), name, email, password, role, parentId, phone, address, isActive, createdAt, updatedAt

### Classes

- id (UUID), name, description, teacherId, schedule, isActive, createdAt, updatedAt

### ClassMembers

- id (UUID), classId, studentId, enrolledAt, createdAt, updatedAt

### Attendance

- id (UUID), studentId, classId, sessionType, status, proofUrl, notes, date, recordedBy, syncedAt, syncSource, createdAt, updatedAt

### MemorizationLogs

- id (UUID), studentId, type, surahId, startAyah, endAyah, teacherId, classId, sessionDate, notes, syncedAt, syncSource, createdAt, updatedAt

### Assessments

- id (UUID), logId, tajwidScore, fashohahScore, fluencyScore, totalScore, grade, notes, assessedBy, createdAt, updatedAt

### Surahs (Reference)

- id (1-114), name, arabicName, totalAyahs, juz

## Offline Sync

The API supports offline-first applications using UUID-based sync:

1. Generate UUIDs client-side for new records
2. Store records locally (Dexie/SQLite in Flutter)
3. When online, POST to `/sync/attendance` or `/sync/tahfidz` with bulk data
4. Server handles upsert based on UUID

## Google Sheets Integration

1. Create a Google Sheet with sheets: Attendance, MemorizationLogs, Assessments
2. Open Extensions > Apps Script
3. Paste the code from `gas/Code.gs`
4. Deploy as Web App
5. Set the Web App URL in `.env` as `GAS_WEBHOOK_URL`
6. Set matching API keys in both GAS and `.env`

## Role-Based Access Control

| Role        | Permissions                                     |
| ----------- | ----------------------------------------------- |
| **Admin**   | Full access to all resources                    |
| **Teacher** | Manage attendance, tahfidz for assigned classes |
| **Parent**  | View their children's data only                 |
| **Student** | View their own data only                        |

## Default Users (after seeding)

| Email               | Password   | Role    |
| ------------------- | ---------- | ------- |
| admin@tahfidz.app   | admin123   | Admin   |
| teacher@tahfidz.app | teacher123 | Teacher |

## License

ISC
#   b o o t c a m p - t a h f i d z  
 #   b o o t c a m p - t a h f i d z  
 #   b o o t c a m p - t a h f i d z  
 