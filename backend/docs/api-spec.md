# API Specification – HRM Backend

> **Base URL:** `https://api.yourdomain.com/api/v1`  
> **Format:** JSON, UTF-8  
> **Auth:** Bearer JWT (Access Token) trong header; refresh token trong cookie HttpOnly (§2)  
> **Docs:** Swagger tại `/api/docs`
>
> ⚠️ Swagger hiện được mount ở **mọi** môi trường (`main.ts` không kiểm tra `NODE_ENV`).
> Ý định ban đầu là chỉ bật ở dev/staging — cần chặn lại trước khi lên production.

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
14. [Announcements – Thông báo nội bộ](#14-announcements--thông-báo-nội-bộ)
15. [Leave Balances – Quản lý ngày phép (Admin)](#15-leave-balances--quản-lý-ngày-phép-admin)
16. [Reports – Báo cáo](#16-reports--báo-cáo)
17. [System – Dữ liệu hệ thống](#17-system--dữ-liệu-hệ-thống)
18. [Error Codes](#18-error-codes)

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

### 1.6. Trạng thái triển khai (tính đến hết Giai đoạn 6)

Tài liệu này mô tả **toàn bộ** API dự kiến của hệ thống. Phần dưới đây là danh sách route **đã tồn tại trong code** — mọi endpoint không có trong bảng này là kế hoạch của các giai đoạn sau, chưa gọi được:

```
GET  /health

POST /auth/login  /auth/refresh  /auth/logout  /auth/change-password
     /auth/forgot-password  /auth/reset-password
GET  /auth/me

GET    /employees          POST   /employees
GET    /employees/me       GET    /employees/stats
GET    /employees/:id      PATCH  /employees/:id      DELETE /employees/:id
GET    /employees/:id/summary
POST   /employees/:id/restore   POST /employees/:id/avatar
GET/POST      /employees/:employeeId/family-members
PATCH/DELETE  /employees/:employeeId/family-members/:memberId
GET/POST      /employees/:employeeId/dependents
PATCH/DELETE  /employees/:employeeId/dependents/:dependentId

GET/POST      /contracts        GET/PATCH/DELETE /contracts/:id
PATCH         /contracts/:id/terminate
GET           /contract-types

GET/POST      /departments      GET /departments/tree
GET/PATCH/DELETE /departments/:id
GET/POST      /positions        GET/PATCH/DELETE /positions/:id
GET/POST      /leave-types      GET/PATCH/DELETE /leave-types/:id
GET/POST      /holidays         GET/PATCH/DELETE /holidays/:id
POST          /holidays/generate

GET/POST      /attendances      GET/PATCH/DELETE /attendances/:id
POST          /attendances/bulk-import
GET           /attendances/export

GET/POST      /leaves           GET/PATCH/DELETE /leaves/:id
POST          /leaves/:id/approve   POST /leaves/:id/reject
GET           /leave-balances   POST /leave-balances/initialize
GET           /leave-balances/:id/adjust

GET           /salaries         POST /salaries/calculate
GET/PATCH     /salaries/:id     POST /salaries/:id/approve  POST /salaries/:id/mark-paid
GET           /salaries/:id/payslip
GET/POST      /salary-advances  GET/PATCH /salary-advances/:id
GET/PATCH     /payroll-settings

GET/POST      /salary-advances  GET/PATCH /salary-advances/:id

GET  /system/provinces  /system/wards  /system/holidays  /system/leave-types
GET  /reports/employees/export  GET /reports/attendance/export
GET  /roles             POST /users
```

**Chưa hiện thực** (kế hoạch Giai đoạn 7–8): §14 (Announcements), §12 (Documents),
`GET /employees/:id/work-history` (§3), `GET /users` · `PATCH /users/:id` · `PATCH /users/:id/reset-password` (§13),
PDF/Excel payslip export, email SES thật, và mọi report ngoài danh sách trên.

---

## 2. Authentication

### Cookie refresh token

`POST /auth/login` và `POST /auth/refresh` đều trả header:

```
Set-Cookie: refresh_token=<opaque>; Path=/api/v1/auth/refresh; HttpOnly; SameSite=Strict
```

| Thuộc tính | Giá trị | Lý do |
|-----------|---------|-------|
| `HttpOnly` | luôn bật | JS không đọc được → XSS không lấy được refresh token |
| `SameSite=Strict` | luôn bật | Chống CSRF |
| `Path` | `/<API_PREFIX>/auth/refresh` (mặc định `/api/v1/auth/refresh`) | Refresh token CHỈ cần ở đúng endpoint đó. Với `Path=/` browser sẽ đính kèm token vào **mọi** request tới origin (kể cả tải ảnh) — mở rộng bề mặt bị lộ mà không được gì. Path được tính từ config `API_PREFIX`, không hardcode |
| `Secure` | **chỉ ở production** | `Secure: true` trên `http://localhost` khiến browser **âm thầm bỏ cookie** (không báo lỗi) → dev sẽ không bao giờ refresh được. Vì vậy production = `true`, dev/test = `false` |
| `Max-Age` | chỉ khi `rememberMe: true` | Xem `rememberMe` bên dưới |

> **Client:** chỉ 2 request được phép gửi/nhận cookie này (`withCredentials`): `POST /auth/login` (nhận `Set-Cookie`) và `POST /auth/refresh` (gửi cookie + được rotate). Mọi endpoint khác — kể cả `/auth/logout` — chỉ dùng Bearer access token.

---

### POST `/auth/login`
Đăng nhập bằng **username HOẶC email** (email không phân biệt hoa/thường), nhận Access Token trong body + Refresh Token trong cookie.

**Request:**
```json
{
  "username": "admin",
  "password": "Abc@12345",
  "rememberMe": false
}
```

| Field | Bắt buộc | Mô tả |
|-------|:--------:|-------|
| `username` | ✅ | Tên đăng nhập **hoặc** email |
| `password` | ✅ | – |
| `rememberMe` | ❌ (mặc định `false`) | CHỈ ảnh hưởng tuổi thọ **cookie**: `true` → cookie có `Max-Age` = tuổi thọ refresh token (7 ngày, còn sau khi đóng browser); `false` → session cookie (mất khi đóng browser). Bản ghi `refresh_tokens.expires_at` trong DB **luôn** là 7 ngày trong cả hai trường hợp |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
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

Kèm header `Set-Cookie` như mô tả ở trên. `expiresIn` = số giây access token còn hiệu lực (mặc định 900 = 15 phút). `user.employee` = `null` nếu tài khoản chưa gắn hồ sơ nhân viên.

**Errors:**

| Status | Code | Khi nào |
|:------:|------|---------|
| 401 | `INVALID_CREDENTIALS` | Sai định danh hoặc mật khẩu (lần sai thứ 1–4) |
| 429 | `ACCOUNT_LOCKED` | **Lần sai thứ 5** — chính lần này làm khoá tài khoản 15 phút |
| 423 | `ACCOUNT_LOCKED` | Các lần thử **sau đó**, khi khoá còn hiệu lực |
| 423 | `ACCOUNT_LOCKED` | `users.status = 'locked'` (khoá thủ công, không tự mở) |
| 403 | `ACCOUNT_INACTIVE` | `users.status` khác `active` (ví dụ `inactive`) — chỉ kiểm tra **sau khi** mật khẩu đúng, để không tiết lộ trạng thái tài khoản cho người không biết mật khẩu |

> **Thời gian còn lại của khoá nằm ở header `Retry-After` (số giây), KHÔNG nằm trong JSON body.**
> `error.message` là văn bản tiếng Anh dành cho developer/log — UI **không được** hiển thị nó và
> không được parse nó để lấy số phút.
>
> `Retry-After` có mặt ở **khoá tự động do đăng nhập sai** (cả 429 và 423). Trường hợp
> `users.status = 'locked'` (khoá thủ công) cũng trả 423 `ACCOUNT_LOCKED` nhưng **không** có
> `Retry-After` — khoá này không tự hết hạn, phải liên hệ HR/quản trị. UI phải xử lý được
> cả hai: có header thì hiện số phút, không có thì hiện thông điệp chung.
>
> Ngưỡng khoá (`AUTH_MAX_FAILED_LOGIN_ATTEMPTS`, mặc định 5) và thời gian khoá
> (`AUTH_LOCKOUT_MINUTES`, mặc định 15) đọc từ config.

---

### POST `/auth/refresh`
Cấp Access Token mới từ cookie refresh token, kèm **rotation**.

**Request:** **KHÔNG có body.** Token đọc từ cookie HttpOnly; client chỉ cần gửi request kèm credentials.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "expiresIn": 900
  }
}
```

Refresh token **mới** được set lại qua `Set-Cookie` (cùng thuộc tính như login). Token cũ bị revoke ngay.

**Errors:** `401 TOKEN_INVALID` (thiếu cookie / token không tồn tại / token đã dùng lại), `401 REFRESH_TOKEN_EXPIRED`.

> **Phát hiện dùng lại token:** gửi một refresh token đã bị revoke sẽ revoke **toàn bộ** session của user đó (dấu hiệu token bị đánh cắp) — xem architecture.md §7.4.

---

### POST `/auth/logout`
> 🔒 Auth required

Revoke refresh token trong DB + xoá cookie.

**Request:** không có body.

Session được xác định qua claim `sid` của **access token**, KHÔNG qua cookie: cookie refresh token có `Path` hẹp nên browser không gửi nó tới `/auth/logout`.

**Response 200:** `{ "success": true, "data": { "ok": true }, "timestamp": "..." }`

---

### GET `/auth/me`
> 🔒 Auth required

Thông tin user đang đăng nhập. Trả về **đúng object `user`** của response login.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@company.com",
    "role": "admin",
    "employee": {
      "id": 1,
      "fullName": "Nguyễn Văn Admin",
      "avatarUrl": null
    }
  }
}
```

**Errors:** `401 TOKEN_INVALID` (user đã bị xoá), `401 TOKEN_EXPIRED`.

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
> 🔒 Auth required. `admin` · `hr_manager` · `hr_staff` xem toàn công ty; `manager` chỉ xem phòng ban mình quản lý; `employee` nhận `403 FORBIDDEN` và phải dùng `GET /employees/me`.
>
> Endpoint **không** khai báo `@Roles()`: phạm vi dữ liệu do service quyết định theo role, không phải chặn/không chặn.

**Query params:**
```
?search=nguyen     Tìm theo tên, mã NV, email, CCCD
?departmentId=1    Lọc theo phòng ban
?positionId=2      Lọc theo chức vụ
?status=active     Lọc: probation|active|on_leave|resigned|terminated
?gender=male
?hireFrom=2024-01-01
?hireTo=2024-12-31
?onlyDeleted=true  Chỉ hồ sơ đã xoá mềm (để khôi phục)
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

  "permanentAddress": "Số 10, Ngõ 20, Phố Huế, Hà Nội",
  "provinceCode": "01",
  "wardCode": "10105001",

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

> **Địa chỉ – 2 cấp:** `provinceCode` (34 tỉnh/thành, mã Bộ Nội Vụ `01`–`34`, lấy từ `GET /system/provinces`) và `wardCode` (3.321 phường/xã/đặc khu, mã cơ quan thuế TMS, lấy từ `GET /system/wards?provinceCode=01`). Không có cấp huyện. `districtCode` nullable — chỉ dùng để đọc hồ sơ cũ, hồ sơ mới bỏ trống.
>
> `employeeCode` do **server sinh** (`NV0001`, `NV0002`…), client không gửi.

**Errors:** `409 DUPLICATE_CCCD`, `409 DUPLICATE_EMAIL`, `409 DUPLICATE_TAX_CODE`, `409 DUPLICATE_SI_NUMBER`, `409 DUPLICATE_HI_NUMBER`, `400 VALIDATION_ERROR`

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

Soft delete – set `deletedAt`, không xoá khỏi DB. Hợp đồng/chấm công/lương giữ nguyên để còn tra cứu lịch sử.

---

### POST `/employees/:id/restore`
> 🔒 Roles: `admin`, `hr_manager`

Khôi phục hồ sơ đã xoá mềm. Tìm hồ sơ đã xoá qua `GET /employees?onlyDeleted=true`.

**Errors:** `404 EMPLOYEE_NOT_FOUND`, `422 EMPLOYEE_NOT_DELETED` (hồ sơ đang bình thường).

---

### GET `/employees/stats`
> 🔒 Auth required (`employee` → `403 FORBIDDEN`)

Gộp mọi con số của các thẻ tổng quan màn hình danh sách vào **một** request: tổng số, phân bổ theo trạng thái/giới tính/phòng ban, số hợp đồng sắp hết hạn, số người mới tuyển và số người sắp hết thử việc trong cửa sổ gần đây, sinh nhật.

Tính trong **đúng phạm vi** của role gọi nó (manager chỉ thấy phòng ban mình). **Không** có số liệu "so với tháng trước": bảng `employees` chỉ lưu trạng thái hiện tại.

---

### GET `/employees/:id/summary`
> 🔒 Auth required (cùng phạm vi với `GET /employees/:id`)

Tóm tắt hồ sơ dùng cho phiếu lương: phòng ban/chức vụ, MST, số BHXH, tài khoản ngân hàng, số người phụ thuộc đang hiệu lực và hợp đồng đang `active`.

---

### POST `/employees/:id/avatar`
> 🔒 Auth required | Employee upload ảnh của chính mình

**Content-Type:** `multipart/form-data`  
**Field:** `avatar` (file, max 2MB, JPEG/PNG/WEBP)

Kiểu file được xác định bằng **magic bytes**, không tin phần mở rộng.

**Response 200:**
```json
{ "data": { "avatarUrl": "/api/v1/uploads/avatars/51/9f3c1b7a2d4e6f80.jpg" } }
```

> `avatarUrl` phụ thuộc driver lưu trữ. Mặc định hiện tại là driver `local` → đường dẫn **tương đối** dưới `/<API_PREFIX>/uploads/…` (đặt dưới `API_PREFIX` để frontend lấy được ảnh qua đúng Vite proxy `/api` đã có sẵn). Driver `s3` (chưa được kích hoạt) sẽ trả URL tuyệt đối. Phần tên file là ngẫu nhiên: URL mới khác URL cũ nên browser/CDN không trả ảnh cũ từ cache, và người ngoài không đoán được đường dẫn ảnh của nhân viên khác. Xem architecture.md §9.

**Errors:** `400 AVATAR_REQUIRED`, `400 AVATAR_TOO_LARGE`, `400 AVATAR_INVALID_TYPE` (cả ba là 400 chứ không phải VALIDATION_ERROR: lỗi nằm ở phần multipart nên không dựng được `details[].field`), `404 EMPLOYEE_NOT_FOUND`, `403 FORBIDDEN` (không phải ảnh của mình và không thuộc nhóm HR).

---

### GET `/employees/:id/work-history`
> ⏳ **Chưa hiện thực** (bảng `work_history` đã có trong schema, chưa có module/route).

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

> **Mã do server sinh.** `departments.code` = `PB0001`…, `positions.code` = `CV0001`…, `leave_types.code` = `NP0001`…, `employees.code` = `NV0001`…  — client **không** gửi `code` khi tạo và **không** sửa được. Mã **không bao giờ được dùng lại** (kể cả bản ghi đã xoá mềm). Gửi `code` trong body sẽ bị `ValidationPipe` tự strip, không báo lỗi.

### GET `/departments`
> 🔒 Auth required (mọi role đã đăng nhập đều đọc được)

**Query:**
```
?tree=true      Trả về mảng lồng nhau (bỏ qua phân trang) thay vì flat list
?parentId=1     Lọc theo phòng ban cha
?isActive=true  Lọc theo trạng thái
?sort=          code | name | sortOrder (mặc định) | createdAt
```

**Response (flat):**
```json
{
  "data": {
    "items": [
      {
        "id": 1,
        "code": "PB0001",
        "name": "Phòng Nhân sự",
        "description": null,
        "parentId": null,
        "manager": { "id": 5, "fullName": "Trần Thị Mai" },
        "employeeCount": 5,
        "positionCount": 4,
        "sortOrder": 1,
        "isActive": true,
        "createdAt": "2026-08-19T02:00:00.000Z",
        "updatedAt": "2026-08-19T02:00:00.000Z"
      }
    ],
    "meta": { "total": 8, "page": 1, "limit": 20, "totalPages": 1 }
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

### GET `/departments/tree`
> 🔒 Auth required

Alias của `GET /departments?tree=true`, trả thẳng mảng `DepartmentTreeNodeDto` lồng nhau (mỗi node là `DepartmentResponseDto` + `children[]`, sắp xếp theo `sortOrder` rồi `name`).

---

### POST `/departments`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

```json
{
  "name": "Phòng Tài chính",
  "description": "Quản lý thu chi, kế toán",
  "parentId": null,
  "managerId": 10,
  "sortOrder": 0,
  "isActive": true
}
```

> **Không gửi `code`** – server sinh `PB####` và trả về trong response.

**Errors:** `404 DEPARTMENT_NOT_FOUND` / `422 PARENT_DEPARTMENT_NOT_FOUND`, `422 EMPLOYEE_NOT_FOUND` (managerId không tồn tại), `409 CODE_ALLOCATION_FAILED` (không cấp được mã duy nhất sau số lần thử tối đa).

---

### PATCH `/departments/:id` | DELETE `/departments/:id`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

PATCH nhận đúng các field của POST (đều tuỳ chọn); `parentId: null` / `managerId: null` để gỡ liên kết. **Không** sửa được `code`.

**Errors (PATCH):** `422 DEPARTMENT_CYCLE` (đặt cha thành chính nó hoặc thành con cháu của nó).
**Errors (DELETE):** `422 DEPARTMENT_HAS_EMPLOYEES`, `422 DEPARTMENT_HAS_CHILDREN`, `422 DEPARTMENT_HAS_POSITIONS`.

---

## 5. Positions – Chức vụ

> `positions.code` do server sinh: `CV0001`, `CV0002`… — xem ghi chú ở §4.

### GET `/positions`
> 🔒 Auth required

**Query:** `?departmentId=2`, `?level=2`, `?isActive=true`, `?sort=` (`code` mặc định · `name` · `level` · `createdAt`), phân trang chuẩn §1.2.

**Response:**
```json
{
  "data": {
    "items": [
      {
        "id": 3,
        "code": "CV0003",
        "name": "Developer Senior",
        "department": { "id": 2, "name": "Phòng Kỹ thuật" },
        "level": 2,
        "minSalary": 20000000,
        "maxSalary": 35000000
      }
    ],
    "meta": { "total": 12, "page": 1, "limit": 20, "totalPages": 1 }
  }
}
```

### POST | PATCH | DELETE `/positions` | `/positions/:id`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

```json
{
  "name": "Developer Senior",
  "departmentId": 2,
  "level": 2,
  "minSalary": 20000000,
  "maxSalary": 35000000,
  "description": null,
  "isActive": true
}
```

`level`: 1 Staff · 2 Senior · 3 Lead · 4 Manager · 5 Director. **Không gửi `code`.**

**Errors:** `404 POSITION_NOT_FOUND`, `422 DEPARTMENT_NOT_FOUND`, `422 INVALID_SALARY_RANGE` (`minSalary > maxSalary`), `422 POSITION_HAS_EMPLOYEES` (khi xoá), `409 CODE_ALLOCATION_FAILED`.

---

## 6. Contracts – Hợp đồng

### GET `/contract-types`
> 🔒 Auth required — **read-only, không có POST/PATCH/DELETE**

Trả về mảng phẳng 4 giá trị của enum `contracts.contract_type` kèm nhãn tiếng Việt và căn cứ pháp lý:

```json
{
  "data": [
    { "value": "probation",  "label": "Hợp đồng thử việc", "description": "Thoả thuận thử việc – Điều 24÷27 BLLĐ 2019 …" },
    { "value": "fixed_term", "label": "Hợp đồng lao động xác định thời hạn", "description": "Điều 20.1.b BLLĐ 2019 – tối đa 36 tháng …" },
    { "value": "indefinite", "label": "Hợp đồng lao động không xác định thời hạn", "description": "Điều 20.1.a BLLĐ 2019 …" },
    { "value": "seasonal",   "label": "Hợp đồng theo mùa vụ / công việc nhất định", "description": "BLLĐ 2012 (Điều 22.1.c), đã bị BLLĐ 2019 bãi bỏ – chỉ đọc dữ liệu lịch sử" }
  ]
}
```

---

### GET `/contracts`
> 🔒 Auth required. Phạm vi theo hồ sơ: nhân viên chỉ thấy hợp đồng của chính mình, manager thấy phòng ban mình, nhóm HR thấy toàn công ty.

**Query:** `?employeeId=1`, `?status=active`, `?contractType=fixed_term`, `?expiringDays=30` (hợp đồng có `end_date`, chưa quá hạn, hết hạn trong N ngày tới), phân trang chuẩn §1.2.

---

### GET `/contracts/:id`
> 🔒 Auth required (cùng phạm vi với `GET /contracts`)

**Errors:** `404 CONTRACT_NOT_FOUND`, `403 FORBIDDEN`.

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

Kiểm tra quy tắc BLLĐ 2019: HĐ không xác định thời hạn không có `endDate`; HĐ xác định thời hạn ≤ 36 tháng và tối đa 2 lần liên tiếp; thử việc ≤ 180 ngày.

**Errors:** `409 DUPLICATE_CONTRACT_NUMBER`, `409 CONTRACT_ALREADY_ACTIVE`, `422 EMPLOYEE_NOT_FOUND`, `422 INVALID_CONTRACT_PERIOD`, `422 INVALID_SIGN_DATE`, `422 INVALID_CONTRACT_STATUS`, `422 CONTRACT_TYPE_LIMIT`.

---

### PATCH `/contracts/:id`
> 🔒 Roles: `admin`, `hr_manager`

Partial update. **Errors:** `404 CONTRACT_NOT_FOUND`, `409 DUPLICATE_CONTRACT_NUMBER`, `409 CONTRACT_ALREADY_ACTIVE`, `422 CONTRACT_ALREADY_TERMINATED`, `422 INVALID_CONTRACT_PERIOD`.

---

### PATCH `/contracts/:id/terminate`
> 🔒 Roles: `admin`, `hr_manager`

```json
{
  "terminatedDate": "2026-10-31",
  "terminatedReason": "Nhân viên xin thôi việc"
}
```

**Errors:** `404 CONTRACT_NOT_FOUND`, `422 CONTRACT_ALREADY_TERMINATED`, `422 CONTRACT_NOT_SIGNED`, `422 INVALID_DATE_RANGE`.

---

### DELETE `/contracts/:id`
> 🔒 Roles: `admin`, `hr_manager`

**Chỉ xoá được hợp đồng `status = draft`.** Bảng `contracts` không có `deleted_at` nên đây là **xoá vật lý**; hợp đồng đã ký phải dùng `/terminate` để giữ lại lịch sử.

**Errors:** `404 CONTRACT_NOT_FOUND`, `422 CONTRACT_NOT_DELETABLE` (hợp đồng đã ký).

---

## 7. Attendances – Chấm công

> ⚠️ **KHÔNG có endpoint tự chấm công.** Nhân viên không đăng nhập hệ thống này (`403 PORTAL_ACCESS_DENIED`). Dữ liệu chấm công nạp vào qua **file Excel** (`POST /attendances/bulk-import`) hoặc **nhập tay từng dòng** (`POST /attendances`).

### POST `/attendances`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

Nhập tay MỘT ngày công — dùng cho ca lẻ mà file từ nền tảng ngoài không có:
quên chấm, đi công tác, làm tại nhà, hoặc một ngày nghỉ phép.

```json
{
  "employeeId": 51,
  "workDate": "2026-05-25",
  "checkIn": "08:00",
  "checkOut": "17:30",
  "breakStart": "12:00",
  "breakEnd": "13:00",
  "status": "present",
  "note": "Nhân viên quên chấm, trưởng phòng xác nhận"
}
```

| Trường | Bắt buộc | Ghi chú |
|--------|:---:|---------|
| `employeeId` | ✅ | Trong phạm vi của người gọi |
| `workDate` | ✅ | `YYYY-MM-DD` |
| `checkIn` / `checkOut` | ❌ | Ngày nghỉ phép/ngày lễ không có giờ nào |
| `breakStart` / `breakEnd` | ❌ | Giờ nghỉ thực tế; trừ đúng khoảng này. Bỏ trống ⇒ trừ theo khung nghỉ chuẩn 12:00–13:00. Phải có đủ cả hai đầu |
| `status` | ❌ | Bỏ trống ⇒ tính từ giờ vào/ra. Đặt tường minh cho `wfh`, `leave`, `holiday` |
| `note` | ✅ | Dòng nhập tay không có bằng chứng từ máy chấm công nên phải nói được nguồn |

**Errors:** `409 ATTENDANCE_ALREADY_EXISTS` (ngày đó đã có bản ghi — sửa bằng
`PATCH` thay vì tạo mới), `409 INVALID_ATTENDANCE_TIMES`, `404 EMPLOYEE_NOT_FOUND`

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

`month` một mình bị **bỏ qua** (tháng 5 của năm nào?). `manager` chỉ nhận được
phòng ban mình quản.

---

### PATCH `/attendances/:id`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

Điều chỉnh chấm công (máy lỗi, quên chấm...). `manager` **không** sửa được dù
đọc được phòng mình.

```json
{
  "checkIn": "08:00",
  "checkOut": "17:30",
  "breakStart": "12:00",
  "breakEnd": "12:30",
  "note": "Điều chỉnh do máy chấm công lỗi"
}
```

`note` là **bắt buộc**: bản ghi sau khi sửa phải tự nói được vì sao nó khác thứ
máy đã ghi. Sửa giờ thì giờ công, đi muộn, về sớm được **tính lại**.

---

### POST `/attendances/bulk-import`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

Nhập chấm công từ file Excel xuất từ nền tảng ngoài.

**Content-Type:** `multipart/form-data`, field: `file` (.xlsx)
**Query:** `?dryRun=true` — chỉ kiểm tra, KHÔNG ghi gì.

**Cột file** (tiêu đề khớp không phân biệt hoa thường và dấu):

| Cột | Bắt buộc | Bí danh chấp nhận |
|-----|:---:|-------------------|
| Mã NV | ✅ | `ma nhan vien`, `employee code` |
| Ngày | ✅ | `ngay cong`, `date` |
| Giờ vào | ✅ | `check in`, `gio den` |
| Giờ ra | ❌ | `check out`, `gio ve` |
| Giờ nghỉ từ | ❌ | `bat dau nghi`, `break start` |
| Giờ nghỉ đến | ❌ | `ket thuc nghi`, `break end` |
| Ghi chú | ❌ | `note` |

> **TẤT CẢ HOẶC KHÔNG GÌ CẢ.** Chỉ cần một dòng sai là KHÔNG dòng nào được ghi,
> và toàn bộ lỗi được trả về kèm **số dòng trong file Excel**. Nhập một phần sẽ
> để lại một tháng công nửa vời mà không ai biết thiếu ngày nào — và bảng công
> thiếu ngày trông y hệt bảng công đủ.

**Response 201:**
```json
{
  "data": {
    "dryRun": false,
    "totalRows": 120,
    "created": 98,
    "updated": 22,
    "errors": []
  }
}
```

`updated` = số ngày công **bị ghi đè**. Luôn được trả về (kể cả khi `dryRun`) để
không ai vô tình thay đổi dữ liệu đã chốt mà không biết.

**Errors:** `400 IMPORT_FILE_REQUIRED`, `400 IMPORT_INVALID_FILE_TYPE` (kiểm
magic bytes, không tin phần mở rộng), `400 IMPORT_MISSING_COLUMNS`,
`400 IMPORT_TOO_MANY_ROWS`

---

### GET `/attendances/import-template`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

File .xlsx mẫu, có sẵn các dòng ví dụ cho định dạng mong đợi.

---

## 8. Leaves – Nghỉ phép

> ⚠️ **Nhân viên KHÔNG tự nộp đơn** — họ không đăng nhập hệ thống này.
> **Quản lý ghi nhận** đơn cho nhân viên phòng mình (nhân sự ghi cho bất kỳ ai),
> **nhân sự duyệt**. Người ghi lưu ở `recorded_by` lấy từ token, và người đã ghi
> một đơn KHÔNG duyệt được chính đơn đó.

### GET `/leave-types`
> 🔒 Auth required

Danh mục loại nghỉ phép (Giai đoạn 2.2). Ghi ở `Cài đặt → Loại nghỉ phép`.

---

### POST `/leave-balances/init`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

Cấp quỹ phép năm cho toàn bộ nhân viên đang làm việc (`probation`, `active`,
`on_leave`).

```json
{ "year": 2026, "dryRun": false, "carryOver": false }
```

Số ngày theo **Điều 113 BLLĐ 2019**: 12 + ⌊thâm niên ÷ 5⌋, đếm theo mốc kỷ niệm
ngày vào làm. Năm đầu tiên tính theo tỉ lệ tháng đã làm, **làm tròn xuống** 0,5
ngày; vào làm sau ngày 15 thì tháng đó không tính.

Chỉ cấp cho loại phép `ANNUAL`. **KHÔNG ghi đè** quỹ đã có — chạy lại chỉ tạo
cho người còn thiếu.

**Response 201:**
```json
{
  "data": {
    "dryRun": false,
    "year": 2026,
    "employeesConsidered": 66,
    "created": 62,
    "skipped": 4
  }
}
```

**Errors:** `422 ANNUAL_LEAVE_TYPE_MISSING` – chưa seed loại phép năm

---

### GET `/leave-balances`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`, `manager`

**Query:** `?employeeId=`, `?departmentId=`, `?leaveTypeId=`, `?year=`

Bỏ trống `year` thì lấy năm hiện tại — quỹ phép luôn thuộc về một năm cụ thể.
`manager` chỉ nhận được phòng ban mình quản.

`remainingDays` là cột **VIRTUAL** của DB: `allocated + carriedOver − used −
pending`. Chỉ đọc.

---

### PATCH `/leave-balances/:id`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

```json
{ "allocatedDays": 14, "carriedOver": 2, "reason": "Bổ sung theo thoả thuận" }
```

Chỉ sửa được `allocatedDays` và `carriedOver`. `usedDays`/`pendingDays` là hệ
quả của các đơn nghỉ — sai ở đâu thì sửa đơn ở đó. `reason` **bắt buộc**.

**Errors:** `422 LEAVE_BALANCE_BELOW_COMMITTED` – hạ quỹ xuống dưới số đã dùng +
đang chờ

---

### DELETE `/leave-balances/:id`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

Xoá một dòng quỹ **cấp nhầm** — nhầm loại phép, nhầm người, nhầm năm.

Chỉ xoá được khi `usedDays` và `pendingDays` đều bằng 0. Đã có đơn trừ vào dòng
này thì xoá là bỏ rơi chính những đơn đó: ngày nghỉ vẫn nằm trong bảng chấm công
mà không còn gì giải thích chúng đến từ đâu. Muốn hạ quỹ về đúng phần chưa dùng
thì `PATCH`, không phải xoá.

```json
{ "id": 88, "deleted": true }
```

**Errors:** `422 LEAVE_BALANCE_IN_USE` – đã có ngày bị tiêu

---

### POST `/leave-requests`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`, `manager`

```json
{
  "employeeId": 51,
  "leaveTypeId": 1,
  "startDate": "2026-05-04",
  "endDate": "2026-05-08",
  "startHalf": "afternoon",
  "endHalf": "full",
  "reason": "Nghỉ phép năm về quê"
}
```

`totalDays` do **SERVER** tính, client không gửi: chỉ đếm ngày làm việc (bỏ
T7/CN và ngày lễ), hỗ trợ nửa ngày ở hai đầu. Nghỉ thứ Sáu → thứ Hai là **2
ngày**, không phải 4.

Quỹ phép bị **giữ chỗ** (`pending_days`) ngay khi ghi nhận, trong cùng một
transaction với đơn.

**Errors:** `409 OVERLAPPING_LEAVE` · `422 INVALID_LEAVE_RANGE` ·
`422 LEAVE_SPANS_TWO_YEARS` (quỹ là con số của một năm — tách thành hai đơn) ·
`422 LEAVE_NO_WORKING_DAYS` · `422 LEAVE_BELOW_MINIMUM` ·
`422 LEAVE_ABOVE_MAX_CONSECUTIVE` · `422 INSUFFICIENT_LEAVE_BALANCE`

---

### GET `/leave-requests`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`, `manager`

**Query:** `?status=pending`, `?employeeId=`, `?departmentId=`, `?leaveTypeId=`,
`?from=&to=`

`from`/`to` lọc theo kỳ nghỉ **GIAO NHAU** với khoảng, không phải chỉ đơn bắt
đầu trong khoảng — một kỳ nghỉ bắc qua đầu tháng vẫn phải hiện trong tháng đó.

---

### GET `/leave-requests/calendar`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`, `manager`

**Query:** `?from=2026-05-01&to=2026-05-31` *(cả hai bắt buộc)*

Ai đang nghỉ trong khoảng ngày. Chỉ trả đơn **đã duyệt** — một đơn còn chờ duyệt
chưa cho phép ai nghỉ cả.

---

### PATCH `/leave-requests/:id/approve`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

`manager` ghi nhận nhưng **KHÔNG duyệt**. Người đã ghi một đơn cũng không duyệt
được chính đơn đó.

Chuyển `pending_days` sang `used_days`, và **ghi những ngày nghỉ vào bảng chấm
công** với `status = leave` — đây là thứ khiến `absentDays` không tính người
nghỉ phép là vắng mặt.

**Response 200:**
```json
{
  "data": {
    "request": { "id": 33, "status": "approved" },
    "attendanceDaysWritten": 4,
    "attendanceConflicts": ["2026-05-06"]
  }
}
```

`attendanceConflicts` là những ngày **đã có** dữ liệu chấm công nên KHÔNG bị ghi
đè: vừa có giờ chấm vừa được duyệt nghỉ phép trong cùng ngày là mâu thuẫn cần
người xem, không phải thứ để phần mềm tự quyết.

**Errors:** `403 FORBIDDEN` · `403 CANNOT_APPROVE_OWN_RECORD` ·
`409 LEAVE_NOT_PENDING`

---

### PATCH `/leave-requests/:id/reject`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff` — `reason` bắt buộc.

Trả lại chỗ đã giữ trên quỹ phép.

### PATCH `/leave-requests/:id/cancel`
> 🔒 Người GHI NHẬN đơn, hoặc nhân sự. Chỉ đơn còn `pending`.

Đơn chuyển sang `cancelled` và **vẫn nằm lại** trong danh sách. Muốn gỡ hẳn thì
dùng `DELETE`.

---

### PATCH `/leave-requests/:id`
> 🔒 Đơn `pending`: người GHI NHẬN đơn, hoặc nhân sự.
> Đơn `approved`: **chỉ nhân sự** — sửa nó là viết lại một quyết định đã ra.

```json
{ "leaveTypeId": 1, "startDate": "2026-05-04", "endDate": "2026-05-06",
  "startHalf": "afternoon", "endHalf": "full", "reason": "Rút ngắn kỳ nghỉ" }
```

Mọi trường đều **tuỳ chọn**; trường không gửi thì giữ nguyên.

**KHÔNG nhận `employeeId`.** Đổi người được nghỉ không phải là sửa đơn mà là một
đơn khác: quỹ phép, phạm vi quản lý của người ghi và cả việc kiểm tra trùng ngày
đều tính theo nhân viên. Nhập nhầm người thì xoá rồi ghi lại.

**KHÔNG nhận `totalDays`** — server tính lại từ khoảng ngày mới, đúng như lúc ghi
nhận. Quỹ phép **trả chỗ cũ trước rồi mới giữ chỗ mới**, trong cùng một
transaction: làm ngược lại thì một đơn 3 ngày sửa thành 4 sẽ bị từ chối oan khi
quỹ chỉ còn đúng 3.

**Sửa đơn ĐÃ DUYỆT kéo theo hai thứ**, cả hai đi cùng transaction với đơn:

| | Đơn `pending` | Đơn `approved` |
|---|---|---|
| Cột quỹ bị đụng | `pending_days` | `used_days` |
| Bảng chấm công | – | gỡ ngày công kỳ nghỉ **cũ**, ghi ngày công kỳ nghỉ **mới** |

Dòng chấm công của kỳ nghỉ cũ **đã bị sửa** sang trạng thái khác thì giữ lại
(`attendanceDaysKept`); ngày của kỳ nghỉ mới **đã có sẵn** dữ liệu chấm công thì
không bị ghi đè (`attendanceConflicts`). Đơn vẫn ở trạng thái `approved` —
không phải duyệt lại.

Đơn `rejected` / `cancelled` **không sửa được**: nó không giữ ngày nào và không
có dòng chấm công nào, nên sửa ngày trên đó chỉ khiến lý do từ chối nói về một kỳ
nghỉ chưa từng tồn tại. Cần lại thì ghi đơn mới.

**Response 200:**
```json
{ "request": { "...": "đơn sau khi sửa" },
  "attendanceDaysWritten": 2, "attendanceConflicts": [], "attendanceDaysKept": 0 }
```

**Errors:** `409 LEAVE_NOT_ACTIVE` · `409 OVERLAPPING_LEAVE` · các mã 422 giống
`POST /leave-requests` (kể cả `INSUFFICIENT_LEAVE_BALANCE` khi kéo dài một đơn đã
duyệt quá quỹ còn lại)

---

### DELETE `/leave-requests/:id`
> 🔒 Đơn `pending`: người GHI NHẬN hoặc nhân sự.
> Đơn `approved` / `rejected` / `cancelled`: **chỉ nhân sự** — xoá nó là đảo
> ngược một quyết định đã ra, kèm hoàn lại quỹ phép.

Xoá **gỡ sạch dấu vết đơn để lại**, trong một transaction:

| Trạng thái đơn | Quỹ phép | Bảng chấm công |
|---|---|---|
| `pending` | hoàn `pending_days` | – |
| `approved` | hoàn `used_days` | gỡ những ngày `leave` do đơn ghi ra |
| `rejected` · `cancelled` | không đổi (đã hoàn từ trước) | – |

FK `attendances.leave_request_id` là `ON DELETE SET NULL`, nên xoá đơn suông sẽ
để lại những dòng `leave` mồ côi — người xem bảng công thấy nhân viên nghỉ phép
mà không tra ra được theo đơn nào. Vì thế service gỡ chúng tường minh.

Dòng chấm công **đã bị sửa** sang trạng thái khác thì **giữ lại**: nó không còn
là hệ quả của đơn nữa mà là ngày công thật, nhập tay hoặc nạp từ máy chấm công.

```json
{ "id": 12, "deleted": true, "attendanceDaysRemoved": 3, "attendanceDaysKept": 1 }
```

---

## 9. Salaries – Lương

> **Quyền ở phân hệ này HẸP HƠN mọi phân hệ khác.** `manager` đọc được hồ sơ và
> chấm công của phòng mình nhưng **không** đọc lương: biết lương nhân viên dưới
> quyền không cần cho việc quản lý công việc, và một bảng lương lộ ra nội bộ là
> chuyện không thu lại được.
>
> | | Vai trò |
> |---|---|
> | Đọc bảng lương | `admin`, `hr_manager`, `hr_staff` |
> | Tính / sửa / duyệt / huỷ | `admin`, `hr_manager` |
>
> **Không có `GET /salaries/me`** — nhân viên không đăng nhập hệ thống này;
> phiếu lương cá nhân do nhân sự in ra từ `GET /salaries/:id`.
>
> Mọi số tiền trả về là **`number`**, không phải chuỗi: TypeORM trả `DECIMAL`
> dạng chuỗi để khỏi mất chính xác, nhưng giữ nguyên ra tới client thì mọi phép
> cộng ở giao diện đều là nối chuỗi.

### POST `/salaries/calculate`
> 🔒 Roles: `admin`, `hr_manager`

Tính lương cho **toàn bộ** nhân viên đang làm việc có hợp đồng còn hiệu lực
trong kỳ. Một lần chạy là **một tháng** — số ngày công chuẩn là mẫu số chung của
cả công ty, tính lẻ từng người sẽ mở đường cho hai người cùng tháng khác mẫu số.

```json
{ "year": 2026, "month": 8, "dryRun": false }
```

**Chạy lại được bao nhiêu lần cũng được** chừng nào bảng lương chưa chốt: dòng
`draft`/`calculated` bị ghi đè bằng số mới, dòng `approved`/`paid` được **giữ
nguyên** và đếm ở `skippedLocked`. Chấm công nhập bổ sung sau khi đã tính là
chuyện thường ngày, nên "tính một lần rồi thôi" sẽ luôn cho ra bảng lương cũ.

Khoản **chỉnh tay** (`performanceBonus`, `otherIncome`, `otherDeductions`) được
giữ lại qua lần tính lại — chúng không suy ra được từ dữ liệu gốc.

**Response 200:**
```json
{
  "year": 2026, "month": 8, "standardWorkingDays": 21,
  "employeesConsidered": 66, "created": 60, "updated": 0,
  "skippedLocked": 0, "skippedNoContract": ["NV0001"],
  "totalGross": 955159291, "totalNet": 804272345, "dryRun": false
}
```

**Errors:** `422 PAYROLL_NO_WORKING_DAYS` – kỳ không có ngày công chuẩn nào

---

### GET `/salaries/summary?year=2026&month=8`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

Số người, tổng gross/net/bảo hiểm/thuế và số dòng theo từng trạng thái. Gộp ở DB
chứ không kéo hết dòng về rồi cộng bằng JavaScript.

### GET `/salaries/periods`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

Mảng `{ year, month }` các kỳ **đã có dữ liệu**, mới nhất trước — để giao diện
biết tháng nào chọn được thay vì cho chọn mọi tháng rồi trả về rỗng.

---

### GET `/salaries`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

**Query:** `?year=2026` (**bắt buộc**) `&month=8&employeeId=51&departmentId=2&status=calculated`,
phân trang chuẩn §1.2. `sort`: `employeeCode` (mặc định) · `netSalary` · `grossSalary`.

Bỏ trống `month` để xem cả năm của một người — đó là câu hỏi thật khi tra cứu
thu nhập cả năm. Nhưng `year` thì không bỏ được: trộn nhiều năm vào một danh
sách thì cột "thực nhận" không còn cộng lại thành gì có nghĩa.

### GET `/salaries/:id`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

**Response (rút gọn):**
```json
{
  "id": 120, "employeeId": 51,
  "employee": { "employeeCode": "NV0051", "fullName": "Nguyễn Văn Bình",
                "departmentName": "Phòng Kỹ thuật", "positionName": "Kỹ sư phần mềm" },
  "month": 8, "year": 2026,
  "standardWorkingDays": 21, "actualWorkingDays": 19,
  "paidLeaveDays": 2, "unpaidLeaveDays": 0, "overtimeHours": 6.5,
  "baseSalary": 20000000, "positionAllowance": 2000000,
  "mealAllowance": 730000, "overtimePay": 1218750,
  "grossSalary": 23948750,
  "insuranceBaseSalary": 20000000,
  "socialInsurance": 1600000, "healthInsurance": 300000,
  "unemploymentInsurance": 200000, "totalInsurance": 2100000,
  "dependentCount": 1, "selfDeduction": 15500000, "dependentDeduction": 6200000,
  "taxableIncome": 0, "personalIncomeTax": 0,
  "advanceDeduction": 0, "otherDeductions": 0,
  "netSalary": 21848750,
  "status": "calculated", "approvedAt": null, "paidAt": null
}
```

---

### PATCH `/salaries/:id`
> 🔒 Roles: `admin`, `hr_manager`

```json
{ "performanceBonus": 3000000, "otherIncome": 0, "otherDeductions": 0,
  "note": "Thưởng dự án Q3" }
```

**CHỈ ba khoản không suy ra được từ dữ liệu gốc.** Lương cơ bản, bảo hiểm, thuế
và ngày công đều do server tính từ hợp đồng và chấm công; cho sửa tay là mở
đường cho một bảng lương không khớp với bất kỳ dữ liệu gốc nào và không ai dò
lại được.

Sửa xong server **tính lại** thuế TNCN và lương thực nhận.

**Errors:** `409 SALARY_LOCKED` – phiếu đã duyệt/đã trả

---

### PATCH `/salaries/:id/approve` · `/mark-paid` · `/cancel`
> 🔒 Roles: `admin`, `hr_manager`

Vòng đời một phiếu: `calculated` → `approved` → `paid`.

| Endpoint | Từ | Sang | Ghi chú |
|---|---|---|---|
| `/approve` | `calculated` | `approved` | Từ đây phiếu bị khoá: không tính lại, không sửa tay |
| `/mark-paid` | `approved` | `paid` | Nhảy thẳng từ `calculated` là bỏ mất bước kiểm soát cuối cùng trước khi tiền rời công ty |
| `/cancel` | bất kỳ | `cancelled` | Đường thoát duy nhất khi phát hiện sai sau khi duyệt; phiếu vẫn nằm lại làm vết |

**Errors:** `409 SALARY_NOT_CALCULATED` · `409 SALARY_NOT_APPROVED` ·
`409 SALARY_ALREADY_CANCELLED`

---

## 9b. Salary Advances – Tạm ứng lương

> Cùng khuôn với đơn nghỉ phép, vì cùng một lý do: nhân viên không đăng nhập hệ
> thống này nên không ai tự đề nghị. **Quản lý ghi nhận** cho phòng mình (nhân sự
> ghi cho bất kỳ ai), **nhân sự duyệt**, và người đã ghi **không** duyệt được
> chính phiếu đó — tạm ứng là tiền mặt ra khỏi công ty.

### POST `/salary-advances`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`, `manager`

```json
{ "employeeId": 51, "amount": 5000000, "advanceDate": "2026-08-20",
  "deductMonth": 9, "deductYear": 2026, "reason": "Ứng trước tiền viện phí" }
```

**`deductMonth`/`deductYear` là KỲ LƯƠNG bị trừ, tách khỏi `advanceDate` là ngày
thực chi.** Ứng ngày 28/07 để trừ vào lương tháng 8 là chuyện bình thường; suy
kỳ trừ từ ngày ứng sẽ đoán sai đúng những trường hợp đó, mà đoán sai ở đây nghĩa
là trừ hai lần hoặc không trừ lần nào.

### GET `/salary-advances`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`, `manager` — `manager` chỉ thấy phòng mình.

**Query:** `?employeeId=51&status=pending&deductYear=2026&deductMonth=9`

### PATCH `/salary-advances/:id/approve` · `/reject` · `/cancel`
> 🔒 `approve`/`reject`: `admin`, `hr_manager`. `cancel`: người GHI NHẬN hoặc nhân sự.

`reject` cần `reason`. Cả ba chỉ chạy trên phiếu còn `pending`.

Phiếu đã duyệt sẽ được lần chạy tính lương của kỳ đó trừ vào `advanceDeduction`
và chuyển sang trạng thái `deducted`.

**Errors:** `403 CANNOT_APPROVE_OWN_RECORD` · `409 ADVANCE_NOT_PENDING`

---

## 9c. Payroll Settings – Cấu hình lương

### GET `/payroll-settings` | PATCH `/payroll-settings`
> 🔒 Roles: `admin`, `hr_manager`

```json
{ "minimumWageRegion": 1, "mealAllowance": 730000, "transportAllowance": 0,
  "phoneAllowance": 0, "attendanceAllowance": 0, "payOvertime": true }
```

Ở đây là những thứ **giống nhau cho mọi người**: vùng lương tối thiểu và các
khoản phụ cấp theo chính sách chung. Khoản thoả thuận riêng với từng người (lương
cơ bản, lương đóng bảo hiểm, phụ cấp chức vụ) nằm ở **hợp đồng**.

`minimumWageRegion` quyết định **trần đóng BHTN** (20 × lương tối thiểu vùng),
khác trần BHXH/BHYT (20 × mức tham chiếu) — xem business-rules.md §1.2.

Sửa cấu hình chỉ ảnh hưởng tới các kỳ lương **tính từ nay**; bảng lương đã tính
giữ nguyên con số của lúc đó, vì nó là chứng từ.

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

**Errors:** `404 FAMILY_MEMBER_NOT_FOUND`, `404 EMPLOYEE_NOT_FOUND`, `403 FORBIDDEN` (ngoài phạm vi của role).

---

## 11. Dependents – Người phụ thuộc

### GET `/employees/:id/dependents`
> 🔒 Auth required — nhân viên xem được người phụ thuộc của **chính mình**; nhóm HR xem của bất kỳ ai.

### POST `/employees/:id/dependents`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

```json
{
  "fullName": "Nguyễn Thị Mẹ",
  "relationship": "mother",
  "dateOfBirth": "1960-04-15",
  "cccdNumber": null,
  "taxCode": null,
  "registrationDate": "2026-01-01",
  "endDate": null,
  "documentUrl": "https://s3.../dependent-doc.pdf",
  "note": "Mẹ ruột, không có thu nhập"
}
```

`endDate` = ngày kết thúc đăng ký giảm trừ (`null` = còn hiệu lực).

### PATCH `/employees/:id/dependents/:depId`
### DELETE `/employees/:id/dependents/:depId`
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`

**Errors:** `404 DEPENDENT_NOT_FOUND`, `409 DEPENDENT_ALREADY_CLAIMED`, `422 DEPENDENT_REASON_REQUIRED`, `422 INVALID_DATE_RANGE`.

---

## 12. Documents – Tài liệu

> ⏳ **Toàn bộ §12 chưa hiện thực.**

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

### GET `/roles`
> 🔒 Auth required (mọi role đã đăng nhập)

Danh sách vai trò đang hoạt động, dùng để đổ dropdown khi tạo tài khoản. Chỉ là tên vai trò, không phải dữ liệu nhạy cảm.

### POST `/users`
> 🔒 Roles: `admin`

Tạo tài khoản đăng nhập cho một nhân viên. Hồ sơ nhân viên (`employees`) và tài khoản (`users`) là **hai bản ghi tách rời**, nối qua `users.employee_id`; đây là bước "tài khoản" của wizard tạo nhân viên.

```json
{
  "username": "binh.nguyen",
  "email": "binh.nguyen@company.com",
  "password": "Temp@2026",
  "roleId": 5,
  "employeeId": 51
}
```

**Errors:** `409 DUPLICATE_USERNAME`, `409 DUPLICATE_EMAIL`, `409 EMPLOYEE_ALREADY_HAS_ACCOUNT`, `422 ROLE_NOT_FOUND`, `403 FORBIDDEN` (chỉ admin).

### GET `/users` · PATCH `/users/:id` · PATCH `/users/:id/reset-password`
> ⏳ **Chưa hiện thực.** Phạm vi hẹp là **cố ý**: màn hình quản lý tài khoản chưa nằm trong giai đoạn nào của PLAN, thêm sớm là code không ai gọi.

---

## 14. Announcements – Thông báo nội bộ

> ⏳ **Toàn bộ §17 chưa hiện thực** (Giai đoạn 8).

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

## 15. Leave Balances – Quản lý ngày phép

Xem [§8](#8-leaves--nghỉ-phép) — `/leave-types`, `/leave-balances`, `/leave-requests`.

---

## 16. Reports – Báo cáo

> **Trạng thái:** chỉ `GET /reports/employees/export` đã hiện thực. Các report còn lại của §19 chưa có. (Số liệu tổng quan nhân sự hiện lấy qua `GET /employees/stats` — xem §3.)

### GET `/reports/dashboard/stats`
> ⏳ **Chưa hiện thực.** Màn hình danh sách nhân viên đang dùng `GET /employees/stats` (§3).
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

Xuất danh sách nhân viên ra Excel (`.xlsx`), 3 sheet theo đúng thứ tự: **`Danh sách`** · **`Thông tin BH`** · **`Thông tin lương`**.

> `manager` **bị loại** khỏi endpoint này một cách có chủ đích, dù vẫn xem được danh sách phòng ban mình trên màn hình: xem một phòng trên màn hình khác với rút cả phòng ra một file mang đi.

**Query:** dùng **chung** bộ filter của `GET /employees` (`search`, `departmentId`, `positionId`, `status`, `gender`, `hireFrom`, `hireTo`, `onlyDeleted`) — file xuất ra đúng bằng những dòng đang hiển thị trên màn hình. `page`/`limit` bị **bỏ qua** (bản xuất không phân trang). Phạm vi dữ liệu theo đúng phạm vi role của `GET /employees`.

| Query thêm | Mặc định | Ý nghĩa |
|-----------|----------|---------|
| `includeSensitive` | `false` | `true` → xuất CCCD, số tài khoản và các cột tiền ở dạng **đầy đủ** (không che). Mặc định CCCD/số tài khoản bị che (`********9432`) và các cột tiền để trống, tiêu đề cột gắn hậu tố ` (ẩn)` |

**Vì sao phải xin tường minh:** `includeSensitive=true` **chỉ dành cho `admin`/`hr_manager`** — `hr_staff` gửi cờ này nhận `403 SENSITIVE_EXPORT_FORBIDDEN` (nhập liệu được nhưng không được mang dữ liệu nhạy cảm của toàn công ty ra khỏi hệ thống). Mỗi lần xuất bản đầy đủ đều được ghi log mức `warn` kèm người yêu cầu.

**Trần số dòng:** **10.000**. Vượt trần → `422 EXPORT_TOO_MANY_ROWS`, **KHÔNG cắt bớt im lặng**: người nhận file sẽ hành động trên nó như thể nó đầy đủ, nên thiếu dòng mà không báo là lỗi toàn vẹn dữ liệu chứ không phải bất tiện nhỏ.

**Response:** `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, kèm `Content-Disposition` có cả `filename=` (ASCII, đã bỏ dấu) lẫn `filename*=UTF-8''…` (tên tiếng Việt) và `X-Content-Type-Options: nosniff`.

> **CORS:** browser giấu mọi response header khỏi JS trừ một danh sách ngắn, và `Content-Disposition` không nằm trong đó — server khai báo `exposedHeaders: ['Content-Disposition']` để frontend đọc được tên file. Ở dev thì Vite proxy làm request thành same-origin nên không thấy vấn đề này.

**Errors:** `403 FORBIDDEN` (role không được xuất), `403 SENSITIVE_EXPORT_FORBIDDEN`, `422 EXPORT_TOO_MANY_ROWS`.

---

### GET `/reports/salaries/export`
> ⏳ **Chưa hiện thực.**
> 🔒 Roles: `admin`, `hr_manager`

**Query:** `?month=5&year=2026&departmentId=2`

**Response:** Excel bảng lương chi tiết từng khoản.

---

### GET `/reports/attendances/export`
> ⏳ **Chưa hiện thực.**
> 🔒 Roles: `admin`, `hr_manager`, `hr_staff`, `manager`

**Query:** `?month=5&year=2026&departmentId=2`

---

### GET `/reports/leaves/summary`
> ⏳ **Chưa hiện thực.**
> 🔒 Roles: `admin`, `hr_manager`

**Query:** `?year=2026`

---

## 17. System – Dữ liệu hệ thống

> 🔒 Mọi endpoint `/system/*` yêu cầu đăng nhập. Chỉ đọc, trả **mảng phẳng** (không phân trang). CRUD ngày lễ ở prefix `/holidays` có phân trang như bình thường.

### Địa giới hành chính – chỉ còn 2 cấp

Từ **01/07/2025**, **Luật 72/2025/QH15** chấm dứt hoạt động của **cấp huyện**. Cả nước còn **34 tỉnh/thành phố** và **3.321 phường/xã/đặc khu** (687 phường, 2.621 xã, 13 đặc khu) — **không có gì ở giữa**.

API chỉ có **hai** endpoint danh mục: `/system/provinces` và `/system/wards`. Không có `/system/districts`.

Dữ liệu đọc thẳng từ **file danh mục của cơ quan thuế** đi kèm app (`src/common/data/vn-administrative-units-2025.csv`), **không phải từ DB** và **không gọi API ngoài lúc chạy**. Danh sách bất biến trong một lần chạy nên frontend cache thoải mái.

---

### GET `/system/provinces`
34 tỉnh/thành phố sau sáp nhập 2025. Không có query param.

```json
{
  "data": [
    { "code": "01", "name": "Thành phố Hà Nội", "type": "city", "tmsCode": "101" },
    { "code": "34", "name": "Tỉnh Cà Mau", "type": "province", "tmsCode": "823" }
  ]
}
```

`code` là mã tỉnh Bộ Nội Vụ (`01`–`34`); `type` ∈ `city` | `province`.

> `tmsCode` (mã tỉnh của hệ thống thuế) có mặt trong response vì controller trả thẳng file JSON và app **không** bật `ClassSerializerInterceptor`, dù `ProvinceResponseDto` không khai báo field này. Client **không nên** phụ thuộc vào nó.

---

### GET `/system/wards`
3.321 phường/xã/đặc khu.

| Query | Bắt buộc | Mô tả |
|-------|:--------:|-------|
| `provinceCode` | ❌ | Lọc theo tỉnh (1–10 chữ số). **Nên luôn truyền** — bỏ trống trả về **toàn bộ 3.321** đơn vị |

```json
{
  "data": [
    {
      "code": "10101003",
      "name": "Phường Ba Đình",
      "provinceCode": "01",
      "type": "phuong",
      "legacyDistrictCode": "10101",
      "legacyDistrictName": "Quận Ba Đình"
    }
  ]
}
```

- `code` là mã của **hệ thống thuế (TMS)**, không phải mã GSO. Chọn hệ mã này vì Giai đoạn 6 sẽ quyết toán thuế TNCN — dùng đúng mã cơ quan thuế dùng thì số liệu đi nộp không phải map thêm một lần nữa.
- `type` ∈ `phuong` | `xa` | `dac_khu`.
- `legacyDistrictCode` / `legacyDistrictName`: quận/huyện **cũ** mà đơn vị này tách ra. **Chỉ để đối chiếu hồ sơ cũ, KHÔNG dùng cho nhập liệu mới.**

---

### GET `/system/holidays`
> 🔒 Auth required

**Query:** `?year=2026` (bỏ trống → năm hiện tại). Mảng phẳng, sắp xếp theo ngày. CRUD ngày lễ nằm ở `/holidays` — xem bên dưới.

### GET `/system/leave-types`
> 🔒 Auth required

Loại nghỉ phép đang áp dụng — **chỉ** những loại `isActive = true`. CRUD nằm ở `/leave-types` (§8).

---

### Holidays – CRUD (`/holidays`)


| Method | Path | Quyền |
|--------|------|-------|
| GET | `/holidays` (phân trang; `?year=`, `?type=`, `?isPaid=`, `?sort=holidayDate\|name\|year`) | Auth required |
| GET | `/holidays/:id` | Auth required |
| POST | `/holidays` | `admin`, `hr_manager`, `hr_staff` |
| PATCH | `/holidays/:id` | `admin`, `hr_manager`, `hr_staff` |
| DELETE | `/holidays/:id` | `admin`, `hr_manager`, `hr_staff` |

```json
{
  "name": "Tết Dương lịch",
  "holidayDate": "2027-01-01",
  "type": "national",
  "isPaid": true,
  "note": null
}
```

> `year` **không nhận từ client** – luôn suy ra từ `holidayDate` để hai cột không bao giờ lệch nhau.
> `holidays` **không có `code`** (và không có `deleted_at` → DELETE là xoá vật lý). Vì ngày lễ do người dùng nhập nên `409 DUPLICATE_HOLIDAY_DATE` vẫn là lỗi có thật, khác với các mã master data do server sinh.

**Errors:** `404 HOLIDAY_NOT_FOUND`, `409 DUPLICATE_HOLIDAY_DATE`, `403 FORBIDDEN`.

---

## 18. Error Codes

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
| 423 | Locked – Tài khoản đang bị khoá |
| 429 | Too Many Requests – Lần đăng nhập sai làm khoá tài khoản |
| 500 | Internal Server Error |
| 503 | Service Unavailable – Driver mail/storage không nạp được |

> **Header `Retry-After`.** Với **khoá tự động do đăng nhập sai** (423 và 429), số giây phải chờ nằm ở header `Retry-After` (RFC 9110 §10.2.3), **không** nằm trong JSON body: envelope lỗi cố định theo §1.1, còn `error.message` là văn bản tiếng Anh dành cho developer nên UI không parse được. Đây là kênh **duy nhất** máy đọc được cho thông tin này. Khoá thủ công (`users.status = 'locked'`) cũng trả 423 nhưng **không** kèm header này — xem §2.

### Application Error Codes

```
AUTH
  PORTAL_ACCESS_DENIED       Vai trò không được đăng nhập hệ thống quản trị
  INVALID_CREDENTIALS        401 Sai tên đăng nhập hoặc mật khẩu
  TOKEN_EXPIRED              401 Access token hết hạn
  TOKEN_INVALID              401 Token không hợp lệ / thiếu cookie refresh /
                                 refresh token đã dùng lại (revoke toàn bộ session)
  REFRESH_TOKEN_EXPIRED      401 Refresh token hết hạn, đăng nhập lại
  ACCOUNT_LOCKED             429 lần sai thứ 5 (chính lần này gây khoá) /
                             423 các lần thử sau trong thời gian khoá
                                 → thời gian còn lại ở header Retry-After.
                             423 users.status = 'locked' (khoá thủ công)
                                 → KHÔNG có Retry-After, phải liên hệ HR/admin
  ACCOUNT_INACTIVE           403 users.status khác 'active' (vd 'inactive');
                                 chỉ kiểm tra SAU khi mật khẩu đúng
  WRONG_CURRENT_PASSWORD     401 Mật khẩu hiện tại không đúng
  PASSWORD_MISMATCH          400 Mật khẩu xác nhận không khớp

EMPLOYEE
  EMPLOYEE_NOT_FOUND         404 Không tìm thấy nhân viên
                             422 khi được dùng như tham chiếu (managerId,
                                 employeeId của hợp đồng…)
  EMPLOYEE_NOT_DELETED       422 Restore một hồ sơ đang bình thường
  EMPLOYEE_SELF_MANAGER      422 Nhân viên không thể là quản lý trực tiếp của chính mình
  EMPLOYEE_CODE_CONFLICT     409 Không cấp được mã NV#### duy nhất
  DUPLICATE_CCCD             409 CCCD đã tồn tại
  DUPLICATE_EMAIL            409 Email đã tồn tại
  DUPLICATE_TAX_CODE         409 Mã số thuế đã tồn tại
  DUPLICATE_SI_NUMBER        409 Số sổ BHXH đã tồn tại
  DUPLICATE_HI_NUMBER        409 Số thẻ BHYT đã tồn tại
  INVALID_HIRE_DATE          422 Ngày vào làm không hợp lệ
  INVALID_DATE_OF_BIRTH      422 Ngày sinh không hợp lệ (tuổi lao động)
  POSITION_DEPARTMENT_MISMATCH 422 Chức vụ không thuộc phòng ban đã chọn
  AVATAR_REQUIRED            400 Thiếu file trong field multipart "avatar"
  AVATAR_TOO_LARGE           400 Ảnh vượt quá 2MB
  AVATAR_INVALID_TYPE        400 Không phải JPEG/PNG/WEBP (nhận diện bằng magic bytes)

  Định dạng CCCD/MST/SĐT sai KHÔNG có mã riêng ở cấp response: chúng là
  VALIDATION_ERROR (400) với details[].code = INVALID_CCCD / INVALID_TAX_CODE /
  INVALID_SI_NUMBER / INVALID_HI_NUMBER / INVALID_PHONE / INVALID_NAME.

MASTER DATA (departments / positions / leave_types / holidays)
  CODE_ALLOCATION_FAILED     409 Không cấp được mã duy nhất (PB####/CV####/NP####)
                                 sau số lần thử tối đa. Thay cho các mã
                                 DUPLICATE_*_CODE cũ: `code` do server sinh nên
                                 client không thể gây trùng nữa
  DEPARTMENT_NOT_FOUND       404 (422 khi là tham chiếu từ position/employee)
  PARENT_DEPARTMENT_NOT_FOUND 422 parentId không tồn tại
  DEPARTMENT_CYCLE           422 Đặt cha thành chính nó hoặc thành con cháu của nó
  DEPARTMENT_HAS_EMPLOYEES   422 Còn nhân viên → không xoá
  DEPARTMENT_HAS_CHILDREN    422 Còn phòng ban con → không xoá
  DEPARTMENT_HAS_POSITIONS   422 Còn chức vụ → không xoá
  POSITION_NOT_FOUND         404
  POSITION_HAS_EMPLOYEES     422 Còn nhân viên giữ chức vụ → không xoá
  INVALID_SALARY_RANGE       422 minSalary > maxSalary
  LEAVE_TYPE_NOT_FOUND       404
  LEAVE_TYPE_IN_USE          422 Còn đơn nghỉ / số dư phép tham chiếu → không xoá.
                                 Đây là chốt chặn DUY NHẤT; `isSystem` không chặn gì
  HOLIDAY_NOT_FOUND          404
  DUPLICATE_HOLIDAY_DATE     409 Ngày lễ đã tồn tại (holidays KHÔNG có `code`,
                                 ngày do người dùng nhập nên lỗi này vẫn có thật)

CONTRACT
  CONTRACT_NOT_FOUND         404
  CONTRACT_ALREADY_ACTIVE    409 Nhân viên đã có hợp đồng đang hiệu lực
  DUPLICATE_CONTRACT_NUMBER  409 Số hợp đồng đã tồn tại
  CONTRACT_TYPE_LIMIT        422 Đã ký 2 lần HĐXĐTH, phải chuyển indefinite
  CONTRACT_ALREADY_TERMINATED 422 Hợp đồng đã chấm dứt
  CONTRACT_NOT_SIGNED        422 Chỉ hợp đồng đã ký mới chấm dứt được
  CONTRACT_NOT_DELETABLE     422 Chỉ xoá được hợp đồng status=draft
  INVALID_CONTRACT_PERIOD    422 Thời hạn vi phạm BLLĐ 2019
  INVALID_CONTRACT_STATUS    422 Trạng thái không hợp lệ cho thao tác
  INVALID_SIGN_DATE          422 Ngày ký không hợp lệ
  INVALID_DATE_RANGE         422 Khoảng ngày không hợp lệ

FAMILY / DEPENDENT
  FAMILY_MEMBER_NOT_FOUND    404
  DEPENDENT_NOT_FOUND        404
  DEPENDENT_ALREADY_CLAIMED  409 Người phụ thuộc đã được đăng ký giảm trừ
  DEPENDENT_REASON_REQUIRED  422 Thiếu lý do phụ thuộc

USER
  DUPLICATE_USERNAME         409
  EMPLOYEE_ALREADY_HAS_ACCOUNT 409 Nhân viên đã có tài khoản
  ROLE_NOT_FOUND             422 roleId không tồn tại

REPORT / EXPORT
  SENSITIVE_EXPORT_FORBIDDEN 403 Role không được lấy bản không che
                                 (chỉ admin/hr_manager)
  EXPORT_TOO_MANY_ROWS       422 Filter khớp quá 10.000 dòng – KHÔNG cắt bớt im lặng

INFRA
  MAIL_TRANSPORT_UNAVAILABLE 503 Driver mail không nạp được (vd SES chưa cài SDK)
  STORAGE_DRIVER_UNAVAILABLE 503 Driver lưu trữ không nạp được (vd S3 chưa cài SDK)

ATTENDANCE
  ATTENDANCE_NOT_FOUND
  ATTENDANCE_ALREADY_EXISTS  Ngày đó đã có bản ghi, hãy sửa thay vì tạo mới
  INVALID_ATTENDANCE_TIMES   Giờ ra sớm hơn giờ vào
  IMPORT_FILE_REQUIRED       Thiếu file .xlsx
  IMPORT_INVALID_FILE_TYPE   Không phải file .xlsx hợp lệ (kiểm magic bytes)
  IMPORT_MISSING_COLUMNS     File thiếu cột bắt buộc
  IMPORT_TOO_MANY_ROWS       File vượt trần số dòng
  IMPORT_EMPTY_FILE          File không có sheet nào

LEAVE
  LEAVE_NOT_FOUND
  LEAVE_TYPE_NOT_FOUND
  LEAVE_NOT_PENDING          Đơn không còn ở trạng thái chờ duyệt
  INSUFFICIENT_LEAVE_BALANCE Không đủ ngày phép còn lại
  OVERLAPPING_LEAVE          Trùng ngày với đơn còn hiệu lực
  INVALID_LEAVE_RANGE        Ngày kết thúc trước ngày bắt đầu
  LEAVE_SPANS_TWO_YEARS      Kỳ nghỉ bắc qua giao thừa, phải tách hai đơn
  LEAVE_NO_WORKING_DAYS      Kỳ nghỉ không có ngày làm việc nào
  LEAVE_BELOW_MINIMUM        Ít hơn số ngày tối thiểu của loại phép
  LEAVE_ABOVE_MAX_CONSECUTIVE Vượt số ngày liên tiếp tối đa của loại phép
  CANNOT_APPROVE_OWN_RECORD  Người ghi nhận không được tự duyệt
  ANNUAL_LEAVE_TYPE_MISSING  Chưa seed loại phép năm
  LEAVE_BALANCE_NOT_FOUND
  LEAVE_BALANCE_BELOW_COMMITTED  Hạ quỹ xuống dưới số đã dùng + đang chờ
  CANNOT_APPROVE_OWN_RECORD  Người ghi nhận đơn không được tự duyệt

SALARY
  SALARY_ALREADY_EXISTS      Bảng lương tháng này đã được tính
  SALARY_NOT_FOUND
  SALARY_ALREADY_APPROVED    Không thể sửa bảng lương đã duyệt
  NO_ACTIVE_CONTRACT         Nhân viên không có hợp đồng hiệu lực

LEAVE_BALANCE
  BALANCE_ALREADY_INITIALIZED  Đã khởi tạo ngày phép cho năm này

AUTH (reset password)
  RESET_TOKEN_INVALID    400 Token không hợp lệ / không tồn tại / đã dùng
  RESET_TOKEN_EXPIRED    400 Token đúng nhưng đã quá hạn (30 phút)

SYSTEM
  VALIDATION_ERROR       400 Lỗi validate dữ liệu (kèm details[])
  FORBIDDEN              403 Không có quyền thực hiện thao tác
  RATE_LIMIT_EXCEEDED    429 Mã mặc định cho status 429 khi exception không tự
                             khai code (lockout đăng nhập dùng ACCOUNT_LOCKED)
  INTERNAL_ERROR         500 Lỗi server nội bộ – KHÔNG lộ stack trace ra production
```

> Mã nào không nằm trong bảng trên và không do service tự khai sẽ được `HttpExceptionFilter` suy ra từ HTTP status: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `UNPROCESSABLE_ENTITY`, `RATE_LIMIT_EXCEEDED`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`, hoặc `HTTP_<status>` nếu không khớp gì cả.

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

*Cập nhật: 19/08/2026 – Version 1.3*