# 📬 Panduan Testing API dengan Postman

## Langkah 1: Import Collection

1. Buka **Postman**
2. Klik **Import** (pojok kiri atas)
3. Drag & drop file `postman/Tahfidz_API.postman_collection.json`
4. Atau klik **Upload Files** dan pilih file tersebut

---

## Langkah 2: Cek Server Berjalan

Pastikan server development sudah berjalan:

```bash
npm run dev
```

Output yang diharapkan:

```
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🕋 TAHFIDZ BOOTCAMP API                             ║
║                                                       ║
║   Server running on http://localhost:3000             ║
║   Environment: development                            ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

---

## Langkah 3: Test Health Check

1. Buka folder **🔄 Health** di collection
2. Klik **Health Check**
3. Klik **Send**
4. Response yang diharapkan:

```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-01-31T07:00:00.000Z"
}
```

---

## Langkah 4: Login untuk Mendapatkan Token

1. Buka folder **🔐 Auth**
2. Klik **Login**
3. Pastikan Body sudah terisi:

```json
{
  "email": "admin@tahfidz.app",
  "password": "admin123"
}
```

4. Klik **Send**
5. **Token otomatis tersimpan!** (ada script di Tests tab)

Response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "xxx-xxx-xxx",
      "name": "Admin",
      "email": "admin@tahfidz.app",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

## Langkah 5: Test Endpoint yang Butuh Auth

Setelah login, semua request dengan header `Authorization: Bearer {{token}}` akan otomatis terisi.

### Contoh: Get My Profile

1. Buka **🔐 Auth** > **Get My Profile**
2. Klik **Send**
3. Lihat data profile Anda

### Contoh: List Surahs

1. Buka **📖 Tahfidz** > **Get Surahs**
2. Klik **Send**
3. Lihat 114 surah Al-Quran

---

## 📋 Daftar Request yang Tersedia

### 🔐 Auth

| Request        | Method | Auth     |
| -------------- | ------ | -------- |
| Login          | POST   | ❌       |
| Register       | POST   | ❌       |
| Get My Profile | GET    | ✅       |
| List All Users | GET    | ✅ Admin |

### 🏫 Classes

| Request      | Method | Auth     |
| ------------ | ------ | -------- |
| List Classes | GET    | ✅       |
| Create Class | POST   | ✅ Admin |

### ✅ Attendance

| Request              | Method | Auth             |
| -------------------- | ------ | ---------------- |
| Bulk Sync Attendance | POST   | ✅ Teacher/Admin |
| Get Attendance       | GET    | ✅               |

### 📖 Tahfidz

| Request               | Method | Auth             |
| --------------------- | ------ | ---------------- |
| Get Surahs            | GET    | ✅               |
| Bulk Sync Tahfidz     | POST   | ✅ Teacher/Admin |
| Get Memorization Logs | GET    | ✅               |

### 📝 Exams

| Request          | Method | Auth             |
| ---------------- | ------ | ---------------- |
| List Exams       | GET    | ✅               |
| Create Exam      | POST   | ✅ Teacher/Admin |
| Add Exam Result  | POST   | ✅ Teacher/Admin |
| Get Exam Results | GET    | ✅               |

### 📊 Reports

| Request              | Method | Auth             |
| -------------------- | ------ | ---------------- |
| List Reports         | GET    | ✅               |
| Generate Reports     | POST   | ✅ Teacher/Admin |
| Get Report Detail    | GET    | ✅               |
| Publish Report       | POST   | ✅ Admin         |
| Get Report for Print | GET    | ✅               |

### 📈 Stats

| Request              | Method | Auth             |
| -------------------- | ------ | ---------------- |
| Get Student Progress | GET    | ✅               |
| Get Attendance Stats | GET    | ✅               |
| Get Leaderboard      | GET    | ✅ Teacher/Admin |

---

## ⚙️ Variables

Collection menggunakan variables berikut:

| Variable    | Nilai Default           | Keterangan              |
| ----------- | ----------------------- | ----------------------- |
| `baseUrl`   | `http://localhost:3000` | URL server              |
| `token`     | (auto-filled)           | JWT token dari login    |
| `studentId` | (manual)                | ID santri untuk testing |
| `examId`    | (manual)                | ID ujian untuk testing  |
| `reportId`  | (manual)                | ID raport untuk testing |

### Cara Set Variable Manual:

1. Klik nama collection **Tahfidz Bootcamp API**
2. Klik tab **Variables**
3. Isi Current Value untuk variable yang diperlukan

---

## 🔧 Tips

### Copy ID dari Response

Setelah create data, copy ID dari response untuk digunakan di request berikutnya:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",  // <- Copy ini
    ...
  }
}
```

### Ubah User untuk Test RBAC

Coba login dengan user berbeda untuk test role-based access:

| Email                 | Password     | Role    |
| --------------------- | ------------ | ------- |
| `admin@tahfidz.app`   | `admin123`   | Admin   |
| `teacher@tahfidz.app` | `teacher123` | Teacher |

---

## 🚀 Quick Flow untuk Testing Lengkap

1. **Login** sebagai admin
2. **List Users** → copy studentId
3. **Create Class** → copy classId
4. **Bulk Sync Attendance** dengan studentId
5. **Bulk Sync Tahfidz** dengan studentId (hafalan Al-Fatihah)
6. **Create Exam**
7. **Add Exam Result** untuk student
8. **Generate Reports** untuk auto-calculate raport
9. **Get Report Detail** / **Print** untuk lihat hasil

---

_Happy Testing! 🎉_
