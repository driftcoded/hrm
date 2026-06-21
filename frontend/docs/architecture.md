# Frontend Architecture

**Phiên bản:** 1.0  
**Ngày cập nhật:** 19/06/2026  
**Stack:** React 18 · TypeScript · Vite · Ant Design v5

---

## 1. Tổng quan

Frontend HRM là Single Page Application (SPA) phục vụ các nhóm người dùng:

| Nhóm | Quyền chính |
|------|-------------|
| Super Admin | Toàn bộ hệ thống, cấu hình công ty |
| HR Manager | Quản lý nhân viên, chấm công, lương, phép |
| Trưởng phòng | Duyệt phép, đánh giá nhân viên phòng ban |
| Nhân viên | Xem thông tin cá nhân, nộp đơn phép, xem phiếu lương |

Giao tiếp với backend qua REST API (JSON). Xác thực bằng JWT access token trong memory + refresh token trong HttpOnly cookie.

---

## 2. Tech Stack

| Thư viện | Phiên bản | Vai trò |
|----------|-----------|---------|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool, dev server |
| Ant Design | 5.x | Component library, Design System |
| React Router | 6.x | Client-side routing |
| TanStack Query | 5.x | Server state, cache, refetch |
| Zustand | 4.x | Client state (auth, UI prefs) |
| axios | 1.x | HTTP client với interceptors |
| dayjs | 1.x | Date/time với locale `vi` |
| i18next | 23.x | Đa ngôn ngữ (VI / EN) |

---

## 3. Cấu trúc thư mục

```
src/
├── assets/             # Ảnh, icon tĩnh
├── components/         # Shared components (KHÔNG fetch API)
│   ├── common/         # Button mở rộng, Badge trạng thái, ...
│   ├── layout/         # AppLayout, Sidebar, Header, PageHeader
│   └── ui/             # DataTable, SearchFilter, UploadAvatar, ...
├── constants/          # Enums, magic strings, config keys
├── hooks/              # Custom hooks (wrap TanStack Query)
│   ├── useAuth.ts
│   ├── useEmployees.ts
│   └── ...
├── locales/
│   ├── vi.json         # Bản dịch tiếng Việt (nguồn chính)
│   └── en.json         # Bản dịch tiếng Anh
├── pages/              # Route-level components (1 file = 1 route)
│   ├── auth/
│   ├── employees/
│   ├── attendance/
│   ├── leave/
│   ├── payroll/
│   └── settings/
├── routes/
│   └── RouterConfig.tsx  # Khai báo toàn bộ routes
├── services/           # axios calls - MỌI API call qua đây
│   ├── auth.service.ts
│   ├── employee.service.ts
│   └── ...
├── store/              # Zustand stores
│   ├── authStore.ts
│   └── uiStore.ts
├── types/              # TypeScript interfaces dùng chung
│   ├── employee.types.ts
│   ├── payroll.types.ts
│   └── ...
└── utils/              # Hàm tiện ích thuần (không có side effect)
    ├── format.ts       # Định dạng tiền, ngày, số VN
    └── validators.ts   # Validate CCCD, MST, SĐT
```

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

### 4.2 Client State — Zustand

Chỉ dùng cho state không cần đồng bộ server:

| Store | Nội dung |
|-------|----------|
| `authStore` | Access token, thông tin user đăng nhập, quyền |
| `uiStore` | Ngôn ngữ, collapsed sidebar, theme (light/dark) |

Zustand store được khởi tạo một lần khi app load. Không persist vào localStorage (trừ `uiStore` cho theme/locale).

---

## 5. Routing

### 5.1 Cấu trúc route

| Pattern | Mô tả |
|---------|-------|
| `/login` | Public route |
| `/` | Redirect đến `/dashboard` |
| `/dashboard` | Trang tổng quan |
| `/employees` | Danh sách nhân viên |
| `/employees/:id` | Chi tiết nhân viên |
| `/employees/new` | Tạo nhân viên mới |
| `/attendance` | Chấm công |
| `/leave` | Phép |
| `/payroll` | Bảng lương |
| `/settings/*` | Cài đặt hệ thống |

### 5.2 Route Guards

Mọi route sau login đều wrap trong `<PrivateRoute>`. Component này kiểm tra:
1. Có access token trong `authStore` không
2. Token còn hạn không (decode payload, kiểm tra `exp`)
3. Nếu không → redirect `/login`

Phân quyền theo role dùng `<RoleGuard allowedRoles={['hr_manager']}>` wrap ở component cấp page.

---

## 6. Auth Flow

### 6.1 Đăng nhập

1. User nhập email / mật khẩu → gọi `POST /auth/login`
2. Backend trả về `access_token` (JWT, 15 phút) và set `refresh_token` trong HttpOnly cookie
3. `authStore` lưu `access_token` trong memory (không localStorage — bảo mật XSS)
4. axios interceptor gắn `Authorization: Bearer <token>` vào mọi request

### 6.2 Tự động làm mới token

Axios response interceptor xử lý lỗi `401 Unauthorized`:
1. Gọi `POST /auth/refresh` (cookie tự đính kèm)
2. Nhận `access_token` mới → cập nhật `authStore`
3. Retry request gốc với token mới
4. Nếu refresh cũng fail → clear auth → redirect `/login`

Cơ chế queue: nếu nhiều request cùng nhận 401, chỉ gọi refresh 1 lần, các request khác chờ.

### 6.3 Đăng xuất

Gọi `POST /auth/logout` → backend xóa refresh token trong DB → clear `authStore` → redirect `/login`.

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

Lỗi từ backend có format chuẩn:
```
{ success: false, message: "...", errorCode: "EMPLOYEE_NOT_FOUND" }
```

`error.message` hiển thị trong Ant Design `message.error()`. Không log chi tiết lỗi ra console ở production.

---

## 8. Internationalization (i18n)

- Dùng `i18next` với plugin `react-i18next`
- Ngôn ngữ mặc định: Tiếng Việt (`vi`)
- Tất cả text hiển thị PHẢI qua `t('key')` — không hardcode tiếng Việt trong JSX
- Key theo namespace: `t('employee.fullName')`, `t('common.save')`, `t('error.required')`
- File nguồn chính: `locales/vi.json`
- Ngôn ngữ được lưu trong `uiStore` và persist vào localStorage

---

## 9. Performance

| Kỹ thuật | Áp dụng ở đâu |
|----------|--------------|
| Code splitting (`React.lazy`) | Mỗi page-level component |
| `Suspense` + skeleton loader | Wrapper cho lazy routes |
| `staleTime: 5 phút` trong TanStack Query | Dữ liệu ít thay đổi (departments, positions) |
| Virtual scroll | Bảng dữ liệu lớn (danh sách nhân viên) |
| Debounce search | Input tìm kiếm, delay 300ms |
| `React.memo` | Component list item có re-render nhiều |

---

## 10. Build & Deploy

| Môi trường | URL | Config |
|------------|-----|--------|
| Development | `http://localhost:5173` | `.env.development` |
| Staging | `https://hrm-staging.company.vn` | `.env.staging` |
| Production | `https://hrm.company.vn` | `.env.production` |

**Biến môi trường quan trọng:**

| Biến | Mô tả |
|------|-------|
| `VITE_API_BASE_URL` | URL gốc của backend API |
| `VITE_APP_NAME` | Tên hiển thị trong tab/title |
| `VITE_SENTRY_DSN` | Endpoint báo lỗi Sentry |

Build output là thư mục `dist/` — deploy lên S3 + CloudFront hoặc Nginx static server.

---

## 11. Error Monitoring

- Tích hợp Sentry (`@sentry/react`) để bắt lỗi runtime
- `ErrorBoundary` wrap ở cấp Route để tránh crash toàn app
- Lỗi API 5xx được log vào Sentry với context (user, route, payload)
- Không log thông tin nhạy cảm (token, CCCD, mật khẩu)
