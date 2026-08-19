# HRM Project — Kế hoạch xây dựng

**Cập nhật lần cuối:** 19/08/2026  
**Trạng thái tổng thể:** 🟢 Giai đoạn 0, 1, 2, 3 hoàn thành — sẵn sàng vào Giai đoạn 4 (Chấm công)

---

## Tiến độ tổng quan

| Giai đoạn | Tên | Tiến độ | Trạng thái |
|-----------|-----|---------|------------|
| 0 | Khởi tạo project | 28 / 28 | ✅ Hoàn thành |
| 1 | Auth & User | 43 / 43 | ✅ Hoàn thành (đã nghiệm thu) |
| 2 | Master Data | 18 / 18 | ✅ Hoàn thành (đã nghiệm thu) |
| 3 | Nhân viên | 29 / 29 | ✅ Hoàn thành |
| 4 | Chấm công | 23 / 23 | ✅ Hoàn thành (đã sửa lại theo phạm vi thực tế) |
| 5 | Phép | 41 / 41 | ✅ Hoàn thành |
| 6 | Lương | 27 / 31 | 🟡 Code xong; 4 mục kiểm chứng UI còn treo |
| 7 | HR Processes | 0 / 10 | ⬜ Chưa bắt đầu |
| 8 | Thông báo & Hoàn thiện | 0 / 21 | ⬜ Chưa bắt đầu |

**Tổng:** 118 / 128 tasks hoàn thành *(xem lưu ý đếm bên dưới — tổng 128 gốc không khớp số checkbox thực tế)*

> ⚠️ **Lưu ý đếm.** Con số trong bảng gốc không khớp số dòng checkbox thực tế:
> - Giai đoạn 0: bảng ghi 14, thực tế 28 dòng (0.1 và 0.2 mỗi mục 14).
> - Giai đoạn 1: bảng ghi 21, thực tế 43 dòng (1.1 = 13 task + 14 test, 1.2 = 8 task + 8 test).
> - Giai đoạn 2: bảng ghi 11, thực tế 18 dòng (2.1 = 6 task + 3 test, 2.2 = 6 task + 3 test).
> - Giai đoạn 3: bảng ghi 16, thực tế 29 dòng (3.1 = 8 task + 9 test, 3.2 = 7 task + 5 test).
>
> Đã sửa 2 dòng trên theo số thực tế. Cột "Tổng: /128" vì thế cũng sai theo — cần rà lại toàn bộ các giai đoạn còn lại rồi chốt lại một cách đếm duy nhất (đếm cả test hay chỉ đếm task).

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
- [x] `nest new` với TypeScript strict, cấu hình `tsconfig.json`
- [x] Cài dependencies: TypeORM, MySQL2, JWT, bcrypt, class-validator, class-transformer, Swagger, Helmet, Winston
- [x] Cấu hình `ConfigModule` (validate env vars)
- [x] Cấu hình `DatabaseModule` (TypeORM + retry on fail)
- [x] Setup `TransformInterceptor` (response format chuẩn)
- [x] Setup `HttpExceptionFilter` (error format chuẩn)
- [x] Setup `ValidationPipe` global
- [x] Chạy migration tạo đủ 26 bảng theo `database-schema.md`
- [x] Seed master data: tỉnh/huyện/xã, ngày lễ, roles — *roles (5) + holidays (2025+2026, 22 bản ghi) seed vào DB; riêng tỉnh/huyện/xã KHÔNG có bảng riêng trong schema 26 bảng (employees chỉ lưu `province_code`/`district_code`/`ward_code` dạng text) nên lưu tạm dưới dạng file tĩnh `src/common/data/vn-provinces.json` (34 tỉnh/thành sau sáp nhập 2025) để dùng cho endpoint `/system/provinces` ở giai đoạn sau.*
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
- [x] Layout hiển thị đúng: sidebar, header, content area — *xác nhận qua code-review `AppLayout.tsx` (Header 64px + Sider 240/80 + Content đúng cấu trúc); không chụp được màn hình live vì trình duyệt thật của máy đang có sẵn app khác (UTPC Admin) chiếm cổng 5173 trên host, còn dev server HRM chạy trong sandbox lệnh — đã verify bằng HTML/JS trả về qua curl thay thế.*
- [x] Proxy API hoạt động (request từ FE đến BE không bị CORS) — *verify end-to-end thật: `curl http://localhost:5173/api/v1/health` (qua Vite proxy) → 200, JSON đúng envelope từ backend thật đang chạy.*

---

## Giai đoạn 1 — Auth & User

### 1.1 Backend Auth
- [x] `AuthModule`: `POST /auth/login` trả JWT + set HttpOnly cookie refresh token — *nhận username HOẶC email (không phân biệt hoa/thường)*
- [x] `POST /auth/refresh` — refresh access token từ cookie *(không nhận body; có rotation)*
- [x] `POST /auth/logout` — xóa refresh token trong DB + clear cookie *(định danh session qua claim `sid` trong access token, không cần cookie — xem ghi chú bảo mật bên dưới)*
- [x] `JwtAuthGuard` — bảo vệ routes cần đăng nhập *(đăng ký global + `@Public()` để bỏ qua)*
- [x] `RolesGuard` + `@Roles()` decorator
- [x] `@CurrentUser()` decorator — lấy user từ JWT payload
- [x] `POST /auth/forgot-password` — gửi email reset link (SES) — *⚠️ chạy qua dev transport ghi file `logs/mail/*.html`, KHÔNG phải SES thật (không có credential AWS). Code SES đã viết nhưng chưa từng chạy, chưa kiểm chứng.*
- [x] `POST /auth/reset-password` — đặt mật khẩu mới từ token *(token dùng 1 lần, TTL 30 phút)*
- [x] **[Security]** Account lockout: ~~Redis~~ đếm failed login, khóa 15 phút sau 5 lần sai liên tiếp — *⚠️ dùng `CacheService` in-memory thay Redis theo quyết định của chủ dự án. Mất trạng thái khi restart và KHÔNG hoạt động qua nhiều worker PM2 cluster → phải thay driver Redis trước khi lên production.*
- [x] **[Security]** Giới hạn tối đa 5 sessions đồng thời/user — login mới kick session cũ nhất
- [x] **[Security]** Cookie refresh token: xác nhận `SameSite=Strict; Secure; HttpOnly` — *`Secure` chỉ bật ở production: `Secure` trên `http://localhost` khiến browser âm thầm bỏ cookie. Thêm `Path=/api/v1/auth/refresh` (xem ghi chú bảo mật).*
- [x] **[Security]** JWT secret tối thiểu 256-bit random (không dùng string dễ đoán) — *Joi validate `min(64)`, fail-fast lúc bootstrap*
- [x] **[Security]** `assertOwnership()` helper — kiểm tra resource thuộc về user hiện tại trước mọi thao tác — *role đặc quyền: admin/hr_manager/hr_staff. `manager` CHƯA đi qua được vì cần phạm vi phòng ban (Giai đoạn 3).*

> **Ghi chú bảo mật — thu hẹp `Path` của cookie refresh token.** Ban đầu cookie set `Path=/`, nên refresh token bị gửi kèm **mọi** request tới origin dù chỉ `/auth/refresh` cần. Đã sửa: `Path` tính từ `API_PREFIX` → `/api/v1/auth/refresh`, và `logout` chuyển sang định danh session bằng claim `sid` trong access token thay vì đọc cookie. Đã kiểm chứng bằng request thật: `GET /auth/me` **không** có header `Cookie`, chỉ `POST /auth/refresh` mới có.
>
> **Hệ quả triển khai:** `SameSite=Strict` buộc frontend và API phải **cùng một origin** ở production (Nginx serve static + proxy `/api`). Nếu tách API sang subdomain riêng thì cookie refresh bị chặn hoàn toàn và phải thiết kế lại luồng auth. Ngoài ra nếu đổi đường dẫn endpoint refresh thì cookie đã phát hành trước đó thành mồ côi — không gửi được mà cũng không xoá được.

**Tests (1.1):** — *đã nghiệm thu: 64 unit + 40 e2e test pass, chạy lại độc lập. Mỗi mục dưới đây có test riêng đánh số `[1]`–`[14]` trong `test/*.e2e-spec.ts`.*
- [x] Login đúng → trả `access_token` + cookie
- [x] Login sai mật khẩu → 401 với `error.message` rõ ràng
- [x] Login sai 5 lần → 429, tài khoản bị khóa 15 phút
- [x] Login sau khi bị khóa → 423 với thời gian còn lại — *⚠️ phát hiện khi nghiệm thu: thời gian còn lại ban đầu CHỈ nằm trong `error.message` tiếng Anh, mà message là text cho developer nên frontend không được hiện cho user → không thể hiển thị "còn 15 phút". Đã sửa: thêm header `Retry-After` (chuẩn RFC 9110), frontend đã dò sẵn header này. Có test hồi quy.*
- [x] Request không có token → 401
- [x] Refresh token hợp lệ → trả token mới, token cũ bị revoke ngay
- [x] Refresh token hết hạn → 401 *(test seed row `expires_at` trong quá khứ — không phải chờ thật)*
- [x] Dùng lại refresh token đã bị revoke → 401 + revoke toàn bộ session user đó
- [x] Logout → cookie bị xóa, refresh token trong DB bị xóa *(revoke bằng `revoked_at`, không xoá vật lý — đúng thiết kế `refresh_tokens` trong database-schema.md §1.5)*
- [x] Login thứ 6 → session cũ nhất tự động bị kick
- [x] Forgot password → email được gửi (kiểm tra ~~SES log~~ file dev transport) — *test assert file HTML sinh ra có chứa link reset. KHÔNG kiểm chứng qua SES thật.*
- [x] Reset password với token hợp lệ → mật khẩu thay đổi được
- [x] Reset password với token hết hạn → 400 *(đẩy `expiresAt` về quá khứ — không chờ 30 phút)*
- [x] `assertOwnership()`: NV A cố truy cập resource của NV B → 403 — *test mount controller thăm dò khai báo bên trong file test, không đưa scaffold vào `src/`, vì Giai đoạn 1 chưa có endpoint nào thuộc sở hữu nhân viên*

### 1.2 Frontend Auth
- [x] Trang `/login`: form email + mật khẩu, validate — *ô nhập nhận email HOẶC username (chỉ validate định dạng email khi giá trị có `@`). Thiết kế 2 cột theo mẫu chủ dự án cung cấp.*
- [x] Xử lý login: lưu token vào `authStore`, redirect `/dashboard` *(tôn trọng `?redirect=` khi bị chặn từ route khác, có chống open-redirect)*
- [x] Axios interceptor: tự động refresh khi nhận 401, queue requests — *đồng thời sửa 2 lỗi có sẵn từ Giai đoạn 0: refresh ghi `user` thành `undefined` (mỗi lần refresh ngầm là đăng xuất), và 401 kèm `WRONG_CURRENT_PASSWORD`/`INVALID_CREDENTIALS` bị đem đi replay (tự gửi lại mật khẩu sai, có thể tự đẩy account vào lockout)*
- [x] `PrivateRoute`: redirect về `/login` nếu chưa đăng nhập
- [x] Trang `/forgot-password` + `/reset-password`
- [x] Trang profile cá nhân: xem thông tin, đổi mật khẩu *(đổi mật khẩu revoke toàn bộ session → thông báo rồi đưa về `/login`)*
- [x] Dropdown user header: tên, xem profile, đăng xuất
- [x] Logout: clear store, redirect `/login` *(dùng `replace` để Back không quay lại được trang đã đăng nhập)*

> **Bổ sung ngoài api-spec:** thêm `GET /auth/me` — access token chỉ nằm trong memory nên sau F5 app phải gọi `/auth/refresh` rồi `/auth/me` để dựng lại session. **Cần cập nhật `api-spec.md`:** tài liệu vẫn ghi `refreshToken` nằm trong body của login và là field request của `/auth/refresh`, trong khi thực tế dùng HttpOnly cookie; đồng thời chưa có `GET /auth/me`, `rememberMe`, `ACCOUNT_INACTIVE`, và header `Retry-After`.
>
> **Quy ước thông báo:** áp dụng quy tắc không double-notify (`ui-conventions.md` §8) — lỗi hiển thị inline trong card/form, toàn bộ `src/` chỉ còn 3 lệnh `message.*` và đều là `success` ngay trước khi redirect (lúc đó không còn surface inline).

**Tests (1.2):** — *nghiệm thu: contract FE↔BE kiểm chứng bằng request thật đi qua Vite proxy; các tương tác thuần UI kiểm tra ở mức code + chủ dự án đã tự xác nhận UI.*
- [x] Login form: validate email, mật khẩu min 8 ký tự *(kiểm ở mức code; regex email được test riêng bằng script)*
- [x] Login thành công → vào dashboard *(API xác nhận: 200 + `accessToken` + `expiresIn` 900 + `user`)*
- [x] Login sai → hiện error message *(API xác nhận 401 `INVALID_CREDENTIALS`; UI hiện `Alert` inline, không toast)*
- [x] F5 sau login → vẫn đăng nhập (token còn trong memory, check /auth/me) *(xác nhận thật: `/auth/refresh` bằng cookie → token mới, rồi `/auth/me` trả đúng user)*
- [x] Token hết hạn → tự refresh, user không bị kick ra
- [x] Refresh fail → redirect login
- [x] Truy cập `/dashboard` khi chưa login → redirect `/login`
- [x] Logout → không thể back về trang trước *(API xác nhận: logout chỉ bằng Bearer → 200 và cookie bị xoá đúng `Path`)*

**Contract FE↔BE đã chốt khi nghiệm thu** (tài liệu không ghi rõ, xác nhận bằng response thật):
- `user.id` là **number** (không phải string)
- `GET /auth/me` trả user **phẳng** trong `data`, không bọc `data.user`
- `POST /auth/refresh` **không** trả `user` — chỉ `accessToken`
- Thời gian khoá tài khoản đọc từ header **`Retry-After`** (giây)

---

## Giai đoạn 2 — Master Data

### 2.1 Backend Master Data
- [x] `DepartmentsModule`: CRUD + cây phân cấp (parent_id) — *có `GET /departments/tree`; chống tạo vòng ở cả 2 hướng (tự làm cha mình, và đặt cha là con cháu) → `422 DEPARTMENT_CYCLE`, test assert cây không bị hỏng*
- [x] `PositionsModule`: CRUD + liên kết department — *thêm validate `level` 1..5 và `minSalary > maxSalary` → `422 INVALID_SALARY_RANGE`*
- [x] ~~`ContractTypesModule`: CRUD loại hợp đồng~~ → **`GET /contract-types` CHỈ ĐỌC** — *⚠️ quyết định: KHÔNG thêm bảng `contract_types`. Trong 26 bảng không có bảng này; loại hợp đồng là enum `contracts.contract_type` (`probation`/`fixed_term`/`indefinite`/`seasonal`) do BLLĐ 2019 quy định. Mỗi loại kéo theo hệ quả pháp lý khác nhau về BHXH, giới hạn thử việc, thời hạn báo trước — cho HR tự tạo loại mới sẽ sinh ra hợp đồng mà logic lương/bảo hiểm không xử lý được. Test khẳng định `POST /contract-types` → 404.*
- [x] `LeaveTypesModule`: CRUD loại phép + số ngày được hưởng mặc định — *kèm **seed 9 loại theo BLLĐ 2019 & Luật BHXH** (bảng này trước đó trống, Giai đoạn 5 phụ thuộc). PATERNITY lấy 5 ngày = mức tối thiểu luật định (doc ghi "5–14" nhưng cột chỉ chứa 1 số).*
- [x] `HolidaysModule`: CRUD ngày lễ theo năm — *`year` do server tự suy ra từ `holidayDate`, client không gửi. **Không có field "lặp lại hàng năm"** — xem ghi chú bên dưới.*
- [x] Phân quyền: chỉ Admin/HR mới CRUD, các role khác chỉ GET — *`MASTER_DATA_WRITE_ROLES` = admin, hr_manager, hr_staff*

> **Ngày lễ không thể "lặp lại hàng năm".** PLAN 2.2 mô tả tính năng này nhưng schema không có field đó, và về bản chất cũng không dùng được: Tết và Giỗ Tổ Hùng Vương tính theo âm lịch nên ngày dương thay đổi mỗi năm (Tết 2025 là 27/01, Tết 2026 là 16/02). Mỗi năm phải là một tập bản ghi riêng, đọc theo `?year=`. Không dựng UI cho field mà API sẽ từ chối.

**Tests (2.1):** — *đã nghiệm thu độc lập: **131 unit + 91 e2e** pass (từ 64+40 của Giai đoạn 1), build sạch, eslint sạch*
- [x] CRUD đầy đủ 5 module, response đúng format *(vòng đời POST→PATCH→DELETE cho từng module + envelope phân trang chuẩn; chặn `limit > 100`)*
- [x] Xóa department có nhân viên → trả lỗi rõ ràng (không xóa cascade NV) — *`422 DEPARTMENT_HAS_EMPLOYEES`, test assert **nhân viên còn nguyên**. Thêm cả `DEPARTMENT_HAS_CHILDREN`, `DEPARTMENT_HAS_POSITIONS`, `POSITION_HAS_EMPLOYEES`.*
- [x] Phân quyền: nhân viên thường GET được, không POST/PUT/DELETE được — *verify live: `manager` GET 200 / POST `403 FORBIDDEN`; `hr_staff` ghi được*

### 2.2 Frontend Settings
- [x] Trang `/settings/departments`: bảng + modal tạo/sửa + xóa — *2 chế độ xem: Cây (mặc định) và Danh sách phân trang có search/filter/sort. Ô chọn phòng ban cha là `TreeSelect` **tự ẩn chính nó và toàn bộ nhánh con** vì API sẽ trả `DEPARTMENT_CYCLE`.*
- [x] Trang `/settings/positions`: bảng + modal — *dropdown phòng ban lấy từ endpoint **tree**, không lấy từ danh sách phẳng vì danh sách phẳng bị cap `limit` 100 sẽ âm thầm thiếu phòng ban*
- [x] ~~Trang `/settings/contract-types`: bảng + modal~~ → **bảng CHỈ ĐỌC, không modal** — *không có endpoint ghi (xem quyết định ở 2.1). Trang có `Alert` giải thích danh sách do BLLĐ 2019 cố định, thay vì nút bấm vào không làm gì.*
- [x] Trang `/settings/leave-types`: bảng + số ngày mặc định — *không phân trang vì API trả mảng thuần (PK là TINYINT nên tối đa 255 dòng)*
- [x] Trang `/settings/holidays`: bảng + ~~chọn ngày lặp lại hàng năm~~ **filter theo năm** — *field "lặp lại hàng năm" không tồn tại và không khả thi, xem ghi chú ở 2.1*
- [x] Sidebar Settings menu ~~chỉ hiện với Admin~~ **hiện với admin + hr_manager + hr_staff** — *⚠️ lệch có chủ ý: 2.1 cho cả HR quyền CRUD, ẩn menu khỏi người có quyền sửa là vô lý. Dùng hook `useCanWriteMasterData()` đọc `MASTER_DATA_WRITE_ROLES`, không so sánh role rải rác trong component. Nếu muốn đúng nghĩa "chỉ admin" thì phải siết quyền ghi ở backend cho khớp.*

**Tests (2.2):**
- [x] CRUD trên UI hoạt động, refresh trang không mất data — *mọi mutation `invalidateQueries`; toàn bộ page/pageSize/search/sort nằm trong URL query string nên F5 fetch lại đúng dữ liệu. Verify live qua proxy: tạo/sửa/xoá thật trên cả 4 entity ghi được.*
- [x] Validation: tên trùng → hiện lỗi — *⚠️ chính xác hơn: backend ràng buộc duy nhất trên **`code`** (và `holidayDate`), **không phải `name`** — tên trùng vẫn được chấp nhận. Verify live 409 `DUPLICATE_DEPARTMENT_CODE`, hiện `Alert` inline trong modal đang mở.*
- [x] Không có permission → redirect hoặc ẩn menu — *chọn **ẩn control** thay vì redirect: `manager`/`employee` vẫn xem được bảng nhưng không có nút Thêm/Sửa/Xoá và cột "Thao tác" bị ẩn hoàn toàn. Verify live: `manager` GET 200, POST 403.*

> **Kiến trúc:** 5 trang settings không copy-paste. Phần chung tách thành `DataTableCard` (khung bảng + filter/action bar + empty/error state), `CrudFormModal`, `useCrudResource` (query + mutation + invalidate), `useCrudScreen` (modal/submit/xoá) và `useTableQuery` (đồng bộ URL). Mỗi trang chỉ khai báo cột, field form và filter.
>
> **Quy ước thông báo:** toàn bộ `src/` **không còn một toast lỗi nào** — lỗi submit hiện `Alert` inline trong modal, lỗi tải bảng hiện inline kèm "Thử lại", từ chối xoá do đang được dùng hiện `Modal.error` kèm hướng xử lý. `message.success` chỉ dùng 4 chỗ, đều sau khi modal đã đóng hoặc đã điều hướng.
>
> **Còn thiếu / phát hiện cho giai đoạn sau:**
> - **Chọn trưởng phòng đang là ô nhập ID**, không phải dropdown — vì **chưa có endpoint `/employees`** (Giai đoạn 3). Sẽ thay bằng picker khi có.
> - **Mã của bản ghi đã xoá mềm vẫn giữ unique index**: tạo lại phòng ban với mã cũ trả `DUPLICATE_DEPARTMENT_CODE` nhưng thông báo không nói rõ mã đang bị bản ghi đã xoá chiếm. Cần xử lý (cho phép tái dùng mã, hoặc nói rõ lý do).
> - **Xuất Excel** (ui-conventions §5 có nhắc) chưa làm — không thuộc phạm vi 2.2. *(Đã làm ở Giai đoạn 3 cho riêng danh sách nhân viên: `GET /reports/employees/export`. Các màn danh mục khác vẫn chưa có.)*

---

## Giai đoạn 3 — Nhân viên

### 3.1 Backend Employees
- [x] `EmployeesModule`: tạo, đọc, cập nhật, soft delete — *`employee_code` (`NV0001`…) do SERVER sinh, có retry khi 2 request giành cùng một mã; `full_name` luôn ghép từ `last_name` + `first_name` nên hai cột không bao giờ lệch.*
- [x] Filter: phòng ban, chức vụ, trạng thái, tìm kiếm tên/mã NV — *thêm `gender`, `hireFrom`/`hireTo`, `onlyDeleted`; cột `sort` whitelist bằng `@IsIn` nên không nội suy tự do vào SQL.*
- [x] Phân trang chuẩn (page, pageSize, total) — *dùng `PaginatedResponseDto` chung; trần `limit` = 100 chặn ở CẢ DTO (`@Max`) lẫn `resolvePagination()`.*
- [x] Upload avatar lên S3, lưu URL vào `employees.avatar_url` — *⚠️ mặc định chạy driver `local` (ghi ra `uploads/`, phục vụ tại `/api/v1/uploads/...`), KHÔNG phải S3 thật: dự án chưa có AWS credentials. `S3StorageDriver` đã viết đủ nhưng CHƯA TỪNG CHẠY — cùng tình trạng với `SesMailTransport` ở Giai đoạn 1. Bật production: `npm i @aws-sdk/client-s3` + `STORAGE_DRIVER=s3` + `S3_BUCKET`. Kiểu file xác định bằng **magic bytes**, không tin phần mở rộng.*
- [x] `ContractsModule`: CRUD hợp đồng cho từng NV — *kèm quy tắc BLLĐ 2019: HĐ không xác định thời hạn không có `end_date`, HĐ xác định thời hạn ≤ 36 tháng và tối đa 2 lần (lần 3 → `CONTRACT_TYPE_LIMIT`), mỗi NV chỉ 1 HĐ `active`. `PATCH /contracts/:id/terminate` để chấm dứt; DELETE chỉ áp dụng cho bản `draft` vì bảng `contracts` KHÔNG có `deleted_at`.*
- [x] `FamilyMembersModule`: CRUD thành viên gia đình — *route lồng `/employees/:employeeId/family-members`; bản ghi phải thuộc đúng nhân viên trên URL (chống IDOR).*
- [x] Restore nhân viên đã soft delete — *`POST /employees/:id/restore`; tìm hồ sơ đã xoá qua `GET /employees?onlyDeleted=true`.*
- [x] `GET /employees/:id/summary` — tóm tắt thông tin NV cho phiếu lương — *gồm phòng ban/chức vụ, MST, số BHXH, tài khoản ngân hàng, số người phụ thuộc đang hiệu lực và hợp đồng `active`; tiền trả về dạng `number` (api-spec §1.5).*

> **Ngoài phạm vi PLAN nhưng cần thiết:**
> - **Đóng nợ phân quyền của Giai đoạn 1.** Ghi chú ở mục `assertOwnership()` (§1.1) nói role `manager` chưa đi qua được vì cần phạm vi phòng ban — nay đã làm: `EmployeesService.resolveScope()` cho admin/hr_manager/hr_staff thấy toàn bộ, `manager` thấy nhân viên phòng ban mình + phòng ban mình làm trưởng phòng, role còn lại chỉ thấy hồ sơ của chính mình (đúng ma trận `architecture.md` §7.3). Hợp đồng và thành viên gia đình DÙNG LẠI đúng hàm này, không định nghĩa bộ quy tắc thứ hai.
> - **Kiểm tra trùng phải tính cả bản ghi đã xoá mềm.** Xoá mềm KHÔNG gỡ ràng buộc UNIQUE của MySQL, nên nếu chỉ dò trong bản ghi "sống" thì INSERT sẽ nổ `ER_DUP_ENTRY` → 500. Đã dò kèm `withDeleted()` và trả 409 với message chỉ rõ "restore hồ sơ cũ thay vì tạo mới".
> - **`GET /employees/me`** (api-spec §3) + **`POST /employees/:id/restore`** + **`?onlyDeleted=true`** — không có trong PLAN nhưng thiếu thì tính năng restore không dùng được từ UI.
> - **`DependentsModule`** (api-spec §11, `/employees/:id/dependents`) — PLAN không liệt kê ở giai đoạn nào, nhưng `GET /employees/:id/summary` đã trả `activeDependents` mà **không có đường nào tạo dependent**, nên con số đó vĩnh viễn bằng 0. Giai đoạn 6 cần nó để tính giảm trừ gia cảnh 6.2tr/người/tháng. Ràng buộc quan trọng nhất: **một người chỉ được khai cho MỘT người nộp thuế** (Điều 19 Luật Thuế TNCN) — trùng CCCD/MST với người phụ thuộc đang hiệu lực của bất kỳ nhân viên nào đều bị chặn, kể cả khi hai vợ chồng cùng làm ở công ty. Ngừng giảm trừ bắt buộc kèm lý do (`DEPENDENT_REASON_REQUIRED`) vì đó là thứ cơ quan thuế sẽ hỏi. Bản ghi `inactive` nhả lại suất cho người khác khai.
> - **Validator định danh VN dùng chung** (`common/validators/vn-identity.validator.ts`): CCCD, MST, số BHXH/BHYT, SĐT, họ tên có dấu — map sang đúng `error.details[].code` của api-spec §21 (`INVALID_CCCD`, `INVALID_PHONE`…) để frontend lookup i18n bằng code.
> - **Chức vụ phải thuộc đúng phòng ban được gán** → 422 `POSITION_DEPARTMENT_MISMATCH`. Không chặn thì sơ đồ tổ chức và bảng lương lệch nhau.
>
> **Lệch với tài liệu (cố ý, đã cân nhắc):**
> - `database-schema.md` §4.1 ghi thử việc "tối đa 60 ngày". Điều 25 BLLĐ 2019 thực tế có **4 mức** (180 / 60 / 30 / 6 ngày) tuỳ vị trí, mà bảng `contracts` không lưu vị trí đó — chặn cứng ở 60 sẽ từ chối hợp đồng HỢP PHÁP của cấp quản lý. Đang chặn ở trần tuyệt đối **180 ngày**; ràng buộc theo từng vị trí thuộc quy trình duyệt của HR.
> - api-spec §3 ghi DELETE `/employees/:id` cho `admin`, `hr_manager` → làm đúng vậy (`hr_staff` nhập liệu được nhưng KHÔNG xoá được).

**Tests (3.1):** — *52 e2e (`test/employees.e2e-spec.ts`, đánh số `[1]`–`[52]`) + 71 unit mới (employees 35, contracts 27, avatar magic-bytes 9). Toàn repo: **245 unit + 117 e2e pass**. Bộ e2e chạy lại được nhiều lần: fixture dùng tiền tố `E3E` / email `@e3e.local`, dọn sạch cả DB lẫn file avatar trên đĩa ở `beforeAll` + `afterAll`, KHÔNG đụng dữ liệu seed.*
- [x] Tạo NV với đầy đủ field bắt buộc → thành công *(e2e [1] — mã `NV####` do server sinh)*
- [x] CCCD không đúng 12 số → 400 *(e2e [2] — `details[].code = INVALID_CCCD`)*
- [x] SĐT sai định dạng → 400 *(e2e [3] — `details[].code = INVALID_PHONE`)*
- [x] Tạo NV thiếu email → 400 *(e2e [4])*
- [x] Tìm kiếm theo tên → kết quả đúng *(e2e [12], [13] — tìm cả theo mã NV)*
- [x] Filter kết hợp phòng ban + trạng thái → đúng *(e2e [14])*
- [x] Soft delete → không xuất hiện trong danh sách thường *(e2e [27] — kiểm chứng `deleted_at` trong DB, list rỗng, GET chi tiết 404)*
- [x] Restore → xuất hiện lại *(e2e [29]; [28] danh sách thùng rác, [30] restore hồ sơ chưa xoá → 422)*
- [x] Upload avatar > 2MB → 400 *(e2e [34] `AVATAR_TOO_LARGE`; [35] file không phải ảnh đổi tên `.jpg` → `AVATAR_INVALID_TYPE`)*

### 3.2 Frontend Employees
- [x] Trang `/employees`: DataTable + filter bar (phòng ban, trạng thái, search) — *làm theo mẫu thiết kế chủ dự án gửi: header + nút chính, thanh lọc, 4 thẻ tổng quan, bảng có chọn dòng, panel phải (biểu đồ tròn nhân sự theo phòng ban + thống kê nhanh + sinh nhật sắp tới). Lọc thêm: chức vụ, giới tính, khoảng ngày vào làm, thùng rác.*
- [x] Wizard tạo NV 4 bước: cơ bản → công việc → lương → tài khoản — *một `Form` duy nhất, các bước ẩn bằng CSS chứ KHÔNG unmount, nên quay lại bước trước không mất dữ liệu đã gõ.*
- [x] Trang chi tiết NV: 8 tabs (cá nhân, hợp đồng, lương, phép, chấm công, khen thưởng, đánh giá, gia đình) — *3 tab có backend thật (cá nhân/hợp đồng/gia đình); 5 tab còn lại hiện `ComingSoonTab` ghi rõ thuộc Giai đoạn nào (4–7) thay vì ẩn đi. Tab "Gia đình" chứa **2 bảng tách bạch**: `family_members` (thông tin nhân sự, không ảnh hưởng thuế) và `dependents` (đăng ký giảm trừ gia cảnh, có hệ quả tiền bạc) — gộp làm một sẽ xoá mất đúng cái khác biệt mà Giai đoạn 6 cần.*
- [x] Upload avatar với preview — *`beforeUpload` trả `false` nên AntD không tự gửi: ảnh được xem trước bằng object URL, chỉ upload khi bấm "Lưu ảnh"; object URL được revoke để không rò bộ nhớ.*
- [x] CCCD hiển thị che giữa — *⚠️ LỆCH PLAN: che ở trang CHI TIẾT (kèm nút hiện/ẩn) chứ không phải ở danh sách, vì `GET /employees` CỐ Ý không trả `cccdNumber` — không gửi số CCCD ra màn hình duyệt còn an toàn hơn là gửi rồi che bằng JS. Có e2e [17] chốt việc list không chứa CCCD.*
- [x] SĐT hiển thị đúng định dạng `0901 234 567` — *dùng `formatPhone()` có sẵn ở `utils/format.ts`.*
- [x] Confirm xóa NV + lý do — *lý do được GHI THẬT: PATCH `terminationReason`/`terminationType`/`terminationDate` trước, xoá mềm sau. PATCH lỗi thì KHÔNG xoá, nên không bao giờ có hồ sơ bị xoá mà mất lý do.*

> **Bổ sung backend cho 3.2** (không có trong PLAN nhưng màn hình không chạy được nếu thiếu):
> - `GET /employees/stats` — gộp toàn bộ số liệu của 4 thẻ + panel phải vào MỘT request. Đếm ở client là sai (mỗi số là `COUNT` toàn bảng, list chỉ trả 1 trang ≤ 100 dòng) và tốn 6-7 request mỗi lần mở trang. Tính đúng trong phạm vi role gọi nó — manager chỉ thấy phòng ban mình, không rò tổng công ty qua đường khác.
> - `baseSalary` thêm vào mỗi dòng `GET /employees` cho cột "Mức lương cơ bản" (lấy từ hợp đồng `active`, một truy vấn cho cả trang chứ không phải mỗi dòng một truy vấn).
> - `POST /users` + `GET /roles` — bước 4 "tài khoản" của wizard trước đó KHÔNG có API nào để gọi (`UsersModule` chỉ có service/repository). Chỉ `admin` được gọi, đúng ma trận `architecture.md` §7.3.
> - `GET /system/provinces` — 34 tỉnh/thành từ file tĩnh, cho ô địa chỉ.
>
> **Cố ý KHÔNG làm giống mẫu thiết kế (và lý do):**
> - **Không có dòng "+12 so với tháng trước"** trên các thẻ. Bảng `employees` chỉ lưu TRẠNG THÁI HIỆN TẠI, không có bảng lịch sử, nên không thể tính trung thực số "đang thử việc"/"đang nghỉ phép" của tháng trước. Mỗi thẻ ghi ý nghĩa con số của chính nó ("Hết hạn trong 30 ngày tới"); riêng "12 tuyển mới 30 ngày qua" là suy ra thật được từ `hire_date`. Muốn có delta đầy đủ phải đọc `work_history` (Giai đoạn 7+).
> - **Badge "Sắp hết hợp đồng" không phải một trạng thái nhân viên.** `employees.status` chỉ có 6 giá trị; hợp đồng sắp hết hạn là chuyện của HỢP ĐỒNG và dòng bảng không mang ngày hết hạn. Con số đó nằm ở thẻ tổng quan riêng.
> - **3 nút hàng loạt (Gửi email / Xuất mục đã chọn / Đổi phòng ban) để `disabled` kèm tooltip "sắp có"** — chưa có endpoint ở bất kỳ giai đoạn nào. Giữ đúng bố cục mẫu nhưng không có nút bấm vào không làm gì. *(Xuất Excel THEO BỘ LỌC thì đã có, nằm ở nút trên đầu trang — `GET /reports/employees/export`. Nút trong thanh hàng loạt là xuất các dòng ĐANG CHỌN, cần filter theo id mà endpoint chưa có, nên vẫn `disabled` và đã đổi nhãn cho khỏi trùng tên.)*
> - **Danh mục hành chính — đã làm xong, và phát hiện schema lỗi thời.** Việt Nam **bỏ hẳn cấp huyện từ 01/07/2025** (Luật 72/2025/QH15), còn **2 cấp**: 34 tỉnh/thành → 3.321 phường/xã/đặc khu. Form đang bắt HR nhập mã cho một cấp không còn tồn tại — tệ hơn thiếu dữ liệu, vì đó là dữ liệu sai. Đã xử lý:
>   - `employees.district_code` → **NULLABLE + deprecated** (migration `MakeDistrictCodeNullable`). KHÔNG xoá cột: hồ sơ tuyển trước 01/07/2025 có mã huyện thật, đó là lịch sử cần giữ.
>   - Danh mục sinh từ **file chính thống của cơ quan thuế** do chủ dự án cung cấp (`Danh-sach-Phuong-xa-moi-2025.xlsx`) qua `scripts/build-vn-admin-data.ts` → `vn-provinces.json` (34) + `vn-wards.json` (3.321 = 687 phường + 2.621 xã + 13 đặc khu). App KHÔNG gọi API ngoài lúc chạy.
>   - **Chọn hệ mã của cơ quan thuế** (tỉnh BNV `01`–`34`, phường/xã TMS `10105001`) thay vì mã GSO: Giai đoạn 6 quyết toán thuế TNCN, dùng đúng mã cơ quan thuế dùng thì số liệu đi nộp không phải map thêm lần nữa. Mỗi phường/xã mang kèm `legacyDistrictCode`/`Name` để tra ngược hồ sơ cũ.
>   - `GET /system/wards?provinceCode=` + form đổi thành Tỉnh → Phường/Xã (bỏ ô mã huyện).
>   - **Đối chiếu chéo** với provinces.open-api.vn v2 (nguồn độc lập): 34/34 tỉnh khớp, 0 tỉnh lệch số lượng, **3.310/3.321 tên khớp tuyệt đối**; 11 tên còn lại chỉ khác dấu gạch/chính tả (`alba` ↔ `al ba`, `Lục Sỹ` ↔ `Lục Si`), không phải khác đơn vị hành chính.

**Tests (3.2):** — *kiểm chứng bằng 27 assertion contract chạy THẬT qua Vite proxy (`http://localhost:5174/api/v1`, đúng đường trình duyệt đi): shape của `EmployeeListItem`/`EmployeeDetail`/`EmployeeStats`/`Province`/`RoleOption`, list không lộ CCCD, tổng lát biểu đồ khớp tổng nhân viên, sinh nhật sắp xếp đúng, và các `error.code` mà UI có sẵn chuỗi i18n. Cộng thêm 27 unit test backend mới (stats + baseSalary 8, người phụ thuộc 19) và 15 e2e mới (10 người phụ thuộc + 5 danh mục hành chính 2 cấp) — trong đó có test chứng minh `summary.activeDependents` đã được nối thật (trước đây luôn = 0). Frontend: `tsc --noEmit` sạch, `oxlint` sạch, `npm run build` thành công.*
- [x] Wizard: không thể Next nếu form bước hiện tại chưa hợp lệ *(`handleNext` chỉ `validateFields(STEP_FIELDS[step])` — thiếu field bước 1 thì không sang được bước 2, còn field bắt buộc ở bước 3 không chặn bước 1)*
- [x] Avatar upload: preview trước khi lưu *(`beforeUpload` → `false`, preview bằng object URL, chỉ gửi khi bấm "Lưu ảnh"; upload lỗi thì giữ nguyên preview để thử lại)*
- [x] Bảng phân trang: URL cập nhật `?page=2&pageSize=20` *(dùng `useTableQuery` — toàn bộ page/pageSize/sort/filter nằm trên query string, F5 và link chia sẻ ra đúng trang đó)*
- [x] Filter combo hoạt động, không reset page *(quy tắc của `useTableQuery`: chỉ về trang 1 khi GIÁ TRỊ filter thật sự đổi; áp lại cùng filter, sắp xếp hay phân trang không đẩy trang đi)*
- [x] Tab chi tiết: click tab không reload lại tab khác *(AntD giữ pane đã render, và mỗi tab có query key riêng nên quay lại đọc cache; tab đang mở nằm trên URL `?tab=`)*

---

## Giai đoạn 4 — Chấm công

> ⚠️ **Phạm vi giai đoạn này đã được sửa lại sau khi nghiệm thu bản đầu.**
> Bản đầu dựng theo giả định nhân viên tự chấm công trong hệ thống. Thực tế:
> nhân viên **không có tài khoản** ở đây, việc chấm công diễn ra trên **nền tảng
> bên ngoài**, và hệ thống này là công cụ vận hành của **quản lý / nhân sự / kế
> toán / IT**. Toàn bộ phần tự chấm công đã bị gỡ — xem "Đã gỡ" ở cuối mục.

### 4.1 Backend Attendance
- [x] `AttendanceModule`: nhận dữ liệu từ ngoài (Excel + nhập tay), tính giờ công thực tế
- [x] `POST /attendances/bulk-import` — nạp file Excel, kiểu "tất cả hoặc không gì cả", có bước chạy thử
- [x] Giờ làm thêm suy ra từ chính bảng công (vượt 8 giờ/ngày, hoặc toàn bộ nếu là ngày nghỉ tuần/ngày lễ) kèm phân loại hệ số Điều 98 — **không có bảng đơn đăng ký/duyệt**
- [x] API export Excel báo cáo chấm công tháng
- [x] Chặn vai trò `employee` đăng nhập ở tầng auth (`PORTAL_LOGIN_ROLES`)

**Tests (4.1):** *(498 unit test / 27 suite toàn backend)*
- [x] Vào 8h, ra 17h30 → 8.5 giờ công *(`work-hours.util.spec` + `attendances.service.spec`)*
- [x] Nhập trùng ngày → 409, KHÔNG ghi đè *(sửa bằng `PATCH` thay vì tạo mới)*
- [x] Không giờ vào + không trạng thái → 422, không âm thầm ghi thành "đi làm"
- [x] Chưa có giờ ra → `check_out` null, giờ công = null *(không phải 0)*
- [x] Giờ nghỉ thực tế: nghỉ 30 phút → 8.5 giờ; nghỉ 90 phút → 7.5 giờ; không có giờ nghỉ → trừ theo khung chuẩn
- [x] Giờ làm thêm suy từ bảng công: ngày thường lấy phần vượt 8 giờ; ngày nghỉ tuần/ngày lễ lấy toàn bộ *(`overtime.util.spec`, 16 test)*
- [x] Hệ số Điều 98 + ca đêm: làm thêm ban đêm ngày thường = **2,0×** (1,5 + 0,3 + 0,2), ngày lễ ban đêm = 3,5×; ngày lễ thắng ngày nghỉ tuần
- [x] Ngày nghỉ tuần/ngày lễ: ca 4 giờ ngày thường = 0 giờ làm thêm, đúng ca đó Chủ nhật = 4 giờ làm thêm; không cờ đi muộn/về sớm
- [x] **1 phút vượt ngày công vẫn được trả** (17:01 → 0,02 giờ, không phải 0) — test này chặn việc thêm ngưỡng làm tròn về sau
- [x] Vai trò `employee` đăng nhập → 403 `PORTAL_ACCESS_DENIED`, không phát token
- [x] Import: file 3 lỗi → không dòng nào được ghi, trả về đủ 3 lỗi kèm số dòng Excel
- [x] Export Excel có đủ cột, đúng dữ liệu

### 4.2 Frontend Attendance
- [x] Bảng chấm công toàn công ty (màn hình chính): lọc phòng ban + tháng
- [x] Màn hình nạp file Excel: 2 bước (kiểm tra trước → ghi thật), báo rõ số dòng sẽ **ghi đè**
- [x] Form nhập một ngày công (chọn nhân viên, giờ vào/ra, giờ nghỉ, trạng thái)
- [x] Xuất Excel bảng công tháng

**Tests (4.2):**
- [x] Bảng: đổi tháng / phòng ban → cập nhật ngay, trạng thái nằm trên URL
- [x] Nạp file: bước chạy thử báo đúng số tạo mới / ghi đè, file lỗi thì không ghi gì

---

> ### Ai dùng phân hệ này
>
> | Vai trò | Xem bảng công | Nhập / sửa / nạp file |
> |---------|:---:|:---:|
> | `admin`, `hr_manager`, `hr_staff` | Toàn công ty | ✅ |
> | `manager` | Phòng mình quản | ❌ |
> | `employee` | *không đăng nhập được* | — |
>
> Nhân viên sẽ tra cứu thông tin của mình qua một **cổng riêng (MyPage)** xây sau.
> Việc chặn đặt ở **bước đăng nhập**, không phải chỉ ẩn menu: một vai trò không
> được dùng hệ thống thì không nên cầm access token hay có bản ghi
> `refresh_tokens` của hệ thống đó. `POST /auth/refresh` cũng kiểm lại vai trò —
> tài khoản bị hạ quyền sau khi đăng nhập nếu không sẽ giữ phiên tới lúc token
> hết hạn.
>
> Kiểm vai trò đặt **sau** bước so mật khẩu: trả lời "vai trò này không được vào"
> trước khi biết mật khẩu đúng hay sai sẽ biến form đăng nhập thành công cụ dò
> xem một tài khoản mang vai trò gì.

> ### Giờ làm thêm suy ra từ bảng công
>
> Không có đơn đăng ký, không có bước duyệt. `attendances.overtime_hours` tính từ
> chính giờ vào/ra và **LÀ căn cứ trả tiền**:
>
> - ngày thường: phần vượt **8 giờ** làm việc thực (đã trừ giờ nghỉ);
> - ngày nghỉ tuần / ngày lễ: **toàn bộ** thời gian làm.
>
> Hệ số Điều 98 (1,5× ngày thường / 2× ngày nghỉ tuần / 3× ngày lễ) cộng phụ trội
> ca đêm 22h–6h (+0,3×, và **+0,2× nữa** nếu giờ đó vừa là làm thêm vừa là ban
> đêm) do `common/utils/overtime.util.ts` tính — xem business-rules.md §7.1.
>
> **1 phút cũng được trả** — không ngưỡng tối thiểu, không làm tròn xuống (1 phút =
> 0,02 giờ ở `DECIMAL(4,2)`), có test khoá lại. Hệ quả bình thường: 991/2.141 ngày
> công demo mang 0,02–0,49 giờ làm thêm vì lệch vài phút quanh giờ tan ca, chỉ 105
> ngày là ở lại từ 1 giờ trở lên. Đổi quy tắc này là đổi **chính sách trả lương**,
> phải sửa business-rules.md trước.
>
> Quyết định "ngày nào là ngày nghỉ" nằm ở `resolveRateType()` — dùng chung với chỗ
> tính hệ số, nên hai nơi không thể hiểu khác nhau về cùng một ngày. Cả API nhập
> tay lẫn đường nạp Excel đều đi qua quy tắc này. Ngày nghỉ cũng **không xét đi
> muộn/về sớm**: không có giờ bắt đầu theo lịch nào để so.
>
> **Vì sao bỏ bước duyệt.** Bản đầu lập luận rằng Điều 107 đòi làm thêm giờ phải
> được NLĐ đồng ý, nên chỉ giờ *đã duyệt* mới được trả. Đó là đọc sai luật: yêu
> cầu đồng ý giới hạn **quyền huy động** của công ty, nó không phải điều kiện để
> được trả tiền cho công việc đã làm xong. Nhân viên đã làm thêm và công ty biết
> thì công ty phải trả; từ chối vì "thiếu đơn duyệt" là vi phạm chứ không phải
> tuân thủ. Về kỹ thuật thì hai nguồn số cho cùng một đại lượng luôn lệch nhau,
> và không ai biết bảng lương nên tin bên nào.

> ### Giờ nghỉ
>
> Khung nghỉ chuẩn là **khoảng giờ tường minh** (12:00–13:00), không phải chỉ một
> độ dài đặt vào giữa ca — cách cũ khiến giờ nghỉ tự trôi mỗi lần đổi giờ tan ca.
> Bản ghi còn mang được **giờ nghỉ thực tế** (`break_start`/`break_end`) khi nền
> tảng ngoài có ghi; có thì trừ đúng khoảng đó, không có thì trừ theo khung chuẩn.
> Chỉ trừ phần **nằm trong ca**, nên ca sáng 08:00–11:00 vẫn là 3 giờ công.

> ### Những chỗ cố ý làm chặt hơn tài liệu
>
> - **Không có giờ vào thì TRẠNG THÁI là bắt buộc** (`ATTENDANCE_STATUS_REQUIRED`).
>   Thiếu cả hai, bản ghi rơi về mặc định `present` của cột — một dòng nói người
>   đó đi làm mà không có căn cứ nào.
> - **Sửa một ngày công đã có thì BẮT BUỘC ghi lý do** (`note` ở `PATCH`). Sửa
>   một con số đã có khác với nhập một con số chưa có.
> - **Nhập trùng ngày → 409, không ghi đè.** Người nhập cần biết ngày đó ĐÃ CÓ dữ
>   liệu để chuyển sang sửa, thay vì âm thầm thay số cũ.
> - **Import kiểu "tất cả hoặc không gì cả".** Một tháng công nửa vời trông y hệt
>   một tháng đầy đủ. Toàn bộ lỗi trả về một lượt kèm số dòng Excel.
> - **Số dòng bị ghi đè luôn được báo ra**, kể cả ở bước chạy thử.
> - **`manager` đọc được phòng mình nhưng không nhập, không sửa, không nạp file.**
> - **Kiểu file .xlsx xác định bằng magic bytes**, không tin phần mở rộng.

> ### Đã gỡ khỏi bản đầu
>
> - `POST /attendances/check-in`, `POST /attendances/check-out`,
>   `GET /attendances/me` và toàn bộ bảng tổng hợp tháng cá nhân đứng sau chúng.
>   Có unit test khoá lại: thêm lại một endpoint tự chấm công sẽ làm test đỏ.
> - Màn hình lịch chấm công cá nhân ở frontend (`MyAttendancePage`,
>   `AttendanceCalendar`). Còn trong lịch sử git nếu MyPage cần dùng lại.
> - Hàm `vietnamDateTime()` — sinh ra cho đồng hồ chấm công, gỡ cùng nó.
> - **Toàn bộ luồng đơn làm thêm giờ** — `OvertimeModule`, bảng
>   `overtime_requests` (migration `DropOvertimeRequests1787250000000`),
>   `/overtime-requests/*`, trang `OvertimePage` và tab "Làm thêm giờ". Lý do và
>   phần thay thế: xem khối "Giờ làm thêm suy ra từ bảng công" ở trên.

> ### Chưa làm
>
> - Cấu hình khung giờ làm việc nằm ở `attendance.constant.ts` chứ không phải
>   bảng `settings` (schema chưa có bảng đó). Có test khoá
>   `STANDARD_WORK_HOURS_PER_DAY` và `LUNCH_BREAK_MINUTES` với khung giờ để các
>   con số không lệch nhau.
> - **e2e spec của module chưa viết.** Đã kiểm chứng bằng tay qua API đang chạy
>   cho toàn bộ các luồng ở trên.
> - **Ba trần Điều 107 (12h/ngày, 40h/tháng, 200–300h/năm) hiện KHÔNG được kiểm ở
>   đâu cả.** Chúng từng kiểm lúc ghi nhận/duyệt đơn làm thêm; gỡ luồng đơn thì
>   gỡ luôn chỗ kiểm. Bản thân việc suy giờ làm thêm từ bảng công không vi phạm
>   gì — trần là giới hạn huy động của công ty, không phải điều kiện trả tiền —
>   nhưng hệ thống nên **cảnh báo** khi cộng dồn vượt trần. Chưa làm.

> ### Dữ liệu demo để kiểm thử phân hệ
>
> `npm run seed:attendance` sinh **2.141 ngày công** cho 60/68 nhân viên demo
> trong khoảng 01/07/2026–19/08/2026 (36 ngày làm việc): 81,7% đi làm, 7,9% đi
> muộn, 4,2% nghỉ phép, cùng 3 ca thứ Bảy + 4 ca ngày lễ (toàn bộ ca là giờ làm
> thêm, không cờ đi muộn) và 3 ngày quên chấm ra (`work_hours` = `NULL`, không
> phải 0). Chạy lại không nhân đôi dữ liệu; thêm `-- --reset` để xoá và sinh lại
> (PRNG có seed nên kết quả y hệt).
>
> Cả 6 cột dẫn xuất đều sinh từ đúng một hàm `calculateWorkHours()` mà API dùng —
> gồm cả tham số `isRestDay` — nên dữ liệu demo không thể lệch khỏi cách hệ thống
> tính. 12 ngày công cũ của `NV0001`–`NV0006` (fixture kiểm thử giờ nghỉ) không bị
> chạm tới.

---

## Giai đoạn 5 — Phép

> ⚠️ **Phạm vi đã sửa lại theo thực tế vận hành**, giống Giai đoạn 4: nhân viên
> **không có tài khoản** ở hệ thống này, nên không có chuyện "nộp đơn của tôi".
> Đơn nghỉ do **quản lý ghi nhận** cho nhân viên phòng mình (nhân sự ghi cho bất
> kỳ ai), **nhân sự duyệt**.

### 5.1 Backend Leave
- [x] `LeaveBalancesModule`: cấp quỹ phép năm cho toàn bộ NV đang làm việc
- [x] Cột VIRTUAL `remaining_days` = `allocated + carried_over − used − pending` *(đã có sẵn từ InitSchema)*
- [x] `LeaveRequestsModule`: ghi nhận, duyệt, từ chối, rút lại
- [x] Tự cập nhật `pending_days` khi ghi nhận, `used_days` khi duyệt — **trong cùng một transaction** với đơn
- [x] Kiểm tra: không trùng ngày, không quá số ngày còn lại
- [x] API lịch: ai đang nghỉ trong khoảng ngày (`GET /leave-requests/calendar`)
- [x] `GET /leave-balances` + `PATCH /leave-balances/:id` — nhân sự xem và điều chỉnh
- [x] `PATCH /leave-requests/:id` — sửa đơn còn hiệu lực; đơn ĐÃ DUYỆT thì dời cả `used_days`
      lẫn ngày công trong bảng chấm công, và chỉ nhân sự làm được
- [x] `DELETE /leave-requests/:id` — xoá đơn, hoàn quỹ và gỡ ngày `leave` khỏi bảng chấm công
- [x] `DELETE /leave-balances/:id` — xoá dòng quỹ cấp nhầm, chặn khi đã có ngày bị tiêu

**Tests (5.1):** *(90 unit test: 35 `leave.util.spec` + 47 `leave-requests.service.spec` + 8 `leave-balances.service.spec`)*
- [x] Ghi nhận đơn 3 ngày: `pending_days` tăng 3
- [x] Duyệt: `pending_days` giảm 3, `used_days` tăng 3
- [x] Từ chối: `pending_days` giảm 3, số ngày được hoàn lại
- [x] Ghi nhận vượt quá số ngày còn lại → 422 `INSUFFICIENT_LEAVE_BALANCE`
- [x] Trùng ngày với đơn còn hiệu lực → 409 `OVERLAPPING_LEAVE`
- [x] `remaining_days` đúng sau mỗi thao tác
- [x] Nghỉ T6 → T2 = **2 ngày phép, không phải 4** (bỏ cuối tuần)
- [x] Nghỉ nửa ngày ở hai đầu; một ngày mà cả hai đầu nửa ngày vẫn là 0,5
- [x] Người ghi ≠ người duyệt (`CANNOT_APPROVE_OWN_RECORD`); `manager` không duyệt
- [x] Duyệt xong ghi ngày nghỉ vào bảng chấm công với `status = leave`
- [x] Sửa đơn: trả chỗ cũ TRƯỚC khi giữ chỗ mới (3 → 4 ngày trên quỹ còn đúng 3 vẫn phải qua)
- [x] Sửa đơn: chính nó không bị tính là trùng ngày với chính nó
- [x] Sửa đơn ĐÃ DUYỆT: dời `used_days`, gỡ ngày công cũ rồi ghi ngày công mới
- [x] Kéo dài một đơn đã duyệt quá quỹ còn lại → 422 `INSUFFICIENT_LEAVE_BALANCE`
      *(quỹ chặn theo TỔNG `pending + used`, không riêng `pending`)*
- [x] `manager` không sửa được đơn đã duyệt; đơn đã đóng → 409 `LEAVE_NOT_ACTIVE`
- [x] Xoá đơn đã duyệt: hoàn `used_days` và gỡ đúng những dòng chấm công còn `leave`
- [x] Xoá đơn đã duyệt: GIỮ dòng chấm công đã bị sửa sang trạng thái khác
- [x] Xoá đơn `rejected`/`cancelled` không đụng vào quỹ (đã hoàn từ trước)
- [x] `manager` không xoá được đơn đã duyệt; xoá quỹ đã có ngày bị tiêu → 422 `LEAVE_BALANCE_IN_USE`

### 5.2 Frontend Leave
- [x] Trang `/leave` — danh sách đơn, lọc trạng thái / phòng ban / loại phép / khoảng ngày
- [x] Form ghi nhận đơn cho nhân viên (chọn NV, loại phép, khoảng ngày, nửa ngày, lý do)
- [x] Duyệt ngay trên danh sách: lối tắt `?status=pending`, nút Duyệt / Từ chối
- [x] Trang `/leave/balances` — quỹ phép theo năm, nút cấp quỹ đầu năm (có bước chạy thử)
- [x] Trang `/leave/calendar` — ai đang nghỉ trong tháng
- [x] Sửa / xoá đơn ngay trên bảng; xoá quỹ cấp nhầm trên bảng quỹ
- [x] Sửa đơn đã duyệt: form cảnh báo trước, báo lại ngày công không ghi được sau khi lưu

> **Duyệt nằm trong danh sách, không tách thành trang riêng.** Nhân sự vừa ghi
> nhận vừa duyệt; tách hai địa chỉ cho cùng một loại giấy tờ chỉ khiến họ phải
> nhớ thêm một đường dẫn. Nút Duyệt / Từ chối chỉ hiện với người có quyền duyệt.
>
> **Nút hiện đúng bằng ranh giới backend đang chặn.** Sửa mở với đơn còn chờ và
> đơn đã duyệt, không mở với đơn đã đóng; xoá mở với mọi trạng thái. Cả hai việc
> trên đơn đã qua tay người duyệt đều chỉ dành cho nhân sự. Nút xoá quỹ tắt sẵn
> khi dòng quỹ đã có ngày bị tiêu. Bày ra một nút rồi trả về 403/422 là bắt người
> dùng học luật bằng cách vấp phải nó.

**Tests (5.2):** *(kiểm chứng thủ công qua API đang chạy — frontend chưa có test runner)*
- [x] Ghi nhận đơn 2 ngày → `pendingDays` 0 → 2, `remainingDays` 7 → 5 ngay trên bảng quỹ
- [x] Nhân sự duyệt → `approved`, `usedDays` +2, ghi 2 dòng chấm công `leave`;
      `manager` không thấy nút duyệt và tự duyệt bị chặn 403 ở backend
- [x] Cấp quỹ đầu năm: chạy thử 2027 báo `created 66 / skipped 0`, chạy lại 2026
      báo `created 0 / skipped 66` (không ghi đè quỹ đã có)
- [x] Sửa đơn 2 → 5 ngày: số ngày và quỹ đổi theo ngay trên bảng
- [x] Xoá đơn đã duyệt: quỹ trở lại như trước, ngày `leave` biến khỏi bảng chấm công

---

> ### Quỹ phép cấp thế nào
>
> Số ngày theo **Điều 113 BLLĐ 2019**: 12 ngày, cộng 1 ngày cho mỗi 5 năm thâm
> niên **tròn**, đếm theo mốc kỷ niệm ngày vào làm chứ không chia số ngày cho
> 365 — lệch một ngày ở đó là chênh nguyên một ngày phép.
>
> Năm đầu tiên tính theo tỉ lệ tháng đã làm và **làm tròn XUỐNG** 0,5 ngày: hệ
> thống chỉ tiêu được nửa ngày nên 10,83 là con số không dùng được, và cấp dư
> phép rồi đòi lại là việc không ai làm được. Vào làm sau ngày 15 thì tháng đó
> không tính.
>
> **Chỉ `ANNUAL` được cấp tự động.** Ốm đau, thai sản, cưới hỏi, tang chế phát
> sinh theo sự việc với số ngày do luật quy định cho từng lần; cấp sẵn một quỹ
> đầu năm cho chúng là bịa ra một con số không có căn cứ. Loại phép không có quỹ
> thì đơn vẫn ghi được, chỉ là không trừ gì.
>
> **Không ghi đè quỹ đã có.** Chạy lại chỉ tạo cho người còn thiếu — ghi đè sẽ
> xoá phần `carried_over` và làm quỹ lệch khỏi những đơn đã duyệt.
>
> **Điều chỉnh tay chỉ sửa được `allocated` / `carried_over`**, bắt buộc ghi lý
> do, và không hạ được xuống dưới số đã dùng + đang chờ. `used`/`pending` là hệ
> quả của các đơn — sai ở đâu thì sửa đơn ở đó.

> ### Những chỗ cố ý làm chặt hơn tài liệu
>
> - **Số ngày phép do SERVER tính**, client không gửi `totalDays`. Chỉ đếm ngày
>   làm việc: nghỉ thứ Sáu → thứ Hai là 2 ngày, không phải 4. Tính cả cuối tuần
>   là lấy mất của nhân viên những ngày họ vốn được nghỉ.
> - **Quỹ phép đổi trong CÙNG transaction với đơn**, và dòng quỹ khoá
>   `FOR UPDATE`. Ghi một bên mà không ghi bên kia sẽ để lại quỹ nói khác danh
>   sách đơn; hai lần duyệt đồng thời không khoá sẽ mất một lần trừ.
> - **Đơn bắc qua giao thừa bị từ chối** (`LEAVE_SPANS_TWO_YEARS`). Quỹ là con số
>   của một năm; chia ngầm theo một quy tắc người dùng không nhìn thấy thì sai cả
>   hai năm. Tách thành hai đơn.
> - **Kỳ nghỉ rơi trọn vào cuối tuần/ngày lễ bị từ chối** thay vì tạo một đơn trừ
>   0 ngày.
> - **Duyệt xong ghi ngày nghỉ vào bảng chấm công** (`status = leave`) — đây
>   chính là thứ khiến `absentDays` không tính người nghỉ phép là vắng mặt.
>   Ngày **đã có** dữ liệu chấm công thì KHÔNG ghi đè, trả về ở
>   `attendanceConflicts`: vừa có giờ chấm vừa được duyệt nghỉ là mâu thuẫn cần
>   người xem, không phải thứ để phần mềm tự quyết.
> - **Rút lại chỉ được với đơn còn chờ.** Đơn đã duyệt đã ghi vào bảng chấm công;
>   gỡ lặng lẽ thì bảng công còn dòng `leave` mà không còn đơn nào giải thích.

> ### Chưa làm
>
> - `advance_notice_days` của loại phép chưa được kiểm: đơn thường được ghi nhận
>   SAU khi sự việc xảy ra (nhân sự nhập lại), nên bắt buộc báo trước sẽ chặn
>   đúng những trường hợp hợp lệ nhất.
> - Đính kèm file cho đơn (`attachment_url` đã có cột, chưa có endpoint upload).
> - Thanh toán phép chưa dùng khi nghỉ việc (business-rules §8.3) — thuộc Giai
>   đoạn 6 vì cần đơn giá ngày công.
> - e2e spec; đã kiểm chứng bằng tay qua API đang chạy cho toàn bộ luồng.

---

## Giai đoạn 6 — Lương

> Theo đúng `backend/docs/business-rules.md`. Kiểm tra kỹ số liệu trước khi tick.
>
> ### Luật 2026 — bản cũ của mục này ghi sai
>
> Mục này trước đây ghi **7 bậc thuế, giảm trừ 11tr/4,4tr**. Đó là luật CŨ.
> Từ **01/01/2026** biểu thuế rút còn **5 bậc** (Luật 109/2025/QH15) và giảm trừ
> lên **15,5tr / 6,2tr** (NQ 110/2025/UBTVQH15). Dùng bảng cũ sẽ tính THỪA thuế
> cho gần như mọi người — bậc 1 cũ chỉ tới 5tr, bậc 1 mới tới 10tr.
>
> Mức tham chiếu còn đổi **giữa năm**: 2,34tr → 2,53tr từ 01/07/2026, kéo theo
> trần đóng BHXH/BHYT 46,8tr → 50,6tr. Nên hằng số được hỏi theo KỲ LƯƠNG
> (`payrollConstantsFor(year, month)`), không đọc thẳng.

### 6.1 Backend Payroll
- [x] `payroll_settings`: cấu hình lương cấp công ty (vùng lương tối thiểu, phụ cấp chung)
- [x] `PayrollService`: tính lương hàng loạt cho một kỳ, có `dryRun`
- [x] Logic BHXH 8%, BHYT 1.5%, BHTN 1% (tổng 10.5% NLĐ) — **hai trần khác nhau**
- [x] Logic thuế TNCN lũy tiến **5 bậc** + giảm trừ bản thân 15,5tr + phụ thuộc 6,2tr
- [x] Lương theo ngày công thực tế = (lương tháng ÷ ngày công chuẩn) × ngày được trả
- [x] Tích hợp dữ liệu chấm công (gồm giờ làm thêm suy ra từ đó) + phép vào bảng lương
- [x] Lock bảng lương: `approved`/`paid` thì không tính lại, không sửa tay
- [x] `SalaryAdvancesService`: tạm ứng lương (ghi nhận → duyệt → trừ vào kỳ lương)
- [x] `contract.seed.ts`: hợp đồng demo, vì không có hợp đồng thì không có căn cứ trả lương

> **Phụ cấp cơm/xe/điện thoại ở cấp CÔNG TY, không ở hợp đồng.** Hợp đồng đã có
> lương cơ bản, lương đóng bảo hiểm và phụ cấp chức vụ — những khoản thoả thuận
> riêng với từng người. Ba khoản còn lại là chính sách chung ghi trong nội quy;
> ghi lặp vào từng hợp đồng thì đổi mức ăn ca một lần phải sửa cả trăm hợp đồng.
>
> **Quyền đọc lương HẸP HƠN mọi phân hệ khác:** `manager` đọc được hồ sơ và chấm
> công của phòng mình nhưng KHÔNG đọc lương.

**Tests (6.1 — Bắt buộc kiểm tra từng số):** *(55 unit test)*
- [x] Lương đóng BH 20tr → BHXH đúng = 1.6tr, BHYT = 300k, BHTN = 200k
- [x] Trần BHXH/BHYT theo kỳ: 46,8tr (trước 01/07/2026) → 50,6tr (từ 01/07/2026)
- [x] Trần BHTN tính theo **lương tối thiểu vùng**, không dùng chung trần BHXH
- [x] Thuế TNCN đủ 5 bậc, và **liền mạch ở cả 4 mốc** 10/30/60/100tr
- [x] Lương Net khớp từng dòng với ví dụ minh hoạ trong business-rules.md §6
- [x] NV có 1 người phụ thuộc → giảm trừ thêm 6,2tr
- [x] Phụ cấp bữa ăn chỉ miễn thuế tới 730k; phần vượt vẫn chịu thuế
- [x] Nghỉ 2 ngày không phép → lương bị trừ đúng 2 ngày công
- [x] Nghỉ không lương ≥ 14 ngày → **không đóng bảo hiểm** tháng đó, net không âm
- [x] Tạm ứng 5tr → trừ SAU thuế, không đổi thu nhập tính thuế
- [x] Bảng lương `approved`/`paid` → không cho tính lại; khoản chỉnh tay được giữ
- [x] Kỳ lương trước 2026 → ném lỗi thay vì chạy êm với bộ hằng số sai

### 6.2 Frontend Payroll
- [x] Trang `/payroll`: bảng lương theo kỳ, có thẻ tổng của cả kỳ
- [x] Nút "Tính lương" hai bước: tính thử rồi mới tính thật
- [x] Từng dòng: ngày công, giờ làm thêm, tổng thu nhập, khấu trừ, thực nhận
- [x] Phiếu lương in được ngay từ danh sách, đủ thông tin theo Điều 95 BLLĐ
- [x] Trang `/payroll/advances` — tạm ứng lương
- [x] Trang `/payroll/settings` — cấu hình lương cấp công ty

> **Mục Bảng lương ẩn khỏi menu với `manager`.** Backend từ chối mọi endpoint
> của phân hệ này với họ; để mục đó trong menu là bày ra một lối đi chắc chắn
> cụt, bấm vào chỉ nhận một màn hình toàn 403.
>
> **In phiếu ngay từ danh sách, không qua trang chi tiết.** Việc thật của kế
> toán là in lần lượt cả danh sách; bắt mở một trang riêng cho mỗi người chỉ
> thêm một cú bấm cho mỗi tờ giấy.

**Tests (6.2):** *(kiểm chứng thủ công — frontend chưa có test runner)*
- [ ] Tính lương: bước tính thử báo đúng số sẽ tạo / ghi đè / bỏ qua
- [ ] Số tiền hiển thị đúng định dạng `1.000.000 ₫`
- [ ] In phiếu lương: layout không bị vỡ, đủ thông tin pháp lý
- [ ] Phiếu đã duyệt / đã trả → ẩn nút Chỉnh tay và nút Duyệt

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
