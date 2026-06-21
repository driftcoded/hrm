# UI Conventions

**Phiên bản:** 1.0  
**Ngày cập nhật:** 19/06/2026  
**Design System:** Ant Design v5 + Custom Token

---

## 1. Design Tokens

Các giá trị gốc của hệ thống. Không dùng giá trị hardcode trong CSS — luôn dùng token.

### Màu sắc chính

| Token | Giá trị | Dùng cho |
|-------|---------|----------|
| `colorPrimary` | `#1677ff` | Button primary, link, focus ring |
| `colorSuccess` | `#52c41a` | Trạng thái hoạt động, đã duyệt |
| `colorWarning` | `#faad14` | Chờ duyệt, cảnh báo |
| `colorError` | `#ff4d4f` | Lỗi, đã từ chối, nghỉ việc |
| `colorInfo` | `#1677ff` | Thông báo thông tin |
| `colorTextBase` | `#000000` | Text chính |
| `colorBgBase` | `#ffffff` | Nền chính |

### Màu trạng thái nhân viên

| Trạng thái | Màu | AntD Badge color |
|------------|-----|-----------------|
| Đang làm việc | Xanh lá | `success` |
| Thử việc | Xanh dương | `processing` |
| Nghỉ thai sản / phép dài | Vàng | `warning` |
| Đã nghỉ việc | Đỏ | `error` |
| Đã nghỉ hưu | Xám | `default` |

### Typography

| Yếu tố | Font size | Font weight |
|--------|-----------|-------------|
| Page title (H1) | 24px | 600 |
| Section title (H2) | 20px | 600 |
| Card title (H3) | 16px | 600 |
| Body text | 14px | 400 |
| Label form | 14px | 500 |
| Caption / hint | 12px | 400 |
| Table header | 14px | 600 |

Font chính: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

### Spacing

Theo bội số 8px: `4 / 8 / 12 / 16 / 24 / 32 / 48px`

---

## 2. Ant Design Theme Configuration

Theme tùy chỉnh khai báo trong `main.tsx` qua `ConfigProvider`:

| Thuộc tính | Giá trị |
|-----------|---------|
| `borderRadius` | `6px` |
| `colorPrimary` | `#1677ff` |
| `fontFamily` | Hệ thống |
| `fontSize` | `14px` |
| `Table.colorFillAlter` | `#fafafa` |

---

## 3. Layout

### AppLayout

```
┌─────────────────────────────────────────┐
│ Header (64px)                            │
├──────────┬──────────────────────────────┤
│ Sidebar  │ Content                       │
│ (240px)  │                               │
│          │  ┌────────────────────────┐   │
│          │  │ PageHeader             │   │
│          │  │ (breadcrumb + actions) │   │
│          │  ├────────────────────────┤   │
│          │  │ Main content           │   │
│          │  │                        │   │
│          │  └────────────────────────┘   │
└──────────┴──────────────────────────────┘
```

Sidebar thu gọn còn 80px (chỉ hiện icon) khi người dùng click toggle.

### Page Header

Mỗi trang có `PageHeader` gồm:
- **Breadcrumb**: tối đa 3 cấp — Trang chủ > Module > Trang hiện tại
- **Tiêu đề trang**: font 20px, bold
- **Actions**: nằm bên phải — thường là nút "Thêm mới" + "Xuất Excel"

---

## 4. Form Conventions

### Layout form

| Loại form | Layout | Khi dùng |
|-----------|--------|----------|
| Trong modal | Vertical (label trên input) | Form ngắn ≤ 6 trường |
| Trang riêng | Horizontal (label bên trái, 6/18 col) | Form dài, nhiều section |
| Filter/search | Inline | Thanh tìm kiếm bảng dữ liệu |

### Quy tắc form

- Dùng `Form` của Ant Design — không dùng react-hook-form
- Mỗi trường có `label`, `name`, và `rules` validation
- Label kết thúc bằng dấu hai chấm: "Họ và tên:"
- Trường bắt buộc hiển thị dấu `*` màu đỏ (AntD tự xử lý)
- Placeholder dạng gợi ý: "Nhập họ và tên đầy đủ"
- Thông báo lỗi validation hiển thị ngay dưới input, màu đỏ

### Trường ngày tháng

- Dùng `DatePicker` của AntD với `format="DD/MM/YYYY"`
- Locale `vi_VN` từ `antd/locale/vi_VN`
- Không cho chọn ngày trong tương lai với ngày sinh
- Không cho chọn ngày trong quá khứ với ngày bắt đầu hợp đồng mới

### Nút Submit / Cancel

- Nút xác nhận (primary) luôn ở **bên phải**
- Nút hủy (default) luôn ở **bên trái** nút xác nhận
- Trong modal: align-right cả hai nút
- Khi đang xử lý: disable + hiện spinner trong nút primary

---

## 5. Table Conventions

### Cấu trúc chuẩn

Mỗi trang danh sách gồm:
1. **Filter bar** — bộ lọc phía trên bảng
2. **Action bar** — "Thêm mới", "Xuất Excel", đếm số bản ghi
3. **Table** — dữ liệu, có phân trang
4. **Pagination** — hiển thị tổng số bản ghi, chọn số hàng/trang

### Cột bắt buộc trong bảng nhân viên

| Cột | Chiều rộng | Ghi chú |
|-----|-----------|---------|
| STT | 60px | Số thứ tự, fixed left |
| Mã NV | 100px | Link đến chi tiết |
| Họ tên | 200px | Avatar + tên |
| Phòng ban | 150px | |
| Chức vụ | 150px | |
| Trạng thái | 120px | Badge màu |
| Thao tác | 120px | Icon xem / sửa / xóa, fixed right |

### Pagination

- Mặc định: 20 bản ghi/trang
- Tuỳ chọn: 10 / 20 / 50 / 100
- Luôn hiển thị tổng số: "Tổng X bản ghi"
- Lưu page hiện tại và pageSize vào URL query string: `?page=2&pageSize=20`

### Empty state

Khi bảng rỗng hiển thị icon minh hoạ + text "Chưa có dữ liệu" + nút "Thêm mới" (nếu user có quyền).

---

## 6. Định dạng Việt Nam

Tất cả hàm định dạng đặt trong `utils/format.ts`.

### Tiền tệ

| Giá trị | Hiển thị |
|---------|---------|
| 1000000 | `1.000.000 ₫` |
| 15500000 | `15.500.000 ₫` |
| -2000000 | `-2.000.000 ₫` |

Dùng dấu **chấm** (`.`) phân cách hàng nghìn, ký hiệu `₫` phía sau, không có dấu thập phân cho VND.

### Ngày tháng

| Format | Khi dùng |
|--------|---------|
| `DD/MM/YYYY` | Ngày sinh, ngày vào làm, ngày nghỉ |
| `DD/MM/YYYY HH:mm` | Timestamp chấm công, tạo hồ sơ |
| `MM/YYYY` | Kỳ lương (tháng/năm) |
| `Th X, YYYY` | Relative display (tháng 6, 2026) |

Dùng `dayjs` với locale `vi` — KHÔNG dùng `moment` hoặc `new Date()`.

### Số điện thoại

Hiển thị cách nhau: `0901 234 567` (nhóm 4-3-3).  
Lưu trong DB dạng: `0901234567`.

### CCCD / CMND

Trong danh sách: che giữa → `001***876543` (hiện 3 số đầu, 6 số cuối).  
Trong trang chi tiết cá nhân: hiện đầy đủ.

### Phần trăm

`85.5%` — dùng `%` không cách, tối đa 1 chữ số thập phân.

---

## 7. Loading & Empty States

### Loading

| Tình huống | Component |
|-----------|-----------|
| Tải trang lần đầu | `Skeleton` (placeholder hình dạng content) |
| Tải dữ liệu bảng | `Table loading={true}` (AntD tự render spinner) |
| Nút submit đang xử lý | `Button loading={true}` |
| Upload file | `Progress` bar |

Không dùng `Spin` (spinner tròn) cho trang — dễ gây layout shift.

### Empty State

| Tình huống | Hiển thị |
|-----------|---------|
| Bảng rỗng (chưa có dữ liệu) | Icon + "Chưa có dữ liệu" + nút tạo mới |
| Tìm kiếm không có kết quả | Icon tìm kiếm + "Không tìm thấy kết quả" |
| Lỗi tải dữ liệu | Icon lỗi + message lỗi + nút "Thử lại" |

---

## 8. Thông báo (Notification)

| Loại | AntD component | Khi dùng |
|------|---------------|---------|
| Thành công | `message.success()` | Lưu, xóa, duyệt thành công |
| Lỗi ngắn | `message.error()` | Lỗi validate, lỗi API nhẹ |
| Cảnh báo | `message.warning()` | Nhắc nhở, xác nhận hành động |
| Thông báo chi tiết | `notification.open()` | Thông báo có action button |
| Xác nhận xóa | `Modal.confirm()` | Trước khi xóa bản ghi |

Thời gian hiển thị `message`: 3 giây. `notification`: 5 giây.

---

## 9. Modal Conventions

- Chiều rộng: 520px (nhỏ), 720px (trung bình), 960px (lớn)
- Tiêu đề modal: động theo action — "Thêm nhân viên" / "Sửa thông tin nhân viên"
- Nút footer: "Lưu" (primary) + "Hủy" (default), align right
- Khi đang submit: disable cả hai nút, hiện spinner trong "Lưu"
- Không đóng modal khi click ra ngoài nếu form đã có dữ liệu (dùng `maskClosable={false}`)
- Form trong modal dùng layout `vertical`

---

## 10. Responsive Design

App HRM chủ yếu dùng trên desktop. Mobile chỉ hỗ trợ các tính năng cơ bản.

| Breakpoint | Chiều rộng | Hành vi |
|-----------|-----------|---------|
| Desktop | ≥ 1200px | Full layout, sidebar mở |
| Tablet | 768px – 1199px | Sidebar thu gọn (icon only) |
| Mobile | < 768px | Sidebar ẩn, drawer khi cần |

Dùng `useBreakpoint()` hook của AntD để điều chỉnh layout theo màn hình.

---

## 11. Accessibility

- Tất cả icon-only button phải có `title` hoặc `aria-label`
- Form input phải có `id` tương ứng với `htmlFor` của label
- Màu sắc không phải cách duy nhất để truyền tải thông tin — badge trạng thái có cả text
- Focus ring không bị ẩn (không override `outline: none` toàn cục)
- Keyboard navigation hoạt động với modal, dropdown, table row actions
