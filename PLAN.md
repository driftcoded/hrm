# HRM Project — Kế hoạch xây dựng

**Cập nhật lần cuối:** 21/06/2026  
**Trạng thái tổng thể:** 🟡 Đang chuẩn bị

---

## Tiến độ tổng quan

| Giai đoạn | Tên | Tiến độ | Trạng thái |
|-----------|-----|---------|------------|
| 0 | Khởi tạo project | 0 / 14 | ⬜ Chưa bắt đầu |
| 1 | Auth & User | 0 / 21 | ⬜ Chưa bắt đầu |
| 2 | Master Data | 0 / 11 | ⬜ Chưa bắt đầu |
| 3 | Nhân viên | 0 / 16 | ⬜ Chưa bắt đầu |
| 4 | Chấm công | 0 / 10 | ⬜ Chưa bắt đầu |
| 5 | Phép | 0 / 12 | ⬜ Chưa bắt đầu |
| 6 | Lương | 0 / 13 | ⬜ Chưa bắt đầu |
| 7 | HR Processes | 0 / 10 | ⬜ Chưa bắt đầu |
| 8 | Thông báo & Hoàn thiện | 0 / 21 | ⬜ Chưa bắt đầu |

**Tổng:** 0 / 128 tasks hoàn thành

---

## Hướng dẫn sử dụng

- `[ ]` = Chưa làm
- `[x]` = Hoàn thành + test pass
- `[~]` = Đang làm dở
- `[!]` = Có vấn đề / blocked

Mỗi task BE/FE đều có **Test checklist** riêng. Chỉ tick `[x]` khi **test pass hết**.

---

## Giai đoạn 0 — Khởi tạo project

### 0.1 Backend scaffold
- [ ] `nest new` với TypeScript strict, cấu hình `tsconfig.json`
- [ ] Cài dependencies: TypeORM, MySQL2, JWT, bcrypt, class-validator, class-transformer, Swagger, Helmet, Winston
- [ ] Cấu hình `ConfigModule` (validate env vars)
- [ ] Cấu hình `DatabaseModule` (TypeORM + retry on fail)
- [ ] Setup `TransformInterceptor` (response format chuẩn)
- [ ] Setup `HttpExceptionFilter` (error format chuẩn)
- [ ] Setup `ValidationPipe` global
- [ ] Chạy migration tạo đủ 26 bảng theo `database-schema.md`
- [ ] Seed master data: tỉnh/huyện/xã, ngày lễ, roles
- [ ] Swagger UI chạy được tại `/api/docs`

**Tests (0.1):**
- [ ] `npm run build` không lỗi
- [ ] `npm run start:dev` khởi động, kết nối DB thành công
- [ ] Swagger UI hiển thị đúng tại `/api/docs`
- [ ] Migration chạy không lỗi, 26 bảng được tạo

### 0.2 Frontend scaffold
- [ ] `npm create vite@latest` → React 19 + TypeScript 6
- [ ] Cài dependencies: antd v6, react-router v7, @tanstack/react-query v5, zustand v5, axios, dayjs (vi locale), i18next 26 + react-i18next 17
- [ ] Cấu hình alias `@/` trong `vite.config.ts` + `tsconfig.json`
- [ ] Cấu hình Vite proxy API → `http://localhost:3000`
- [ ] `ConfigProvider` Ant Design: theme token, locale `vi_VN`
- [ ] Setup axios instance + interceptors (attach Bearer token, refresh logic)
- [ ] Setup `authStore` (Zustand) + `uiStore`
- [ ] Layout shell: `AppLayout`, `Sidebar`, `Header`, `PageHeader`
- [ ] Route skeleton: `RouterConfig.tsx` với `PrivateRoute`
- [ ] i18n setup: `locales/vi.json`, `locales/en.json`

**Tests (0.2):**
- [ ] `npm run dev` chạy tại `localhost:5173`
- [ ] `npm run build` không lỗi TypeScript
- [ ] Layout hiển thị đúng: sidebar, header, content area
- [ ] Proxy API hoạt động (request từ FE đến BE không bị CORS)

---

## Giai đoạn 1 — Auth & User

### 1.1 Backend Auth
- [ ] `AuthModule`: `POST /auth/login` trả JWT + set HttpOnly cookie refresh token
- [ ] `POST /auth/refresh` — refresh access token từ cookie
- [ ] `POST /auth/logout` — xóa refresh token trong DB + clear cookie
- [ ] `JwtAuthGuard` — bảo vệ routes cần đăng nhập
- [ ] `RolesGuard` + `@Roles()` decorator
- [ ] `@CurrentUser()` decorator — lấy user từ JWT payload
- [ ] `POST /auth/forgot-password` — gửi email reset link (SES)
- [ ] `POST /auth/reset-password` — đặt mật khẩu mới từ token
- [ ] **[Security]** Account lockout: Redis đếm failed login, khóa 15 phút sau 5 lần sai liên tiếp
- [ ] **[Security]** Giới hạn tối đa 5 sessions đồng thời/user — login mới kick session cũ nhất
- [ ] **[Security]** Cookie refresh token: xác nhận `SameSite=Strict; Secure; HttpOnly`
- [ ] **[Security]** JWT secret tối thiểu 256-bit random (không dùng string dễ đoán)
- [ ] **[Security]** `assertOwnership()` helper — kiểm tra resource thuộc về user hiện tại trước mọi thao tác

**Tests (1.1):**
- [ ] Login đúng → trả `access_token` + cookie
- [ ] Login sai mật khẩu → 401 với `error.message` rõ ràng
- [ ] Login sai 5 lần → 429, tài khoản bị khóa 15 phút
- [ ] Login sau khi bị khóa → 423 với thời gian còn lại
- [ ] Request không có token → 401
- [ ] Refresh token hợp lệ → trả token mới, token cũ bị revoke ngay
- [ ] Refresh token hết hạn → 401
- [ ] Dùng lại refresh token đã bị revoke → 401 + revoke toàn bộ session user đó
- [ ] Logout → cookie bị xóa, refresh token trong DB bị xóa
- [ ] Login thứ 6 → session cũ nhất tự động bị kick
- [ ] Forgot password → email được gửi (kiểm tra SES log)
- [ ] Reset password với token hợp lệ → mật khẩu thay đổi được
- [ ] Reset password với token hết hạn → 400
- [ ] `assertOwnership()`: NV A cố truy cập resource của NV B → 403

### 1.2 Frontend Auth
- [ ] Trang `/login`: form email + mật khẩu, validate
- [ ] Xử lý login: lưu token vào `authStore`, redirect `/dashboard`
- [ ] Axios interceptor: tự động refresh khi nhận 401, queue requests
- [ ] `PrivateRoute`: redirect về `/login` nếu chưa đăng nhập
- [ ] Trang `/forgot-password` + `/reset-password`
- [ ] Trang profile cá nhân: xem thông tin, đổi mật khẩu
- [ ] Dropdown user header: tên, xem profile, đăng xuất
- [ ] Logout: clear store, redirect `/login`

**Tests (1.2):**
- [ ] Login form: validate email, mật khẩu min 8 ký tự
- [ ] Login thành công → vào dashboard
- [ ] Login sai → hiện error message
- [ ] F5 sau login → vẫn đăng nhập (token còn trong memory, check /auth/me)
- [ ] Token hết hạn → tự refresh, user không bị kick ra
- [ ] Refresh fail → redirect login
- [ ] Truy cập `/dashboard` khi chưa login → redirect `/login`
- [ ] Logout → không thể back về trang trước

---

## Giai đoạn 2 — Master Data

### 2.1 Backend Master Data
- [ ] `DepartmentsModule`: CRUD + cây phân cấp (parent_id)
- [ ] `PositionsModule`: CRUD + liên kết department
- [ ] `ContractTypesModule`: CRUD loại hợp đồng
- [ ] `LeaveTypesModule`: CRUD loại phép + số ngày được hưởng mặc định
- [ ] `HolidaysModule`: CRUD ngày lễ theo năm
- [ ] Phân quyền: chỉ Admin/HR mới CRUD, các role khác chỉ GET

**Tests (2.1):**
- [ ] CRUD đầy đủ 5 module, response đúng format
- [ ] Xóa department có nhân viên → trả lỗi rõ ràng (không xóa cascade NV)
- [ ] Phân quyền: nhân viên thường GET được, không POST/PUT/DELETE được

### 2.2 Frontend Settings
- [ ] Trang `/settings/departments`: bảng + modal tạo/sửa + xóa
- [ ] Trang `/settings/positions`: bảng + modal
- [ ] Trang `/settings/contract-types`: bảng + modal
- [ ] Trang `/settings/leave-types`: bảng + số ngày mặc định
- [ ] Trang `/settings/holidays`: bảng + chọn ngày lặp lại hàng năm
- [ ] Sidebar Settings menu chỉ hiện với Admin

**Tests (2.2):**
- [ ] CRUD trên UI hoạt động, refresh trang không mất data
- [ ] Validation: tên trùng → hiện lỗi
- [ ] Không có permission → redirect hoặc ẩn menu

---

## Giai đoạn 3 — Nhân viên

### 3.1 Backend Employees
- [ ] `EmployeesModule`: tạo, đọc, cập nhật, soft delete
- [ ] Filter: phòng ban, chức vụ, trạng thái, tìm kiếm tên/mã NV
- [ ] Phân trang chuẩn (page, pageSize, total)
- [ ] Upload avatar lên S3, lưu URL vào `employees.avatar_url`
- [ ] `ContractsModule`: CRUD hợp đồng cho từng NV
- [ ] `FamilyMembersModule`: CRUD thành viên gia đình
- [ ] Restore nhân viên đã soft delete
- [ ] `GET /employees/:id/summary` — tóm tắt thông tin NV cho phiếu lương

**Tests (3.1):**
- [ ] Tạo NV với đầy đủ field bắt buộc → thành công
- [ ] CCCD không đúng 12 số → 400
- [ ] SĐT sai định dạng → 400
- [ ] Tạo NV thiếu email → 400
- [ ] Tìm kiếm theo tên → kết quả đúng
- [ ] Filter kết hợp phòng ban + trạng thái → đúng
- [ ] Soft delete → không xuất hiện trong danh sách thường
- [ ] Restore → xuất hiện lại
- [ ] Upload avatar > 2MB → 400

### 3.2 Frontend Employees
- [ ] Trang `/employees`: DataTable + filter bar (phòng ban, trạng thái, search)
- [ ] Wizard tạo NV 4 bước: cơ bản → công việc → lương → tài khoản
- [ ] Trang chi tiết NV: 8 tabs (cá nhân, hợp đồng, lương, phép, chấm công, khen thưởng, đánh giá, gia đình)
- [ ] Upload avatar với preview
- [ ] CCCD hiển thị che giữa trong danh sách
- [ ] SĐT hiển thị đúng định dạng `0901 234 567`
- [ ] Confirm xóa NV + lý do

**Tests (3.2):**
- [ ] Wizard: không thể Next nếu form bước hiện tại chưa hợp lệ
- [ ] Avatar upload: preview trước khi lưu
- [ ] Bảng phân trang: URL cập nhật `?page=2&pageSize=20`
- [ ] Filter combo hoạt động, không reset page
- [ ] Tab chi tiết: click tab không reload lại tab khác

---

## Giai đoạn 4 — Chấm công

### 4.1 Backend Attendance
- [ ] `AttendanceModule`: check-in/out, tính giờ công thực tế
- [ ] Tổng hợp chấm công theo tháng cho từng NV
- [ ] `OvertimeModule`: đăng ký + duyệt làm thêm giờ
- [ ] API export Excel báo cáo chấm công tháng

**Tests (4.1):**
- [ ] Check-in lúc 8h, check-out lúc 17h30 → 8.5 giờ công
- [ ] Check-in 2 lần trong ngày → chỉ tính lần đầu
- [ ] Chưa check-out → `check_out_time` null, giờ công = null
- [ ] Tổng hợp tháng đúng với dữ liệu check-in/out
- [ ] OT: manager duyệt → trạng thái `approved`
- [ ] Export Excel có đủ cột, đúng dữ liệu

### 4.2 Frontend Attendance
- [ ] Calendar view cá nhân: hiển thị có đi làm / vắng / OT
- [ ] Bảng chấm công toàn công ty (HR): filter phòng ban, tháng
- [ ] Form đăng ký OT: chọn ngày, giờ, lý do
- [ ] Trang duyệt OT (Manager)

**Tests (4.2):**
- [ ] Calendar hiển thị đúng tháng, click ngày xem chi tiết
- [ ] Bảng HR: filter phòng ban cập nhật ngay
- [ ] OT: gửi form → hiện trong danh sách chờ duyệt

---

## Giai đoạn 5 — Phép

### 5.1 Backend Leave
- [ ] `LeaveBalancesModule`: khởi tạo số ngày phép đầu năm cho toàn bộ NV
- [ ] Cột VIRTUAL `remaining_days` = `allocated + carried_over - used - pending`
- [ ] `LeaveRequestsModule`: nộp đơn, duyệt, từ chối, hủy
- [ ] Auto cập nhật `pending_days` khi nộp, `used_days` khi duyệt xong
- [ ] Kiểm tra: không cho phép trùng ngày, không quá số ngày còn lại
- [ ] API calendar: danh sách NV nghỉ phép trong khoảng ngày
- [ ] `GET /leave-balances/admin` — HR xem tất cả NV, init/adjust balance

**Tests (5.1):**
- [ ] Nộp đơn 3 ngày: `pending_days` tăng 3
- [ ] Duyệt đơn: `pending_days` giảm 3, `used_days` tăng 3
- [ ] Từ chối: `pending_days` giảm 3, số ngày hoàn lại
- [ ] Nộp đơn vượt quá số ngày còn lại → 400
- [ ] Nộp đơn trùng ngày đang có đơn khác → 400
- [ ] `remaining_days` tính đúng sau mỗi thao tác

### 5.2 Frontend Leave
- [ ] Trang `/leave/balance`: số ngày theo loại phép (dạng card)
- [ ] Trang `/leave/requests`: danh sách đơn của tôi, filter trạng thái
- [ ] Form tạo đơn phép: chọn loại phép, ngày bắt đầu/kết thúc, lý do, attach file
- [ ] Trang duyệt phép (Manager): danh sách đơn chờ duyệt
- [ ] Calendar phép: xem ai đang nghỉ

**Tests (5.2):**
- [ ] Tạo đơn: DatePicker không cho chọn ngày cuối tuần (nếu công ty không tính)
- [ ] Số ngày còn lại cập nhật ngay sau khi nộp đơn
- [ ] Manager duyệt → trạng thái đổi sang `approved`
- [ ] Nhân viên nhận thông báo khi đơn được duyệt/từ chối

---

## Giai đoạn 6 — Lương

> Theo đúng `docs/vn-business-rules.md`. Kiểm tra kỹ số liệu trước khi tick.

### 6.1 Backend Payroll
- [ ] `SalaryComponentsModule`: cấu hình các khoản phụ cấp theo NV
- [ ] `PayrollModule`: tính lương hàng loạt — trigger cho một tháng
- [ ] Logic BHXH 8%, BHYT 1.5%, BHTN 1% (tổng 10.5% NLĐ)
- [ ] Logic thuế TNCN lũy tiến 7 bậc + giảm trừ bản thân 11tr + phụ thuộc 4.4tr
- [ ] Tính hệ số công = ngày công thực tế / ngày công chuẩn tháng
- [ ] Tích hợp dữ liệu chấm công + phép + OT vào bảng lương
- [ ] Lock bảng lương: đã lock thì không tính lại
- [ ] `SalaryAdvancesModule`: tạm ứng lương

**Tests (6.1 — Bắt buộc kiểm tra từng số):**
- [ ] Lương gross 20tr → BHXH đúng = 1.6tr, BHYT = 300k, BHTN = 200k
- [ ] Thu nhập chịu thuế = Gross - BHXH NLĐ - Giảm trừ bản thân 11tr
- [ ] Thuế TNCN bracket 1 (0–5tr × 5%) đúng
- [ ] Thuế TNCN bracket 2 (5–10tr × 10%) đúng
- [ ] Lương Net = Gross - tổng khấu trừ — khớp với ví dụ trong business-rules.md
- [ ] NV có 1 người phụ thuộc → giảm trừ thêm 4.4tr
- [ ] Hệ số công: nghỉ 2 ngày không phép → lương bị trừ đúng
- [ ] Tạm ứng 5tr → bị trừ vào lương net tháng đó
- [ ] Bảng lương đã lock → không cho tính lại

### 6.2 Frontend Payroll
- [ ] Trang `/payroll`: danh sách bảng lương theo tháng (HR)
- [ ] Nút "Tính lương tháng X" + confirm + progress indicator
- [ ] Bảng chi tiết: từng NV, các khoản thu/khấu trừ, net
- [ ] Phiếu lương cá nhân: in được, đủ thông tin
- [ ] Trang tạm ứng lương

**Tests (6.2):**
- [ ] Trigger tính lương → hiện progress, sau đó hiện kết quả
- [ ] Số tiền hiển thị đúng định dạng `1.000.000 ₫`
- [ ] In phiếu lương: layout không bị vỡ, đủ thông tin pháp lý
- [ ] Bảng lương locked → ẩn nút "Tính lại"

---

## Giai đoạn 7 — HR Processes

### 7.1 Backend HR Processes
- [ ] `RewardsDisciplinesModule`: CRUD khen thưởng / kỷ luật theo NV
- [ ] `PerformanceReviewsModule`: tạo kỳ đánh giá, NV tự đánh, manager đánh
- [ ] `TrainingsModule`: CRUD khoá đào tạo, đăng ký tham gia, hoàn thành

**Tests (7.1):**
- [ ] Tạo kỷ luật → lưu vào lịch sử NV
- [ ] Tạo kỳ đánh giá → NV nhận thông báo
- [ ] Đánh giá: NV submit → Manager review → Hoàn thành
- [ ] Đào tạo: đăng ký → tham gia → hoàn thành → lịch sử cập nhật

### 7.2 Frontend HR Processes
- [ ] Tab Khen thưởng/kỷ luật trong chi tiết NV
- [ ] Trang `/performance`: danh sách kỳ đánh giá
- [ ] Form đánh giá: NV tự đánh (tự nhập điểm + nhận xét)
- [ ] Trang `/trainings`: danh sách khoá đào tạo, đăng ký

**Tests (7.2):**
- [ ] NV tự đánh → lưu nháp → submit
- [ ] Manager xem đánh giá NV → thêm nhận xét → xác nhận
- [ ] Lịch sử đào tạo hiển thị đúng trong tab NV

---

## Giai đoạn 8 — Thông báo & Hoàn thiện

### 8.1 Backend Announcements & Email
- [ ] `AnnouncementsModule`: CRUD, gắn file, gửi đến phòng ban/toàn công ty
- [ ] Email service (SES): duyệt phép, thông báo lương, reset mật khẩu
- [ ] Rate limiting per endpoint (Throttler)
- [ ] Security: Helmet headers, CORS whitelist
- [ ] Logging: Winston → file + CloudWatch
- [ ] **[Security]** Request size limit: `json({ limit: '1mb' })` + timeout cho long-running jobs
- [ ] **[Security]** Pagination hard cap: server luôn cap `pageSize` tối đa 100, bỏ qua giá trị lớn hơn
- [ ] **[Security]** `X-Request-ID` header cho mọi request — trace log end-to-end
- [ ] **[Security]** `npm audit` trong CI — block deploy nếu có `critical` vulnerability
- [ ] **[Security]** File upload: validate magic bytes server-side (không chỉ extension), giới hạn 2MB enforce phía server
- [ ] **[Security]** S3 files (avatar, phiếu lương, hợp đồng): bucket private, truy cập qua presigned URL TTL 15 phút
- [ ] **[Security]** Mã hóa CCCD và số tài khoản ngân hàng at-rest (AES-256) trước khi lưu DB
- [ ] **[Security]** Input sanitization: strip HTML tags khỏi text fields (tên, ghi chú, thông báo) trước khi lưu

**Tests (8.1):**
- [ ] Tạo thông báo gửi toàn công ty → tất cả NV nhận được
- [ ] Email duyệt phép được gửi đúng địa chỉ, nội dung đúng
- [ ] Rate limit: gọi quá 10 lần/phút → 429
- [ ] Request không hợp lệ không lọt qua Helmet headers
- [ ] Upload file > 2MB → 413 từ server (không phải chỉ FE validate)
- [ ] Upload file .php đổi tên thành .jpg → bị chặn (magic bytes check)
- [ ] Presigned URL hết hạn sau 15 phút → 403
- [ ] Payload JSON > 1MB → 413
- [ ] `pageSize=99999` → server trả tối đa 100 records
- [ ] Lưu tên NV có `<script>alert(1)</script>` → lấy ra không có thẻ script

### 8.2 Frontend Dashboard & Polish
- [ ] Dashboard: tổng NV đang làm, đơn phép chờ duyệt, lương tháng gần nhất
- [ ] Trang `/announcements`: danh sách thông báo, đọc chi tiết
- [ ] Empty states đầy đủ: bảng rỗng, lỗi tải
- [ ] Responsive: kiểm tra trên tablet (768px)
- [ ] Loading skeleton cho mọi trang
- [ ] Tất cả text qua `t('key')` — không còn hardcode tiếng Việt

**Tests (8.2):**
- [ ] Dashboard load < 2 giây (với dữ liệu thực)
- [ ] Thông báo chưa đọc → badge số trên header
- [ ] Kiểm tra toàn bộ trang trên màn hình 1280px và 768px
- [ ] `npm run build` không lỗi TypeScript, không warning
- [ ] Lighthouse Performance score ≥ 80

---

## Checklist Go-live

Trước khi đưa vào production, hoàn thành toàn bộ:

**Chức năng:**
- [ ] Tất cả tasks trên đã tick `[x]`
- [ ] Test smoke: đăng nhập → tạo NV → chấm công → xin phép → tính lương → in phiếu lương

**Bảo mật:**
- [ ] Không có `console.log` trong production code
- [ ] Không có credentials nào hardcode trong source code (`git grep -r "password\s*=" src/`)
- [ ] File `.env` trên server có quyền `chmod 600`
- [ ] File `.env.example` có đủ mọi biến môi trường, không có giá trị thật
- [ ] JWT_SECRET tối thiểu 64 ký tự random (`openssl rand -base64 64`)
- [ ] S3 bucket không có public access, chỉ dùng presigned URL
- [ ] Security headers kiểm tra qua securityheaders.com — đạt A
- [ ] OWASP Top 10 tự review: SQLi, XSS, IDOR, Broken Auth, Sensitive Data

**Hạ tầng:**
- [ ] DB backup strategy đã cấu hình (RDS automated backup hàng ngày, giữ 7 ngày)
- [ ] PM2 ecosystem config cho backend (cluster mode, auto-restart)
- [ ] Nginx config cho frontend static + proxy API + gzip + cache headers
- [ ] SSL certificate đã gắn (Let's Encrypt hoặc ACM)
- [ ] CloudWatch alerts: CPU > 80%, Memory > 85%, 5xx rate > 1%
- [ ] Sentry DSN đã kết nối (BE + FE), alert khi error mới
- [ ] `npm audit` clean — không có `critical` hoặc `high` vulnerability

---

*File này là nguồn sự thật duy nhất về tiến độ dự án. Cập nhật mỗi khi hoàn thành task.*
