# Component Guide

**Phiên bản:** 1.0  
**Ngày cập nhật:** 19/06/2026

---

## 1. Phân loại Components

| Loại | Thư mục | Mô tả |
|------|---------|-------|
| **Layout** | `components/layout/` | Khung sườn app (không fetch API) |
| **Shared UI** | `components/ui/` | Tái sử dụng nhiều nơi (không fetch API) |
| **Page** | `pages/` | Route-level, fetch qua hooks |
| **Feature** | `pages/<module>/components/` | Component của một module cụ thể |

**Quy tắc vàng:** Component trong `components/` KHÔNG được fetch API. Chỉ nhận data qua props.

---

## 2. Layout Components

### AppLayout

Wrapper bọc toàn bộ app sau khi đăng nhập. Render Header + Sidebar + `<Outlet />` (React Router).

Props: không có — đọc state từ `authStore` và `uiStore`.

### Sidebar

Menu điều hướng trái. Thu gọn/mở rộng theo `uiStore.sidebarCollapsed`.

| Menu item | Icon | Route | Quyền |
|-----------|------|-------|-------|
| Tổng quan | Dashboard | `/dashboard` | Tất cả |
| Nhân viên | Team | `/employees` | HR, Admin |
| Chấm công | Clock | `/attendance` | HR, Manager, Admin |
| Phép | Calendar | `/leave` | Tất cả |
| Lương | Money | `/payroll` | HR, Admin |
| Khen thưởng / Kỷ luật | Award | `/rewards-disciplines` | HR, Admin |
| Đánh giá | Star | `/performance` | Manager, HR, Admin |
| Đào tạo | Book | `/trainings` | HR, Admin |
| Thông báo | Bell | `/announcements` | Tất cả |
| Cài đặt | Settings | `/settings` | Admin |

Menu item được ẩn nếu user không có quyền (không disable — ẩn hẳn).

### Header

Thanh trên cùng. Gồm:
- Logo công ty + tên HRM (trái)
- Tìm kiếm nhanh (giữa)
- Icon thông báo + badge số chưa đọc
- Avatar + dropdown user (tên, xem profile, đổi mật khẩu, đăng xuất)

### PageHeader

Component dùng lại ở đầu mỗi trang. Props:

| Prop | Kiểu | Bắt buộc | Mô tả |
|------|------|----------|-------|
| `title` | `string` | Có | Tiêu đề trang |
| `breadcrumbs` | `BreadcrumbItem[]` | Không | Mảng breadcrumb |
| `actions` | `ReactNode` | Không | Nút / action phải |
| `extra` | `ReactNode` | Không | Content bổ sung bên dưới title |

---

## 3. Shared UI Components

### DataTable

Bảng dữ liệu chuẩn, wrap AntD `Table` với thêm:
- Tự xử lý pagination (lấy `page`, `pageSize` từ URL)
- Loading skeleton
- Empty state mặc định
- Responsive scroll ngang trên tablet

Props chính:

| Prop | Kiểu | Mô tả |
|------|------|-------|
| `columns` | `ColumnDef[]` | Định nghĩa cột |
| `dataSource` | `T[]` | Dữ liệu |
| `total` | `number` | Tổng số bản ghi |
| `loading` | `boolean` | Trạng thái tải |
| `rowKey` | `string` | Key unique của mỗi row |

### SearchFilter

Thanh filter phía trên bảng. Gồm ô tìm kiếm text + các Select filter.

Props: nhận `fields` là mảng config các filter field, callback `onChange` khi filter thay đổi.

### StatusBadge

Badge hiển thị trạng thái với màu tương ứng.

| Status key | Label | Màu |
|-----------|-------|-----|
| `active` | Đang làm việc | Xanh lá |
| `probation` | Thử việc | Xanh dương |
| `maternity_leave` | Nghỉ thai sản | Vàng |
| `resigned` | Đã nghỉ việc | Đỏ |
| `retired` | Đã nghỉ hưu | Xám |
| `pending` | Chờ duyệt | Vàng |
| `approved` | Đã duyệt | Xanh lá |
| `rejected` | Từ chối | Đỏ |

### UploadAvatar

Component upload ảnh đại diện nhân viên. Hỗ trợ:
- Xem trước ảnh sau khi chọn
- Giới hạn 2MB, chỉ chấp nhận JPG / PNG / WebP
- Upload lên S3 qua `POST /upload/avatar`
- Hiển thị tiến trình upload

### ConfirmButton

Nút có xác nhận trước khi thực hiện (dùng cho xóa, hủy).

Props: `label`, `confirmText`, `onConfirm`, `danger` (màu đỏ), `loading`.

### CurrencyDisplay

Hiển thị số tiền theo chuẩn VN (`1.000.000 ₫`).

Props: `value` (number), `showSign` (hiện dấu + / - cho delta), `size` (sm/md/lg).

### DateDisplay

Hiển thị ngày theo định dạng VN. Props: `value` (ISO string), `format` (mặc định `DD/MM/YYYY`).

---

## 4. Page Components theo Module

### 4.1 Employees (Nhân viên)

| File | Mô tả |
|------|-------|
| `EmployeeListPage` | Danh sách + filter + phân trang |
| `EmployeeDetailPage` | Xem chi tiết, tabs thông tin |
| `EmployeeCreatePage` | Form tạo mới nhiều bước (wizard) |
| `EmployeeEditPage` | Form sửa thông tin |

**EmployeeCreatePage** dùng wizard 4 bước:
1. Thông tin cơ bản (họ tên, ngày sinh, giới tính, CCCD)
2. Thông tin công việc (phòng ban, chức vụ, loại hợp đồng, ngày vào làm)
3. Thông tin lương (lương cơ bản, phụ cấp)
4. Tài khoản đăng nhập (email, mật khẩu tạm)

**EmployeeDetailPage** dùng Tabs:
- Thông tin cá nhân
- Hợp đồng
- Lương & Phụ cấp
- Phép năm
- Chấm công
- Lịch sử khen thưởng / kỷ luật
- Đánh giá hiệu suất
- Thành viên gia đình

### 4.2 Attendance (Chấm công)

| File | Mô tả |
|------|-------|
| `AttendanceListPage` | Xem lịch chấm công theo tháng (calendar view) |
| `AttendanceManagePage` | HR xem bảng chấm công toàn công ty |
| `OvertimeRequestPage` | Đăng ký / duyệt làm thêm giờ |

### 4.3 Leave (Phép)

| File | Mô tả |
|------|-------|
| `LeaveBalancePage` | Xem số ngày phép còn lại |
| `LeaveRequestListPage` | Danh sách đơn phép của tôi |
| `LeaveRequestCreatePage` | Tạo đơn phép mới |
| `LeaveApprovalPage` | Manager duyệt / từ chối đơn phép |
| `LeaveCalendarPage` | Lịch phép toàn công ty |

### 4.4 Payroll (Lương)

| File | Mô tả |
|------|-------|
| `PayrollListPage` | Danh sách bảng lương theo tháng |
| `PayrollDetailPage` | Chi tiết bảng lương một nhân viên |
| `PayrollCalculatePage` | HR tính lương hàng loạt |
| `PayslipPage` | Phiếu lương cá nhân (có nút in) |

### 4.5 Settings (Cài đặt)

| File | Mô tả |
|------|-------|
| `DepartmentSettingsPage` | Quản lý phòng ban |
| `PositionSettingsPage` | Quản lý chức vụ |
| `HolidaySettingsPage` | Cấu hình ngày lễ trong năm |
| `LeaveTypeSettingsPage` | Loại phép và số ngày được hưởng |
| `UserManagePage` | Quản lý tài khoản hệ thống |
| `RolePermissionPage` | Phân quyền theo role |

---

## 5. Custom Hooks

Tất cả hooks đặt trong `hooks/`. Convention đặt tên: `use<Entity>` hoặc `use<Action>`.

### Hooks lấy dữ liệu (useQuery)

| Hook | Endpoint | Mô tả |
|------|----------|-------|
| `useEmployees(params)` | `GET /employees` | Danh sách nhân viên có filter/page |
| `useEmployee(id)` | `GET /employees/:id` | Chi tiết một nhân viên |
| `useDepartments()` | `GET /departments` | Danh sách phòng ban (cache 10 phút) |
| `usePositions(departmentId?)` | `GET /positions` | Danh sách chức vụ |
| `useLeaveRequests(params)` | `GET /leave-requests` | Danh sách đơn phép |
| `useLeaveBalance(employeeId)` | `GET /leave-balances/:id` | Số ngày phép |
| `usePayrolls(params)` | `GET /payrolls` | Danh sách bảng lương |
| `usePayroll(id)` | `GET /payrolls/:id` | Chi tiết bảng lương |

### Hooks thao tác (useMutation)

| Hook | Method | Sau khi thành công |
|------|--------|--------------------|
| `useCreateEmployee()` | `POST /employees` | Invalidate `['employees']` |
| `useUpdateEmployee(id)` | `PUT /employees/:id` | Invalidate `['employees', id]` |
| `useDeleteEmployee(id)` | `DELETE /employees/:id` | Invalidate `['employees']` |
| `useApproveLeave(id)` | `PUT /leave-requests/:id/approve` | Invalidate `['leave-requests']` |
| `useRejectLeave(id)` | `PUT /leave-requests/:id/reject` | Invalidate `['leave-requests']` |
| `useCalculatePayroll()` | `POST /payrolls/calculate` | Invalidate `['payrolls']` |

### Utility Hooks

| Hook | Mô tả |
|------|-------|
| `useAuth()` | Trả về `user`, `isAuthenticated`, `login()`, `logout()` |
| `usePermission(action, resource)` | Kiểm tra quyền hiện tại |
| `usePagination()` | Đọc/ghi `page`, `pageSize` vào URL |
| `useDebounce(value, delay)` | Debounce input search |
| `useBreakpoint()` | Responsive breakpoint hiện tại |

---

## 6. Zustand Stores

### authStore

| State | Kiểu | Mô tả |
|-------|------|-------|
| `accessToken` | `string \| null` | JWT access token trong memory |
| `user` | `UserProfile \| null` | Thông tin user đang đăng nhập |
| `isAuthenticated` | `boolean` | Computed từ accessToken |

Actions: `setAuth(token, user)`, `clearAuth()`, `updateToken(token)`.

### uiStore

| State | Kiểu | Mô tả |
|-------|------|-------|
| `sidebarCollapsed` | `boolean` | Sidebar thu gọn hay không |
| `locale` | `'vi' \| 'en'` | Ngôn ngữ hiển thị |
| `theme` | `'light' \| 'dark'` | Giao diện |

Actions: `toggleSidebar()`, `setLocale(locale)`, `setTheme(theme)`.

`locale` và `theme` được persist vào localStorage qua `zustand/middleware/persist`.

---

## 7. Naming Conventions

### Files

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Page component | PascalCase + Page | `EmployeeListPage.tsx` |
| Shared component | PascalCase | `DataTable.tsx`, `StatusBadge.tsx` |
| Custom hook | camelCase bắt đầu `use` | `useEmployees.ts` |
| Service | camelCase + `.service` | `employee.service.ts` |
| Store | camelCase + `Store` | `authStore.ts` |
| Types | camelCase + `.types` | `employee.types.ts` |
| Utils | camelCase | `format.ts`, `validators.ts` |
| Constants | camelCase | `routes.ts`, `queryKeys.ts` |

### Types / Interfaces

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Entity từ API | PascalCase | `Employee`, `LeaveRequest` |
| DTO (request body) | PascalCase + `Dto` | `CreateEmployeeDto` |
| Props component | PascalCase + `Props` | `DataTableProps` |
| Response paging | `PaginatedResponse<T>` | `PaginatedResponse<Employee>` |
| Enum | PascalCase | `EmployeeStatus`, `LeaveType` |

### Query Keys

Định nghĩa tập trung trong `constants/queryKeys.ts`:

| Key | Giá trị |
|-----|---------|
| employees.all | `['employees']` |
| employees.detail(id) | `['employees', id]` |
| departments.all | `['departments']` |
| leaveRequests.all | `['leave-requests']` |
| payrolls.all | `['payrolls']` |

Không dùng string rời rạc trong từng hook — luôn import từ `queryKeys.ts`.

---

## 8. Do & Don't

### DO

- Tách logic fetch ra hook riêng, component chỉ render
- Dùng TypeScript strict — định nghĩa type cho mọi prop và data
- Dùng `dayjs` với locale `vi` cho mọi xử lý ngày
- Dùng hàm trong `utils/format.ts` cho currency, date, phone
- Lazy load page-level component để tối ưu bundle
- Invalidate query sau mỗi mutation thành công

### DON'T

- Không fetch API trong component con — chỉ nhận qua props
- Không dùng `any` — dùng `unknown` nếu chưa biết type
- Không hardcode tiếng Việt trong JSX — dùng `t('key')`
- Không lưu token trong localStorage — dễ bị XSS
- Không dùng `moment.js` — dùng `dayjs`
- Không inline CSS style — dùng AntD token hoặc CSS module
- Không gọi trực tiếp `queryClient` trong component — dùng hook
