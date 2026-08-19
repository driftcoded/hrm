# Frontend Architecture

**Phiên bản:** 1.1  
**Ngày cập nhật:** 19/08/2026  
**Stack:** React 19 · TypeScript 6 · Vite 8 · Ant Design v6

---

## 1. Tổng quan

Frontend HRM là Single Page Application (SPA) phục vụ các nhóm người dùng:

| `roles.name` | Nhóm | Quyền chính |
|--------------|------|-------------|
| `admin` | Quản trị hệ thống | Toàn bộ hệ thống, tạo tài khoản đăng nhập |
| `hr_manager` | Trưởng phòng Nhân sự | Quản lý nhân viên, hợp đồng, chấm công, lương, phép |
| `hr_staff` | Nhân viên Nhân sự | Nhập liệu nhân viên & master data; **không** xoá hồ sơ, **không** ký hợp đồng |
| `manager` | Quản lý phòng ban | Xem nhân viên phòng mình, duyệt phép, đánh giá; **không** xuất file |
| `employee` | Nhân viên | Xem thông tin cá nhân, nộp đơn phép, xem phiếu lương |

Danh sách quyền theo từng thao tác nằm ở `src/constants/roles.ts` — phải khớp với `backend/src/common/constants/roles.constant.ts`.

Giao tiếp với backend qua REST API (JSON). Xác thực bằng JWT access token trong memory + refresh token trong HttpOnly cookie.

---

## 2. Tech Stack

Phiên bản dưới đây lấy từ `frontend/package.json` (semver range `^`, tức là bản minor/patch mới hơn vẫn được cài).

| Thư viện | Phiên bản | Vai trò |
|----------|-----------|---------|
| React · React DOM | **19.2.x** | UI framework |
| TypeScript | **~6.0.2** | Type safety |
| Vite | **8.2.x** | Build tool, dev server |
| `@vitejs/plugin-react` | 6.0.x | React plugin cho Vite |
| Ant Design (`antd`) | **6.6.x** | Component library, Design System |
| `@ant-design/icons` | 6.3.x | Bộ icon của AntD |
| React Router (`react-router`) | **7.18.x** | Client-side routing |
| TanStack Query | 5.101.x | Server state, cache, refetch |
| Zustand | **5.0.x** | Client state (auth, UI prefs) |
| axios | 1.19.x | HTTP client với interceptors |
| dayjs | 1.11.x | Date/time với locale `vi` |
| i18next | **26.3.x** | Đa ngôn ngữ (VI / EN) |
| react-i18next | 17.0.x | Binding i18next cho React |
| `i18next-browser-languagedetector` | 8.2.x | Nhận diện ngôn ngữ trình duyệt |
| oxlint | 1.75.x | Linter (**không** dùng ESLint) |

Vài điểm cần biết vì khác với tài liệu cũ:

- **React Router v7 ở chế độ Data Router** (`createBrowserRouter` + `RouterProvider`), dùng package `react-router` trực tiếp — đây là SPA Vite thuần, **không** dùng framework/SSR mode (`@react-router/dev`). API vẫn cùng hình dạng với v6.4+.
- **Ant Design v6**, không phải v5.
- Lint chạy bằng **oxlint** (`npm run lint`), không phải ESLint + Prettier.

---

## 3. Cấu trúc thư mục

```
src/
├── App.tsx             # Providers (QueryClient, AntD ConfigProvider, i18n)
├── main.tsx            # Entry point
├── i18n.ts             # Khởi tạo i18next
├── index.css
│
├── components/         # Shared components (KHÔNG fetch API)
│   ├── auth/           # AuthShell, BrandPanel, BrandIllustration, SsoButtons
│   ├── charts/         # DonutChart (SVG tự viết, không thư viện chart)
│   ├── common/         # BrandMark, FullPageLoader, StatCard
│   ├── crud/           # Bộ dùng chung cho màn hình master data:
│   │                   #   DataTableCard, CrudFormModal, TableSearch,
│   │                   #   RowActions, BooleanTag, GeneratedCodeField
│   ├── dashboard/      # KpiCard, ActivityCard, ExpiringCard
│   ├── departments/    # DepartmentOrgChart
│   ├── employees/      # EmployeeWizard, AvatarUploader, EmployeeHeroCard, …
│   └── layout/         # AppLayout, Sidebar, Header, PageHeader, NavTabs
│
├── constants/          # roles.ts, routeTitles.ts, settingsSections.ts
├── hooks/              # Custom hooks (wrap TanStack Query)
│   ├── useAuth.ts            useEmployees.ts       useDepartments.ts
│   ├── usePositions.ts       useLeaveTypes.ts      useHolidays.ts
│   ├── useContractTypes.ts   useProvinces.ts       useReports.ts
│   ├── useCrudResource.ts    useCrudScreen.ts      useTableQuery.ts
│   ├── useEmployeeSearch.ts  usePermissions.ts     useApiErrorMessage.ts
│
├── lib/                # axios.ts (instance + interceptors), queryClient.ts
├── locales/            # vi.json (nguồn chính) · en.json
├── pages/              # Route-level components
│   ├── auth/           # LoginPage, ForgotPasswordPage, ResetPasswordPage
│   ├── dashboard/      # DashboardPage
│   ├── employees/      # EmployeesPage, EmployeeDetailPage, tabs/
│   ├── profile/        # ProfilePage
│   ├── settings/       # Departments, Positions, ContractTypes,
│   │                   # LeaveTypes, Holidays, SettingsIndex
│   └── ComingSoonPage.tsx    # Module của giai đoạn sau
│
├── routes/             # RouterConfig.tsx, PrivateRoute.tsx, GuestRoute.tsx
├── services/           # axios calls – MỌI API call qua đây
│   ├── auth.service.ts       employee.service.ts
│   ├── masterData.service.ts report.service.ts
├── store/              # Zustand stores: authStore, uiStore, tabsStore
├── styles/             # tokens.css (design token)
├── types/              # api.types, auth.types, employee.types, masterData.types
└── utils/              # Hàm tiện ích thuần
    ├── format.ts       # Định dạng tiền, ngày, số VN
    ├── validators.ts   # Validate CCCD, MST, SĐT + sanitizeRedirectPath
    ├── apiError.ts     # Bóc tách error envelope, đọc Retry-After
    ├── departmentTree.ts  download.ts  user.ts
```

Khác với tài liệu cũ:

- **Không có `src/assets/`** — ảnh/icon tĩnh nằm ở `public/` (`favicon.svg`, `icons.svg`).
- **Không có `components/ui/`** — vai trò đó do `components/crud/` đảm nhiệm.
- CSS dùng **CSS Module** (`*.module.css`) cạnh chính component, cộng token chung ở `styles/tokens.css`.
- `pages/attendance`, `pages/leave`, `pages/payroll` **chưa tồn tại**: các route đó trỏ tới `ComingSoonPage`.

---

## 4. State Management

Phân tách rõ ràng hai loại state:

### 4.1 Server State — TanStack Query

Dùng cho tất cả dữ liệu lấy từ API:

| Khái niệm | Cách dùng |
|-----------|-----------|
| `useQuery` | Đọc dữ liệu, tự cache và refetch |
| `useMutation` | Tạo / sửa / xóa, invalidate query sau khi thành công |
| `queryClient.invalidateQueries` | Xóa cache để trigger refetch |
| `staleTime` | Thời gian cache còn "tươi" trước khi refetch nền |

Cache key theo quy ước: `['entity', id?]` — ví dụ `['employees', '123']`, `['leave-requests', { status: 'pending' }]`.

Mặc định toàn cục (`lib/queryClient.ts`): `retry: 1`, `refetchOnWindowFocus: false`, `staleTime: 60_000`.

### 4.2 Client State — Zustand

Chỉ dùng cho state không cần đồng bộ server:

| Store | Nội dung | Persist |
|-------|----------|---------|
| `authStore` | Access token, user đăng nhập, `isAuthenticated`, `sessionChecked` | ❌ **memory-only** |
| `uiStore` | Ngôn ngữ, collapsed sidebar, theme (light/dark) | ✅ localStorage (`hrm-ui-store`) |
| `tabsStore` | Danh sách tab đang mở của thanh tab | ❌ cố ý không persist — tab mô tả "việc đang làm ngay lúc này" |

`authStore` **không** dùng `persist`: access token chỉ nằm trong bộ nhớ để XSS không đọc được. Hệ quả là F5 làm mất token — `sessionChecked` đánh dấu app đã thử khôi phục phiên trong vòng đời trang này chưa, để không thử lại sau khi logout mà cũng không bỏ sót sau khi reload.

---

## 5. Routing

### 5.1 Cấu trúc route

| Pattern | Guard | Mô tả |
|---------|-------|-------|
| `/login` | `GuestRoute` | Màn hình đăng nhập |
| `/forgot-password` · `/reset-password` | – | **Không** wrap `GuestRoute`: người đang đăng nhập theo link reset từ hộp thư vẫn phải dùng được |
| `/` | `PrivateRoute` | Redirect đến `/dashboard` |
| `/dashboard` | `PrivateRoute` | Trang tổng quan |
| `/profile` | `PrivateRoute` | Hồ sơ cá nhân |
| `/employees` · `/employees/:id` | `PrivateRoute` | Danh sách / chi tiết nhân viên |
| `/settings` | `PrivateRoute` | Trang chỉ mục cài đặt |
| `/settings/departments` · `/positions` · `/contract-types` · `/leave-types` · `/holidays` | `PrivateRoute` | Master data |
| `/attendance` · `/leave` · `/payroll` · `/reports` | `PrivateRoute` | `ComingSoonPage` – tính năng ở giai đoạn sau |
| `/departments` | `PrivateRoute` | Redirect → `/settings/departments` (giữ bookmark cũ sống) |
| `*` | – | Redirect → `/` |

> **Không có `/employees/new`**: tạo nhân viên dùng `EmployeeWizard` dạng modal/drawer ngay trên `/employees`.
>
> Mọi page-level component đều được code-split bằng `React.lazy`; page nằm trong `AppLayout` dùng chung Suspense boundary của layout, còn màn hình auth đứng riêng có fallback toàn trang.

### 5.2 Route Guards

`PrivateRoute` là **layout route** bọc toàn bộ route sau login. Nó **không** decode JWT để kiểm tra `exp` — token là chuỗi trong `authStore`, và hạn dùng thật do backend quyết định. Thay vào đó:

1. Nếu chưa authenticated và chưa `sessionChecked` → thử **khôi phục phiên ngầm** (`POST /auth/refresh` → `GET /auth/me`) và hiển thị `FullPageLoader` trong lúc chờ.
2. Chỉ khi lần thử đó **thất bại** mới redirect `/login`, kèm `?redirect=<đường dẫn đang muốn vào>` để đăng nhập xong quay lại đúng chỗ.

Phân quyền theo role **không** dùng component `<RoleGuard>` (component đó không tồn tại). Dùng các hook trong `hooks/usePermissions.ts`: `useCanWriteMasterData`, `useCanWriteEmployees`, `useCanDeleteEmployees`, `useCanWriteContracts`, `useCanCreateUsers`, `useCanExportEmployees`.

> Các hook này **ẩn nút bấm, không phải hàng rào bảo mật**. Backend mới là chỗ chặn thật (`403 FORBIDDEN` ở mọi endpoint ghi); phía UI chỉ để người dùng không bấm một nút chắc chắn sẽ lỗi. Ví dụ `manager` / `employee` mở được màn hình master data bằng URL và thấy bảng, nhưng không có nút Thêm/Sửa/Xoá.

---

## 6. Auth Flow

### 6.1 Đăng nhập

1. User nhập **email hoặc tên đăng nhập** + mật khẩu (+ tuỳ chọn "ghi nhớ đăng nhập") → gọi `POST /auth/login`
2. Backend trả `accessToken` (JWT, 15 phút) trong body và set `refresh_token` trong cookie HttpOnly, `SameSite=Strict`, `Path=/api/v1/auth/refresh` (`Secure` chỉ ở production). **Refresh token không bao giờ có trong body.**
3. `authStore` lưu `accessToken` trong memory (không localStorage — bảo mật XSS)
4. axios request interceptor gắn `Authorization: Bearer <token>` vào mọi request

> **`withCredentials` bật theo từng lời gọi, không bật toàn cục.** Chỉ **hai** request được phép: `POST /auth/login` (nhận `Set-Cookie`) và `POST /auth/refresh` (gửi cookie + được rotate). Mọi thứ còn lại — kể cả `/auth/me` và `/auth/logout` — chỉ cần Bearer token. Đặt cờ này lên `axios.create()` sẽ xin credentials ở mọi request, kể cả những request không liên quan gì tới cookie refresh.

### 6.2 Khôi phục phiên sau F5

Access token chỉ nằm trong memory nên reload trang, mở tab mới hay mở lại trình duyệt đều bắt đầu với store rỗng — dù cookie refresh vẫn còn hiệu lực tới 7 ngày.

`useSessionRestore()` gọi `POST /auth/refresh` → `GET /auth/me`, chạy **tối đa một lần mỗi vòng đời trang** (`authStore.sessionChecked`), và TanStack Query còn dedupe các caller song song nên hai route guard không thể bắn hai lần refresh.

**`GuestRoute` cũng chạy đúng quy trình đó trên màn hình `/login`:** người còn cookie hợp lệ được cho vào thẳng chứ không bị hỏi lại mật khẩu. Trước đây vào thẳng `/login` (bookmark, tab mở lại) sẽ thấy form và bị đòi thông tin mà chính trình duyệt có thể tự cung cấp bằng một lần `POST /auth/refresh`. Thành công → redirect tới nơi người dùng định vào; thất bại → hiện form đăng nhập.

Không thể có vòng lặp redirect: cả hai guard đọc cùng một state đã giải quyết sau một lần thử duy nhất, nên chỉ một trong hai có thể muốn redirect.

### 6.3 Tự động làm mới token

Axios response interceptor xử lý lỗi `401 Unauthorized`:
1. Gọi `POST /auth/refresh` (**không body**, cookie tự đính kèm)
2. Nhận `accessToken` mới → cập nhật `authStore`
3. Retry request gốc với token mới
4. Nếu refresh cũng fail → `clearAuth()` → **hard redirect** `/login`

Cơ chế queue: nếu nhiều request cùng nhận 401, chỉ gọi refresh 1 lần, các request khác chờ.

**Những 401 KHÔNG được retry:**

| Loại | Vì sao |
|------|--------|
| `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` | Public — 401/400 ở đó là câu trả lời thật cho caller |
| `/auth/refresh` | 401 ở đây **chính là** lỗi refresh; retry sẽ đệ quy |
| `/auth/logout` | Token đã chết thì không có gì để cứu |
| `error.code` ∈ `WRONG_CURRENT_PASSWORD`, `INVALID_CREDENTIALS` | Đây là lỗi **nghiệp vụ**, không phải "token cũ". Refresh rồi replay `POST /auth/change-password` sẽ âm thầm gửi lại mật khẩu sai — và có thể tính vào lockout |

`/auth/me` **cố ý không** nằm trong danh sách trên: nó phải được retry sau khi refresh xong.

**Marker chống vòng lặp.** Redirect sau khi refresh thất bại dùng `location.replace()` (để nút Back không quay lại trang vừa bị từ chối) và mang theo hai query:

```
/login?redirect=<đường dẫn đang dở>&sessionExpired=1
```

`sessionExpired=1` là **marker báo "phiên vừa khôi phục hỏng"**. Nó cần thiết vì redirect này là một lần tải trang đầy đủ, xoá sạch cờ `sessionChecked` trong memory — không có marker thì `GuestRoute` sẽ thử khôi phục lại từ đầu, và nếu cookie *trông* vẫn dùng được thì nó ném người dùng ngược về đúng trang vừa từ chối họ, rồi lặp mãi. Thấy marker thì `GuestRoute` bỏ qua lần thử đó và hiện thẳng form.

`redirect` được **sanitize** trước khi dùng (`utils/validators.ts` → `sanitizeRedirectPath`), mặc định về `/dashboard` và từ chối mọi giá trị có thể thành open redirect.

### 6.4 Đăng xuất

Gọi `POST /auth/logout` → backend revoke refresh token trong DB (nhận diện phiên qua claim `sid` của access token, **không** qua cookie) → xoá cookie → clear `authStore`. `authStore` luôn được dọn kể cả khi lời gọi server thất bại.

---

## 7. API Call Pattern

Mọi component KHÔNG fetch API trực tiếp. Luồng bắt buộc:

```
Component → Custom Hook → Service → axios → Backend API
```

**Tầng Service** (`services/employee.service.ts`): định nghĩa hàm gọi API, trả về Promise với kiểu dữ liệu cụ thể.

**Tầng Hook** (`hooks/useEmployees.ts`): wrap service trong `useQuery` / `useMutation`. Component gọi hook, nhận `{ data, isLoading, error }`.

**Tầng Component**: chỉ render UI dựa trên data từ hook.

### Xử lý lỗi API

Envelope lỗi thật của backend (`backend/docs/api-spec.md` §1.1) — **không** phải `{ success, message, errorCode }` như tài liệu này từng ghi:

```json
{
  "success": false,
  "error": {
    "code": "EMPLOYEE_NOT_FOUND",
    "message": "Cannot find employee with id 42",
    "details": [
      { "field": "email", "code": "INVALID_EMAIL", "message": "Invalid email format" }
    ]
  },
  "timestamp": "2026-08-19T10:00:00.000Z"
}
```

- Mã lỗi nằm ở **`error.code`**, không phải `errorCode`.
- **`details[]` chỉ xuất hiện khi `error.code === "VALIDATION_ERROR"`**; mỗi phần tử đủ 3 trường `field` + `code` + `message`.
- Response thành công là `{ success, data, timestamp }` — **không** có `message`.

> ⚠️ **`error.message` là văn bản tiếng Anh dành cho developer/log và TUYỆT ĐỐI KHÔNG được render cho người dùng.** UI map **`error.code`** sang i18n. Dùng hook `useApiErrorMessage()`: nó tra `errors.api.<CODE>` trong file dịch và fallback về một câu chung cho mã chưa biết. Kiểu TypeScript của envelope nằm ở `types/api.types.ts`.

**Thời gian còn lại của khoá tài khoản nằm ở header `Retry-After`,** không nằm trong body. `utils/apiError.ts` đọc header đó (chấp nhận cả dạng số giây lẫn HTTP date) và `useLoginErrorMessage()` phân biệt ba tình huống của màn hình đăng nhập:

| Tín hiệu | Thông điệp |
|----------|-----------|
| `401 INVALID_CREDENTIALS` | Sai tên đăng nhập / mật khẩu |
| `429` | Lần thử này vừa làm khoá tài khoản 15 phút |
| `423 ACCOUNT_LOCKED` | Đang bị khoá (kèm số phút còn lại nếu đọc được) |

Không log chi tiết lỗi ra console ở production.

---

## 8. Internationalization (i18n)

- Dùng `i18next` + `react-i18next` + `i18next-browser-languagedetector`
- Ngôn ngữ mặc định và fallback: Tiếng Việt (`vi`); hỗ trợ `vi` | `en`
- Chỉ có **một namespace**: `common` (khai báo `ns: ['common']`, `defaultNS: 'common'`) — key viết thẳng như `t('employee.fullName')`, không có tiền tố namespace
- Tất cả text hiển thị PHẢI qua `t('key')` — không hardcode tiếng Việt trong JSX
- Mã lỗi API map qua key `errors.api.<CODE>` (§7)
- File nguồn chính: `locales/vi.json`
- **`uiStore` (persist localStorage `hrm-ui-store`) là nguồn sự thật** cho ngôn ngữ; language-detector chỉ có tác dụng ở lần truy cập đầu tiên khi `uiStore` chưa từng được ghi. Hai chiều được đồng bộ: đổi qua switcher hay gọi `i18n.changeLanguage()` trực tiếp đều giữ bên kia nhất quán

---

## 9. Performance

| Kỹ thuật | Trạng thái | Áp dụng ở đâu |
|----------|-----------|--------------|
| Code splitting (`React.lazy`) | ✅ | Mỗi page-level component (`routes/RouterConfig.tsx`) |
| `Suspense` + `FullPageLoader` | ✅ | Boundary trong `AppLayout` cho page nội bộ; fallback toàn trang cho màn hình auth |
| `staleTime` trong TanStack Query | ✅ | Mặc định toàn cục **60 giây** (`lib/queryClient.ts`), không phải 5 phút |
| Debounce search | ✅ | `useEmployeeSearch` – dropdown chọn người (query key là term **đã** debounce) |
| Virtual scroll | ⏳ chưa có | Dự định cho bảng dữ liệu lớn |
| `React.memo` | ⏳ chưa dùng | – |

---

## 10. Build & Deploy

| Môi trường | URL | Config | Trạng thái |
|------------|-----|--------|-----------|
| Development | `http://localhost:5173` | `.env.development` | ✅ |
| Staging | `https://hrm-staging.company.vn` | `.env.staging` | ⏳ file chưa tồn tại |
| Production | `https://hrm.company.vn` | `.env.production` | ⏳ file chưa tồn tại |

**Biến môi trường:**

| Biến | Trạng thái | Mô tả |
|------|-----------|-------|
| `VITE_API_BASE_URL` | ✅ | URL gốc của backend API. Ở dev là **`/api/v1`** (đường dẫn tương đối) — Vite proxy `/api` → `http://localhost:3000`, nhờ vậy request là same-origin và cookie refresh hoạt động bình thường |
| `VITE_APP_NAME` | ✅ | Tên hiển thị trong tab/title (`HRM`) |
| `VITE_SENTRY_DSN` | ⏳ | Chưa dùng (xem §11) |

`lib/axios.ts` fallback về `/api/v1` nếu `VITE_API_BASE_URL` trống.

Build output là thư mục `dist/` — deploy lên S3 + CloudFront hoặc Nginx static server.

---

## 11. Error Monitoring

> ⏳ **Chưa tích hợp gì.** Không có package `@sentry/*` trong `package.json` và **chưa có component `ErrorBoundary`** nào trong `src/`. Toàn bộ mục này là kế hoạch.

Kế hoạch:
- Tích hợp Sentry (`@sentry/react`) để bắt lỗi runtime
- `ErrorBoundary` wrap ở cấp Route để tránh crash toàn app
- Lỗi API 5xx được log vào Sentry với context (user, route, payload)
- Không log thông tin nhạy cảm (token, CCCD, mật khẩu)

---

*Cập nhật: 19/08/2026 – Version 1.1 – Đồng bộ với code: §2 phiên bản thật (React 19, AntD 6, React Router 7, Zustand 5, i18next 26, Vite 8, TS 6, oxlint); §3 cây thư mục thật (`components/crud`, `charts`, `constants`, `routes`, `lib`, `styles`; không có `assets/`); §5 route + guard thật (không có RoleGuard, không decode `exp`); §6 bổ sung khôi phục phiên, GuestRoute, marker `sessionExpired`, quy tắc `withCredentials`; §7 sửa envelope lỗi về `{ success, error: { code, message, details? }, timestamp }` và nêu rõ `error.message` không được hiển thị; §9–§11 đánh dấu phần chưa có*
