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
| 4 | Chấm công | 0 / 10 | ⬜ Chưa bắt đầu |
| 5 | Phép | 0 / 12 | ⬜ Chưa bắt đầu |
| 6 | Lương | 0 / 13 | ⬜ Chưa bắt đầu |
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
> - **Xuất Excel** (ui-conventions §5 có nhắc) chưa làm — không thuộc phạm vi 2.2.

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
> - **3 nút hàng loạt (Gửi email / Xuất Excel / Đổi phòng ban) để `disabled` kèm tooltip "sắp có"** — chưa có endpoint ở bất kỳ giai đoạn nào. Giữ đúng bố cục mẫu nhưng không có nút bấm vào không làm gì.
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
