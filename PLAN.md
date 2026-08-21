# HRM Project — Kế hoạch xây dựng

**Cập nhật lần cuối:** 13/08/2026
**Trạng thái:** 🟢 Giai đoạn 0–6 hoàn thành — đang vào Giai đoạn 7

---

## Tiến độ tổng quan

| Giai đoạn | Tên | Tiến độ | Trạng thái |
|-----------|-----|---------|------------|
| 0 | Khởi tạo project | 28 / 28 | ✅ Hoàn thành |
| 1 | Auth & User | 43 / 43 | ✅ Hoàn thành |
| 2 | Master Data | 18 / 18 | ✅ Hoàn thành |
| 3 | Nhân viên | 29 / 29 | ✅ Hoàn thành |
| 4 | Chấm công | 23 / 23 | ✅ Hoàn thành |
| 5 | Phép | 41 / 41 | ✅ Hoàn thành |
| 6 | Lương | 33 / 35 | 🟡 2 mục cần kiểm tra trên trình duyệt |
| 7 | Thông báo & Hoàn thiện | 0 / 34 | ⬜ Chưa bắt đầu |
| 8 | PDF, Excel & Email thật | 0 / 33 | ⬜ Chưa bắt đầu |

---

## Hướng dẫn sử dụng

- `[ ]` = Chưa làm
- `[x]` = Hoàn thành + test pass
- `[~]` = Đang làm dở
- `[!]` = Có vấn đề / blocked

Chỉ tick `[x]` khi **test pass hết**.

---

## Giai đoạn 0 — Khởi tạo project

### 0.1 Backend scaffold
- [x] `nest new` với TypeScript strict, cấu hình `tsconfig.json`
- [x] Cài dependencies: TypeORM, MySQL2, JWT, bcrypt, class-validator, class-transformer, Swagger, Helmet, Winston
- [x] Cấu hình `ConfigModule` (validate env vars)
- [x] Cấu hình `DatabaseModule` (TypeORM + retry on fail)
- [x] Setup `TransformInterceptor` (response format chuẩn)
- [x] Setup `HttpExceptionFilter` (error format chuẩn)
- [x] Setup `ValidationPipe` global
- [x] Chạy migration tạo đủ 26 bảng theo `database-schema.md`
- [x] Seed master data: tỉnh/huyện/xã, ngày lễ, roles
- [x] Swagger UI chạy được tại `/api/docs`

**Tests (0.1):**
- [x] `npm run build` không lỗi
- [x] `npm run start:dev` khởi động, kết nối DB thành công
- [x] Swagger UI hiển thị đúng tại `/api/docs`
- [x] Migration chạy không lỗi, 26 bảng được tạo

### 0.2 Frontend scaffold
- [x] `npm create vite@latest` → React 19 + TypeScript 6
- [x] Cài dependencies: antd v6, react-router v7, @tanstack/react-query v5, zustand v5, axios, dayjs (vi locale), i18next 26 + react-i18next 17
- [x] Cấu hình alias `@/` trong `vite.config.ts` + `tsconfig.json`
- [x] Cấu hình Vite proxy API → `http://localhost:3000`
- [x] `ConfigProvider` Ant Design: theme token, locale `vi_VN`
- [x] Setup axios instance + interceptors (attach Bearer token, refresh logic)
- [x] Setup `authStore` (Zustand) + `uiStore`
- [x] Layout shell: `AppLayout`, `Sidebar`, `Header`, `PageHeader`
- [x] Route skeleton: `RouterConfig.tsx` với `PrivateRoute`
- [x] i18n setup: `locales/vi.json`, `locales/en.json`

**Tests (0.2):**
- [x] `npm run dev` chạy tại `localhost:5173`
- [x] `npm run build` không lỗi TypeScript
- [x] Layout hiển thị đúng: sidebar, header, content area
- [x] Proxy API hoạt động, không bị CORS

---

## Giai đoạn 1 — Auth & User

### 1.1 Backend Auth
- [x] `AuthModule`: `POST /auth/login` trả JWT + set HttpOnly cookie refresh token
- [x] `POST /auth/refresh` — refresh access token từ cookie, có rotation
- [x] `POST /auth/logout` — xóa refresh token trong DB + clear cookie
- [x] `JwtAuthGuard` — bảo vệ routes cần đăng nhập, đăng ký global + `@Public()`
- [x] `RolesGuard` + `@Roles()` decorator
- [x] `@CurrentUser()` decorator — lấy user từ JWT payload
- [x] `POST /auth/forgot-password` — gửi email reset link
- [x] `POST /auth/reset-password` — đặt mật khẩu mới từ token, dùng 1 lần, TTL 30 phút
- [x] **[Security]** Account lockout: khóa 15 phút sau 5 lần sai liên tiếp
- [x] **[Security]** Giới hạn tối đa 5 sessions đồng thời/user — login mới kick session cũ nhất
- [x] **[Security]** Cookie refresh token: `SameSite=Strict; HttpOnly; Path=/api/v1/auth/refresh`
- [x] **[Security]** JWT secret tối thiểu 256-bit random, validate lúc bootstrap
- [x] **[Security]** `assertOwnership()` helper — kiểm tra resource thuộc về user hiện tại

**Tests (1.1):**
- [x] Login đúng → trả `access_token` + cookie
- [x] Login sai mật khẩu → 401
- [x] Login sai 5 lần → 429, tài khoản bị khóa 15 phút
- [x] Login sau khi bị khóa → 423 kèm header `Retry-After`
- [x] Request không có token → 401
- [x] Refresh token hợp lệ → trả token mới, token cũ bị revoke ngay
- [x] Refresh token hết hạn → 401
- [x] Dùng lại refresh token đã bị revoke → 401 + revoke toàn bộ session user đó
- [x] Logout → cookie bị xóa, refresh token trong DB bị xóa
- [x] Login thứ 6 → session cũ nhất tự động bị kick
- [x] Forgot password → email được gửi
- [x] Reset password với token hợp lệ → mật khẩu thay đổi được
- [x] Reset password với token hết hạn → 400
- [x] `assertOwnership()`: NV A cố truy cập resource của NV B → 403

### 1.2 Frontend Auth
- [x] Trang `/login`: form email + mật khẩu, validate
- [x] Xử lý login: lưu token vào `authStore`, redirect `/dashboard`
- [x] Axios interceptor: tự động refresh khi nhận 401, queue requests
- [x] `PrivateRoute`: redirect về `/login` nếu chưa đăng nhập
- [x] Trang `/forgot-password` + `/reset-password`
- [x] Trang profile cá nhân: xem thông tin, đổi mật khẩu
- [x] Dropdown user header: tên, xem profile, đăng xuất
- [x] Logout: clear store, redirect `/login`

**Tests (1.2):**
- [x] Login form: validate email, mật khẩu min 8 ký tự
- [x] Login thành công → vào dashboard
- [x] Login sai → hiện error message inline
- [x] F5 sau login → vẫn đăng nhập
- [x] Token hết hạn → tự refresh, user không bị kick ra
- [x] Refresh fail → redirect login
- [x] Truy cập `/dashboard` khi chưa login → redirect `/login`
- [x] Logout → không thể back về trang trước

---

## Giai đoạn 2 — Master Data

### 2.1 Backend Master Data
- [x] `DepartmentsModule`: CRUD + cây phân cấp (parent_id), chống vòng lặp
- [x] `PositionsModule`: CRUD + liên kết department
- [x] `GET /contract-types` — chỉ đọc (enum theo BLLĐ 2019, không cho tự tạo)
- [x] `LeaveTypesModule`: CRUD loại phép + seed 9 loại theo BLLĐ 2019
- [x] `HolidaysModule`: CRUD ngày lễ theo năm + auto-generate từ lunar calendar
- [x] Phân quyền: chỉ Admin/HR mới CRUD, các role khác chỉ GET

**Tests (2.1):**
- [x] CRUD đầy đủ 5 module, response đúng format
- [x] Xóa department có nhân viên → 422, không xóa cascade
- [x] Phân quyền: employee GET được, không POST/PUT/DELETE được

### 2.2 Frontend Settings
- [x] Trang `/settings/departments`: cây phân cấp + danh sách + modal tạo/sửa/xóa
- [x] Trang `/settings/positions`: bảng + modal
- [x] Trang `/settings/contract-types`: bảng chỉ đọc
- [x] Trang `/settings/leave-types`: bảng + số ngày mặc định
- [x] Trang `/catalog/holidays`: bảng + filter năm + modal + generate tự động

**Tests (2.2):**
- [x] CRUD trên UI hoạt động, refresh trang không mất data
- [x] Lỗi trùng mã → hiện inline trong modal
- [x] Không có permission → ẩn nút Thêm/Sửa/Xóa

---

## Giai đoạn 3 — Nhân viên

### 3.1 Backend Employees
- [x] `EmployeesModule`: tạo, đọc, cập nhật, soft delete; `employee_code` do server sinh
- [x] Filter: phòng ban, chức vụ, trạng thái, tên/mã NV, giới tính, khoảng ngày vào làm
- [x] Phân trang chuẩn (page, pageSize, total), trần `limit` = 100
- [x] Upload avatar lên S3/local, xác định kiểu file bằng magic bytes
- [x] `ContractsModule`: CRUD hợp đồng, áp đúng quy tắc BLLĐ 2019
- [x] `FamilyMembersModule`: CRUD thành viên gia đình
- [x] `DependentsModule`: CRUD người phụ thuộc giảm trừ gia cảnh, chống khai trùng CCCD/MST
- [x] Restore nhân viên đã soft delete
- [x] `GET /employees/:id/summary` — tóm tắt cho phiếu lương
- [x] Phân quyền theo phạm vi: admin/hr toàn công ty, manager phòng mình, employee chỉ bản thân

**Tests (3.1):**
- [x] Tạo NV với đầy đủ field bắt buộc → thành công
- [x] CCCD không đúng 12 số → 400 `INVALID_CCCD`
- [x] SĐT sai định dạng → 400 `INVALID_PHONE`
- [x] Tạo NV thiếu email → 400
- [x] Tìm kiếm theo tên → kết quả đúng
- [x] Filter kết hợp phòng ban + trạng thái → đúng
- [x] Soft delete → không xuất hiện trong danh sách thường
- [x] Restore → xuất hiện lại
- [x] Upload avatar > 2MB → 400 `AVATAR_TOO_LARGE`
- [x] File không phải ảnh đổi tên `.jpg` → 400 `AVATAR_INVALID_TYPE`

### 3.2 Frontend Employees
- [x] Trang `/employees`: DataTable + filter bar + 4 thẻ tổng quan + biểu đồ phòng ban
- [x] Wizard tạo NV 4 bước: cơ bản → công việc → lương → tài khoản
- [x] Trang chi tiết NV: 8 tabs (cá nhân, hợp đồng, lương, phép, chấm công, gia đình…)
- [x] Upload avatar với preview
- [x] CCCD hiển thị che giữa ở trang chi tiết, nút hiện/ẩn
- [x] SĐT hiển thị đúng định dạng `0901 234 567`
- [x] Confirm xóa NV + ghi lý do + ngày chấm dứt

**Tests (3.2):**
- [x] Wizard: không thể Next nếu form bước hiện tại chưa hợp lệ
- [x] Avatar upload: preview trước khi lưu
- [x] Bảng phân trang: URL cập nhật `?page=2&pageSize=20`
- [x] Filter combo hoạt động, không reset page
- [x] Tab chi tiết: click tab không reload lại tab khác

---

## Giai đoạn 4 — Chấm công

### 4.1 Backend Attendance
- [x] `AttendanceModule`: nhận dữ liệu từ ngoài (Excel + nhập tay), tính giờ công thực tế
- [x] `POST /attendances/bulk-import` — nạp file Excel, kiểu "tất cả hoặc không gì cả", có bước chạy thử
- [x] Giờ làm thêm suy ra từ bảng công: vượt 8h/ngày với ngày thường; toàn bộ với ngày nghỉ/lễ; phân loại hệ số Điều 98
- [x] API export Excel báo cáo chấm công tháng
- [x] Chặn vai trò `employee` đăng nhập

**Tests (4.1):**
- [x] Vào 8h, ra 17h30 → 8.5 giờ công
- [x] Nhập trùng ngày → 409, không ghi đè
- [x] Không giờ vào + không trạng thái → 422
- [x] Chưa có giờ ra → `check_out` null, giờ công = null
- [x] Giờ nghỉ 30 phút → 8.5 giờ; 90 phút → 7.5 giờ
- [x] Giờ làm thêm: ngày thường lấy phần vượt 8 giờ; ngày nghỉ/lễ lấy toàn bộ
- [x] Hệ số Điều 98 + ca đêm: ban đêm ngày thường = 2,0×; ngày lễ ban đêm = 3,5×
- [x] 1 phút vượt ngày công vẫn được trả
- [x] Vai trò `employee` đăng nhập → 403
- [x] Import file 3 lỗi → không dòng nào được ghi, trả về đủ 3 lỗi kèm số dòng Excel
- [x] Export Excel có đủ cột, đúng dữ liệu

### 4.2 Frontend Attendance
- [x] Bảng chấm công toàn công ty: lọc phòng ban + tháng
- [x] Màn hình nạp file Excel: 2 bước (kiểm tra trước → ghi thật), báo rõ số dòng sẽ ghi đè
- [x] Form nhập một ngày công (chọn nhân viên, giờ vào/ra, giờ nghỉ, trạng thái)
- [x] Xuất Excel bảng công tháng

**Tests (4.2):**
- [x] Bảng: đổi tháng / phòng ban → cập nhật ngay, trạng thái nằm trên URL
- [x] Nạp file: bước chạy thử báo đúng số tạo mới / ghi đè, file lỗi thì không ghi gì

---

## Giai đoạn 5 — Phép

### 5.1 Backend Leave
- [x] `LeaveBalancesModule`: cấp quỹ phép năm cho toàn bộ NV đang làm việc
- [x] `remaining_days` VIRTUAL = `allocated + carried_over − used − pending`
- [x] `LeaveRequestsModule`: ghi nhận, duyệt, từ chối, rút lại
- [x] Tự cập nhật `pending_days`/`used_days` trong cùng một transaction với đơn
- [x] Kiểm tra: không trùng ngày, không quá số ngày còn lại
- [x] `GET /leave-requests/calendar` — ai đang nghỉ trong khoảng ngày
- [x] `GET /leave-balances` + `PATCH /leave-balances/:id` — xem và điều chỉnh quỹ
- [x] `PATCH /leave-requests/:id` — sửa đơn; đơn đã duyệt thì dời `used_days` + ngày chấm công
- [x] `DELETE /leave-requests/:id` — xoá đơn, hoàn quỹ và gỡ ngày `leave` khỏi bảng chấm công
- [x] `DELETE /leave-balances/:id` — xoá dòng quỹ cấp nhầm, chặn khi đã có ngày bị tiêu

**Tests (5.1):**
- [x] Ghi nhận đơn 3 ngày: `pending_days` tăng 3
- [x] Duyệt: `pending_days` giảm 3, `used_days` tăng 3
- [x] Từ chối: `pending_days` giảm 3, số ngày được hoàn lại
- [x] Ghi nhận vượt quá số ngày còn lại → 422 `INSUFFICIENT_LEAVE_BALANCE`
- [x] Trùng ngày với đơn còn hiệu lực → 409 `OVERLAPPING_LEAVE`
- [x] `remaining_days` đúng sau mỗi thao tác
- [x] Nghỉ T6 → T2 = 2 ngày phép, không phải 4 (bỏ cuối tuần)
- [x] Nghỉ nửa ngày ở hai đầu; một ngày mà cả hai đầu nửa ngày vẫn là 0,5
- [x] Người ghi ≠ người duyệt (`CANNOT_APPROVE_OWN_RECORD`); `manager` không duyệt
- [x] Duyệt xong ghi ngày nghỉ vào bảng chấm công với `status = leave`
- [x] Sửa đơn: trả chỗ cũ trước khi giữ chỗ mới
- [x] Sửa đơn: chính nó không bị tính là trùng ngày với chính nó
- [x] Sửa đơn đã duyệt: dời `used_days`, gỡ ngày công cũ rồi ghi ngày công mới
- [x] Kéo dài đơn đã duyệt quá quỹ còn lại → 422
- [x] `manager` không sửa được đơn đã duyệt; đơn đã đóng → 409 `LEAVE_NOT_ACTIVE`
- [x] Xoá đơn đã duyệt: hoàn `used_days` và gỡ đúng những dòng chấm công còn `leave`
- [x] Xoá đơn đã duyệt: giữ dòng chấm công đã bị sửa sang trạng thái khác
- [x] Xoá đơn `rejected`/`cancelled` không đụng vào quỹ
- [x] `manager` không xoá được đơn đã duyệt; xoá quỹ đã có ngày bị tiêu → 422

### 5.2 Frontend Leave
- [x] Trang `/leave` — danh sách đơn, lọc trạng thái / phòng ban / loại phép / khoảng ngày
- [x] Form ghi nhận đơn cho nhân viên (chọn NV, loại phép, khoảng ngày, nửa ngày, lý do)
- [x] Duyệt ngay trên danh sách: lối tắt `?status=pending`, nút Duyệt / Từ chối
- [x] Trang `/leave/balances` — quỹ phép theo năm, nút cấp quỹ đầu năm (có bước chạy thử)
- [x] Trang `/leave/calendar` — ai đang nghỉ trong tháng
- [x] Sửa / xoá đơn ngay trên bảng; xoá quỹ cấp nhầm trên bảng quỹ
- [x] Sửa đơn đã duyệt: form cảnh báo trước, báo lại ngày công không ghi được sau khi lưu

**Tests (5.2):**
- [x] Ghi nhận đơn 2 ngày → `pendingDays` 0→2, `remainingDays` 7→5
- [x] Nhân sự duyệt → `approved`, `usedDays` +2, ghi 2 dòng `leave`; `manager` bị chặn 403
- [x] Cấp quỹ đầu năm: chạy thử báo số tạo/bỏ qua, chạy lại không ghi đè
- [x] Sửa đơn 2 → 5 ngày: số ngày và quỹ đổi theo ngay trên bảng
- [x] Xoá đơn đã duyệt: quỹ trở lại như trước, ngày `leave` biến khỏi bảng chấm công

---

## Giai đoạn 6 — Lương

### 6.1 Backend Payroll
- [x] `payroll_settings`: cấu hình lương cấp công ty (vùng lương tối thiểu, phụ cấp chung)
- [x] `PayrollService`: tính lương hàng loạt cho một kỳ, có `dryRun`
- [x] Logic BHXH 8%, BHYT 1.5%, BHTN 1% — hai trần khác nhau
- [x] Logic thuế TNCN lũy tiến 5 bậc + giảm trừ bản thân 15,5tr + phụ thuộc 6,2tr
- [x] Lương theo ngày công thực tế = (lương tháng ÷ ngày công chuẩn) × ngày được trả
- [x] Tích hợp dữ liệu chấm công (giờ làm thêm) + phép vào bảng lương
- [x] Lock bảng lương: `approved`/`paid` thì không tính lại, không sửa tay
- [x] `SalaryAdvancesService`: tạm ứng lương (ghi nhận → duyệt → trừ vào kỳ lương)
- [x] `contract.seed.ts`: hợp đồng demo

**Tests (6.1 — Bắt buộc kiểm tra từng số):**
- [x] Lương đóng BH 20tr → BHXH = 1.6tr, BHYT = 300k, BHTN = 200k
- [x] Trần BHXH/BHYT: 46,8tr (trước 01/07/2026) → 50,6tr (từ 01/07/2026)
- [x] Trần BHTN tính theo lương tối thiểu vùng, không dùng chung trần BHXH
- [x] Thuế TNCN đủ 5 bậc, liền mạch ở cả 4 mốc 10/30/60/100tr
- [x] Lương Net khớp ví dụ minh hoạ trong business-rules.md §6
- [x] NV có 1 người phụ thuộc → giảm trừ thêm 6,2tr
- [x] Phụ cấp bữa ăn chỉ miễn thuế tới 730k; phần vượt vẫn chịu thuế
- [x] Nghỉ 2 ngày không phép → lương bị trừ đúng 2 ngày công
- [x] Nghỉ không lương ≥ 14 ngày → không đóng bảo hiểm tháng đó, net không âm
- [x] Tạm ứng 5tr → trừ SAU thuế, không đổi thu nhập tính thuế
- [x] Tạm ứng lớn hơn lương còn lại → chỉ thu phần chịu được, net không âm
- [x] Tính lại cùng một kỳ nhiều lần → phần thu hồi tạm ứng không cộng dồn
- [x] Khoản chỉnh tay (thưởng / thu nhập khác / khấu trừ khác) đi vào gross và thuế
- [x] Chỉnh tay không tính lại bảo hiểm
- [x] Bảng lương `approved`/`paid` → không cho tính lại; khoản chỉnh tay được giữ
- [x] Kỳ lương trước 2026 → ném lỗi

### 6.2 Frontend Payroll
- [x] Trang `/payroll`: bảng lương theo kỳ, có thẻ tổng của cả kỳ
- [x] Nút "Tính lương" hai bước: tính thử rồi mới tính thật
- [x] Từng dòng: ngày công, giờ làm thêm, tổng thu nhập, khấu trừ, thực nhận
- [x] Phiếu lương in được ngay từ danh sách, đủ thông tin theo Điều 95 BLLĐ
- [x] Trang `/payroll/advances` — tạm ứng lương
- [x] Trang `/payroll/settings` — cấu hình lương cấp công ty

**Tests (6.2):**
- [x] Tính lương: bước tính thử báo đúng số sẽ tạo / ghi đè / bỏ qua, và không ghi gì
- [ ] Số tiền hiển thị đúng định dạng `1.000.000 ₫` — cần mở trình duyệt
- [ ] In phiếu lương: layout không bị vỡ, đủ thông tin pháp lý — cần mở trình duyệt
- [x] Phiếu đã duyệt / đã trả → backend trả 409 `SALARY_LOCKED`, giao diện ẩn nút

---

## Giai đoạn 7 — Thông báo & Hoàn thiện

### 7.1 Backend Announcements & Email
- [ ] `AnnouncementsModule`: CRUD, gắn file, gửi đến phòng ban/toàn công ty
- [ ] Email service (SES): duyệt phép, thông báo lương, reset mật khẩu
- [ ] Rate limiting per endpoint (Throttler)
- [ ] Security: Helmet headers, CORS whitelist
- [ ] Logging: Winston → file + CloudWatch
- [ ] **[Security]** Request size limit: `json({ limit: '1mb' })` + timeout cho long-running jobs
- [ ] **[Security]** Pagination hard cap: server luôn cap `pageSize` tối đa 100
- [ ] **[Security]** `X-Request-ID` header cho mọi request
- [ ] **[Security]** `npm audit` trong CI — block deploy nếu có `critical` vulnerability
- [ ] **[Security]** File upload: validate magic bytes server-side, giới hạn 2MB
- [ ] **[Security]** S3 files: bucket private, truy cập qua presigned URL TTL 15 phút
- [ ] **[Security]** Mã hóa CCCD và số tài khoản ngân hàng at-rest (AES-256)
- [ ] **[Security]** Input sanitization: strip HTML tags khỏi text fields trước khi lưu

**Tests (7.1):**
- [ ] Tạo thông báo gửi toàn công ty → tất cả NV nhận được
- [ ] Email duyệt phép được gửi đúng địa chỉ, nội dung đúng
- [ ] Rate limit: gọi quá 10 lần/phút → 429
- [ ] Upload file > 2MB → 413 từ server
- [ ] Upload file .php đổi tên thành .jpg → bị chặn (magic bytes check)
- [ ] Presigned URL hết hạn sau 15 phút → 403
- [ ] Payload JSON > 1MB → 413
- [ ] `pageSize=99999` → server trả tối đa 100 records
- [ ] Lưu tên NV có `<script>alert(1)</script>` → lấy ra không có thẻ script

### 7.2 Frontend Dashboard & Polish
- [ ] Dashboard: tổng NV đang làm, đơn phép chờ duyệt, lương tháng gần nhất
- [ ] Trang `/announcements`: danh sách thông báo, đọc chi tiết
- [ ] Empty states đầy đủ: bảng rỗng, lỗi tải
- [ ] Responsive: kiểm tra trên tablet (768px)
- [ ] Loading skeleton cho mọi trang
- [ ] Tất cả text qua `t('key')` — không còn hardcode tiếng Việt

**Tests (7.2):**
- [ ] Dashboard load < 2 giây
- [ ] Thông báo chưa đọc → badge số trên header
- [ ] Kiểm tra toàn bộ trang trên màn hình 1280px và 768px
- [ ] `npm run build` không lỗi TypeScript, không warning
- [ ] Lighthouse Performance score ≥ 80

---

## Giai đoạn 8 — PDF Phiếu lương, Excel & Email thật

### 8.1 Backend — PDF Phiếu lương
- [ ] Cài `pdfmake` (server-side); tạo `PdfModule` tái dùng được
- [ ] `GET /payroll/:periodId/payslip/:employeeId/pdf` — xuất 1 phiếu lương PDF
- [ ] `GET /payroll/:periodId/payslips/zip` — zip toàn bộ phiếu của 1 kỳ (stream)
- [ ] Template phiếu lương đủ thông tin theo Điều 95 BLLĐ: tên, mã NV, kỳ lương, gross, từng khoản bảo hiểm, thuế TNCN, tạm ứng, thực nhận
- [ ] Phiếu lương lưu lên S3 sau khi tạo; URL presigned TTL 15 phút
- [ ] Chỉ tạo được PDF khi bảng lương ở trạng thái `approved` hoặc `paid`

**Tests (8.1):**
- [ ] PDF tạo ra là file hợp lệ (magic bytes `%PDF`)
- [ ] PDF có đủ 6 dòng số: gross, BHXH, BHYT, BHTN, thuế TNCN, net — số khớp DB
- [ ] Gọi endpoint khi bảng lương còn `draft` → 409 `SALARY_NOT_APPROVED`
- [ ] Gọi endpoint với `employeeId` không thuộc kỳ đó → 404
- [ ] Tải 2 lần cùng phiếu → trả file S3 đã lưu sẵn, không tạo lại
- [ ] ZIP 50 phiếu → không OOM, stream trả đúng 50 file bên trong

### 8.2 Backend — Excel Export chuẩn kế toán
- [ ] `GET /payroll/:periodId/export/excel` — Excel bảng lương kỳ
  - Sheet 1: tóm tắt (mã NV, tên, phòng ban, gross, tổng BH, thuế, net)
  - Sheet 2: chi tiết từng khoản (lương CB, phụ cấp, làm thêm, tạm ứng, khấu trừ khác)
- [ ] `GET /payroll/:periodId/export/bank-transfer` — file lệnh chuyển tiền (chuẩn Vietcombank)
- [ ] Header Excel: format tiền tệ VN (`#,##0`), cột ngày `DD/MM/YYYY`, freeze row đầu

**Tests (8.2):**
- [ ] Excel tạo ra là file hợp lệ (magic bytes `PK`)
- [ ] Sheet tóm tắt: tổng cột Net = tổng `net` trong DB của kỳ đó
- [ ] Sheet bank transfer: số tài khoản đã giải mã, không lộ dữ liệu mã hóa
- [ ] NV nghỉ không lương cả tháng (net = 0) → không có dòng trong file bank transfer

### 8.3 Backend — Email thật qua AWS SES
- [ ] Cấu hình SES transport trong `MailModule` đọc từ env (`MAIL_TRANSPORT=ses|file`)
- [ ] Template email HTML responsive (Handlebars): layout header/footer công ty
- [ ] **Email duyệt phép:** gửi cho NV khi đơn được duyệt/từ chối
- [ ] **Email phiếu lương:** gửi cho từng NV cuối tháng — PDF đính kèm
- [ ] **Email reset mật khẩu:** template đẹp + có thời hạn rõ
- [ ] Queue email bằng Bull (Redis): retry 3 lần, delay 5 giây
- [ ] `POST /payroll/:periodId/send-payslips` — trigger gửi email phiếu lương (admin only)
- [ ] Dead-letter: email thất bại sau 3 retry → ghi log + cảnh báo

**Tests (8.3):**
- [ ] Duyệt phép → `MailService.send()` được gọi đúng địa chỉ NV, đúng subject
- [ ] Gửi phiếu lương: mỗi NV nhận đúng 1 email, PDF đính kèm đúng kỳ
- [ ] Email reset password chứa link có `token` hợp lệ
- [ ] Gửi 100 email → queue xử lý tuần tự, không bị SES rate-limit
- [ ] SES lỗi 3 lần → vào dead-letter, không exception ra controller

### 8.4 Frontend — UI cho PDF, Excel, Email
- [ ] Nút **"Tải PDF"** trên từng hàng bảng lương → mở tab mới
- [ ] Nút **"Tải tất cả (ZIP)"** — progress indicator khi đang zip
- [ ] Nút **"Xuất Excel"** — tải `bang-luong-YYYY-MM.xlsx`
- [ ] Nút **"Xuất file chuyển khoản"** — tải `chuyen-khoan-YYYY-MM.xlsx`
- [ ] Nút **"Gửi phiếu lương qua email"** (admin only) — confirm dialog, chỉ hiện khi `approved`/`paid`

**Tests (8.4 — mở Chrome):**
- [ ] Tải PDF: file tải về, mở được, hiển thị đúng tên NV và số tiền net
- [ ] Xuất Excel: file mở được, cột số định dạng đúng
- [ ] Nút "Gửi email" không xuất hiện khi bảng lương còn `draft`
- [ ] Nút "Gửi email" → confirm dialog → confirm → toast "Đã gửi thành công"

---

## Checklist Go-live

**Chức năng:**
- [ ] Tất cả tasks trên đã tick `[x]`
- [ ] Test smoke: đăng nhập → tạo NV → chấm công → xin phép → tính lương → in phiếu lương

**Bảo mật:**
- [ ] Không có `console.log` trong production code
- [ ] Không có credentials nào hardcode trong source code
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

*Cập nhật mỗi khi hoàn thành task. Tham khảo `backend/docs/` cho chi tiết nghiệp vụ.*
