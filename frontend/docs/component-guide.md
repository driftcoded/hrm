# Component Guide

**Phiên bản:** 1.1  
**Ngày cập nhật:** 19/08/2026

> **Cách đọc tài liệu này.** Phần lớn nội dung là **thiết kế dự kiến** viết trước khi code, và nhiều tên component/hook/page ở đây chưa từng tồn tại. Ở mỗi mục lệch đã có một khối ⚠️ đối chiếu với code thật. Khi hai bên mâu thuẫn, **code là đúng**; hãy sửa tài liệu chứ đừng đổi tên trong code cho khớp tài liệu.

---

## 1. Phân loại Components

| Loại | Thư mục | Mô tả |
|------|---------|-------|
| **Layout** | `components/layout/` | Khung sườn app (không fetch API) |
| **Shared UI** | `components/crud/`, `components/common/`, `components/charts/` | Tái sử dụng nhiều nơi (không fetch API). **Không có `components/ui/`** |
| **Page** | `pages/` | Route-level, fetch qua hooks |
| **Feature** | `components/<module>/` — vd `components/employees/`, `components/departments/`, `components/dashboard/`, `components/auth/` | Component của một module cụ thể. Tab của trang chi tiết nhân viên nằm ở `pages/employees/tabs/` |

**Quy tắc vàng:** Component trong `components/` KHÔNG được fetch API. Chỉ nhận data qua props.

---

## 2. Layout Components

### AppLayout

Wrapper bọc toàn bộ app sau khi đăng nhập. Render Header + Sidebar + `<Outlet />` (React Router).

Props: không có — đọc state từ `authStore` và `uiStore`.

### Sidebar

Menu điều hướng trái. Thu gọn/mở rộng theo `uiStore.sidebarCollapsed`.

Menu **thật** hiện tại (`Sidebar.tsx`):

| Menu item | Icon | Route | Trạng thái |
|-----------|------|-------|-----------|
| Tổng quan | `HomeOutlined` | `/dashboard` | ✅ |
| Nhân viên | `TeamOutlined` | `/employees` | ✅ |
| Chấm công | `ClockCircleOutlined` | `/attendance` | ⏳ ComingSoonPage |
| Lương | `DollarCircleOutlined` | `/payroll` | ⏳ ComingSoonPage |
| Phép | `FileTextOutlined` | `/leave` | ⏳ ComingSoonPage |
| Báo cáo | `BarChartOutlined` | `/reports` | ⏳ ComingSoonPage |
| Cài đặt | `SettingOutlined` | `/settings` (+ submenu từ `constants/settingsSections.ts`) | ✅ |

> ⚠️ **Menu hiện KHÔNG ẩn theo quyền** — mọi role đã đăng nhập đều thấy đủ các mục trên. Việc ẩn/hiện theo quyền mới chỉ áp dụng cho **nút thao tác** bên trong từng trang (`hooks/usePermissions.ts`). Mục "Thông báo" ở phiên bản trước của bảng này chưa tồn tại ở bất kỳ dạng nào. Đánh giá hiệu suất và Đào tạo đã bị bỏ khỏi phạm vi sản phẩm (PLAN giai đoạn 7).
>
> Ngoài Sidebar còn có `NavTabs` — thanh tab các trang đang mở, lấy state từ `tabsStore`.

### Header

Thanh trên cùng. Gồm:
- Nút thu gọn sidebar (trái)
- Ô tìm kiếm nhanh — **render `disabled` kèm tooltip "Sắp có"**: chưa có API tìm kiếm toàn cục
- Icon chuông thông báo — **cũng `disabled`**, badge luôn `count={0}`: chưa có API thông báo
- Nút trợ giúp, công tắc đổi ngôn ngữ
- Avatar + dropdown user (xem profile, đăng xuất)

> Hai control chưa có backend được để **disabled kèm tooltip** thay vì ẩn đi — người dùng thấy tính năng đang tới, và không bấm vào một nút chắc chắn không phản hồi.

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

> ⚠️ **Mục §3 đã lệch so với code.** Không component nào dưới đây tồn tại đúng tên như mô tả. Bảng đối chiếu với thực tế (`src/components/`):
>
> | Mô tả ở §3 | Thực tế trong code |
> |------------|--------------------|
> | `DataTable` | `components/crud/DataTableCard` |
> | `SearchFilter` | `components/crud/TableSearch` (chỉ ô tìm kiếm; filter select do từng page tự dựng) |
> | `StatusBadge` | `components/employees/EmployeeStatusTag` (AntD `Tag`) và `components/crud/BooleanTag` |
> | `UploadAvatar` | `components/employees/AvatarUploader` |
> | `ConfirmButton` | `components/crud/RowActions` (Popconfirm của AntD) |
> | `CurrencyDisplay` · `DateDisplay` | **Không phải component** – là hàm trong `utils/format.ts`: `formatCurrency`, `formatNumber`, `formatPercent`, `formatDate`, `formatDateTime`, `formatPhone`, `maskCccd` |
> | – | Còn có: `crud/CrudFormModal`, `crud/GeneratedCodeField`, `common/FullPageLoader`, `common/StatCard`, `common/BrandMark`, `charts/DonutChart` |
>
> **Trạng thái nhân viên đúng là 6 giá trị** của `employees.status`: `probation` · `active` · `on_leave` · `suspended` · `resigned` · `terminated`. Bảng ở phần `StatusBadge` bên dưới liệt kê `maternity_leave` / `retired` — hai giá trị **không tồn tại** — và trộn lẫn trạng thái đơn nghỉ (`pending`/`approved`/`rejected`) vào cùng một component.
>
> **Avatar:** upload qua `POST /employees/:id/avatar` (multipart, field `avatar`), **không** phải `POST /upload/avatar`, và mặc định file được lưu bằng driver `local` xuống `uploads/` chứ không phải S3 (S3 chưa từng chạy — xem `backend/docs/architecture.md` §9).

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

> ⚠️ **Chỉ §4.1 và §4.5 có code; §4.2 (Chấm công), §4.3 (Phép), §4.4 (Lương) chưa tồn tại** — các route `/attendance`, `/leave`, `/payroll`, `/reports` hiện trỏ tới `ComingSoonPage`.
>
> Page thật đang có: `pages/auth/{LoginPage, ForgotPasswordPage, ResetPasswordPage}`, `pages/dashboard/DashboardPage`, `pages/profile/ProfilePage`, `pages/employees/{EmployeesPage, EmployeeDetailPage, tabs/}`, `pages/settings/{SettingsIndexPage, DepartmentsPage, PositionsPage, ContractTypesPage, LeaveTypesPage, HolidaysPage}`, `pages/ComingSoonPage`.

### 4.1 Employees (Nhân viên)

| File | Trạng thái | Mô tả |
|------|-----------|-------|
| `EmployeesPage` | ✅ | Danh sách + filter + phân trang (tên thật, không phải `EmployeeListPage`) |
| `EmployeeDetailPage` | ✅ | Xem chi tiết, tabs thông tin |
| `components/employees/EmployeeWizard` | ✅ | Tạo/sửa dạng wizard **ngay trên `/employees`** — **không** có route `/employees/new` và không có `EmployeeCreatePage` / `EmployeeEditPage` riêng |

**EmployeeWizard** dùng 4 bước:
1. Thông tin cơ bản (họ tên, ngày sinh, giới tính, CCCD)
2. Thông tin công việc (phòng ban, chức vụ, loại hợp đồng, ngày vào làm)
3. Thông tin lương (lương cơ bản, phụ cấp)
4. Tài khoản đăng nhập (email, mật khẩu tạm) — **chỉ hiện với `admin`**; role khác chỉ thấy 3 bước, vì `POST /users` là endpoint admin-only

Wizard dùng **một** instance `Form` cho cả 4 bước (ẩn pane không hoạt động thay vì unmount) nên không mất dữ liệu người dùng đã gõ; nút "Tiếp" chỉ validate field của **bước hiện tại**.

**EmployeeDetailPage** dùng Tabs — hiện có `PersonalTab`, `ContractsTab`, `RewardsTab`, `FamilyTab` (kèm `DependentsSection`); ba tab còn lại (Lương & Phụ cấp, Phép năm, Chấm công) render `ComingSoonTab` cho tới khi có bản xem theo từng nhân viên.

### 4.2 Attendance (Chấm công)

| File | Mô tả |
|------|-------|
| `AttendanceLayout` | Vỏ của module: tiêu đề + `Outlet`. Không còn tabbar (chỉ còn một màn hình) |
| `AttendanceTablePage` | Màn hình chính: bảng công toàn công ty, lọc phòng ban + tháng |
| `AddAttendanceModal` / `AdjustAttendanceModal` | Nhập một ngày công / sửa ngày công đã có (bắt buộc ghi lý do) |
| `ImportAttendanceModal` | Nạp Excel 2 bước: chạy thử → ghi thật |
| `AttendanceStatusTag` | Tag trạng thái ngày công |

> KHÔNG có trang đăng ký/duyệt làm thêm giờ. Giờ làm thêm là một cột của bảng
> công, suy ra từ giờ vào/ra — xem PLAN.md Giai đoạn 4.

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

| File thật | Route | Trạng thái |
|-----------|-------|-----------|
| `SettingsIndexPage` | `/settings` | ✅ Trang chỉ mục |
| `DepartmentsPage` | `/settings/departments` | ✅ Quản lý phòng ban (kèm `DepartmentOrgChart`) |
| `PositionsPage` | `/settings/positions` | ✅ Quản lý chức vụ |
| `ContractTypesPage` | `/settings/contract-types` | ✅ **Chỉ đọc** – 4 loại hợp đồng là enum theo BLLĐ 2019, không thêm/sửa/xoá được |
| `LeaveTypesPage` | `/settings/leave-types` | ✅ Loại phép và số ngày được hưởng |
| `HolidaysPage` | `/settings/holidays` | ✅ Cấu hình ngày lễ trong năm |
| `UserManagePage` | – | ⏳ chưa có (backend mới có `POST /users`, chưa có `GET /users`) |
| `RolePermissionPage` | – | ⏳ chưa có |

> **Mã phòng ban / chức vụ / loại phép do server sinh** (`PB0001`, `CV0001`, `NP0001`) — form không có ô nhập `code`; `components/crud/GeneratedCodeField` hiển thị mã ở chế độ chỉ đọc.

---

## 5. Custom Hooks

Tất cả hooks đặt trong `hooks/`. Convention đặt tên: `use<Entity>` hoặc `use<Action>`.

> ⚠️ **Danh sách bên dưới là thiết kế dự kiến, không khớp code.** Hook thật đang có trong `src/hooks/`:
>
> | File | Export |
> |------|--------|
> | `useAuth.ts` | `useSessionRestore`, `useCurrentUser`, `useLogin`, `useLogout`, `useChangePassword`, `useForgotPassword`, `useResetPassword`, `AUTH_QUERY_KEYS` |
> | `useEmployees.ts` | `useEmployees`, `useEmployee`, `useEmployeeStats`, `useEmployeeSummary`, `useEmployeeMutations`, `useContracts`, `useFamilyMembers`, `useDependents`, `useRoles` |
> | `useEmployeeSearch.ts` | `useEmployeeSearch` (debounce 300ms) |
> | `useDepartments.ts` | `useDepartments`, `useDepartmentTree`, `useAllDepartments` |
> | `usePositions.ts` · `useLeaveTypes.ts` · `useHolidays.ts` · `useContractTypes.ts` | `usePositions`, `useLeaveTypes`, `useHolidays`, `useContractTypes` |
> | `useProvinces.ts` | `useProvinces`, `useWards` (**không có** `useDistricts` — cấp huyện đã bị bỏ) |
> | `useReports.ts` | `useExportEmployees` |
> | `usePermissions.ts` | `useHasRole` + `useCanWriteMasterData` / `useCanWriteEmployees` / `useCanDeleteEmployees` / `useCanWriteContracts` / `useCanCreateUsers` / `useCanExportEmployees` |
> | `useCrudResource.ts` · `useCrudScreen.ts` | Bộ khung dùng chung cho màn hình master data |
> | `useTableQuery.ts` | Đọc/ghi `page`, `pageSize`, filter vào URL (`DEFAULT_PAGE_SIZE = 20`) |
> | `useApiErrorMessage.ts` | `useApiErrorMessage`, `useLoginErrorMessage` |
>
> Khác biệt đáng chú ý: **mutation gộp trong `useEmployeeMutations()`** chứ không tách `useCreateEmployee` / `useUpdateEmployee` / `useDeleteEmployee`; backend dùng **`PATCH`**, không phải `PUT`; và các hook nghỉ phép / lương (`useLeaveRequests`, `usePayrolls`…) **chưa tồn tại** vì module tương ứng thuộc giai đoạn sau.

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
| `user` | `AuthUser \| null` | Thông tin user đang đăng nhập |
| `isAuthenticated` | `boolean` | Đặt cùng lúc với token/user |
| `sessionChecked` | `boolean` | Đã thử khôi phục phiên ngầm trong vòng đời trang này chưa |

Actions: `setAuth(token, user)`, `setAccessToken(token)`, `setUser(user)`, `markSessionChecked()`, `clearAuth()`.

> `setAccessToken` **không** đụng tới `user`: `POST /auth/refresh` không chắc trả về user, ghi đè `undefined` sẽ đăng xuất người dùng ở mỗi lần refresh ngầm. `authStore` **không** dùng `persist` (token chỉ nằm trong memory).

### uiStore

| State | Kiểu | Mô tả |
|-------|------|-------|
| `sidebarCollapsed` | `boolean` | Sidebar thu gọn hay không |
| `locale` | `'vi' \| 'en'` | Ngôn ngữ hiển thị |
| `theme` | `'light' \| 'dark'` | Giao diện |

Actions: `toggleSidebar()`, `setSidebarCollapsed(collapsed)`, `setLocale(locale)`, `setTheme(theme)`.

**Toàn bộ** `uiStore` (gồm cả `sidebarCollapsed`) được persist vào localStorage qua `zustand/middleware/persist`, key `hrm-ui-store`.

### tabsStore

State thanh tab đang mở: `tabs: OpenTab[]` với các action `openTab`, `closeTab`, `closeOthers`, `closeAll`.

**Cố ý KHÔNG persist:** tab mô tả "việc đang làm ngay lúc này"; khôi phục lại một mớ tab cũ sau một ngày vắng mặt là nhiễu chứ không phải trợ giúp.

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

---

*Cập nhật: 19/08/2026 – Version 1.1 – Đối chiếu với code sau Giai đoạn 0–3: §3 map tên component thật (crud/DataTableCard, TableSearch, RowActions, employees/AvatarUploader, EmployeeStatusTag; CurrencyDisplay/DateDisplay là hàm trong utils/format.ts), sửa 6 giá trị employees.status và endpoint avatar; §4 đánh dấu module chưa có + page/tab thật; §5 liệt kê hook thật (useEmployeeMutations gộp, PATCH không phải PUT, không có useDistricts); §6 bổ sung sessionChecked, tabsStore, phạm vi persist*
