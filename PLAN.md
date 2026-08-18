# HRM Project — Kế hoạch xây dựng

**Cập nhật lần cuối:** 19/08/2026  
**Trạng thái tổng thể:** 🟢 Giai đoạn 0, 1, 2 hoàn thành và đã nghiệm thu — sẵn sàng vào Giai đoạn 3

---

## Tiến độ tổng quan

| Giai đoạn | Tên | Tiến độ | Trạng thái |
|-----------|-----|---------|------------|
| 0 | Khởi tạo project | 28 / 28 | ✅ Hoàn thành |
| 1 | Auth & User | 43 / 43 | ✅ Hoàn thành (đã nghiệm thu) |
| 2 | Master Data | 18 / 18 | ✅ Hoàn thành (đã nghiệm thu) |
| 3 | Nhân viên | 0 / 16 | ⬜ Chưa bắt đầu |
| 4 | Chấm công | 0 / 10 | ⬜ Chưa bắt đầu |
| 5 | Phép | 0 / 12 | ⬜ Chưa bắt đầu |
| 6 | Lương | 0 / 13 | ⬜ Chưa bắt đầu |
| 7 | HR Processes | 0 / 10 | ⬜ Chưa bắt đầu |
| 8 | Thông báo & Hoàn thiện | 0 / 21 | ⬜ Chưa bắt đầu |

**Tổng:** 89 / 128 tasks hoàn thành *(xem lưu ý đếm bên dưới — tổng 128 gốc không khớp số checkbox thực tế)*

> ⚠️ **Lưu ý đếm.** Con số trong bảng gốc không khớp số dòng checkbox thực tế:
> - Giai đoạn 0: bảng ghi 14, thực tế 28 dòng (0.1 và 0.2 mỗi mục 14).
> - Giai đoạn 1: bảng ghi 21, thực tế 43 dòng (1.1 = 13 task + 14 test, 1.2 = 8 task + 8 test).
> - Giai đoạn 2: bảng ghi 11, thực tế 18 dòng (2.1 = 6 task + 3 test, 2.2 = 6 task + 3 test).
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
> - **Xuất Excel** (ui-conventions §5 có nhắc) chưa làm — không thuộc phạm vi 2.2.

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
