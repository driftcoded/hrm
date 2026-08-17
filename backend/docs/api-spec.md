# API Specification – HRM Backend

> **Base URL:** `https://api.yourdomain.com/api/v1`  
> **Format:** JSON, UTF-8  
> **Auth:** Bearer JWT (Access Token)  
> **Docs:** Swagger tại `/api/docs` (chỉ môi trường dev/staging)

---

## Mục lục

1. [Quy ước chung](#1-quy-ước-chung)
2. [Authentication](#2-authentication)
3. [Employees – Nhân viên](#3-employees--nhân-viên)
4. [Departments – Phòng ban](#4-departments--phòng-ban)
5. [Positions – Chức vụ](#5-positions--chức-vụ)
6. [Contracts – Hợp đồng](#6-contracts--hợp-đồng)
7. [Attendances – Chấm công](#7-attendances--chấm-công)
8. [Leaves – Nghỉ phép](#8-leaves--nghỉ-phép)
9. [Salaries – Lương](#9-salaries--lương)
10. [Family Members – Thành viên gia đình](#10-family-members--thành-viên-gia-đình)
11. [Dependents – Người phụ thuộc](#11-dependents--người-phụ-thuộc)
12. [Documents – Tài liệu](#12-documents--tài-liệu)
13. [Users – Tài khoản](#13-users--tài-khoản)
14. [Disciplines & Rewards – Khen thưởng & Kỷ luật](#14-disciplines--rewards--khen-thưởng--kỷ-luật)
15. [Performance Reviews – Đánh giá hiệu suất](#15-performance-reviews--đánh-giá-hiệu-suất)
16. [Trainings – Đào tạo](#16-trainings--đào-tạo)
17. [Announcements – Thông báo nội bộ](#17-announcements--thông-báo-nội-bộ)
18. [Leave Balances – Quản lý ngày phép (Admin)](#18-leave-balances--quản-lý-ngày-phép-admin)
19. [Reports – Báo cáo](#19-reports--báo-cáo)
20. [System – Dữ liệu hệ thống](#20-system--dữ-liệu-hệ-thống)
21. [Error Codes](#21-error-codes)

---

## 1. Quy ước chung

### 1.1. Standard Response

Mọi response đều bọc trong envelope sau:

```json
// ✅ Thành công – single object
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-05-25T10:00:00.000Z"
}

// ✅ Danh sách có phân trang
{
  "success": true,
  "data": {
    "items": [ ... ],
    "meta": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8
    }
  },
  "timestamp": "2026-05-25T10:00:00.000Z"
}

// ❌ Lỗi thông thường (404, 403, 409, 422 …)
{
  "success": false,
  "error": {
    "code": "EMPLOYEE_NOT_FOUND",
    "message": "Cannot find employee with id 42"
  },
  "timestamp": "2026-05-25T10:00:00.000Z"
}

// ❌ Lỗi validation (400) – có thêm details[]
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "code": "INVALID_EMAIL", "message": "Invalid email format" }
    ]
  },
  "timestamp": "2026-05-25T10:00:00.000Z"
}
```

> **Quy tắc:** `message` trong error dùng tiếng Anh, phục vụ developer/log — frontend dùng `error.code` để lookup i18n text. `details[]` **chỉ có** khi `code === "VALIDATION_ERROR"`.

### 1.2. Pagination Query Params

```
?page=1        Trang hiện tại (default: 1)
?limit=20      Số bản ghi/trang (default: 20, max: 100)
?sort=fullName Cột sắp xếp
?order=asc     Hướng sắp xếp: asc | desc
?search=nguyen Tìm kiếm full-text
```

### 1.3. Authentication Header

```
Authorization: Bearer <access_token>
```

### 1.4. Date Format

```
- Date:     YYYY-MM-DD           (2026-05-25)
- DateTime: ISO 8601 UTC         (2026-05-25T03:00:00.000Z)
- Time:     HH:mm                (08:30)
```

### 1.5. Tiền tệ

```
- Lưu DB: DECIMAL(15,2)
- API response: number (đơn vị VNĐ, không có thập phân thực tế)
- Ví dụ: 25000000 (không phải "25,000,000" hay 25000000.00)
```

---

## 2. Authentication

### POST `/auth/login`
Đăng nhập, nhận Access Token + Refresh Token.

**Request:**
```json
{
  "username": "admin",
  "password": "Abc@12345"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "expiresIn": 900,
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@company.com",
      "role": "admin",
      "employee": {
        "id": 1,
        "fullName": "Nguyễn Văn Admin",
        "avatarUrl": "https://s3.../avatar.jpg"
      }
    }
  }
}
```

**Errors:** `401 INVALID_CREDENTIALS`, `423 ACCOUNT_LOCKED`

---

### POST `/auth/refresh`
Lấy Access Token mới bằng Refresh Token.

**Request:**
```json
{ "refreshToken": "eyJhbGci..." }
```

**Response 200:** Trả về `accessToken` mới + `refreshToken` mới (rotation).

---

### POST `/auth/logout`
> 🔒 Auth required

Vô hiệu hóa Refresh Token hiện tại.

**Request:** `{}` (token lấy từ header)

---

### POST `/auth/change-password`
> 🔒 Auth required

```json
{
  "currentPassword": "Abc@12345",
  "newPassword": "NewPass@2026",
  "confirmPassword": "NewPass@2026"
}
```

**Errors:** `400 PASSWORD_MISMATCH`, `401 WRONG_CURRENT_PASSWORD`

---

### POST `/auth/forgot-password`
Gửi email chứa link đặt lại mật khẩu (link có hiệu lực 30 phút).

```json
{ "email": "user@company.com" }
```

---

### POST `/auth/reset-password`
Đặt mật khẩu mới bằng token từ email.

```json
{
  "token": "<reset_token_from_email>",
  "newPassword": "NewPass@2026",
  "confirmPassword": "NewPass@2026"
}
```

**Errors:** `400 RESET_TOKEN_INVALID`, `400 RESET_TOKEN_EXPIRED`, `400 PASSWORD_MISMATCH`

---

## 3. Employees – Nhân viên

### GET `/employees`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

**Query params:**
```
?search=nguyen     Tìm theo tên, mã NV, email, CCCD
?departmentId=1    Lọc theo phòng ban
?positionId=2      Lọc theo chức vụ
?status=active     Lọc: probation|active|on_leave|resigned|terminated
?gender=male
?hireFrom=2024-01-01
?hireTo=2024-12-31
```

**Response 200:**
```json
{
  "data": {
    "items": [
      {
        "id": 1,
        "employeeCode": "NV0001",
        "fullName": "Nguyễn Thị Lan",
        "email": "lan.nguyen@company.com",
        "phone": "0901234567",
        "gender": "female",
        "dateOfBirth": "1995-03-15",
        "department": { "id": 2, "name": "Phòng Kỹ thuật" },
        "position": { "id": 5, "name": "Developer Senior" },
        "status": "active",
        "hireDate": "2022-01-10",
        "avatarUrl": "https://s3.../avatar.jpg"
      }
    ],
    "meta": { "total": 150, "page": 1, "limit": 20, "totalPages": 8 }
  }
}
```

---

### POST `/employees`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

**Request:**
```json
{
  "lastName": "Nguyễn",
  "firstName": "Văn Bình",
  "dateOfBirth": "1998-07-20",
  "gender": "male",
  "maritalStatus": "single",
  "nationality": "Việt Nam",
  "ethnicity": "Kinh",
  "religion": null,
  "placeOfBirth": "Hà Nội",
  "hometown": "Hà Nam",

  "cccdNumber": "001098765432",
  "cccdIssueDate": "2021-05-10",
  "cccdIssuePlace": "Cục CS QLHC về TTXH Hà Nội",

  "taxCode": "8901234560",
  "socialInsuranceNo": "0123456789",
  "healthInsuranceNo": "DN4010000123456",

  "permanentAddress": "Số 10, Ngõ 20, Phố Huế, Hai Bà Trưng, Hà Nội",
  "provinceCode": "01",
  "districtCode": "007",
  "wardCode": "00193",

  "phone": "0912345678",
  "email": "binh.nguyen@company.com",
  "personalEmail": "binh.personal@gmail.com",

  "bankAccount": "1234567890",
  "bankName": "Vietcombank",
  "bankBranch": "Chi nhánh Hà Nội",

  "positionId": 3,
  "departmentId": 2,
  "directManagerId": 5,
  "hireDate": "2026-06-01",
  "probationStartDate": "2026-06-01",
  "probationEndDate": "2026-07-31",

  "educationLevel": "university",
  "major": "Công nghệ thông tin",
  "university": "Đại học Bách Khoa Hà Nội",
  "graduationYear": 2020,

  "notes": ""
}
```

**Response 201:**
```json
{
  "data": {
    "id": 51,
    "employeeCode": "NV0051",
    "fullName": "Nguyễn Văn Bình",
    ...
  }
}
```

**Errors:** `409 DUPLICATE_CCCD`, `409 DUPLICATE_EMAIL`, `409 DUPLICATE_TAX_CODE`, `400 VALIDATION_ERROR`

---

### GET `/employees/:id`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff` | Employee xem chính mình

**Response 200:** Full employee object bao gồm tất cả thông tin.

---

### PATCH `/employees/:id`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

**Request:** Các trường cần cập nhật (partial update).

---

### DELETE `/employees/:id`
> 🔒 Roles: `admin`, `hr_manager`

Soft delete – set `deletedAt`, không xoá khỏi DB.

---

### POST `/employees/:id/avatar`
> 🔒 Auth required | Employee upload ảnh của chính mình

**Content-Type:** `multipart/form-data`  
**Field:** `avatar` (file, max 2MB, JPEG/PNG/WEBP)

**Response 200:**
```json
{ "data": { "avatarUrl": "https://s3.amazonaws.com/..." } }
```

---

### GET `/employees/:id/work-history`
Lịch sử công tác của nhân viên.

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "eventType": "hire",
      "toDepartment": { "id": 2, "name": "Phòng Kỹ thuật" },
      "toPosition": { "id": 3, "name": "Developer Junior" },
      "toSalary": 12000000,
      "effectiveDate": "2022-01-10",
      "reason": "Nhận vào làm"
    }
  ]
}
```

---

### GET `/employees/me`
> 🔒 Auth required

Nhân viên xem hồ sơ cá nhân của chính mình.

---

## 4. Departments – Phòng ban

### GET `/departments`
> 🔒 Auth required

**Query:** `?tree=true` để trả về dạng cây thay vì flat list.

**Response (flat):**
```json
{
  "data": {
    "items": [
      {
        "id": 1,
        "code": "HR",
        "name": "Phòng Nhân sự",
        "parentId": null,
        "manager": { "id": 5, "fullName": "Trần Thị Mai" },
        "employeeCount": 5,
        "isActive": true
      }
    ]
  }
}
```

**Response (tree):**
```json
{
  "data": [
    {
      "id": 1, "name": "Ban Giám đốc",
      "children": [
        { "id": 2, "name": "Phòng Kỹ thuật", "children": [] },
        { "id": 3, "name": "Phòng Nhân sự", "children": [] }
      ]
    }
  ]
}
```

---

### POST `/departments`
> 🔒 Roles: `admin`, `hr_manager`

```json
{
  "code": "FIN",
  "name": "Phòng Tài chính",
  "parentId": null,
  "managerId": 10,
  "description": ""
}
```

---

### PATCH `/departments/:id` | DELETE `/departments/:id`
> 🔒 Roles: `admin`, `hr_manager`

---

## 5. Positions – Chức vụ

### GET `/positions`
**Query:** `?departmentId=2`

**Response:**
```json
{
  "data": {
    "items": [
      {
        "id": 3,
        "code": "DEV_SENIOR",
        "name": "Developer Senior",
        "department": { "id": 2, "name": "Phòng Kỹ thuật" },
        "level": 2,
        "minSalary": 20000000,
        "maxSalary": 35000000
      }
    ]
  }
}
```

### POST | PATCH | DELETE `/positions` | `/positions/:id`
> 🔒 Roles: `admin`, `hr_manager`

---

## 6. Contracts – Hợp đồng

### GET `/contracts`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

**Query:** `?employeeId=1`, `?status=active`, `?expiringDays=30` (hợp đồng sắp hết hạn)

---

### POST `/contracts`
> 🔒 Roles: `admin`, `hr_manager`

```json
{
  "employeeId": 51,
  "contractNumber": "HDLD-2026-051",
  "contractType": "fixed_term",
  "startDate": "2026-08-01",
  "endDate": "2027-07-31",
  "signDate": "2026-07-28",
  "baseSalary": 15000000,
  "insuranceSalary": 15000000,
  "positionAllowance": 500000,
  "workingHours": 8,
  "workingDays": 5,
  "fileUrl": "https://s3.../contracts/hdld-2026-051.pdf"
}
```

---

### PATCH `/contracts/:id/terminate`
> 🔒 Roles: `admin`, `hr_manager`

```json
{
  "terminatedDate": "2026-10-31",
  "terminatedReason": "Nhân viên xin thôi việc"
}
```

---

## 7. Attendances – Chấm công

### POST `/attendances/check-in`
> 🔒 Auth required (employee tự chấm)

```json
{
  "note": ""
}
```

**Response 201:**
```json
{
  "data": {
    "id": 1001,
    "employeeId": 51,
    "workDate": "2026-05-25",
    "checkIn": "08:05",
    "isLate": false,
    "lateMinutes": 0
  }
}
```

**Errors:** `409 ALREADY_CHECKED_IN`

---

### POST `/attendances/check-out`
> 🔒 Auth required

```json
{ "note": "" }
```

**Response 200:** Trả về record đầy đủ bao gồm `workHours`, `overtimeHours`.

---

### GET `/attendances`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`, `manager`

**Query:**
```
?employeeId=51
?departmentId=2
?month=5&year=2026
?status=absent
```

---

### GET `/attendances/me`
> 🔒 Auth required (employee)

**Query:** `?month=5&year=2026`

**Response:**
```json
{
  "data": {
    "summary": {
      "workingDays": 22,
      "presentDays": 20,
      "absentDays": 1,
      "lateDays": 1,
      "overtimeHours": 4.5
    },
    "records": [ ... ]
  }
}
```

---

### PATCH `/attendances/:id`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

Điều chỉnh chấm công (khi máy lỗi, quên chấm...).

```json
{
  "checkIn": "08:00",
  "checkOut": "17:30",
  "note": "Điều chỉnh do máy chấm công lỗi"
}
```

---

### POST `/attendances/bulk-import`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

Import chấm công từ file Excel.

**Content-Type:** `multipart/form-data`, field: `file` (.xlsx)

---

## 8. Leaves – Nghỉ phép

### GET `/leave-types`
> 🔒 Auth required

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "code": "ANNUAL",
      "name": "Nghỉ phép năm",
      "daysPerYear": 12,
      "isPaid": true,
      "requireApproval": true
    }
  ]
}
```

---

### GET `/leaves/balance`
> 🔒 Auth required (employee xem balance của mình)

**Query:** `?year=2026`

**Response:**
```json
{
  "data": [
    {
      "leaveType": { "id": 1, "name": "Nghỉ phép năm" },
      "year": 2026,
      "allocatedDays": 12,
      "usedDays": 3,
      "pendingDays": 1,
      "carriedOver": 0,
      "remainingDays": 8
    }
  ]
}
```

---

### POST `/leaves`
> 🔒 Auth required (employee tạo đơn)

```json
{
  "leaveTypeId": 1,
  "startDate": "2026-06-02",
  "endDate": "2026-06-04",
  "startHalf": "full",
  "endHalf": "full",
  "reason": "Về quê thăm gia đình",
  "attachmentUrl": null
}
```

**Response 201:**
```json
{
  "data": {
    "id": 201,
    "totalDays": 3,
    "status": "pending",
    ...
  }
}
```

**Errors:** `400 INSUFFICIENT_LEAVE_BALANCE`, `400 OVERLAPPING_LEAVE`

---

### GET `/leaves`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`, `manager`

**Query:** `?status=pending`, `?employeeId=51`, `?departmentId=2`

---

### GET `/leaves/me`
> 🔒 Auth required

Lịch sử đơn nghỉ của nhân viên.

---

### PATCH `/leaves/:id/approve`
> 🔒 Roles: `admin`, `hr_manager`, `manager`

```json
{ "note": "Đã duyệt" }
```

---

### PATCH `/leaves/:id/reject`
> 🔒 Roles: `admin`, `hr_manager`, `manager`

```json
{ "reason": "Phòng ban đang bận dự án, vui lòng dời sang tháng sau" }
```

---

### DELETE `/leaves/:id`
> 🔒 Auth required (chỉ NV tự huỷ đơn của mình, khi status=pending)

---

## 9. Salaries – Lương

### POST `/salaries/calculate`
> 🔒 Roles: `admin`, `hr_manager`

Tính lương hàng loạt cho toàn bộ NV hoặc 1 phòng ban.

```json
{
  "month": 5,
  "year": 2026,
  "departmentId": null,      // null = toàn công ty
  "overwrite": false         // true = tính lại nếu đã tồn tại
}
```

**Response 200:**
```json
{
  "data": {
    "processed": 45,
    "skipped": 2,
    "errors": [],
    "totalNetSalary": 850000000
  }
}
```

---

### GET `/salaries`
> 🔒 Roles: `admin`, `hr_manager`

**Query:** `?month=5&year=2026&departmentId=2&status=draft`

---

### GET `/salaries/me/:year/:month`
> 🔒 Auth required (employee xem phiếu lương)

**Response 200:**
```json
{
  "data": {
    "id": 501,
    "month": 5,
    "year": 2026,
    "employee": { "id": 51, "fullName": "Nguyễn Văn Bình", "employeeCode": "NV0051" },

    "workingDays": {
      "standard": 22,
      "actual": 21,
      "paidLeave": 1,
      "unpaidLeave": 0,
      "overtimeHours": 4
    },

    "income": {
      "baseSalary": 15000000,
      "positionAllowance": 500000,
      "mealAllowance": 730000,
      "transportAllowance": 300000,
      "phoneAllowance": 200000,
      "overtimePay": 227272,
      "performanceBonus": 0,
      "grossSalary": 16957272
    },

    "insurance": {
      "insuranceSalary": 15000000,
      "socialInsurance": 1200000,
      "healthInsurance": 225000,
      "unemploymentInsurance": 150000,
      "total": 1575000
    },

    "tax": {
      "selfDeduction": 11000000,
      "dependentDeduction": 0,
      "dependentCount": 0,
      "taxableIncome": 2132272,
      "personalIncomeTax": 106613
    },

    "summary": {
      "totalDeductions": 1681613,
      "netSalary": 15275659
    },

    "status": "approved",
    "paidAt": "2026-05-31T02:00:00.000Z"
  }
}
```

---

### PATCH `/salaries/:id/approve`
> 🔒 Roles: `admin`, `hr_manager`

---

### PATCH `/salaries/:id/mark-paid`
> 🔒 Roles: `admin`, `hr_manager`

```json
{ "paidAt": "2026-05-31T02:00:00.000Z" }
```

---

### GET `/salaries/:id/payslip`
> 🔒 Auth required

Xuất phiếu lương PDF.

**Response:** `Content-Type: application/pdf`

---

## 10. Family Members – Thành viên gia đình

### GET `/employees/:id/family-members`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff` | Employee xem của chính mình

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "fullName": "Nguyễn Thị Vợ",
      "relationship": "spouse",
      "dateOfBirth": "1998-03-10",
      "occupation": "Giáo viên",
      "phone": "0912345678",
      "cccdNumber": null
    }
  ]
}
```

---

### POST `/employees/:id/family-members`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

```json
{
  "fullName": "Nguyễn Văn Con",
  "relationship": "child",
  "dateOfBirth": "2020-08-15",
  "occupation": null,
  "phone": null,
  "cccdNumber": null,
  "note": ""
}
```

---

### PATCH `/employees/:id/family-members/:memberId`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

**Request:** Các trường cần cập nhật (partial update).

---

### DELETE `/employees/:id/family-members/:memberId`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

---

## 11. Dependents – Người phụ thuộc

### GET `/employees/:id/dependents`
### POST `/employees/:id/dependents`

```json
{
  "fullName": "Nguyễn Thị Mẹ",
  "relationship": "mother",
  "dateOfBirth": "1960-04-15",
  "cccdNumber": null,
  "taxCode": null,
  "registrationDate": "2026-01-01",
  "documentUrl": "https://s3.../dependent-doc.pdf",
  "note": "Mẹ ruột, không có thu nhập"
}
```

### PATCH `/employees/:id/dependents/:depId`
### DELETE `/employees/:id/dependents/:depId`

---

## 12. Documents – Tài liệu

### GET `/employees/:id/documents`
**Query:** `?type=cccd`

### POST `/employees/:id/documents`
**Content-Type:** `multipart/form-data`

**Fields:**
```
type: cccd | cv | degree | contract | health_check | other
name: "CCCD mặt trước"
file: [file upload, max 10MB, PDF/JPG/PNG]
issueDate: 2021-05-10
expiryDate: (optional)
```

### DELETE `/employees/:id/documents/:docId`

---

## 13. Users – Tài khoản

### GET `/users`
> 🔒 Roles: `admin`

### POST `/users`
> 🔒 Roles: `admin`

```json
{
  "username": "binh.nguyen",
  "email": "binh.nguyen@company.com",
  "password": "Temp@2026",
  "roleId": 5,
  "employeeId": 51
}
```

### PATCH `/users/:id`
### PATCH `/users/:id/reset-password`
> 🔒 Roles: `admin`

```json
{ "newPassword": "NewTemp@2026" }
```

---

## 14. Disciplines & Rewards – Khen thưởng & Kỷ luật

### GET `/employees/:id/disciplines-rewards`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff` | Employee xem của chính mình

**Query:** `?type=reward` | `?type=discipline`

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "type": "reward",
      "category": "Thưởng KPI",
      "title": "Hoàn thành xuất sắc Q1/2026",
      "description": "Vượt KPI 120%",
      "decisionNumber": "QD-2026-001",
      "decisionDate": "2026-04-01",
      "effectiveDate": "2026-04-01",
      "amount": 5000000,
      "issuedBy": { "id": 3, "fullName": "Trần Thị Giám Đốc" }
    }
  ]
}
```

---

### POST `/employees/:id/disciplines-rewards`
> 🔒 Roles: `admin`, `hr_manager`

```json
{
  "type": "discipline",
  "category": "Cảnh cáo",
  "title": "Vi phạm nội quy công ty",
  "description": "Đi muộn liên tục 3 ngày trong tháng",
  "decisionNumber": "QD-KC-2026-005",
  "decisionDate": "2026-05-20",
  "effectiveDate": "2026-05-20",
  "amount": null,
  "issuedById": 3,
  "documentUrl": null
}
```

---

### PATCH `/employees/:id/disciplines-rewards/:recordId`
> 🔒 Roles: `admin`, `hr_manager`

---

### DELETE `/employees/:id/disciplines-rewards/:recordId`
> 🔒 Roles: `admin`, `hr_manager`

---

## 15. Performance Reviews – Đánh giá hiệu suất

### GET `/performance-reviews`
> 🔒 Roles: `admin`, `hr_manager`, `manager`

**Query:** `?employeeId=51&year=2026&period=quarterly`

---

### GET `/performance-reviews/me`
> 🔒 Auth required (employee xem đánh giá của mình)

---

### POST `/performance-reviews`
> 🔒 Roles: `admin`, `hr_manager`, `manager`

```json
{
  "employeeId": 51,
  "reviewPeriod": "quarterly",
  "periodYear": 2026,
  "periodQuarter": 2,
  "kpiScore": 85.5,
  "attitudeScore": 90.0,
  "skillScore": 88.0,
  "strengths": "Chủ động, hoàn thành đúng deadline",
  "weaknesses": "Cần cải thiện kỹ năng trình bày",
  "recommendations": "Đề xuất tham gia khoá đào tạo presentation"
}
```

**Response 201:** Trả về record với `overallScore` và `rating` tính tự động.

---

### PATCH `/performance-reviews/:id`
> 🔒 Roles: `admin`, `hr_manager`, `manager` (chỉ khi status=draft)

---

### PATCH `/performance-reviews/:id/submit`
> 🔒 Roles: `admin`, `hr_manager`, `manager`

Chuyển trạng thái → `submitted`, gửi thông báo cho nhân viên.

---

### PATCH `/performance-reviews/:id/acknowledge`
> 🔒 Auth required (employee xác nhận đã đọc đánh giá)

---

## 16. Trainings – Đào tạo

### GET `/trainings`
> 🔒 Auth required

**Query:** `?status=ongoing&type=internal`

**Response 200:**
```json
{
  "data": {
    "items": [
      {
        "id": 1,
        "code": "TRN-2026-001",
        "name": "Kỹ năng lãnh đạo",
        "type": "external",
        "startDate": "2026-06-10",
        "endDate": "2026-06-12",
        "location": "Hà Nội",
        "trainer": "Học viện Kỹ năng PACE",
        "cost": 5000000,
        "maxParticipants": 20,
        "status": "planned"
      }
    ]
  }
}
```

---

### POST `/trainings`
> 🔒 Roles: `admin`, `hr_manager`

```json
{
  "code": "TRN-2026-002",
  "name": "Clean Code & Refactoring",
  "type": "internal",
  "startDate": "2026-07-01",
  "endDate": "2026-07-01",
  "location": "Phòng họp A",
  "trainer": "Nguyễn Văn Senior Dev",
  "cost": 0,
  "maxParticipants": 15,
  "description": ""
}
```

---

### PATCH `/trainings/:id` | DELETE `/trainings/:id`
> 🔒 Roles: `admin`, `hr_manager`

---

### GET `/trainings/:id/participants`
Danh sách nhân viên tham gia khoá đào tạo.

---

### POST `/trainings/:id/enroll`
> 🔒 Roles: `admin`, `hr_manager`

Đăng ký nhân viên vào khoá đào tạo.

```json
{ "employeeIds": [51, 52, 53] }
```

---

### PATCH `/trainings/:id/participants/:employeeId`
> 🔒 Roles: `admin`, `hr_manager`

Cập nhật kết quả sau khoá học.

```json
{
  "result": "passed",
  "score": 88.5,
  "completionDate": "2026-07-01",
  "certificateUrl": "https://s3.../cert-001.pdf"
}
```

---

## 17. Announcements – Thông báo nội bộ

### GET `/announcements`
> 🔒 Auth required (tất cả nhân viên)

Lấy thông báo theo đối tượng của người dùng hiện tại.

**Query:** `?type=urgent&page=1&limit=10`

**Response 200:**
```json
{
  "data": {
    "items": [
      {
        "id": 1,
        "title": "Thông báo nghỉ lễ 30/4 - 01/5",
        "type": "general",
        "isPinned": true,
        "publishDate": "2026-04-25T00:00:00.000Z",
        "expiryDate": "2026-05-05T00:00:00.000Z",
        "createdBy": { "id": 2, "fullName": "Nguyễn HR Manager" }
      }
    ],
    "meta": { "total": 5, "page": 1, "limit": 10, "totalPages": 1 }
  }
}
```

---

### GET `/announcements/:id`
> 🔒 Auth required

---

### POST `/announcements`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

```json
{
  "title": "Lịch nghỉ Tết Nguyên Đán 2027",
  "content": "Công ty thông báo lịch nghỉ Tết ...",
  "type": "general",
  "targetAudience": "all",
  "targetIds": null,
  "publishDate": null,
  "expiryDate": "2027-02-01T00:00:00.000Z",
  "isPinned": false,
  "attachmentUrl": null
}
```

---

### PATCH `/announcements/:id` | DELETE `/announcements/:id`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff` (chỉ người tạo hoặc admin)

---

## 18. Leave Balances – Quản lý ngày phép (Admin)

### GET `/leave-balances`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

**Query:** `?year=2026&departmentId=2&employeeId=51`

Xem số ngày phép của tất cả nhân viên.

---

### POST `/leave-balances/init-year`
> 🔒 Roles: `admin`, `hr_manager`

Khởi tạo ngày phép năm mới cho toàn bộ nhân viên (chạy đầu năm).

```json
{
  "year": 2027,
  "carryOverLimit": 5
}
```

**Logic:** Với mỗi nhân viên đang active:
- `allocated_days` = 12 + (số năm làm việc trọn 5 năm)
- `carried_over` = min(remaining_days của năm trước, `carryOverLimit`)

**Response 200:**
```json
{
  "data": {
    "processed": 143,
    "year": 2027
  }
}
```

---

### PATCH `/leave-balances/:id`
> 🔒 Roles: `admin`, `hr_manager`

Điều chỉnh thủ công số ngày phép (trường hợp đặc biệt).

```json
{
  "allocatedDays": 15,
  "note": "Cộng thêm 3 ngày theo quyết định HĐQT"
}
```

---

## 19. Reports – Báo cáo

### GET `/reports/dashboard/stats`
> 🔒 Roles: `admin`, `hr_manager`

**Response:**
```json
{
  "data": {
    "totalEmployees": 152,
    "activeEmployees": 143,
    "probationEmployees": 5,
    "newThisMonth": 3,
    "resignedThisMonth": 1,
    "pendingLeaveRequests": 8,
    "birthdaysThisMonth": [
      { "id": 5, "fullName": "Trần Văn C", "dateOfBirth": "1995-05-28" }
    ],
    "expiringContracts": [
      { "id": 10, "employeeCode": "NV0010", "fullName": "...", "endDate": "2026-06-30" }
    ]
  }
}
```

---

### GET `/reports/employees/export`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

**Query:** Các filter tương tự GET `/employees`

**Response:** `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`  
File Excel với các sheet: Danh sách, Thông tin BH, Thông tin lương.

---

### GET `/reports/salaries/export`
> 🔒 Roles: `admin`, `hr_manager`

**Query:** `?month=5&year=2026&departmentId=2`

**Response:** Excel bảng lương chi tiết từng khoản.

---

### GET `/reports/attendances/export`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`, `manager`

**Query:** `?month=5&year=2026&departmentId=2`

---

### GET `/reports/leaves/summary`
> 🔒 Roles: `admin`, `hr_manager`

**Query:** `?year=2026`

---

## 20. System – Dữ liệu hệ thống

### GET `/system/provinces`
Danh sách 63 tỉnh/thành phố.

```json
{
  "data": [
    { "code": "01", "name": "Hà Nội", "type": "Thành phố Trung ương" },
    { "code": "79", "name": "Thành phố Hồ Chí Minh", "type": "Thành phố Trung ương" }
  ]
}
```

### GET `/system/districts/:provinceCode`
### GET `/system/wards/:districtCode`

### GET `/system/holidays`
**Query:** `?year=2026`

### GET `/system/leave-types`
Danh sách loại nghỉ phép (public, không cần auth).

---

## 21. Error Codes

### HTTP Status Codes

| Code | Ý nghĩa |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request – Dữ liệu không hợp lệ |
| 401 | Unauthorized – Chưa đăng nhập / Token hết hạn |
| 403 | Forbidden – Không có quyền |
| 404 | Not Found |
| 409 | Conflict – Trùng dữ liệu |
| 422 | Unprocessable Entity – Vi phạm business rule |
| 429 | Too Many Requests – Rate limit |
| 500 | Internal Server Error |

### Application Error Codes

```
AUTH
  INVALID_CREDENTIALS        Sai tên đăng nhập hoặc mật khẩu
  TOKEN_EXPIRED              Access token hết hạn
  TOKEN_INVALID              Token không hợp lệ
  REFRESH_TOKEN_EXPIRED      Refresh token hết hạn, đăng nhập lại
  ACCOUNT_LOCKED             Tài khoản bị khoá
  WRONG_CURRENT_PASSWORD     Mật khẩu hiện tại không đúng
  PASSWORD_MISMATCH          Mật khẩu xác nhận không khớp

EMPLOYEE
  EMPLOYEE_NOT_FOUND         Không tìm thấy nhân viên
  DUPLICATE_CCCD             CCCD đã tồn tại
  DUPLICATE_EMAIL            Email đã tồn tại
  DUPLICATE_TAX_CODE         Mã số thuế đã tồn tại
  DUPLICATE_SI_NUMBER        Số sổ BHXH đã tồn tại
  INVALID_CCCD_FORMAT        CCCD không đúng định dạng 12 số
  INVALID_HIRE_DATE          Ngày vào làm không hợp lệ

CONTRACT
  CONTRACT_NOT_FOUND
  CONTRACT_ALREADY_ACTIVE    Nhân viên đã có hợp đồng đang hiệu lực
  CONTRACT_TYPE_LIMIT        Đã ký 2 lần HĐXĐTH, phải chuyển indefinite

ATTENDANCE
  ALREADY_CHECKED_IN         Đã chấm công vào hôm nay
  NOT_CHECKED_IN             Chưa chấm công vào
  ALREADY_CHECKED_OUT        Đã chấm công ra

LEAVE
  LEAVE_NOT_FOUND
  INSUFFICIENT_LEAVE_BALANCE Không đủ ngày phép
  OVERLAPPING_LEAVE          Trùng với đơn nghỉ khác đã được duyệt
  CANNOT_CANCEL_APPROVED     Không thể huỷ đơn đã duyệt
  LEAVE_IN_PAST              Không thể tạo đơn nghỉ ngày đã qua

SALARY
  SALARY_ALREADY_EXISTS      Bảng lương tháng này đã được tính
  SALARY_NOT_FOUND
  SALARY_ALREADY_APPROVED    Không thể sửa bảng lương đã duyệt
  NO_ACTIVE_CONTRACT         Nhân viên không có hợp đồng hiệu lực

TRAINING
  TRAINING_NOT_FOUND
  TRAINING_FULL              Khoá đào tạo đã đủ chỗ
  ALREADY_ENROLLED           Nhân viên đã đăng ký khoá này

PERFORMANCE
  REVIEW_NOT_FOUND
  REVIEW_ALREADY_SUBMITTED   Không thể sửa đánh giá đã submit

AUTH
  RESET_TOKEN_INVALID        Token đặt lại mật khẩu không hợp lệ
  RESET_TOKEN_EXPIRED        Token đặt lại mật khẩu đã hết hạn (30 phút)

LEAVE_BALANCE
  BALANCE_ALREADY_INITIALIZED  Đã khởi tạo ngày phép cho năm này

SYSTEM
  VALIDATION_ERROR           Lỗi validate dữ liệu (kèm details[])
  FORBIDDEN                  Không có quyền thực hiện thao tác
  RATE_LIMIT_EXCEEDED        Quá nhiều request
  INTERNAL_ERROR             Lỗi server nội bộ
```

### Validation Error Format

`details[]` chỉ xuất hiện khi `code === "VALIDATION_ERROR"`. Mỗi phần tử có đủ 3 trường:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "cccdNumber", "code": "INVALID_CCCD",  "message": "CCCD must be exactly 12 digits" },
      { "field": "email",      "code": "INVALID_EMAIL", "message": "Invalid email format" },
      { "field": "salary",     "code": "REQUIRED",      "message": "salary is required" }
    ]
  },
  "timestamp": "2026-05-25T10:00:00.000Z"
}
```

**TypeScript type (dùng ở frontend):**

```typescript
type ApiError =
  | { code: 'VALIDATION_ERROR'; message: string; details: ValidationDetail[] }
  | { code: string;             message: string }

type ValidationDetail = { field: string; code: string; message: string }
```

---

*Cập nhật: 13/08/2026 – Version 1.2 – Chuẩn hóa response format: bỏ `message` khỏi success, `details[]` chỉ có ở VALIDATION_ERROR, mỗi detail item gồm `field`+`code`+`message`*