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
8. [Caching](#8-caching)
9. [File Upload – StorageService](#9-file-upload--storageservice)
10. [Background Jobs & Scheduler](#10-background-jobs--scheduler)
11. [Email Service](#11-email-service)
12. [Rate Limiting & Security Headers](#12-rate-limiting--security-headers)
13. [Error Handling & Logging](#13-error-handling--logging)
14. [Health Check](#14-health-check)
15. [Response & DTO Pattern](#15-response--dto-pattern)
16. [Database Strategy](#16-database-strategy)
17. [Environment Variables](#17-environment-variables)
18. [Lý do chọn tech stack](#18-lý-do-chọn-tech-stack)
19. [Việc phải làm trước khi lên production](#19-việc-phải-làm-trước-khi-lên-production)

---

## 1. Tổng quan hệ thống

HRM Backend là REST API xây dựng bằng **NestJS** phục vụ ứng dụng quản lý nhân sự cho công ty Việt Nam. Hệ thống xử lý: quản lý nhân viên, chấm công, nghỉ phép, tính lương theo pháp luật VN, hợp đồng lao động và báo cáo.

**Tech stack:**

> Cột **Trạng thái** phân biệt cái đã chạy trong code với cái là *kiến trúc mục tiêu* khi lên production. Tài liệu này mô tả cả hai; chỗ nào chưa có thì nói rõ.

| Thành phần | Công nghệ | Trạng thái |
|-----------|-----------|-----------|
| Framework | NestJS 11 (Node.js) | ✅ đang chạy |
| Ngôn ngữ | TypeScript strict mode | ✅ |
| Database | MySQL 8.0+ (production: Amazon RDS) | ✅ (RDS: kế hoạch) |
| ORM | TypeORM + migrations | ✅ |
| Cache | `CacheService` + driver **in-memory** | ✅ — **KHÔNG có Redis** (§8) |
| File storage | Driver `local` (ghi `uploads/`) · driver `s3` đã viết nhưng **chưa từng chạy** | ✅ local · ⏳ S3 |
| Email | Transport `dev` (ghi file `logs/mail/`) · transport `ses` đã viết nhưng **chưa từng chạy** | ✅ dev · ⏳ SES |
| Logging | Winston (`nest-winston`) | ✅ |
| Process manager | PM2 cluster mode | ⏳ kế hoạch |
| Reverse proxy | Nginx | ⏳ kế hoạch |
| Hosting | AWS EC2 (app) + RDS (database) | ⏳ kế hoạch |
| Monitoring | CloudWatch Logs + Sentry | ⏳ kế hoạch – chưa có package nào |

**Chưa cài (nêu trong tài liệu như kế hoạch):** Redis, `@nestjs/throttler`, `@nestjs/schedule`, `Bull`, `@sentry/node`, `@nestjs/terminus`, `@aws-sdk/client-s3`, `@aws-sdk/client-sesv2`.

---

## 2. Sơ đồ hạ tầng

### 2.1. Hiện tại (dev / Giai đoạn 0–3)

```
Browser (Vite dev server :5173, proxy /api → backend)
   │
   ▼
NestJS (một process, `npm run start:dev`)
   │
   ├──► MySQL 8            (local hoặc RDS)
   │
   ├──► CacheService       (in-memory Map trong chính process — KHÔNG Redis)
   │
   ├──► uploads/           (driver storage `local` trên đĩa)
   │
   └──► logs/mail/*.html   (transport mail `dev` — không gửi email thật)

logs/ (Winston: console + file)
```

### 2.2. Kiến trúc mục tiêu khi lên production

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

> ⚠️ **Chặn đường lên production:** PM2 cluster mode có nhiều worker process, mà driver cache hiện tại là in-memory *trong từng process*. Bật cluster trước khi thay driver sẽ làm hỏng đếm lockout đăng nhập và token reset password (§8). Tương tự, driver storage `local` ghi lên đĩa của **một** instance.

---

## 3. Kiến trúc ứng dụng

### 3.1. Các tầng (Layers)

```
HTTP Request
     │
     ▼
┌──────────────────────────────────────────────────────┐
│  MIDDLEWARE  (Helmet, CORS, cookie-parser)           │
│              ⏳ Rate Limiter: chưa có – §12.1         │
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
  MySQL   /   CacheService (in-memory – §8)
     │
     ▼
┌──────────────────────────────────────────────────────┐
│  INTERCEPTOR  (TransformInterceptor – wrap response) │
└──────────────────────────────────────────────────────┘
     │
     ▼
HTTP Response  { success, data, timestamp }
```

> Response **không** có field `message` (api-spec.md §1.1).

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
├── app.controller.ts              # GET /health
├── app.service.ts
│
├── config/                        # Cấu hình theo environment (registerAs)
│   ├── app.config.ts              # PORT, NODE_ENV, API prefix
│   ├── auth.config.ts             # Lockout, session, TTL reset token, tên cookie
│   ├── database.config.ts         # MySQL connection
│   ├── env.validation.ts          # Joi schema – fail fast khi thiếu env
│   ├── jwt.config.ts              # Secret, expiry
│   ├── mail.config.ts             # MAIL_TRANSPORT, from, thư mục output dev
│   ├── storage.config.ts          # STORAGE_DRIVER, thư mục local / bucket S3
│   └── winston.config.ts          # Transport log
│                                  # (KHÔNG có redis.config.ts / s3.config.ts riêng)
│
├── common/                        # Shared across toàn bộ app
│   ├── constants/                 # roles.constant.ts, attendance.constant.ts
│   ├── data/                      # vn-provinces.json (34), vn-wards.json (3.321)
│   ├── decorators/                # @CurrentUser, @Roles, @Public, @ApiAuth,
│   │                              # @IsBooleanValue
│   ├── dto/                       # pagination, pagination-response,
│   │                              # error-response, delete-response
│   ├── filters/                   # http-exception.filter.ts
│   ├── guards/                    # jwt-auth.guard.ts, roles.guard.ts
│   ├── interceptors/              # transform.interceptor.ts
│   ├── pipes/                     # validation-exception.factory.ts
│   ├── types/                     # authenticated-user.ts
│   ├── utils/                     # sequential-code, pagination, date, duration,
│   │                              # hash, assert-ownership, work-hours, overtime,
│   │                              # reject-null (+ .spec.ts đi kèm)
│   └── validators/                # vn-identity, is-calendar-date, is-clock-time
│
├── database/
│   ├── database.module.ts
│   ├── data-source.ts
│   ├── migrations/                # InitSchema, AddIsSystemToLeaveTypes,
│   │                              # MakeDistrictCodeNullable
│   └── seeds/                     # roles, leave-types, holidays, demo
│
├── shared/                        # Hạ tầng dùng chung (@Global modules)
│   ├── cache/
│   │   ├── cache.module.ts        # Đổi driver = đổi useClass ở đây
│   │   ├── cache.service.ts       # Abstract: get/set/del/incr/ttl/reset
│   │   └── in-memory-cache.service.ts   # Driver đang dùng (§8)
│   ├── mail/
│   │   ├── mail.module.ts         # Chọn transport theo MAIL_TRANSPORT
│   │   ├── mail.service.ts
│   │   ├── templates/             # reset-password.template.ts (TS, không .hbs)
│   │   └── transports/            # dev-file-mail (đang dùng), ses-mail (chưa chạy)
│   └── storage/
│       ├── storage.module.ts      # Chọn driver theo STORAGE_DRIVER
│       ├── storage.service.ts
│       ├── image-file.util.ts     # Nhận diện ảnh bằng magic bytes
│       └── transports/            # local-storage (đang dùng), s3-storage (chưa chạy)
│                                  # (KHÔNG có shared/scheduler/ – xem §10)
│
└── modules/                       # Business modules (domain-driven)
    ├── auth/          ✅          ├── attendances/       (chỉ entity)
    ├── users/         ✅          ├── leave-balances/    (chỉ entity)
    ├── employees/     ✅          ├── salaries/          (chỉ entity)
    ├── departments/   ✅          ├── documents/         (chỉ entity)
    ├── positions/     ✅          ├── trainings/         (chỉ entity)
    ├── contracts/     ✅          ├── performance-reviews/ (chỉ entity)
    ├── leaves/        ✅ (chỉ leave-types)  ├── disciplines-rewards/ (chỉ entity)
    ├── system/        ✅ (provinces/wards/holidays)  ├── work-history/ (chỉ entity)
    ├── family-members/✅          ├── announcements/     (chỉ entity)
    ├── dependents/    ✅          └── audit-logs/        (chỉ entity)
    └── reports/       ✅ (employee-export)
```

> "chỉ entity" = thư mục đã có `entities/*.ts` để migration dựng bảng, nhưng chưa có controller/service/route nào.
>
> Ngoại lệ: `modules/attendances/` đã có `attendances.service.ts` + `attendances.repository.ts` + `dto/` nhưng **chưa có controller và chưa được import vào `AppModule`** — chưa gọi được từ HTTP.

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

> Module **không đọc DB thì không có repository**: `ContractTypesService` (enum, không có bảng `contract_types`) và `SystemController` (đọc file JSON tĩnh) là hai ví dụ có chủ đích, không phải thiếu sót.

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
{ success: true, data: <kết quả>, timestamp: "ISO-8601" }
```

**Không** có field `message` (api-spec.md §1.1). Đặt globally trong `app.module.ts` qua `APP_INTERCEPTOR`.

> Ngoại lệ duy nhất: `GET /reports/employees/export` trả về file nhị phân nên controller ghi thẳng vào `res` (`@Res()` không `passthrough`) để đi vòng qua interceptor mà không phải sửa interceptor dùng chung. Lỗi ném ra từ service vẫn đi qua `HttpExceptionFilter` như thường.

### 6.4. HttpExceptionFilter

Bắt mọi exception (kể cả unhandled) và trả về:

```
{ success: false, error: { code: "...", message: "...", details: [...] }, timestamp: "..." }
```

Đặt globally qua `APP_FILTER`. Không bao giờ để lộ stack trace ra production (5xx ở production trả `"Internal server error"`).

- `details[]` **chỉ** xuất hiện khi `code === "VALIDATION_ERROR"`.
- Exception nào mang `retryAfterSeconds` trong payload sẽ được filter phát ra thành **header `Retry-After`** (giây) — không bao giờ echo vào body. Dùng cho lockout đăng nhập 423/429 (§7.1).
- Exception không tự khai `code` thì filter suy ra từ HTTP status (`NOT_FOUND`, `CONFLICT`, `RATE_LIMIT_EXCEEDED`…, hoặc `HTTP_<status>`).

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

1. `POST /auth/login` (username **hoặc** email) → verify password → tạo Access Token (15 phút) + Refresh Token (7 ngày).
2. **Access Token** trả trong body, lưu trong bộ nhớ JavaScript (Zustand store) — không lưu localStorage (chống XSS).
3. **Refresh Token** chỉ giao qua cookie `HttpOnly; SameSite=Strict; Path=/api/v1/auth/refresh`, **không bao giờ** có trong response body.
   - `Secure` **chỉ bật ở production**: `Secure: true` trên `http://localhost` khiến browser âm thầm bỏ cookie (không báo lỗi) → dev sẽ không refresh được token.
   - `Path` hẹp vì refresh token chỉ cần ở đúng endpoint đó; với `Path=/` browser sẽ đính kèm nó vào **mọi** request tới origin.
   - `Max-Age` chỉ được set khi `rememberMe: true`; ngược lại là session cookie. Bản ghi `refresh_tokens.expires_at` trong DB luôn 7 ngày ở cả hai trường hợp.
   - `set()` và `clear()` **phải** dùng chung một bộ attribute: `clearCookie` chỉ xoá được cookie khi `Path`/domain/secure/sameSite khớp lúc set — lệch nhau thì logout "thành công" nhưng cookie vẫn còn.
4. Mọi request gửi `Authorization: Bearer <access_token>` trong header.
5. Khi Access Token hết hạn (401): Axios interceptor tự gọi `POST /auth/refresh` (không body, cookie tự đính kèm) → nhận token mới → retry request ban đầu.
6. Sau F5, store rỗng → frontend gọi `POST /auth/refresh` rồi `GET /auth/me` để dựng lại session.
7. Logout: gọi `POST /auth/logout` → server revoke refresh token trong DB → xoá cookie. Session được xác định qua claim `sid` của **access token**, không qua cookie (cookie có `Path` hẹp nên không được gửi tới `/auth/logout`).

**Chống brute-force (không dùng rate limiter):** đếm số lần đăng nhập sai theo định danh trong `CacheService`. Lần sai thứ `AUTH_MAX_FAILED_LOGIN_ATTEMPTS` (mặc định 5) đặt khoá `AUTH_LOCKOUT_MINUTES` (mặc định 15) và trả **429**; các lần thử sau đó trong thời gian khoá trả **423**. Cả hai đều kèm header `Retry-After` (giây) — đó là kênh duy nhất máy đọc được, vì `error.message` là văn bản tiếng Anh cho developer. Trạng thái tài khoản (`ACCOUNT_INACTIVE`) chỉ được kiểm tra **sau khi** mật khẩu đúng.

### 7.2. Forgot Password flow

1. `POST /auth/forgot-password` → tạo reset token (random 32 bytes) → lưu **SHA-256 hash** của token vào `CacheService` với TTL 30 phút (`AUTH_RESET_TOKEN_TTL_MINUTES`). Giá trị thật chỉ có trong email. Response luôn giống nhau dù email có tồn tại hay không (chống user enumeration).
2. Gửi email chứa link `<FRONTEND_URL>/reset-password?token=<raw_token>`.
3. `POST /auth/reset-password` → hash token từ request → so khớp trong cache → cập nhật password → xoá token (dùng một lần).

Entry được giữ thêm một khoảng ân hạn sau khi hết hạn logic để phân biệt `RESET_TOKEN_EXPIRED` (token đúng nhưng quá hạn) với `RESET_TOKEN_INVALID` (không tồn tại / đã dùng).

> **Token KHÔNG nằm trong Redis.** Dự án quyết định **chưa dùng Redis** (cũng không Docker) ở giai đoạn này. Chỗ lưu là `CacheService` — một abstraction trong `src/shared/cache/` với driver mặc định `InMemoryCacheService` (Map + TTL theo từng key + sweep định kỳ). Interface mô phỏng đúng quy ước Redis (`incr`, `ttl` trả `-2`/`-1`) để sau này thêm `RedisCacheService` và đổi `useClass` trong `CacheModule` là xong, business logic không phải sửa dòng nào.
>
> ⚠️ **Hai giới hạn – phải xử lý TRƯỚC khi lên production** (đây chính là lý do đây là việc tiền-production chứ không phải chuyện nhỏ):
> 1. **State nằm trong RAM của process** → restart app là **mất sạch** counter lockout đang đếm và mọi token reset password đang chờ. Người dùng vừa bấm "quên mật khẩu" sẽ thấy link báo không hợp lệ.
> 2. **Không chia sẻ giữa nhiều process** → chạy **PM2 cluster** thì mỗi worker có một Map riêng: đếm login sai không chính xác (5 lần sai chia cho N worker ⇒ khoá không bao giờ kích hoạt), và token reset tạo ở worker A không đọc được ở worker B.
>
> Ngoài ra driver này không có eviction theo dung lượng — chỉ dùng cho dữ liệu nhỏ, có TTL.

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

## 8. Caching

> **Không có Redis, và không có tầng cache dữ liệu nào.** Phiên bản trước của mục này liệt kê các key `provinces` / `districts:{provinceCode}` / `wards:{districtCode}` cùng "63 tỉnh/thành" — **không có gì trong đó được hiện thực**, và cấp huyện thì đã không còn tồn tại (§8.2).

### 8.1. `CacheService` – cái đang thực sự chạy

`src/shared/cache/` là một `@Global` module cung cấp abstract class `CacheService`:

| Method | Ghi chú |
|--------|---------|
| `get<T>(key)` / `set<T>(key, value, ttlSeconds?)` / `del(key)` | `ttlSeconds` bỏ trống = không hết hạn |
| `incr(key, ttlSeconds?)` | Giống `INCR` + `EXPIRE NX` của Redis: TTL chỉ set ở lần đầu, các lần incr sau **không** gia hạn |
| `ttl(key)` | Giữ đúng quy ước Redis: `-2` = key không tồn tại, `-1` = tồn tại nhưng không có TTL |
| `reset()` | Chỉ dùng cho test/maintenance, **không** dùng trong business logic |

Driver đang dùng: **`InMemoryCacheService`** (`Map` + TTL từng key + sweep mỗi 60 giây). Xem §7.2 cho hai giới hạn phải xử lý trước production.

Hiện chỉ có **auth** dùng cache, với 3 nhóm key:

| Key | TTL | Nội dung |
|-----|-----|----------|
| `auth:login:fail:{identifier}` | = thời gian khoá (15 phút) | Counter số lần đăng nhập sai liên tiếp |
| `auth:login:lock:{identifier}` | 15 phút | Trạng thái "đang bị khoá" |
| `auth:reset:{sha256(token)}` | 30 phút + ân hạn 15 phút | Payload token reset password (`userId`, `expiresAt`) |

**Chưa có** cache cho `holidays`, `leave_types` hay bất kỳ master data nào — và cũng chưa cần: chúng là truy vấn nhỏ trên bảng nhỏ.

### 8.2. Dữ liệu tham chiếu tĩnh (thay cho cache tỉnh/huyện/xã)

Danh mục hành chính **không** nằm trong DB và **không** cần cache: chúng là file JSON đóng gói cùng app trong `src/common/data/`, nạp **một lần lúc khởi động** và gom sẵn theo tỉnh trong bộ nhớ.

| File | Nội dung |
|------|----------|
| `vn-provinces.json` | **34** tỉnh/thành phố (sau sáp nhập 01/07/2025) |
| `vn-wards.json` | **3.321** phường/xã/đặc khu (687 phường, 2.621 xã, 13 đặc khu) |

Sinh bằng `scripts/build-vn-admin-data.ts` từ danh mục cơ quan thuế; **app không gọi API ngoài lúc chạy**.

> **Cấp huyện đã bị bỏ.** Từ 01/07/2025 (Luật 72/2025/QH15) Việt Nam còn chính quyền địa phương **2 cấp**. Vì vậy không có key `districts:*`, không có endpoint `/system/districts`, và `employees.district_code` chỉ còn là cột nullable để đọc hồ sơ cũ.

### 8.3. Kế hoạch (chưa xây)

- Thêm `RedisCacheService implements CacheService`, đổi `useClass` trong `CacheModule` → khắc phục hai giới hạn ở §7.2 mà không phải sửa business logic.
- Rate limiting bằng Redis store (§12.1) — cũng chưa có.

---

## 9. File Upload – StorageService

> **S3 chưa từng chạy.** `StorageService` chọn driver theo biến `STORAGE_DRIVER`, mặc định **`local`**. Driver `s3` đã được viết nhưng **chưa bao giờ được thực thi**: dự án chưa có AWS credentials, nên `@aws-sdk/client-s3` **chưa được cài** vào `package.json` và chỉ được nạp bằng dynamic import khi thực sự upload (thiếu SDK → `503 STORAGE_DRIVER_UNAVAILABLE`).

### 9.1. Driver

| Driver | Khi nào | Nơi lưu | URL trả về |
|--------|---------|---------|-----------|
| `local` (mặc định) | dev/test, và production nếu chưa đổi | `uploads/` trên đĩa (`STORAGE_LOCAL_DIR`) | Đường dẫn tương đối `/<API_PREFIX>/uploads/…` |
| `s3` | ⏳ khi đã có credentials + `npm install @aws-sdk/client-s3` | Bucket `S3_BUCKET` | URL public (hoặc `S3_PUBLIC_BASE_URL`) |

`main.ts` chỉ mount route static `/<API_PREFIX>/uploads` khi driver là `local`, kèm `X-Content-Type-Options: nosniff` và `Content-Disposition: inline` để file upload không bao giờ được browser thực thi như HTML/script.

> Ở production mà vẫn để `STORAGE_DRIVER=local` thì `StorageModule` log **cảnh báo**: file chỉ nằm trên đĩa của **một** instance, PM2 cluster nhiều máy sẽ đọc không thấy ảnh.

### 9.2. Phân loại folder/key

```
avatars/{employeeId}/{random}.{ext}         ✅ đã có – max 2MB (AVATAR_MAX_BYTES),
                                               JPEG/PNG/WEBP
documents/{employeeId}/{type}/{filename}    ⏳ max 10MB, PDF/JPG/PNG
contracts/{contractId}/{filename}           ⏳ max 10MB, PDF
exports/{userId}/{timestamp}-{name}.xlsx    ⏳ max 50MB, XLSX (tự xoá sau 24h)
```

Hiện chỉ **avatar** đi qua `StorageService`. Bản xuất Excel (`GET /reports/employees/export`) được **stream thẳng về client**, không lưu file ở đâu cả.

### 9.3. Upload flow

1. Client gửi file qua `multipart/form-data` đến NestJS.
2. NestJS validate: dung lượng, và **kiểu file bằng magic bytes** — không tin phần mở rộng cũng không tin `Content-Type` client khai (`shared/storage/image-file.util.ts`).
3. Ghi qua driver với key theo pattern trên; phần tên file là **ngẫu nhiên** (chống cache cũ + chống đoán URL của người khác).
4. Lưu URL vào DB.
5. Trả URL về cho client.

> **Không** cho client upload thẳng lên S3 (Presigned URL) vì cần validate và audit log phía server.

### 9.4. Xoá file

Khi thay/xoá record → `StorageService.removeByUrl()`. Thao tác này **không ném lỗi**: dọn rác thất bại không được làm hỏng nghiệp vụ đang chạy.

> ⏳ Kế hoạch Giai đoạn 8: bucket S3 phải **private**, truy cập qua presigned URL TTL 15 phút. Hiện driver `s3` mới dựng URL dạng public object URL. Export lifecycle rule 24 giờ cũng chưa áp dụng (chưa có file export nào được lưu).

---

## 10. Background Jobs & Scheduler

> ⏳ **Chưa xây gì cả.** `@nestjs/schedule` và `Bull` **chưa được cài**, không có `shared/scheduler/`, không có cron job nào đang chạy. Toàn bộ mục này là kế hoạch.
>
> Lưu ý: queue bằng Bull cần Redis, mà Redis chưa có (§8) — nên §10 phụ thuộc vào việc thay driver cache trước.

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

> **SES chưa từng chạy.** `MailService` chọn transport theo `MAIL_TRANSPORT`, mặc định **`dev`**. Transport `ses` đã được viết nhưng **chưa bao giờ được thực thi**: dự án chưa có AWS credentials, nên `@aws-sdk/client-sesv2` **chưa được cài** và chỉ nạp bằng dynamic import khi thực sự gửi (thiếu SDK → `503 MAIL_TRANSPORT_UNAVAILABLE`).
>
> Không dùng `@nestjs-modules/mailer` và **không dùng Handlebars** — package đó cũng chưa được cài.

### 11.1. Transport

| Transport | Khi nào | Hành vi |
|-----------|---------|---------|
| `dev` (mặc định) | dev/test | **Không gửi email thật.** Render nội dung ra file HTML: `logs/mail/<timestamp>-<to>.html`. Nhờ vậy test được luồng forgot-password ở local mà không cần AWS |
| `ses` | ⏳ khi đã có credentials + `npm install @aws-sdk/client-sesv2` | Gửi thật qua AWS SES v2 |

> ⚠️ File trong `logs/mail/` chứa **toàn bộ** nội dung email, gồm cả link reset password. `logs/` phải luôn nằm trong `.gitignore`, và transport này không được bật ở production. Ở production mà vẫn để `MAIL_TRANSPORT=dev` thì `MailModule` log cảnh báo rõ ràng ("email sẽ CHỈ được ghi ra file, KHÔNG gửi thật"). Dòng log chỉ ghi đường dẫn file + người nhận, **không** ghi token.

### 11.2. Các email được gửi

| Trigger | Trạng thái | Nội dung |
|---------|-----------|----------|
| Forgot password | ✅ đã có | Link reset (hết hạn 30 phút) |
| Tạo tài khoản mới | ⏳ | Username, link đặt mật khẩu |
| Đơn nghỉ được duyệt / bị từ chối | ⏳ | Chi tiết đơn / lý do |
| HĐ sắp hết hạn | ⏳ | Danh sách NV (gửi cho HR) |
| Lương đã được duyệt | ⏳ | Link xem phiếu lương |

### 11.3. Template

Templates là **hàm TypeScript** trong `src/shared/mail/templates/` (hiện có `reset-password.template.ts`), không phải file `.hbs`. Mỗi template trả về cả bản HTML và bản text thuần.

---

## 12. Rate Limiting & Security Headers

### 12.1. Rate limiting

> ⏳ **Chưa có.** `@nestjs/throttler` chưa được cài và không có guard rate-limit nào đang chạy.
>
> Cái **đã có** là **lockout đăng nhập theo định danh** (không theo IP): 5 lần sai liên tiếp → khoá 15 phút, đếm trong `CacheService` — xem §7.1. Nó chống được đoán mật khẩu của một tài khoản cụ thể, nhưng **không** chống được quét nhiều tài khoản từ một IP, và cũng không bảo vệ `/auth/forgot-password` khỏi spam email.

Kế hoạch (`@nestjs/throttler` + Redis store):

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

- **Allowed origins**: đúng **một** origin, đọc từ `FRONTEND_URL` (mặc định `http://localhost:5173`)
- **Allowed methods**: GET, POST, PATCH, DELETE
- **Allowed headers**: Content-Type, Authorization
- **Credentials**: `true` (để gửi HttpOnly cookie)
- **Exposed headers**: `Content-Disposition`

> **Vì sao phải `exposedHeaders`:** browser giấu **mọi** response header khỏi JS trừ một danh sách safelist ngắn, và `Content-Disposition` không nằm trong đó. Thiếu dòng này thì file Excel vẫn tải về được nhưng tên file server chọn không đọc được, file rơi xuống với tên kiểu "download". Ở dev không thấy vấn đề vì Vite proxy làm request thành same-origin.

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

Dùng **Winston** (`nest-winston`, thay logger mặc định của Nest trong `main.ts`) với 3 transport:

| Transport | Level | Ghi chú |
|-----------|-------|---------|
| Console (màu, `nestLike`) | `debug` ở dev · `info` ở production | – |
| File `logs/error.log` | `error` | JSON |
| File `logs/combined.log` | theo level chung | JSON |

`logs/` nằm trong `.gitignore` (cùng chỗ với `logs/mail/` của transport mail dev).

> ⏳ **CloudWatch Logs chưa có.** Ở production hiện tại log vẫn chỉ ra console + file trên đĩa instance.

**Log những gì:**
- `HttpExceptionFilter` log **mọi** lỗi: `warn` cho 4xx, `error` + stack trace cho 5xx, kèm method + URL + status + code.
- Các hành động quan trọng: login thành công, logout, phát hiện dùng lại refresh token, khoá tài khoản, xuất Excel bản không che (mức `warn`, kèm người yêu cầu).
- ⏳ Chưa có logging interceptor ghi duration/user_id cho **mọi** request.

**Không log:**
- Password, token, CCCD, số tài khoản ngân hàng.
- Request body của `POST /auth/login`, `POST /auth/change-password`.

### 13.3. Sentry (error monitoring)

> ⏳ **Chưa tích hợp** – chưa có package `@sentry/*` nào trong `package.json`, và không có biến `SENTRY_DSN` trong Joi schema.

Kế hoạch:
- Tự động capture unhandled exceptions.
- Gắn user context (user_id, role) vào mỗi error.
- Ignore 4xx errors (chỉ alert 5xx).

---

## 14. Health Check

`GET /health` — `@Public()`, không cần auth, dùng cho PM2, load balancer, uptime monitoring.

**Hiện tại** (`app.service.ts`, tự viết – **không** dùng `@nestjs/terminus`):

| Check | Mục đích |
|-------|---------|
| Database ping (`SELECT 1`) | MySQL connection còn sống |
| `process.uptime()` | Thời gian process đã chạy |

```json
{ "success": true, "data": { "status": "ok", "uptime": 1234.5, "database": "up" }, "timestamp": "…" }
```

> ⚠️ Endpoint **luôn trả 200**, kể cả khi DB down (khi đó `status: "error"`, `database: "down"`). Load balancer nào chỉ nhìn HTTP status sẽ tưởng app khoẻ — cần sửa trước khi đặt sau LB thật.

⏳ Chưa có: Redis ping (chưa có Redis), disk space, memory usage, và mã `503 Service Unavailable` khi có check fail.

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

Schema xác thực bằng **Joi** (`src/config/env.validation.ts`) với `abortEarly: false` — thiếu/sai biến thì app **fail fast lúc bootstrap** chứ không chết giữa chừng lúc chạy.

| Nhóm | Biến | Bắt buộc | Mặc định / Mô tả |
|------|------|:--------:|------------------|
| **App** | `NODE_ENV` | ❌ | `development` \| `production` \| `test` (mặc định `development`) |
| | `PORT` | ❌ | `3000` |
| | `API_PREFIX` | ❌ | `api/v1` (không có dấu `/` đầu) |
| | `FRONTEND_URL` | ❌ | `http://localhost:5173` — dùng cho CORS **và** link trong email reset |
| **Database** | `DB_HOST` | ✅ | – |
| | `DB_PORT` | ❌ | `3306` |
| | `DB_USERNAME` | ✅ | – |
| | `DB_PASSWORD` | ✅ | Cho phép chuỗi rỗng nhưng **phải khai báo** |
| | `DB_DATABASE` | ✅ | – |
| **JWT** | `JWT_SECRET` | ✅ | **≥ 64 ký tự** (≈256-bit entropy nếu random hex) |
| | `JWT_EXPIRES_IN` | ❌ | `15m` |
| | `JWT_REFRESH_EXPIRES_IN` | ❌ | `7d` |
| **Auth policy** | `AUTH_MAX_FAILED_LOGIN_ATTEMPTS` | ❌ | `5` |
| | `AUTH_LOCKOUT_MINUTES` | ❌ | `15` |
| | `AUTH_MAX_CONCURRENT_SESSIONS` | ❌ | `5` (vượt → revoke session **cũ nhất**) |
| | `AUTH_RESET_TOKEN_TTL_MINUTES` | ❌ | `30` |
| | `AUTH_REFRESH_COOKIE_NAME` | ❌ | `refresh_token` |
| **Mail** | `MAIL_TRANSPORT` | ❌ | `dev` (mặc định) \| `ses` |
| | `MAIL_FROM` | ❌ | `no-reply@company.local` |
| | `MAIL_FROM_NAME` | ❌ | `HRM System` |
| | `MAIL_DEV_OUTPUT_DIR` | ❌ | `logs/mail` |
| | `AWS_REGION` | ❌ | `ap-southeast-1` (dùng chung cho SES và S3) |
| **Storage** | `STORAGE_DRIVER` | ❌ | `local` (mặc định) \| `s3` |
| | `STORAGE_LOCAL_DIR` | ❌ | `uploads` |
| | `STORAGE_LOCAL_PUBLIC_PATH` | ❌ | Mặc định `/<API_PREFIX>/uploads` |
| | `S3_BUCKET` | ⚠️ | **Bắt buộc khi** `STORAGE_DRIVER=s3` |
| | `S3_PUBLIC_BASE_URL` | ❌ | CDN/CloudFront; rỗng = endpoint S3 mặc định |
| | `AVATAR_MAX_BYTES` | ❌ | `2097152` (2MB) |
| **Seed** | `SEED_DEFAULT_PASSWORD` | ❌ | Chỉ dùng cho script seed ở dev |

**Không có trong schema** (vì tính năng chưa xây): `REDIS_*`, `SENTRY_DSN`, `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (khi bật S3/SES nên cấp bằng IAM role của EC2/ECS thay vì key trong `.env`).

---

## 18. Lý do chọn tech stack

| Quyết định | Thay vì | Lý do |
|-----------|---------|-------|
| TypeORM | Prisma | Migration linh hoạt hơn cho schema phức tạp VN (26 bảng, circular FK) |
| MySQL 8 | PostgreSQL | Phổ biến hơn ở VN, dễ tìm DBA và hosting |
| **In-memory cache sau `CacheService`** | **Redis ngay từ đầu** | **Quyết định của chủ dự án: chưa dùng Redis (và không Docker) ở giai đoạn này** — thêm một service phải vận hành để phục vụ 3 loại key nhỏ là chưa đáng. Đổi lại phải chấp nhận 2 giới hạn ở §7.2 và **phải** thay driver trước khi bật PM2 cluster / lên production. Abstraction giữ cho việc đổi chỉ tốn một dòng `useClass` |
| JWT + Refresh Token | Session | Stateless, scale tốt khi thêm server |
| Refresh token trong cookie HttpOnly `Path` hẹp | Trả trong response body | JS không đọc được → XSS không lấy được phiên 7 ngày; `Path` hẹp để browser không đính kèm token vào mọi request |
| Mã bản ghi do server sinh (`PB`/`CV`/`NP`/`NV`) | Người dùng tự nhập | Người dùng không phải nghĩ ra định danh trước khi lưu, và dữ liệu không trôi dạt (`IT`/`it`/`CNTT` cùng một phòng) |
| Dữ liệu hành chính từ file JSON đóng gói | Bảng DB hoặc API ngoài | Bất biến, tra cứu nhiều, và không phụ thuộc dịch vụ bên thứ ba lúc chạy |
| Bull + Redis (⏳) | Cron đơn thuần | Job queue bền vững, không mất job khi server restart |
| AWS SES (⏳) | SMTP tự host | Rẻ, deliverability cao, không cần quản lý server email |
| PM2 cluster (⏳) | Single process | Tận dụng nhiều CPU core trên EC2 |
| RDS (⏳) | MySQL cùng EC2 | Tách biệt database ra instance riêng, tự backup, failover |

---

## 19. Việc phải làm trước khi lên production

| # | Việc | Vì sao chặn |
|---|------|-------------|
| 1 | Thêm `RedisCacheService` và đổi driver trong `CacheModule` | In-memory mất state khi restart và **không** chia sẻ giữa các worker PM2 → lockout đăng nhập và token reset password sai (§7.2, §8.1) |
| 2 | `npm install @aws-sdk/client-sesv2`, đặt `MAIL_TRANSPORT=ses`, verify `MAIL_FROM` | Transport SES **chưa từng chạy**; để `dev` ở production nghĩa là email không bao giờ được gửi (§11) |
| 3 | `npm install @aws-sdk/client-s3`, đặt `STORAGE_DRIVER=s3` + bucket private + presigned URL | Driver S3 **chưa từng chạy**; `local` chỉ ghi lên đĩa một instance (§9) |
| 4 | Chặn Swagger ở production | `main.ts` đang mount `/api/docs` ở **mọi** môi trường |
| 5 | `GET /health` trả `503` khi có check fail | Hiện luôn trả 200, LB sẽ tưởng app khoẻ (§14) |
| 6 | Thêm rate limiting theo IP | Lockout hiện chỉ theo định danh, không chặn quét nhiều tài khoản hay spam forgot-password (§12.1) |
| 7 | Chuyển log ra CloudWatch + tích hợp Sentry | Log đang nằm trên đĩa instance, không có alert (§13) |

---

*Cập nhật: 19/08/2026 – Version 1.1 – Đồng bộ với code sau Giai đoạn 0–3: phân biệt "đã chạy" vs "kế hoạch" trong toàn tài liệu; §7.2 reset token nằm ở `CacheService` in-memory (KHÔNG Redis) kèm 2 giới hạn; §8 viết lại (bỏ cache tỉnh/huyện/xã, mô tả dữ liệu JSON tĩnh 34 tỉnh/3.321 phường-xã); §4 cập nhật cây thư mục thật (`shared/cache|mail|storage`, `modules/reports|contracts|family-members|dependents|system`); §9/§11 nói rõ S3 và SES chưa từng chạy; §14/§17 theo code hiện tại; thêm §19 checklist tiền-production*
