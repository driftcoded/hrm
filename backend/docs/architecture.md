# Architecture – HRM Backend

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Sơ đồ hạ tầng](#2-sơ-đồ-hạ-tầng)
3. [Kiến trúc ứng dụng](#3-kiến-trúc-ứng-dụng)
4. [Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
5. [Module Pattern](#5-module-pattern)
6. [NestJS Core Patterns](#6-nestjs-core-patterns)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Caching – Redis](#8-caching--redis)
9. [File Upload – AWS S3](#9-file-upload--aws-s3)
10. [Background Jobs & Scheduler](#10-background-jobs--scheduler)
11. [Email Service](#11-email-service)
12. [Rate Limiting & Security Headers](#12-rate-limiting--security-headers)
13. [Error Handling & Logging](#13-error-handling--logging)
14. [Health Check](#14-health-check)
15. [Response & DTO Pattern](#15-response--dto-pattern)
16. [Database Strategy](#16-database-strategy)
17. [Environment Variables](#17-environment-variables)
18. [Lý do chọn tech stack](#18-lý-do-chọn-tech-stack)

---

## 1. Tổng quan hệ thống

HRM Backend là REST API xây dựng bằng **NestJS** phục vụ ứng dụng quản lý nhân sự cho công ty Việt Nam. Hệ thống xử lý: quản lý nhân viên, chấm công, nghỉ phép, tính lương theo pháp luật VN, hợp đồng lao động và báo cáo.

**Tech stack:**

| Thành phần | Công nghệ |
|-----------|-----------|
| Framework | NestJS (Node.js) |
| Ngôn ngữ | TypeScript strict mode |
| Database | MySQL 8.0+ (Amazon RDS) |
| ORM | TypeORM + migrations |
| Cache | Redis (ElastiCache hoặc EC2) |
| File storage | AWS S3 |
| Email | AWS SES |
| Process manager | PM2 cluster mode |
| Reverse proxy | Nginx |
| Hosting | AWS EC2 (app) + RDS (database) |
| Monitoring | CloudWatch Logs + Sentry |

---

## 2. Sơ đồ hạ tầng

```
Internet
   │
   ▼
Nginx (reverse proxy, SSL termination, static files)
   │
   ▼
PM2 Cluster (NestJS – nhiều worker process trên 1 EC2)
   │
   ├──► Amazon RDS MySQL 8  (database – instance riêng, không cùng EC2 app)
   │
   ├──► Redis               (cache, rate limit, job queue)
   │
   ├──► AWS S3              (avatars, documents, contracts, exports)
   │
   └──► AWS SES             (email: forgot-password, thông báo)

CloudWatch Logs ◄─── NestJS Winston logger
Sentry          ◄─── NestJS exception filter
```

> **Tại sao tách RDS?** Nếu EC2 restart, database không bị ảnh hưởng. Dễ scale độc lập. RDS tự động backup, failover.

---

## 3. Kiến trúc ứng dụng

### 3.1. Các tầng (Layers)

```
HTTP Request
     │
     ▼
┌──────────────────────────────────────────────────────┐
│  MIDDLEWARE  (Helmet, CORS, Logger, Rate Limiter)    │
└──────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────┐
│  PIPE  (ValidationPipe – validate & transform DTO)   │
└──────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────┐
│  GUARD  (JwtAuthGuard → RolesGuard)                  │
└──────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────┐
│  CONTROLLER  – nhận request, gọi service, trả DTO   │
└──────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────┐
│  SERVICE  – toàn bộ business logic                   │
└──────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────┐
│  REPOSITORY  – truy vấn DB qua TypeORM               │
└──────────────────────────────────────────────────────┘
     │
     ▼
  MySQL (RDS)   /   Redis (cache)
     │
     ▼
┌──────────────────────────────────────────────────────┐
│  INTERCEPTOR  (TransformInterceptor – wrap response) │
└──────────────────────────────────────────────────────┘
     │
     ▼
HTTP Response  { success, data, message, timestamp }
```

### 3.2. Trách nhiệm từng tầng

| Tầng | Trách nhiệm | KHÔNG làm |
|------|-------------|-----------|
| **Controller** | Nhận request, gọi service, trả response DTO | Không chứa business logic |
| **Service** | Toàn bộ business logic, tính toán, kiểm tra quy tắc | Không query DB trực tiếp |
| **Repository** | Truy vấn DB qua TypeORM, không có logic | Không gọi service khác |
| **Entity** | Định nghĩa bảng DB, relations | Không chứa logic |
| **DTO** | Định nghĩa shape của request/response | Không trộn request DTO với response DTO |

---

## 4. Cấu trúc thư mục

```
src/
├── main.ts                        # Bootstrap app, Swagger, global middleware
├── app.module.ts                  # Root module, import tất cả modules
│
├── config/                        # Cấu hình theo environment
│   ├── app.config.ts              # PORT, NODE_ENV, API prefix
│   ├── database.config.ts         # MySQL connection
│   ├── jwt.config.ts              # Secret, expiry
│   ├── redis.config.ts            # Redis host/port
│   ├── s3.config.ts               # Bucket, region, credentials
│   └── mail.config.ts             # SES region, from address
│
├── common/                        # Shared across toàn bộ app
│   ├── decorators/
│   │   ├── current-user.decorator.ts   # @CurrentUser() → lấy user từ request
│   │   └── roles.decorator.ts          # @Roles('admin', 'hr_manager')
│   ├── filters/
│   │   └── http-exception.filter.ts    # Bắt mọi exception → format lỗi chuẩn
│   ├── guards/
│   │   ├── jwt-auth.guard.ts           # Kiểm tra Bearer token
│   │   └── roles.guard.ts              # Kiểm tra role từ @Roles() decorator
│   ├── interceptors/
│   │   ├── transform.interceptor.ts    # Wrap response → { success, data, message }
│   │   └── logging.interceptor.ts      # Log request method, path, duration
│   ├── pipes/
│   │   └── parse-int.pipe.ts           # Parse ID params từ string → number
│   └── dto/
│       ├── pagination.dto.ts           # page, limit, sort, order, search
│       └── pagination-response.dto.ts  # items[], meta { total, page, ... }
│
├── database/
│   ├── database.module.ts
│   ├── migrations/                # TypeORM migration files (26 bước)
│   └── seeds/                     # Seed scripts: roles, leave-types, holidays
│
├── shared/                        # Feature modules dùng chung
│   ├── redis/
│   │   ├── redis.module.ts
│   │   └── redis.service.ts       # get/set/del/ttl wrapper
│   ├── mail/
│   │   ├── mail.module.ts
│   │   └── mail.service.ts        # sendForgotPassword, sendWelcome...
│   ├── s3/
│   │   ├── s3.module.ts
│   │   └── s3.service.ts          # upload, delete, getSignedUrl
│   └── scheduler/
│       └── scheduler.service.ts   # Các cron jobs định kỳ
│
└── modules/                       # Business modules (domain-driven)
    ├── auth/
    ├── users/
    ├── employees/
    ├── departments/
    ├── positions/
    ├── contracts/
    ├── attendances/
    ├── leaves/
    ├── leave-balances/
    ├── salaries/
    ├── dependents/
    ├── family-members/
    ├── documents/
    ├── trainings/
    ├── performance-reviews/
    ├── disciplines-rewards/
    ├── work-history/
    ├── announcements/
    └── reports/
```

---

## 5. Module Pattern

Mỗi business module có cấu trúc thống nhất:

```
modules/employees/
├── employees.module.ts
├── employees.controller.ts
├── employees.service.ts
├── employees.repository.ts        # Custom queries phức tạp
├── entities/
│   └── employee.entity.ts
├── dto/
│   ├── create-employee.dto.ts     # Request body: POST /employees
│   ├── update-employee.dto.ts     # Request body: PATCH /employees/:id
│   ├── filter-employee.dto.ts     # Query params: GET /employees
│   └── employee-response.dto.ts   # Response shape (không lộ sensitive fields)
└── employees.service.spec.ts      # Unit test cho service
```

**Quy tắc bắt buộc:**
- Controller chỉ gọi service của **chính module đó**.
- Service có thể inject service của module khác (qua module imports).
- Repository chỉ chứa TypeORM queries, không có if/else logic.
- Response DTO phải **loại bỏ** các field nhạy cảm: `password`, `deleted_at`, `token_hash`.

---

## 6. NestJS Core Patterns

### 6.1. Global ValidationPipe

Đặt ở `main.ts`, áp dụng cho mọi request:

- `transform: true` — tự convert `"1"` → `1`, `"true"` → `true`
- `whitelist: true` — tự xoá field không khai báo trong DTO
- `forbidNonWhitelisted: false` — không throw lỗi, chỉ bỏ qua
- `transformOptions.enableImplicitConversion: true` — convert kiểu tự động

### 6.2. Guards – thứ tự thực thi

```
JwtAuthGuard → RolesGuard
```

- **JwtAuthGuard**: verify Bearer token, đặt `req.user` = payload.
- **RolesGuard**: đọc metadata từ `@Roles()` decorator, so sánh với `req.user.role`.
- Endpoint không cần auth: dùng `@Public()` decorator để bypass JwtAuthGuard.

### 6.3. TransformInterceptor

Wrap **mọi** response thành format chuẩn:

```
{ success: true, data: <kết quả>, message: "...", timestamp: "ISO-8601" }
```

Đặt globally trong `app.module.ts` qua `APP_INTERCEPTOR`.

### 6.4. HttpExceptionFilter

Bắt mọi exception (kể cả unhandled) và trả về:

```
{ success: false, error: { code: "...", message: "...", details: [...] }, timestamp: "..." }
```

Đặt globally qua `APP_FILTER`. Không bao giờ để lộ stack trace ra production.

### 6.5. Custom Decorators

| Decorator | Dùng ở | Mục đích |
|-----------|--------|---------|
| `@CurrentUser()` | Controller param | Lấy user đang đăng nhập từ `req.user` |
| `@Roles('admin')` | Controller/method | Khai báo roles được phép |
| `@Public()` | Controller/method | Bỏ qua JwtAuthGuard |
| `@ApiAuth()` | Controller | Shortcut Swagger Bearer auth |

---

## 7. Authentication & Authorization

### 7.1. Luồng đăng nhập

1. `POST /auth/login` → verify username/password → tạo Access Token (15 phút) + Refresh Token (7 ngày).
2. **Access Token** lưu trong bộ nhớ JavaScript (Zustand store) — không lưu localStorage (chống XSS).
3. **Refresh Token** lưu trong `HttpOnly; Secure; SameSite=Strict` cookie — không thể đọc từ JS.
4. Mọi request gửi `Authorization: Bearer <access_token>` trong header.
5. Khi Access Token hết hạn (401): Axios interceptor tự gọi `POST /auth/refresh` → nhận token mới → retry request ban đầu.
6. Logout: gọi `POST /auth/logout` → server revoke refresh token trong DB → xoá cookie.

### 7.2. Forgot Password flow

1. `POST /auth/forgot-password` → tạo reset token (random 32 bytes) → lưu **hash** vào Redis với TTL 30 phút.
2. Gửi email (AWS SES) chứa link: `https://app.company.com/reset-password?token=<raw_token>`.
3. `POST /auth/reset-password` → hash token từ request → so khớp với Redis → cập nhật password → xoá token.

> Token lưu trong **Redis** (không phải DB) vì: tự hết hạn, không cần job dọn dẹp, tốc độ nhanh.

### 7.3. Authorization matrix

| Endpoint group | admin | hr_manager | hr_staff | manager | employee |
|---------------|:-----:|:----------:|:--------:|:-------:|:--------:|
| Tất cả nhân viên | ✅ | ✅ | ✅ | ❌ | ❌ |
| Nhân viên phòng ban mình | ✅ | ✅ | ✅ | ✅ | ❌ |
| Hồ sơ cá nhân | ✅ | ✅ | ✅ | ✅ | ✅ (chỉ mình) |
| Tính lương | ✅ | ✅ | ❌ | ❌ | ❌ |
| Duyệt nghỉ phép | ✅ | ✅ | ❌ | ✅ | ❌ |
| Xem phiếu lương | ✅ | ✅ | ✅ | ❌ | ✅ (chỉ mình) |
| Quản lý user | ✅ | ❌ | ❌ | ❌ | ❌ |
| Export báo cáo | ✅ | ✅ | ✅ | ❌ | ❌ |

### 7.4. Refresh Token rotation

Mỗi lần refresh: revoke token cũ, cấp token mới. Nếu phát hiện dùng token đã bị revoke → revoke **tất cả** token của user đó (dấu hiệu bị đánh cắp).

---

## 8. Caching – Redis

### 8.1. Những gì cần cache

| Key pattern | TTL | Nội dung | Lý do |
|-------------|-----|----------|-------|
| `provinces` | 24 giờ | 63 tỉnh/thành | Bất biến, query nhiều |
| `districts:{provinceCode}` | 24 giờ | Quận/huyện theo tỉnh | Bất biến |
| `wards:{districtCode}` | 24 giờ | Phường/xã theo huyện | Bất biến |
| `holidays:{year}` | 30 ngày | Danh sách ngày lễ | Bất biến theo năm |
| `leave_types` | 1 giờ | 9 loại nghỉ phép | Hiếm thay đổi |
| `pwd_reset:{hash}` | 30 phút | Reset password token | Tự hết hạn |
| `rate_limit:{ip}` | 1 phút | Số request theo IP | Rate limiting |

### 8.2. Cache invalidation

- Khi admin cập nhật `holidays` → xoá key `holidays:{year}`.
- Khi admin thêm `leave_type` → xoá key `leave_types`.
- Provinces/Districts/Wards không cần invalidate (cố định theo Bộ Nội Vụ).

---

## 9. File Upload – AWS S3

### 9.1. Phân loại bucket/folder

```
hrm-bucket/
├── avatars/{employeeId}/{timestamp}.{ext}     max 2MB, JPEG/PNG/WEBP
├── documents/{employeeId}/{type}/{filename}   max 10MB, PDF/JPG/PNG
├── contracts/{contractId}/{filename}          max 10MB, PDF
└── exports/{userId}/{timestamp}-{name}.xlsx   max 50MB, XLSX (tự xoá sau 24h)
```

### 9.2. Upload flow

1. Client gửi file qua `multipart/form-data` đến NestJS.
2. NestJS validate: kích thước, MIME type, tên file (strip path traversal).
3. Upload lên S3 với key theo pattern trên.
4. Lưu S3 URL vào DB.
5. Trả URL về cho client.

> **Không** cho client upload thẳng lên S3 (Presigned URL) vì cần validate và audit log phía server.

### 9.3. Xoá file

Khi xoá record trong DB → gọi `s3.deleteObject()` để tránh rác. Export files tự xoá sau 24 giờ qua S3 Lifecycle rule.

---

## 10. Background Jobs & Scheduler

Dùng `@nestjs/schedule` cho cron jobs, `Bull` + Redis cho queue jobs bất đồng bộ.

### 10.1. Cron jobs (chạy định kỳ)

| Job | Lịch | Mục đích |
|-----|------|---------|
| `contract-expiry-check` | Mỗi ngày 7:00 sáng | Tìm HĐ hết hạn trong 30 ngày → gửi email cho HR |
| `leave-balance-annual-reset` | 01/01 hàng năm 00:30 | Khởi tạo ngày phép năm mới cho tất cả NV active |
| `attendance-auto-absent` | Mỗi ngày 23:55 | Đánh dấu `absent` cho NV không chấm công và không có đơn nghỉ |
| `export-cleanup` | Mỗi ngày 3:00 sáng | Xoá file export trên S3 cũ hơn 24 giờ |
| `refresh-token-cleanup` | Mỗi ngày 4:00 sáng | Xoá refresh token đã hết hạn trong DB |

### 10.2. Queue jobs (bất đồng bộ)

Các tác vụ nặng không chạy trong request/response cycle:

| Job | Trigger | Mục đích |
|-----|---------|---------|
| `send-email` | Nhiều nơi | Gửi email qua SES bất đồng bộ |
| `generate-payslip-pdf` | Sau khi approve lương | Tạo PDF phiếu lương, upload S3 |
| `generate-salary-batch` | POST /salaries/calculate | Tính lương hàng loạt (không block request) |
| `export-excel` | GET /reports/*/export | Tạo file Excel lớn bất đồng bộ |

> Queue job trả về `jobId` ngay lập tức. Client polling `GET /jobs/{jobId}/status` để kiểm tra tiến độ.

---

## 11. Email Service

Dùng **AWS SES** qua `@nestjs-modules/mailer` + Handlebars templates.

### 11.1. Các email được gửi

| Trigger | Subject | Nội dung |
|---------|---------|---------|
| Tạo tài khoản mới | Chào mừng đến [Công ty] | Username, link đặt mật khẩu |
| Forgot password | Đặt lại mật khẩu | Link reset (hết hạn 30 phút) |
| Đơn nghỉ được duyệt | Đơn nghỉ của bạn đã được duyệt | Chi tiết đơn |
| Đơn nghỉ bị từ chối | Đơn nghỉ của bạn bị từ chối | Lý do từ chối |
| HĐ sắp hết hạn | Hợp đồng sắp hết hạn | Danh sách NV (gửi cho HR) |
| Lương đã được duyệt | Phiếu lương tháng X/202X | Link xem phiếu lương |

### 11.2. Template

Templates lưu tại `src/shared/mail/templates/*.hbs`. Luôn có cả bản HTML và text thuần.

---

## 12. Rate Limiting & Security Headers

### 12.1. Rate limiting

Dùng `@nestjs/throttler` + Redis store:

| Endpoint | Giới hạn | Lý do |
|----------|---------|-------|
| `POST /auth/login` | 5 lần/phút/IP | Chống brute-force |
| `POST /auth/forgot-password` | 3 lần/15 phút/IP | Chống spam email |
| `POST /auth/refresh` | 10 lần/phút/IP | – |
| Các endpoint còn lại | 100 lần/phút/IP | General protection |

### 12.2. Security headers (Helmet)

Đặt trong `main.ts`, tự động thêm các header:

| Header | Giá trị | Bảo vệ |
|--------|---------|--------|
| `X-Content-Type-Options` | `nosniff` | Chống MIME sniffing |
| `X-Frame-Options` | `DENY` | Chống Clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Chống XSS (legacy) |
| `Strict-Transport-Security` | `max-age=31536000` | Bắt buộc HTTPS |
| `Content-Security-Policy` | Cấu hình cụ thể | Chống XSS |

### 12.3. CORS

Chỉ cho phép request từ frontend domain. Cấu hình trong `main.ts`:

- **Allowed origins**: `http://localhost:5173` (dev) và `https://hrm.company.com` (prod)
- **Allowed methods**: GET, POST, PATCH, DELETE
- **Allowed headers**: Content-Type, Authorization
- **Credentials**: `true` (để gửi HttpOnly cookie)

---

## 13. Error Handling & Logging

### 13.1. Exception hierarchy

```
HttpException (NestJS built-in)
  ├── BadRequestException        400 – validation, business rule violation
  ├── UnauthorizedException      401 – chưa đăng nhập / token hết hạn
  ├── ForbiddenException         403 – không có quyền
  ├── NotFoundException          404 – không tìm thấy resource
  ├── ConflictException          409 – trùng dữ liệu (CCCD, email)
  └── UnprocessableEntityException 422 – vi phạm business rule

Không bao giờ throw Error trần. Luôn dùng HttpException có code cụ thể.
```

### 13.2. Logging strategy

Dùng **Winston** logger với 2 transport:

| Transport | Level | Môi trường |
|-----------|-------|-----------|
| Console (màu) | debug+ | development |
| CloudWatch Logs | info+ | production |

**Log những gì:**
- Mọi request: method, path, status code, duration, user_id.
- Mọi lỗi 500: full stack trace.
- Các hành động quan trọng: login, logout, tạo/sửa/xoá nhân viên, tính lương, export.

**Không log:**
- Password, token, CCCD, số tài khoản ngân hàng.
- Request body của `POST /auth/login`, `POST /auth/change-password`.

### 13.3. Sentry (error monitoring)

Tích hợp Sentry để nhận alert ngay khi có lỗi production:
- Tự động capture unhandled exceptions.
- Gắn user context (user_id, role) vào mỗi error.
- Ignore 4xx errors (chỉ alert 5xx).

---

## 14. Health Check

`GET /health` — không cần auth, dùng cho PM2, load balancer, uptime monitoring.

| Check | Mục đích |
|-------|---------|
| Database ping | MySQL connection còn sống |
| Redis ping | Redis connection còn sống |
| Disk space | Còn đủ dung lượng |
| Memory usage | Không bị memory leak |

Response:
- `200 OK` → tất cả healthy
- `503 Service Unavailable` → ít nhất 1 check fail

---

## 15. Response & DTO Pattern

### 15.1. Request DTO

Mỗi endpoint có DTO riêng, dùng `class-validator` decorators:

| DTO | Dùng cho |
|-----|---------|
| `CreateEmployeeDto` | POST /employees |
| `UpdateEmployeeDto` | PATCH /employees/:id (Partial type) |
| `FilterEmployeeDto` | GET /employees (query params) |

### 15.2. Response DTO

**Bắt buộc** dùng Response DTO thay vì trả Entity trực tiếp, để:
- Loại bỏ field nhạy cảm: `password`, `deleted_at`, `token_hash`.
- Kiểm soát chính xác những gì client nhận được.
- Dễ thay đổi DB structure mà không break API.

| Entity field | Có trong Response DTO |
|-------------|:--------------------:|
| id, employee_code, full_name | ✅ |
| email, phone, department | ✅ |
| password | ❌ |
| deleted_at | ❌ |
| created_by (internal) | ❌ (trừ admin) |

### 15.3. Pagination Response

Mọi danh sách đều trả về format:

```
{
  "success": true,
  "data": {
    "items": [...],
    "meta": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8
    }
  },
  "timestamp": "..."
}
```

---

## 16. Database Strategy

### 16.1. Connection

- Dùng TypeORM `DataSource` với connection pool (mặc định 10 connections).
- Không bao giờ dùng `synchronize: true` trong production — chỉ dùng migrations.

### 16.2. Migrations

- Mọi thay đổi schema đều qua migration file, không sửa trực tiếp DB.
- Tên file: `{timestamp}-{MoTa}.ts` (ví dụ: `1716892800000-AddEmployeeTable.ts`).
- Migration phải có cả `up()` và `down()` để rollback được.

### 16.3. Transactions

Các thao tác liên quan nhiều bảng phải dùng transaction:
- Tạo nhân viên → tạo user → ghi work_history → ghi audit_log.
- Tính lương → cập nhật leave_balances → ghi salary_components.
- Duyệt đơn nghỉ → cập nhật leave_balances → tạo attendance record.

### 16.4. Soft delete

Các bảng chính dùng `deleted_at` thay vì `DELETE`. Mọi query phải thêm `WHERE deleted_at IS NULL` (TypeORM `@DeleteDateColumn` tự xử lý nếu dùng đúng).

### 16.5. Backup

- RDS automated backup: mỗi ngày, giữ 7 ngày.
- RDS snapshot thủ công: trước mỗi lần deploy lớn.
- Không bao giờ backup vào cùng region với production (dùng S3 cross-region replication).

---

## 17. Environment Variables

Tất cả config nhạy cảm qua `.env` (không commit). File `.env.example` luôn cập nhật.

| Nhóm | Biến | Mô tả |
|------|------|-------|
| **App** | `PORT` | Port server (mặc định 3000) |
| | `NODE_ENV` | `development` / `production` |
| | `API_PREFIX` | `/api/v1` |
| | `FRONTEND_URL` | URL frontend (dùng cho CORS, email links) |
| **Database** | `DB_HOST` | RDS endpoint |
| | `DB_PORT` | 3306 |
| | `DB_NAME` | `hrm_production` |
| | `DB_USER` | – |
| | `DB_PASSWORD` | – |
| **JWT** | `JWT_SECRET` | Ít nhất 64 ký tự random |
| | `JWT_EXPIRES_IN` | `15m` |
| | `JWT_REFRESH_EXPIRES_IN` | `7d` |
| **Redis** | `REDIS_HOST` | – |
| | `REDIS_PORT` | 6379 |
| | `REDIS_PASSWORD` | – |
| **S3** | `AWS_REGION` | `ap-southeast-1` |
| | `AWS_ACCESS_KEY_ID` | – |
| | `AWS_SECRET_ACCESS_KEY` | – |
| | `S3_BUCKET` | `hrm-bucket` |
| **Email** | `MAIL_FROM` | `no-reply@company.com` |
| | `MAIL_FROM_NAME` | `HRM System` |
| **Monitoring** | `SENTRY_DSN` | Sentry project DSN |

---

## 18. Lý do chọn tech stack

| Quyết định | Thay vì | Lý do |
|-----------|---------|-------|
| TypeORM | Prisma | Migration linh hoạt hơn cho schema phức tạp VN (26 bảng, circular FK) |
| MySQL 8 | PostgreSQL | Phổ biến hơn ở VN, dễ tìm DBA và hosting |
| Redis | In-memory cache | Persist qua restart, share giữa nhiều PM2 workers |
| JWT + Refresh Token | Session | Stateless, scale tốt khi thêm server |
| Bull + Redis | Cron đơn thuần | Job queue bền vững, không mất job khi server restart |
| AWS SES | SMTP tự host | Rẻ, deliverability cao, không cần quản lý server email |
| PM2 cluster | Single process | Tận dụng nhiều CPU core trên EC2 |
| RDS | MySQL cùng EC2 | Tách biệt database ra instance riêng, tự backup, failover |

---

*Cập nhật: 26/05/2026 – Version 1.0 – Full architecture document*
