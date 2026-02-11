# 🔗 API Documentation

## Tahfidz Bootcamp - REST API Reference

Dokumentasi lengkap untuk semua endpoint API.

---

## 📑 Daftar Isi

1. [Authentication](#authentication)
2. [Users](#users)
3. [Classes](#classes)
4. [Attendance Sync](#attendance-sync)
5. [Tahfidz Sync](#tahfidz-sync)
6. [Exams (Ujian)](#exams-ujian)
7. [Reports (Raport)](#reports-raport)
8. [Statistics](#statistics)
9. [Statistics](#statistics)
10. [Upload](#upload)
11. [School Data](#school-data)
12. [Error Responses](#error-responses)

---

## 🔐 Authentication

### Headers

Semua endpoint yang membutuhkan autentikasi harus menyertakan header:

```
Authorization: Bearer <token>
```

### POST /auth/register

Registrasi pengguna baru.

**Request Body:**

```json
{
  "name": "Ahmad Santri",
  "email": "ahmad@example.com",
  "password": "password123",
  "role": "student",
  "parentId": "uuid-parent-optional",
  "phone": "08123456789",
  "address": "Jl. Contoh No. 1"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Ahmad Santri",
      "email": "ahmad@example.com",
      "role": "student"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### POST /auth/login

Login pengguna dan mendapatkan token JWT.

**Request Body:**

```json
{
  "email": "admin@tahfidz.app",
  "password": "admin123"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Admin",
      "email": "admin@tahfidz.app",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### POST /auth/verify-otp

Verifikasi OTP login untuk mendapatkan token JWT.

**Request Body:**

```json
{
  "email": "ahmad@example.com",
  "code": "123456"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Ahmad Santri",
      "email": "ahmad@example.com",
      "role": "student"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---



**Error Responses (OTP Endpoints):**

| Code | Message          |
|------|------------------|
| 400  | Invalid OTP      |
| 400  | OTP expired      |
| 404  | User not found   |

---

### GET /auth/me

Mendapatkan profil pengguna yang sedang login.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Admin",
    "email": "admin@tahfidz.app",
    "role": "admin",
    "phone": null,
    "address": null,
    "parentId": null,
    "createdAt": "2026-01-31T05:00:00.000Z"
  }
}
```

---

### PUT /auth/me

Update profil pengguna yang sedang login.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "name": "Admin Updated",
  "phone": "08123456789"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Admin Updated",
    "email": "admin@tahfidz.app",
    "role": "admin",
    "phone": "08123456789",
    "address": null
  }
}
```

---

## 👥 Users (Admin Only)

### GET /auth/users

Mendapatkan daftar semua pengguna.

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `page` | number | ❌ | Halaman (default: 1) |
| `limit` | number | ❌ | Jumlah data per halaman (default: 20) |
| `role` | string | ❌ | Filter by role (admin, teacher, student, parent) |
| `is_active` | boolean | ❌ | Filter by status (true/false) |
| `q` | string | ❌ | Search by name or email |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Admin",
      "email": "admin@tahfidz.app",
      "role": "admin",
      "isActive": true,
      "createdAt": "2026-01-31T05:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

### GET /auth/users/:id

Mendapatkan detail pengguna berdasarkan ID.

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Ahmad Santri",
    "email": "ahmad@example.com",
    "role": "student",
    "parentId": "parent-uuid",
    "phone": "08123456789",
    "address": "Jl. Contoh No. 1",
    "isActive": true,
    "createdAt": "2026-01-31T05:00:00.000Z",
    "updatedAt": "2026-01-31T05:00:00.000Z"
  }
}
```

---

### PUT /auth/users/:id

Update pengguna (full update).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Request Body:**

```json
{
  "name": "Ahmad Santri Updated",
  "role": "student",
  "isActive": true
}
```

---

### PATCH /auth/users/:id

Update pengguna (partial update).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Request Body:**

```json
{
  "isActive": false
}
```

---

### DELETE /auth/users/:id

Hapus pengguna.

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**

```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## 🏫 Classes

### GET /classes

Mendapatkan daftar kelas.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "class-uuid",
      "name": "Halaqah Al-Fatihah",
      "description": "Kelas tahfidz untuk pemula",
      "teacherId": "teacher-uuid",
      "schedule": "{\"senin\": \"07:00\", \"rabu\": \"07:00\"}",
      "isActive": true,
      "teacher": {
        "id": "teacher-uuid",
        "name": "Ustadz Ahmad",
        "email": "teacher@tahfidz.app"
      },
      "memberCount": 10
    }
  ],
  "total": 1
}
```

---

### POST /classes

Membuat kelas baru.

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Request Body:**

```json
{
  "name": "Halaqah Al-Baqarah",
  "description": "Kelas tahfidz tingkat lanjut",
  "teacherId": "teacher-uuid",
  "schedule": "{\"selasa\": \"07:00\", \"kamis\": \"07:00\"}"
}
```

---

### GET /classes/:id

Mendapatkan detail kelas dengan daftar anggota.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "class-uuid",
    "name": "Halaqah Al-Fatihah",
    "description": "Kelas tahfidz untuk pemula",
    "teacherId": "teacher-uuid",
    "isActive": true,
    "teacher": {
      "id": "teacher-uuid",
      "name": "Ustadz Ahmad",
      "email": "teacher@tahfidz.app"
    },
    "members": [
      {
        "id": "member-uuid",
        "classId": "class-uuid",
        "studentId": "student-uuid",
        "enrolledAt": "2026-01-31T05:00:00.000Z",
        "student": {
          "id": "student-uuid",
          "name": "Ahmad Santri",
          "email": "ahmad@example.com"
        }
      }
    ],
    "memberCount": 1
  }
}
```

---

### POST /classes/:id/members

Menambahkan santri ke kelas.

**Headers:** `Authorization: Bearer <token>` (Teacher/Admin)

**Request Body:**

```json
{
  "studentId": "student-uuid"
}
```

---

### DELETE /classes/:id/members/:studentId

Menghapus santri dari kelas.

**Headers:** `Authorization: Bearer <token>` (Teacher/Admin)

---

## ✅ Attendance Sync

### POST /sync/attendance

Bulk sync kehadiran (untuk offline sync).

**Headers:** `Authorization: Bearer <token>` (Teacher/Admin)

**Request Body:**

```json
{
  "items": [
    {
      "id": "uuid-opsional-untuk-update",
      "studentId": "student-uuid",
      "classId": "class-uuid",
      "sessionType": "subuh",
      "status": "present",
      "date": "2026-01-31",
      "notes": "Hadir tepat waktu"
    },
    {
      "studentId": "student-uuid-2",
      "classId": "class-uuid",
      "sessionType": "ziyadah",
      "status": "sick",
      "proofUrl": "https://example.com/bukti.jpg",
      "date": "2026-01-31"
    }
  ]
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Synced 2 attendance records",
  "data": {
    "created": 1,
    "updated": 1,
    "errors": []
  }
}
```

---

### GET /sync/attendance

Mendapatkan daftar kehadiran dengan filter.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `page` | number | Halaman (default: 1) |
| `limit` | number | Jumlah per halaman (default: 20, max: 100) |
| `studentId` | uuid | Filter berdasarkan santri |
| `classId` | uuid | Filter berdasarkan kelas |
| `sessionType` | enum | subuh, ziyadah, murojaah, tahsin |
| `status` | enum | present, absent, sick, leave, late |
| `startDate` | date | Filter tanggal mulai (YYYY-MM-DD) |
| `endDate` | date | Filter tanggal akhir (YYYY-MM-DD) |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "attendance-uuid",
      "studentId": "student-uuid",
      "classId": "class-uuid",
      "sessionType": "subuh",
      "status": "present",
      "date": "2026-01-31",
      "notes": null,
      "syncedAt": "2026-01-31T05:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## 📖 Tahfidz Sync

### POST /sync/tahfidz

Bulk sync memorization logs dan assessments.

**Headers:** `Authorization: Bearer <token>` (Teacher/Admin)

**Request Body:**

```json
{
  "logs": [
    {
      "id": "uuid-opsional",
      "studentId": "student-uuid",
      "type": "ziyadah",
      "surahId": 1,
      "startAyah": 1,
      "endAyah": 7,
      "teacherId": "teacher-uuid",
      "sessionDate": "2026-01-31",
      "notes": "Hafalan Al-Fatihah lengkap"
    }
  ],
  "assessments": [
    {
      "logId": "log-uuid",
      "tajwidScore": 85,
      "fashohahScore": 90,
      "fluencyScore": 88,
      "notes": "Perlu perbaikan makhraj"
    }
  ]
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Tahfidz data synced successfully",
  "data": {
    "logs": {
      "created": 1,
      "updated": 0,
      "errors": []
    },
    "assessments": {
      "created": 1,
      "updated": 0,
      "errors": []
    }
  }
}
```

---

### GET /sync/tahfidz/logs

Mendapatkan daftar memorization logs.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `page` | number | Halaman |
| `limit` | number | Jumlah per halaman |
| `studentId` | uuid | Filter berdasarkan santri |
| `type` | enum | ziyadah atau murojaah |
| `surahId` | number | Filter berdasarkan surah (1-114) |
| `startDate` | date | Filter tanggal mulai |
| `endDate` | date | Filter tanggal akhir |

---

### GET /sync/tahfidz/logs/:id

Mendapatkan detail log dengan assessment.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "log-uuid",
    "studentId": "student-uuid",
    "type": "ziyadah",
    "surahId": 1,
    "startAyah": 1,
    "endAyah": 7,
    "sessionDate": "2026-01-31",
    "assessment": {
      "id": "assessment-uuid",
      "tajwidScore": 85,
      "fashohahScore": 90,
      "fluencyScore": 88,
      "totalScore": 87.67,
      "grade": "B"
    }
  }
}
```

---

### GET /sync/tahfidz/surahs

Mendapatkan daftar 114 surah.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Al-Fatihah",
      "arabicName": "الفاتحة",
      "totalAyahs": 7,
      "juz": "[\"1\"]"
    },
    {
      "id": 2,
      "name": "Al-Baqarah",
      "arabicName": "البقرة",
      "totalAyahs": 286,
      "juz": "[\"1\",\"2\",\"3\"]"
    }
  ]
}
```

---

## � Exams (Ujian)

### GET /exams

Mendapatkan daftar ujian.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "exam-uuid",
      "name": "Ujian Tengah Semester 1",
      "description": "Ujian hafalan semester 1",
      "examType": "mid_semester",
      "classId": "class-uuid",
      "startSurah": 1,
      "endSurah": 3,
      "examDate": "2026-02-15",
      "academicYear": "2025/2026",
      "semester": "1",
      "passingScore": 70,
      "maxScore": 100,
      "isActive": true,
      "createdAt": "2026-01-31T05:00:00.000Z"
    }
  ],
  "total": 1
}
```

---

### POST /exams

Membuat ujian baru.

**Headers:** `Authorization: Bearer <token>` (Teacher/Admin)

**Request Body:**

```json
{
  "name": "Ujian Tengah Semester 1",
  "description": "Ujian hafalan semester 1",
  "examType": "mid_semester",
  "classId": "class-uuid",
  "startSurah": 1,
  "endSurah": 3,
  "startAyah": 1,
  "endAyah": 200,
  "examDate": "2026-02-15",
  "academicYear": "2025/2026",
  "semester": "1",
  "passingScore": 70,
  "maxScore": 100
}
```

**Exam Types:**
| Type | Deskripsi |
|------|-----------|
| `mid_semester` | Ujian Tengah Semester |
| `end_semester` | Ujian Akhir Semester |
| `monthly` | Ujian Bulanan |
| `weekly` | Ujian Mingguan |
| `placement` | Ujian Penempatan |

**Response (201):**

```json
{
  "success": true,
  "message": "Exam created successfully",
  "data": {
    "id": "exam-uuid",
    "name": "Ujian Tengah Semester 1",
    ...
  }
}
```

---

### GET /exams/:id

Mendapatkan detail ujian.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "exam-uuid",
    "name": "Ujian Tengah Semester 1",
    "examType": "mid_semester",
    "examDate": "2026-02-15",
    "academicYear": "2025/2026",
    "semester": "1",
    "passingScore": 70,
    "class": {
      "id": "class-uuid",
      "name": "Halaqah Al-Fatihah"
    },
    "resultsCount": 15
  }
}
```

---

### PUT /exams/:id

Update ujian.

**Headers:** `Authorization: Bearer <token>` (Teacher/Admin)

**Request Body:** (partial update)

```json
{
  "name": "Ujian Tengah Semester 1 - Revisi",
  "examDate": "2026-02-20"
}
```

---

### DELETE /exams/:id

Hapus ujian (Admin only).

**Headers:** `Authorization: Bearer <token>` (Admin)

---

### GET /exams/:id/results

Mendapatkan semua hasil ujian.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "result-uuid",
      "examId": "exam-uuid",
      "studentId": "student-uuid",
      "hafalanScore": 85,
      "tajwidScore": 80,
      "fashohahScore": 82,
      "fluencyScore": 78,
      "makhorijulHurufScore": 75,
      "tartilScore": 80,
      "totalScore": 80.0,
      "grade": "B",
      "isPassed": true,
      "rank": 3,
      "feedback": "Perlu perbaikan makhraj huruf",
      "student": {
        "id": "student-uuid",
        "name": "Ahmad Santri",
        "email": "ahmad@example.com"
      }
    }
  ],
  "total": 15
}
```

---

### POST /exams/:id/results

Menambahkan hasil ujian santri.

**Headers:** `Authorization: Bearer <token>` (Teacher/Admin)

**Request Body:**

```json
{
  "studentId": "student-uuid",
  "hafalanScore": 85,
  "tajwidScore": 80,
  "fashohahScore": 82,
  "fluencyScore": 78,
  "makhorijulHurufScore": 75,
  "tartilScore": 80,
  "notes": "Catatan penguji",
  "feedback": "Perlu perbaikan makhraj huruf"
}
```

**Score Fields:**
| Field | Required | Deskripsi |
|-------|----------|-----------|
| `hafalanScore` | ✅ | Nilai hafalan (0-100) |
| `tajwidScore` | ✅ | Nilai tajwid (0-100) |
| `fashohahScore` | ✅ | Nilai fashohah (0-100) |
| `fluencyScore` | ✅ | Nilai kelancaran (0-100) |
| `makhorijulHurufScore` | ❌ | Nilai makhraj (0-100) |
| `tartilScore` | ❌ | Nilai tartil (0-100) |

**Response (201):**

```json
{
  "success": true,
  "message": "Exam result created successfully",
  "data": {
    "id": "result-uuid",
    "totalScore": 80.0,
    "grade": "B",
    "isPassed": true,
    ...
  }
}
```

---

### POST /exams/:id/results/bulk

Menambahkan hasil ujian secara bulk.

**Headers:** `Authorization: Bearer <token>` (Teacher/Admin)

**Request Body:**

```json
{
  "results": [
    {
      "studentId": "student-uuid-1",
      "hafalanScore": 85,
      "tajwidScore": 80,
      "fashohahScore": 82,
      "fluencyScore": 78
    },
    {
      "studentId": "student-uuid-2",
      "hafalanScore": 90,
      "tajwidScore": 88,
      "fashohahScore": 85,
      "fluencyScore": 92
    }
  ]
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Processed 2 results",
  "data": {
    "created": 2,
    "errors": []
  }
}
```

---

### GET /exams/:id/results/:studentId

Mendapatkan hasil ujian santri tertentu.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "result-uuid",
    "hafalanScore": 85,
    "tajwidScore": 80,
    "fashohahScore": 82,
    "fluencyScore": 78,
    "totalScore": 81.25,
    "grade": "B",
    "isPassed": true,
    "rank": 3,
    "feedback": "Perlu perbaikan makhraj huruf",
    "exam": {
      "id": "exam-uuid",
      "name": "Ujian Tengah Semester 1"
    },
    "student": {
      "id": "student-uuid",
      "name": "Ahmad Santri"
    }
  }
}
```

---

## 📊 Reports (Raport)

### GET /reports

Mendapatkan daftar raport.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `academicYear` | string | Filter tahun ajaran (e.g., "2025/2026") |
| `semester` | enum | Filter semester ("1" atau "2") |
| `classId` | uuid | Filter berdasarkan kelas |
| `status` | enum | draft, published, archived (Admin/Teacher only) |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "report-uuid",
      "studentId": "student-uuid",
      "classId": "class-uuid",
      "academicYear": "2025/2026",
      "semester": "1",
      "finalScore": 85.5,
      "finalGrade": "B",
      "classRank": 3,
      "totalStudents": 15,
      "status": "published",
      "student": {
        "id": "student-uuid",
        "name": "Ahmad Santri"
      }
    }
  ],
  "total": 1
}
```

---

### POST /reports/generate

**Auto-generate raport** dari data kehadiran, hafalan, dan ujian.

**Headers:** `Authorization: Bearer <token>` (Teacher/Admin)

**Request Body:**

```json
{
  "academicYear": "2025/2026",
  "semester": "1",
  "classId": "class-uuid",
  "studentIds": ["student-uuid-1", "student-uuid-2"]
}
```

| Field          | Required | Deskripsi                           |
| -------------- | -------- | ----------------------------------- |
| `academicYear` | ✅       | Tahun ajaran (format: YYYY/YYYY)    |
| `semester`     | ✅       | Semester ("1" atau "2")             |
| `classId`      | ❌       | Filter kelas tertentu               |
| `studentIds`   | ❌       | Daftar santri (jika kosong = semua) |

**Response (200):**

```json
{
  "success": true,
  "message": "Generated 15 reports",
  "data": {
    "generated": 15,
    "skipped": 2,
    "errors": []
  }
}
```

**Data yang Auto-Calculate:**

- ✅ Total sesi & persentase kehadiran
- ✅ Total ayat yang dihafal (ziyadah)
- ✅ Total sesi murojaah
- ✅ Rata-rata nilai harian (tajwid, fashohah, kelancaran)
- ✅ Nilai UTS & UAS (dari exam_results)
- ✅ Final score (30% harian + 30% UTS + 40% UAS)
- ✅ Ranking dalam kelas

---

### GET /reports/:id

Mendapatkan detail raport.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "report-uuid",
    "studentId": "student-uuid",
    "academicYear": "2025/2026",
    "semester": "1",

    "totalSessions": 50,
    "presentCount": 45,
    "absentCount": 2,
    "sickCount": 2,
    "leaveCount": 1,
    "attendancePercentage": 90.0,

    "totalAyahsMemorized": 150,
    "totalNewAyahs": 50,
    "totalMurojaahSessions": 20,
    "currentSurah": 3,
    "currentAyah": 50,
    "progressPercentage": 2.4,

    "avgTajwidScore": 85.5,
    "avgFashohahScore": 88.2,
    "avgFluencyScore": 82.1,
    "avgTotalScore": 85.27,

    "midSemesterScore": 82.5,
    "endSemesterScore": 88.0,
    "finalScore": 85.5,
    "finalGrade": "B",

    "classRank": 3,
    "totalStudents": 15,
    "status": "published",

    "teacherNotes": "Santri rajin dan tekun",
    "recommendations": "Tingkatkan murojaah",

    "student": {
      "id": "student-uuid",
      "name": "Ahmad Santri"
    },
    "class": {
      "id": "class-uuid",
      "name": "Halaqah Al-Fatihah"
    },
    "currentSurahInfo": {
      "id": 3,
      "name": "Ali Imran"
    }
  }
}
```

---

### PUT /reports/:id

Update raport.

**Headers:** `Authorization: Bearer <token>` (Teacher/Admin)

**Request Body:**

```json
{
  "teacherNotes": "Santri rajin dan tekun dalam menghafal",
  "recommendations": "Tingkatkan murojaah dan perbaiki tajwid",
  "targetAyahs": 100
}
```

---

### POST /reports/:id/publish

Publish raport (membuatnya visible untuk santri/wali).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**

```json
{
  "success": true,
  "message": "Report published successfully",
  "data": {
    "id": "report-uuid",
    "status": "published",
    "approvedBy": "admin-uuid",
    "approvedAt": "2026-01-31T10:00:00.000Z",
    "publishedAt": "2026-01-31T10:00:00.000Z"
  }
}
```

---

### POST /reports/publish-bulk

Publish banyak raport sekaligus.

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Request Body:**

```json
{
  "reportIds": ["report-uuid-1", "report-uuid-2", "report-uuid-3"]
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Published 3 reports",
  "data": {
    "published": 3
  }
}
```

---

### GET /reports/:id/print

Mendapatkan data raport untuk dicetak.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "report": { ... },
    "student": {
      "id": "student-uuid",
      "name": "Ahmad Santri",
      "email": "ahmad@example.com",
      "phone": "08123456789",
      "address": "Jl. Contoh No. 1"
    },
    "parent": {
      "id": "parent-uuid",
      "name": "Bapak Ahmad",
      "phone": "08198765432"
    },
    "class": {
      "id": "class-uuid",
      "name": "Halaqah Al-Fatihah"
    },
    "teacher": {
      "id": "teacher-uuid",
      "name": "Ustadz Ahmad"
    },
    "currentSurah": {
      "id": 3,
      "name": "Ali Imran",
      "arabicName": "آل عمران"
    },
    "approver": {
      "id": "admin-uuid",
      "name": "Admin"
    },
    "printedAt": "2026-01-31T12:00:00.000Z"
  }
}
```

---

### DELETE /reports/:id

Hapus raport.

**Headers:** `Authorization: Bearer <token>` (Admin only)

---

## �📊 Statistics

### GET /stats/progress/:studentId

Mendapatkan progress hafalan santri.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "student": {
      "id": "student-uuid",
      "name": "Ahmad Santri"
    },
    "overall": {
      "totalAyahsMemorized": 150,
      "totalQuranAyahs": 6236,
      "progressPercentage": 2.4,
      "juzCompleted": 0
    },
    "scores": {
      "averageTajwid": 85.5,
      "averageFashohah": 88.2,
      "averageFluency": 82.1,
      "averageTotal": 85.27,
      "totalAssessments": 10
    },
    "juzProgress": [
      {
        "juz": 1,
        "percentage": 50.5,
        "ayahsMemorized": 75,
        "totalAyahs": 148
      }
    ],
    "surahProgress": [
      {
        "surahId": 1,
        "totalAyahs": 7,
        "sessions": 1
      }
    ],
    "recentActivity": []
  }
}
```

---

### GET /stats/attendance/:studentId

Mendapatkan statistik kehadiran untuk heatmap.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `year` | number | Tahun (default: tahun ini) |
| `month` | number | Bulan (1-12, opsional) |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "student": {
      "id": "student-uuid",
      "name": "Ahmad Santri"
    },
    "period": {
      "year": 2026,
      "month": 1,
      "startDate": "2026-01-01",
      "endDate": "2026-01-31"
    },
    "overall": {
      "totalSessions": 50,
      "presentCount": 45,
      "absentCount": 2,
      "sickCount": 2,
      "leaveCount": 1,
      "lateCount": 0,
      "attendanceRate": 90.0
    },
    "heatmap": [
      {
        "date": "2026-01-01",
        "sessions": [
          { "type": "subuh", "status": "present" },
          { "type": "ziyadah", "status": "present" }
        ],
        "presentCount": 2,
        "absentCount": 0,
        "totalSessions": 2
      }
    ],
    "monthlySummary": {
      "2026-01": {
        "present": 45,
        "absent": 2,
        "sick": 2,
        "leave": 1,
        "late": 0,
        "total": 50,
        "attendanceRate": 90.0
      }
    },
    "sessionTypeBreakdown": [
      { "sessionType": "subuh", "status": "present", "count": 25 }
    ]
  }
}
```

---

### GET /stats/leaderboard

Mendapatkan leaderboard santri.

**Headers:** `Authorization: Bearer <token>` (Teacher/Admin)

**Query Parameters:**
| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `limit` | number | Jumlah teratas (default: 10, max: 50) |
| `type` | enum | ayahs, score, attendance |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "type": "ayahs",
    "leaderboard": [
      {
        "studentId": "student-uuid",
        "studentName": "Ahmad Santri",
        "value": 500
      },
      {
        "studentId": "student-uuid-2",
        "studentName": "Budi Santri",
        "value": 450
      }
    ]
  }
}
```

---

### GET /stats/class/:classId

Mendapatkan statistik kelas (kehadiran dan hafalan 30 hari terakhir).

**Headers:** `Authorization: Bearer <token>` (Teacher/Admin)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "classId": "class-uuid",
    "period": {
      "from": "2026-01-01",
      "to": "2026-01-31"
    },
    "attendance": {
      "totalSessions": 100,
      "presentCount": 85,
      "absentCount": 10,
      "sickCount": 3,
      "leaveCount": 2,
      "attendanceRate": 85.0
    },
    "memorization": {
      "totalLogs": 50,
      "totalAyahsMemorized": 200,
      "avgTajwidScore": 82.5,
      "avgFashohahScore": 85.0,
      "avgFluencyScore": 80.0
    }
  }
}
```

---




## 📤 Upload

### POST /upload

Upload file (foto, dokumen, dll).

**Headers:** `Authorization: Bearer <token>`

**Request Body:** `multipart/form-data`

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `file` | File | File yang akan diupload |

**Response (200):**

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "url": "/uploads/file-uuid.jpg"
  }
}
```

---

## 🏫 School Data

### GET /school

Get data profil sekolah/lembaga.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "E-Tahfiz Bootcamp",
    "address": "Jl. Pesantren No. 123",
    "phone": "021-12345678",
    "email": "admin@etahfiz.com",
    "website": "https://etahfiz.com",
    "logoUrl": "/uploads/logo.png",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### PUT /school

Update data profil sekolah (Admin Only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

| Field | Tipe | Wajib | Deskripsi |
|-------|------|-------|-----------|
| `name` | string | Ya | Nama sekolah |
| `address` | string | Tidak | Alamat |
| `phone` | string | Tidak | Nomor telepon |
| `email` | string | Tidak | Email sekolah |
| `website` | string | Tidak | Website sekolah |
| `logoUrl` | string | Tidak | URL logo (dari response upload) |

```json
{
  "name": "E-Tahfiz Bootcamp Updated",
  "address": "Jl. Baru No. 1",
  "phone": "08123456789",
  "email": "info@etahfiz.com",
  "website": "https://bootcamp.etahfiz.com",
  "logoUrl": "/uploads/new-logo.png"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "School profile updated successfully",
  "data": {
    "id": "uuid",
    "name": "E-Tahfiz Bootcamp Updated",
    "address": "Jl. Baru No. 1",
    ...
  }
}
```

---

## ❌ Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "error": "Validation Error",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Missing or invalid authorization header"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "error": "Access denied. Required roles: admin"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "User not found"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Internal Server Error"
}
```

---

_API Documentation untuk Tahfidz Bootcamp API v1.3.0_
