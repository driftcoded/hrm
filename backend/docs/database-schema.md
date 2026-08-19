# Database Schema – HRM Việt Nam

> **Hệ quản trị:** MySQL 8.0+ · **Charset:** utf8mb4 · **Timezone:** Asia/Ho_Chi_Minh (UTC+7)
> **Soft delete:** Các bảng chính dùng cột `deleted_at` thay vì xoá vật lý.
> **Quy ước:** `snake_case` cho tên bảng và cột · `BIGINT UNSIGNED` cho mọi khoá chính · `DECIMAL(15,2)` cho tiền VNĐ.

---

## Mục lục

1. [Sơ đồ quan hệ (ERD)](#sơ-đồ-quan-hệ-erd)
2. [Nhóm 1 – Xác thực & Phân quyền](#nhóm-1--xác-thực--phân-quyền)
3. [Nhóm 2 – Tổ chức & Nhân viên](#nhóm-2--tổ-chức--nhân-viên)
4. [Nhóm 3 – Gia đình & Người phụ thuộc](#nhóm-3--gia-đình--người-phụ-thuộc)
5. [Nhóm 4 – Hợp đồng lao động](#nhóm-4--hợp-đồng-lao-động)
6. [Nhóm 5 – Chấm công & Nghỉ phép](#nhóm-5--chấm-công--nghỉ-phép)
7. [Nhóm 6 – Lương & Phúc lợi](#nhóm-6--lương--phúc-lợi)
8. [Nhóm 7 – Đào tạo & Phát triển](#nhóm-7--đào-tạo--phát-triển)
9. [Nhóm 8 – Đánh giá & Kỷ luật](#nhóm-8--đánh-giá--kỷ-luật)
10. [Nhóm 9 – Tài liệu & Hệ thống](#nhóm-9--tài-liệu--hệ-thống)
11. [Thứ tự Migration](#thứ-tự-migration)
12. [Seed Data cần chuẩn bị](#seed-data-cần-chuẩn-bị)

---

## Sơ đồ quan hệ (ERD)

```
roles ──────────────── role_permissions ──── permissions
  │
users ──── employees ──┬── departments (self-ref, có manager_id)
                       ├── positions
                       ├── contracts
                       ├── attendances ──── leave_requests
                       ├── leave_requests ── leave_types
                       ├── leave_balances ── leave_types
                       ├── salaries ──────── salary_components
                       ├── dependents
                       ├── family_members
                       ├── work_history
                       ├── employee_trainings ── trainings
                       ├── performance_reviews
                       ├── disciplines_rewards
                       └── documents

holidays    (standalone – lịch nghỉ lễ VN)
audit_logs  (standalone – ghi log mọi thao tác, chỉ INSERT)
announcements (standalone – thông báo nội bộ)
```

---

## Nhóm 1 – Xác thực & Phân quyền

### 1.1. `roles` – Vai trò hệ thống

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính (TINYINT – tối đa 255 roles) |
| name | text (50) | ✅ | Tên kỹ thuật, duy nhất: `admin` · `hr_manager` · `hr_staff` · `manager` · `employee` |
| display_name | text (100) | ✅ | Tên hiển thị tiếng Việt |
| description | văn bản dài | ❌ | Mô tả quyền hạn |
| is_active | boolean | ✅ | Mặc định `true` |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |

**Seed mặc định:**

| id | name | display_name |
|----|------|--------------|
| 1 | admin | Quản trị hệ thống |
| 2 | hr_manager | Trưởng phòng Nhân sự |
| 3 | hr_staff | Nhân viên Nhân sự |
| 4 | manager | Quản lý phòng ban |
| 5 | employee | Nhân viên |

---

### 1.2. `permissions` – Quyền hạn

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính (SMALLINT) |
| module | text (50) | ✅ | Module: `employees` · `departments` · `salaries` · `leaves` · `reports` … |
| action | text (50) | ✅ | Hành động: `create` · `read` · `update` · `delete` · `approve` · `export` |
| name | text (100) | ✅ | Duy nhất, dạng `module:action` – ví dụ: `employees:create` |
| description | text (255) | ❌ | Mô tả ngắn |

---

### 1.3. `role_permissions` – Mapping vai trò ↔ quyền

Bảng trung gian many-to-many giữa `roles` và `permissions`. Không có cột riêng ngoài 2 khoá ngoại.

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| role_id | FK → roles | ✅ | Xoá vai trò thì xoá luôn mapping (CASCADE) |
| permission_id | FK → permissions | ✅ | Xoá quyền thì xoá luôn mapping (CASCADE) |

---

### 1.4. `users` – Tài khoản đăng nhập

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| username | text (50) | ✅ | Duy nhất, dùng để đăng nhập |
| email | text (100) | ✅ | Duy nhất |
| password | text (255) | ✅ | **bcrypt hash** – salt rounds 10. Không bao giờ lưu plaintext |
| role_id | FK → roles | ✅ | Mặc định `5` (employee) |
| employee_id | FK → employees | ❌ | Duy nhất. `NULL` nếu tài khoản chưa liên kết hồ sơ nhân viên |
| status | enum | ✅ | `active` · `inactive` · `locked`. Mặc định `active` |
| last_login_at | thời điểm | ❌ | Cập nhật mỗi lần đăng nhập thành công |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |
| deleted_at | thời điểm | ❌ | Soft delete |

> ⚠️ Không log giá trị cột `password` ra console hay file log.

---

### 1.5. `refresh_tokens` – JWT Refresh Token

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| user_id | FK → users | ✅ | Xoá user thì xoá token (CASCADE) |
| token_hash | text (255) | ✅ | SHA-256 hash của token thực. Duy nhất |
| device | text (255) | ❌ | User-Agent rút gọn, lưu để phân biệt thiết bị |
| ip_address | text (45) | ❌ | IPv4 hoặc IPv6 |
| expires_at | thời điểm | ✅ | Thời điểm hết hạn (mặc định 7 ngày) |
| revoked_at | thời điểm | ❌ | Không NULL khi đã bị thu hồi (logout, đổi mật khẩu) |
| created_at | thời điểm | ✅ | Tự động |

**Lý do lưu DB:** Cho phép revoke token khi logout, đổi mật khẩu, hoặc phát hiện đăng nhập bất thường.

---

## Nhóm 2 – Tổ chức & Nhân viên

### 2.1. `departments` – Phòng ban

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| code | text (20) | ✅ | Duy nhất. Ví dụ: `IT` · `HR` · `FIN` · `SALE` |
| name | text (150) | ✅ | Tên đầy đủ: "Phòng Công nghệ thông tin" |
| description | văn bản dài | ❌ | – |
| parent_id | FK → departments | ❌ | `NULL` nếu là phòng ban gốc. Self-reference để tạo cây tổ chức |
| manager_id | FK → employees | ❌ | Trưởng phòng. FK này được thêm sau khi tạo bảng `employees` (tránh circular) |
| sort_order | số nhỏ | ✅ | Thứ tự hiển thị trong danh sách. Mặc định `0` |
| is_active | boolean | ✅ | Mặc định `true` |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |
| deleted_at | thời điểm | ❌ | Soft delete |

---

### 2.2. `positions` – Chức vụ

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| code | text (20) | ✅ | Duy nhất. Ví dụ: `DEV_JUNIOR` · `PM_SENIOR` |
| name | text (150) | ✅ | Tên chức vụ đầy đủ |
| department_id | FK → departments | ✅ | Phòng ban sở hữu chức vụ này |
| level | số nhỏ | ✅ | Cấp bậc: `1` Staff · `2` Senior · `3` Lead · `4` Manager · `5` Director |
| min_salary | tiền VNĐ | ❌ | Lương tối thiểu theo thang bảng lương |
| max_salary | tiền VNĐ | ❌ | Lương tối đa |
| description | văn bản dài | ❌ | – |
| is_active | boolean | ✅ | Mặc định `true` |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |
| deleted_at | thời điểm | ❌ | Soft delete |

---

### 2.3. `employees` – Hồ sơ nhân viên *(bảng trung tâm)*

#### Định danh

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| employee_code | text (20) | ✅ | Duy nhất. Auto-generate: `NV0001`, `NV0002`… |

#### Thông tin cá nhân

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| last_name | text (50) | ✅ | Họ: Nguyễn, Trần, Lê… |
| first_name | text (50) | ✅ | Tên đệm + Tên: "Văn An" |
| full_name | text (100) | ✅ | Họ và tên đầy đủ – tự ghép từ last + first |
| date_of_birth | ngày | ✅ | Tuổi hợp lệ: 15–70 tuổi |
| gender | enum | ✅ | `male` · `female` · `other` |
| marital_status | enum | ✅ | `single` · `married` · `divorced` · `widowed`. Mặc định `single` |
| nationality | text (50) | ✅ | Mặc định `Việt Nam` |
| ethnicity | text (50) | ✅ | Dân tộc. Mặc định `Kinh` |
| religion | text (50) | ❌ | Tôn giáo. `NULL` = Không |
| place_of_birth | text (255) | ✅ | Nơi sinh |
| hometown | text (255) | ✅ | Quê quán (tỉnh/huyện/xã) |

#### Giấy tờ tuỳ thân

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| cccd_number | text (12) | ✅ | **Duy nhất.** CCCD 12 số, validate `/^\d{12}$/` |
| cccd_issue_date | ngày | ✅ | Ngày cấp CCCD |
| cccd_issue_place | text (255) | ✅ | Nơi cấp: "Cục CS QLHC về TTXH tỉnh X" |
| cccd_expired_date | ngày | ❌ | Hạn dùng (CCCD gắn chip). Loại cũ = `NULL` |

#### Mã số thuế & Bảo hiểm

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| tax_code | text (13) | ❌ | Duy nhất. MST cá nhân: 10 hoặc 13 chữ số |
| social_insurance_no | text (15) | ❌ | Duy nhất. Số sổ BHXH – 10 chữ số |
| health_insurance_no | text (15) | ❌ | Duy nhất. Số thẻ BHYT – 15 ký tự |
| health_insurance_exp | ngày | ❌ | Ngày hết hạn thẻ BHYT |

#### Địa chỉ

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| permanent_address | text (500) | ✅ | Hộ khẩu thường trú – địa chỉ đầy đủ |
| current_address | text (500) | ❌ | Chỗ ở hiện tại. `NULL` = giống thường trú |
| province_code | text (10) | ✅ | Mã tỉnh/thành phố theo Bộ Nội Vụ — **34 tỉnh/thành** sau sáp nhập 01/07/2025, mã `01`–`34` |
| district_code | text (10) | ❌ | ⚠️ **ĐÃ LỖI THỜI.** Cấp huyện chấm dứt hoạt động từ 01/07/2025 (Luật 72/2025/QH15). Cột giữ lại NULLABLE chỉ để đọc hồ sơ tuyển trước mốc đó — xem migration `MakeDistrictCodeNullable` |
| ward_code | text (10) | ✅ | Mã phường/xã/đặc khu theo danh mục cơ quan thuế (TMS), ví dụ `10105001`. Cả nước 3.321 đơn vị |

#### Liên lạc

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| phone | text (15) | ✅ | Validate: `0xxxxxxxxx` hoặc `+84xxxxxxxxx` |
| email | text (100) | ✅ | **Duy nhất.** Email công ty, chuẩn RFC 5322 |
| personal_email | text (100) | ❌ | Email cá nhân |
| emergency_contact_name | text (100) | ❌ | Tên người liên lạc khẩn cấp |
| emergency_contact_phone | text (15) | ❌ | SĐT người liên lạc khẩn cấp |
| emergency_contact_rel | text (50) | ❌ | Quan hệ: Vợ/Chồng, Bố, Mẹ… |

#### Ngân hàng

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| bank_account | text (30) | ❌ | Số tài khoản nhận lương |
| bank_name | text (100) | ❌ | Vietcombank, BIDV, Techcombank… |
| bank_branch | text (200) | ❌ | Chi nhánh cụ thể |

#### Thông tin công việc

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| position_id | FK → positions | ✅ | Chức vụ hiện tại |
| department_id | FK → departments | ✅ | Phòng ban hiện tại |
| direct_manager_id | FK → employees | ❌ | Quản lý trực tiếp. Self-reference. `NULL` = không có |
| hire_date | ngày | ✅ | Ngày vào làm (ngày ký hợp đồng đầu tiên) |
| probation_start_date | ngày | ❌ | Ngày bắt đầu thử việc |
| probation_end_date | ngày | ❌ | Ngày kết thúc thử việc |
| official_start_date | ngày | ❌ | Ngày trở thành nhân viên chính thức |
| termination_date | ngày | ❌ | Ngày nghỉ việc |
| termination_reason | văn bản dài | ❌ | Lý do nghỉ việc |
| termination_type | enum | ❌ | `resigned` · `fired` · `contract_ended` · `retired` · `deceased` |
| status | enum | ✅ | `probation` · `active` · `on_leave` · `suspended` · `resigned` · `terminated`. Mặc định `probation` |

#### Học vấn

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| education_level | enum | ❌ | `high_school` · `college` · `university` · `master` · `phd` · `other` |
| major | text (200) | ❌ | Chuyên ngành |
| university | text (200) | ❌ | Trường học |
| graduation_year | năm | ❌ | Năm tốt nghiệp |

#### Metadata

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| avatar_url | text (500) | ❌ | URL ảnh đại diện trên S3 |
| notes | văn bản dài | ❌ | Ghi chú nội bộ HR |
| created_by | FK → users | ❌ | Người tạo hồ sơ |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |
| deleted_at | thời điểm | ❌ | Soft delete |

> **Đơn vị hành chính — cập nhật 01/07/2025.** Việt Nam chuyển sang chính quyền
> địa phương **2 cấp** (Luật 72/2025/QH15): 34 tỉnh/thành → 3.321 phường/xã/đặc
> khu (2.621 xã + 687 phường + 13 đặc khu). Cấp huyện không còn.
>
> Danh mục nằm ở `src/common/data/vn-provinces.json` và `vn-wards.json`, sinh từ
> danh mục chính thống của cơ quan thuế bằng `scripts/build-vn-admin-data.ts`
> (đã đối chiếu chéo với provinces.open-api.vn v2: 34/34 tỉnh khớp, 0 tỉnh lệch
> số lượng, 3.310/3.321 tên khớp tuyệt đối). App KHÔNG gọi API ngoài lúc chạy.
>
> Mỗi phường/xã mang kèm `legacyDistrictCode`/`legacyDistrictName` để tra ngược
> hồ sơ cũ. Mã phường/xã dùng hệ TMS của cơ quan thuế, không phải mã GSO — để
> số liệu quyết toán thuế TNCN ở Giai đoạn 6 không phải map thêm một lần nữa.

**Validation tầng Application:**

| Trường | Quy tắc |
|--------|---------|
| cccd_number | Đúng 12 chữ số |
| tax_code | 10 hoặc 13 chữ số |
| social_insurance_no | Đúng 10 chữ số |
| phone | Bắt đầu bằng `0` hoặc `+84`, theo sau 9 chữ số |
| date_of_birth | Tuổi từ 15 đến 70, không phải tương lai |
| hire_date | Không được trước ngày sinh + 15 năm |
| email | Chuẩn RFC 5322 |

---

## Nhóm 3 – Gia đình & Người phụ thuộc

### 3.1. `family_members` – Thành viên gia đình

Lưu thông tin gia đình cho hồ sơ nhân sự (không liên quan đến giảm trừ thuế).

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| employee_id | FK → employees | ✅ | Xoá nhân viên thì xoá luôn (CASCADE) |
| full_name | text (100) | ✅ | Họ tên thành viên gia đình |
| relationship | enum | ✅ | `spouse` · `father` · `mother` · `child` · `sibling` · `other` |
| date_of_birth | ngày | ❌ | – |
| occupation | text (100) | ❌ | Nghề nghiệp |
| phone | text (15) | ❌ | – |
| cccd_number | text (12) | ❌ | CCCD nếu có |
| note | văn bản dài | ❌ | – |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |

---

### 3.2. `dependents` – Người phụ thuộc (giảm trừ gia cảnh)

> Căn cứ: Điều 19 Luật Thuế TNCN – mỗi người phụ thuộc hợp lệ giảm **4.400.000 VNĐ/tháng** tiền thuế.

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| employee_id | FK → employees | ✅ | Xoá nhân viên thì xoá luôn (CASCADE) |
| full_name | text (100) | ✅ | Họ tên người phụ thuộc |
| relationship | enum | ✅ | `child` · `spouse` · `parent` · `sibling` · `other` |
| date_of_birth | ngày | ✅ | Ngày sinh (để xác định đủ điều kiện) |
| cccd_number | text (12) | ❌ | CCCD nếu đã có |
| tax_code | text (13) | ❌ | MST người phụ thuộc nếu có |
| registration_date | ngày | ✅ | Ngày bắt đầu được tính giảm trừ |
| end_date | ngày | ❌ | Ngày hết giảm trừ (khi người phụ thuộc có thu nhập, qua đời…) |
| status | enum | ✅ | `active` · `inactive`. Mặc định `active` |
| reason_inactive | text (255) | ❌ | Lý do ngừng giảm trừ |
| document_url | text (500) | ❌ | Link giấy tờ chứng minh trên S3 |
| note | văn bản dài | ❌ | – |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |

---

## Nhóm 4 – Hợp đồng lao động

### 4.1. `contracts` – Hợp đồng lao động

> Căn cứ: Điều 20 BLLĐ 2019

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| employee_id | FK → employees | ✅ | Nhân viên ký hợp đồng |
| contract_number | text (50) | ✅ | Duy nhất. Ví dụ: `HDLD-2024-001` |
| contract_type | enum | ✅ | `probation` · `fixed_term` · `indefinite` · `seasonal` |
| start_date | ngày | ✅ | Ngày bắt đầu hiệu lực |
| end_date | ngày | ❌ | Ngày kết thúc. `NULL` nếu loại `indefinite` |
| sign_date | ngày | ✅ | Ngày ký |
| base_salary | tiền VNĐ | ✅ | Lương cơ bản ghi trong hợp đồng |
| insurance_salary | tiền VNĐ | ✅ | Lương đóng bảo hiểm (thường bằng base_salary) |
| position_allowance | tiền VNĐ | ✅ | Phụ cấp chức vụ. Mặc định `0` |
| other_allowance | tiền VNĐ | ✅ | Phụ cấp khác. Mặc định `0` |
| working_hours | số thập phân | ✅ | Giờ làm việc/ngày. Mặc định `8.0` |
| working_days | số nhỏ | ✅ | Ngày làm việc/tuần. Mặc định `5` |
| probation_salary_pct | số thập phân | ❌ | % lương thử việc (tối thiểu 85%). Mặc định `85.00` |
| status | enum | ✅ | `draft` · `active` · `expired` · `terminated`. Mặc định `draft` |
| terminated_date | ngày | ❌ | Ngày chấm dứt hợp đồng sớm |
| terminated_reason | văn bản dài | ❌ | Lý do chấm dứt |
| file_url | text (500) | ❌ | Link bản scan hợp đồng trên S3 |
| note | văn bản dài | ❌ | – |
| created_by | FK → users | ❌ | Người tạo hợp đồng |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |

**Quy tắc nghiệp vụ:**
- `probation`: tối đa 60 ngày (Điều 25 BLLĐ 2019).
- `fixed_term`: tối đa 36 tháng; ký tối đa 2 lần, sau đó phải chuyển sang `indefinite`.
- Khi đến `end_date`: tự động chuyển status → `expired` và gửi thông báo cho HR.

---

## Nhóm 5 – Chấm công & Nghỉ phép

### 5.1. `attendances` – Chấm công

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| employee_id | FK → employees | ✅ | – |
| work_date | ngày | ✅ | Ngày làm việc. **Unique** theo cặp (employee_id, work_date) |
| check_in | thời gian (HH:mm) | ❌ | Giờ chấm vào. `NULL` nếu không chấm vào |
| check_out | thời gian (HH:mm) | ❌ | Giờ chấm ra |
| work_hours | số thập phân | ❌ | Giờ làm thực tế – tính tự động khi check_out |
| overtime_hours | số thập phân | ✅ | Giờ làm thêm. Mặc định `0` |
| is_late | boolean | ✅ | Đến muộn > 15 phút. Mặc định `false` |
| late_minutes | số nhỏ | ✅ | Số phút đến muộn. Mặc định `0` |
| is_early_leave | boolean | ✅ | Về sớm > 15 phút. Mặc định `false` |
| early_leave_minutes | số nhỏ | ✅ | Số phút về sớm. Mặc định `0` |
| status | enum | ✅ | `present` · `absent` · `late` · `early_leave` · `leave` · `holiday` · `wfh`. Mặc định `present` |
| leave_request_id | FK → leave_requests | ❌ | Chỉ có giá trị khi `status = leave` |
| note | văn bản dài | ❌ | Ghi chú điều chỉnh |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |

---

### 5.2. `leave_types` – Loại nghỉ phép

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính (TINYINT) |
| code | text (20) | ✅ | Duy nhất. Ví dụ: `ANNUAL` · `SICK` · `MATERNITY` |
| name | text (100) | ✅ | Tên hiển thị tiếng Việt |
| days_per_year | số thập phân | ✅ | Số ngày/năm. `0` = không giới hạn hoặc tính theo case |
| is_paid | boolean | ✅ | Có hưởng lương không. Mặc định `true` |
| require_approval | boolean | ✅ | Cần phê duyệt không. Mặc định `true` |
| min_days | số thập phân | ✅ | Số ngày tối thiểu mỗi lần nghỉ. Mặc định `0.5` (nửa ngày) |
| max_consecutive | số nhỏ | ❌ | Số ngày liên tục tối đa. `NULL` = không giới hạn |
| advance_notice_days | số nhỏ | ✅ | Phải báo trước tối thiểu X ngày. Mặc định `1` |
| applicable_gender | enum | ✅ | `all` · `female` · `male`. Mặc định `all` |
| description | văn bản dài | ❌ | Mô tả, căn cứ pháp lý |
| is_active | boolean | ✅ | Mặc định `true` |
| sort_order | số nhỏ | ✅ | Thứ tự hiển thị. Mặc định `0` |

**Seed dữ liệu (căn cứ BLLĐ 2019 & Luật BHXH):**

| code | Tên | Ngày/năm | Hưởng lương | Căn cứ |
|------|-----|:--------:|:-----------:|--------|
| ANNUAL | Nghỉ phép năm | 12 | ✅ | Điều 113 BLLĐ 2019 |
| SICK | Nghỉ ốm | 30 | ✅ | Luật BHXH (BHXH chi trả) |
| MATERNITY | Nghỉ thai sản (mẹ) | 180 | ✅ | Điều 34 Luật BHXH |
| PATERNITY | Nghỉ thai sản (cha) | 5–14 | ✅ | Điều 34 Luật BHXH |
| MARRIAGE | Nghỉ kết hôn | 3 | ✅ | Điều 115 BLLĐ |
| CHILD_MARRIAGE | Con kết hôn | 1 | ✅ | Điều 115 BLLĐ |
| BEREAVEMENT | Nghỉ tang | 3 | ✅ | Điều 115 BLLĐ |
| UNPAID | Nghỉ không lương | 0 | ❌ | Điều 115 BLLĐ |
| COMPENSATORY | Nghỉ bù | 0 | ✅ | Khi làm thêm ngày lễ |

---

### 5.3. `leave_requests` – Đơn xin nghỉ

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| employee_id | FK → employees | ✅ | Người xin nghỉ |
| leave_type_id | FK → leave_types | ✅ | Loại nghỉ |
| start_date | ngày | ✅ | Ngày bắt đầu nghỉ |
| end_date | ngày | ✅ | Ngày kết thúc nghỉ |
| start_half | enum | ✅ | Buổi bắt đầu: `full` · `morning` · `afternoon`. Dùng cho nửa ngày đầu |
| end_half | enum | ✅ | Buổi kết thúc: `full` · `morning` · `afternoon`. Dùng cho nửa ngày cuối |
| total_days | số thập phân | ✅ | Số ngày nghỉ thực tế – tính tự động, trừ cuối tuần và ngày lễ |
| reason | văn bản dài | ✅ | Lý do nghỉ |
| status | enum | ✅ | `pending` · `approved` · `rejected` · `cancelled`. Mặc định `pending` |
| approved_by | FK → employees | ❌ | Người duyệt đơn (quản lý/HR) |
| approved_at | thời điểm | ❌ | Thời điểm duyệt |
| rejected_reason | văn bản dài | ❌ | Lý do từ chối |
| attachment_url | text (500) | ❌ | Giấy tờ đính kèm trên S3 (ví dụ: giấy ra viện) |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |

---

### 5.4. `leave_balances` – Số ngày phép còn lại

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| employee_id | FK → employees | ✅ | **Unique** theo cặp (employee_id, leave_type_id, year) |
| leave_type_id | FK → leave_types | ✅ | – |
| year | năm | ✅ | Năm áp dụng |
| allocated_days | số thập phân | ✅ | Số ngày được cấp trong năm |
| used_days | số thập phân | ✅ | Đã dùng. Mặc định `0` |
| pending_days | số thập phân | ✅ | Đang chờ duyệt. Mặc định `0` |
| carried_over | số thập phân | ✅ | Chuyển từ năm trước. Mặc định `0` |
| remaining_days | **Computed** | – | `= allocated_days + carried_over − used_days − pending_days` (Virtual column) |
| updated_at | thời điểm | ✅ | Tự động cập nhật |

> **Lưu ý:** `remaining_days` là cột computed (VIRTUAL), không lưu vật lý. Giá trị luôn chính xác theo công thức.

---

### 5.5. `holidays` – Lịch nghỉ lễ

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính (SMALLINT) |
| name | text (100) | ✅ | Tên ngày lễ |
| holiday_date | ngày | ✅ | Duy nhất |
| type | enum | ✅ | `national` · `company` · `other`. Mặc định `national` |
| year | năm | ✅ | Năm của ngày lễ |
| is_paid | boolean | ✅ | Có hưởng lương không. Mặc định `true` |
| note | text (255) | ❌ | – |

---

## Nhóm 6 – Lương & Phúc lợi

### 6.1. `salaries` – Bảng lương tháng

Mỗi nhân viên có tối đa **1 bản ghi/tháng** (unique theo employee_id + month + year).

#### Ngày công

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| employee_id | FK → employees | ✅ | – |
| month | số nhỏ | ✅ | Tháng (1–12) |
| year | năm | ✅ | Năm |
| standard_working_days | số thập phân | ✅ | Ngày công chuẩn của tháng (trừ T7, CN, lễ) |
| actual_working_days | số thập phân | ✅ | Ngày công thực tế. Mặc định `0` |
| paid_leave_days | số thập phân | ✅ | Ngày nghỉ phép có lương. Mặc định `0` |
| unpaid_leave_days | số thập phân | ✅ | Ngày nghỉ không lương. Mặc định `0` |
| overtime_hours | số thập phân | ✅ | Tổng giờ làm thêm trong tháng. Mặc định `0` |

#### Thu nhập

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| base_salary | tiền VNĐ | ✅ | Lương cơ bản tháng |
| position_allowance | tiền VNĐ | ✅ | Phụ cấp chức vụ. Mặc định `0` |
| attendance_allowance | tiền VNĐ | ✅ | Phụ cấp chuyên cần. Mặc định `0` |
| meal_allowance | tiền VNĐ | ✅ | Phụ cấp bữa ăn (≤ 730.000/tháng miễn thuế). Mặc định `0` |
| transport_allowance | tiền VNĐ | ✅ | Phụ cấp đi lại. Mặc định `0` |
| phone_allowance | tiền VNĐ | ✅ | Phụ cấp điện thoại. Mặc định `0` |
| other_allowances | tiền VNĐ | ✅ | Phụ cấp khác. Mặc định `0` |
| overtime_pay | tiền VNĐ | ✅ | Lương làm thêm giờ. Mặc định `0` |
| performance_bonus | tiền VNĐ | ✅ | Thưởng KPI tháng. Mặc định `0` |
| other_income | tiền VNĐ | ✅ | Thu nhập khác. Mặc định `0` |
| gross_salary | tiền VNĐ | ✅ | **Tổng thu nhập** trước khấu trừ |

#### Bảo hiểm (người lao động đóng)

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| insurance_base_salary | tiền VNĐ | ✅ | Lương đóng BHXH/BHYT/BHTN (sau khi áp trần) |
| social_insurance | tiền VNĐ | ✅ | BHXH 8%. Mặc định `0` |
| health_insurance | tiền VNĐ | ✅ | BHYT 1,5%. Mặc định `0` |
| unemployment_insurance | tiền VNĐ | ✅ | BHTN 1%. Mặc định `0` |
| total_insurance | tiền VNĐ | ✅ | Tổng BH = 10,5%. Mặc định `0` |

#### Thuế TNCN

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| dependent_count | số nhỏ | ✅ | Số người phụ thuộc tháng này. Mặc định `0` |
| self_deduction | tiền VNĐ | ✅ | Giảm trừ bản thân. Mặc định `11.000.000` |
| dependent_deduction | tiền VNĐ | ✅ | 4.400.000 × số NPT. Mặc định `0` |
| taxable_income | tiền VNĐ | ✅ | Thu nhập tính thuế. Mặc định `0` |
| personal_income_tax | tiền VNĐ | ✅ | Thuế TNCN phải nộp. Mặc định `0` |

#### Khấu trừ khác & Thực nhận

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| advance_deduction | tiền VNĐ | ✅ | Tạm ứng lương trong tháng. Mặc định `0` |
| other_deductions | tiền VNĐ | ✅ | Khấu trừ khác. Mặc định `0` |
| net_salary | tiền VNĐ | ✅ | **Lương thực nhận (NET)** |

#### Trạng thái & Phê duyệt

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| status | enum | ✅ | `draft` · `calculated` · `approved` · `paid` · `cancelled`. Mặc định `draft` |
| note | văn bản dài | ❌ | – |
| approved_by | FK → users | ❌ | Người phê duyệt bảng lương |
| approved_at | thời điểm | ❌ | Thời điểm phê duyệt |
| paid_at | thời điểm | ❌ | Ngày chuyển khoản lương |
| generated_by | FK → users | ❌ | Người chạy lệnh tính lương |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |

---

### 6.2. `salary_components` – Chi tiết từng khoản phụ cấp / khấu trừ

Lưu breakdown chi tiết từng dòng của phiếu lương, liên kết với `salaries`.

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| salary_id | FK → salaries | ✅ | Xoá bảng lương thì xoá luôn (CASCADE) |
| type | enum | ✅ | `allowance` · `bonus` · `deduction` · `other` |
| name | text (100) | ✅ | Tên khoản: "Phụ cấp ăn trưa", "Thưởng tháng 13"… |
| amount | tiền VNĐ | ✅ | Số tiền (dương = tăng lương, âm = khấu trừ) |
| is_taxable | boolean | ✅ | Tính vào thu nhập chịu thuế không? Mặc định `false` |
| note | text (255) | ❌ | – |

---

## Nhóm 7 – Đào tạo & Phát triển

### 7.1. `trainings` – Khoá đào tạo

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| code | text (30) | ✅ | Duy nhất. Ví dụ: `TRN-2026-001` |
| name | text (200) | ✅ | Tên khoá đào tạo |
| type | enum | ✅ | `internal` · `external` · `online` · `on_the_job` |
| description | văn bản dài | ❌ | Nội dung, mục tiêu |
| start_date | ngày | ❌ | – |
| end_date | ngày | ❌ | – |
| location | text (200) | ❌ | Địa điểm tổ chức |
| trainer | text (200) | ❌ | Tên giảng viên hoặc đơn vị đào tạo |
| cost | tiền VNĐ | ✅ | Chi phí. Mặc định `0` |
| max_participants | số nhỏ | ❌ | Số học viên tối đa. `NULL` = không giới hạn |
| status | enum | ✅ | `planned` · `ongoing` · `completed` · `cancelled`. Mặc định `planned` |
| attachment_url | text (500) | ❌ | Tài liệu đào tạo trên S3 |
| note | văn bản dài | ❌ | – |
| created_by | FK → users | ❌ | – |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |

---

### 7.2. `employee_trainings` – Nhân viên tham gia đào tạo

Bảng trung gian many-to-many giữa `employees` và `trainings`, có thêm thông tin kết quả.

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| employee_id | FK → employees | ✅ | **Unique** theo cặp (employee_id, training_id) |
| training_id | FK → trainings | ✅ | – |
| registration_date | ngày | ✅ | Ngày đăng ký. Mặc định ngày hiện tại |
| completion_date | ngày | ❌ | Ngày hoàn thành khoá học |
| result | enum | ❌ | `passed` · `failed` · `incomplete` · `exempted` |
| score | số thập phân | ❌ | Điểm số (nếu có thi) |
| certificate_url | text (500) | ❌ | Link chứng chỉ trên S3 |
| note | văn bản dài | ❌ | – |
| created_at | thời điểm | ✅ | Tự động |

---

## Nhóm 8 – Đánh giá & Kỷ luật

### 8.1. `performance_reviews` – Đánh giá hiệu suất

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| employee_id | FK → employees | ✅ | Người được đánh giá |
| reviewer_id | FK → employees | ✅ | Người đánh giá (quản lý trực tiếp) |
| review_period | enum | ✅ | `monthly` · `quarterly` · `biannual` · `annual` |
| period_year | năm | ✅ | Năm đánh giá |
| period_quarter | số nhỏ | ❌ | Quý (1–4). `NULL` nếu là annual |
| period_month | số nhỏ | ❌ | Tháng (1–12). `NULL` nếu là quarterly |
| kpi_score | số thập phân | ❌ | Điểm KPI (thang 0–100) |
| attitude_score | số thập phân | ❌ | Điểm thái độ (thang 0–100) |
| skill_score | số thập phân | ❌ | Điểm kỹ năng (thang 0–100) |
| overall_score | số thập phân | ❌ | Điểm tổng – tính tự động từ 3 điểm trên |
| rating | enum | ❌ | `excellent` · `good` · `average` · `below_average` · `poor` |
| strengths | văn bản dài | ❌ | Điểm mạnh |
| weaknesses | văn bản dài | ❌ | Điểm cần cải thiện |
| recommendations | văn bản dài | ❌ | Đề xuất (đào tạo, thăng chức…) |
| status | enum | ✅ | `draft` · `submitted` · `acknowledged`. Mặc định `draft` |
| acknowledged_at | thời điểm | ❌ | Thời điểm nhân viên xác nhận đã đọc |
| note | văn bản dài | ❌ | – |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |

---

### 8.2. `disciplines_rewards` – Khen thưởng & Kỷ luật

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| employee_id | FK → employees | ✅ | Đối tượng được khen/kỷ luật |
| type | enum | ✅ | `reward` (khen thưởng) · `discipline` (kỷ luật) |
| category | text (100) | ✅ | Phân loại cụ thể: "Thưởng KPI" · "Cảnh cáo" · "Khiển trách"… |
| title | text (255) | ✅ | Tiêu đề quyết định |
| description | văn bản dài | ✅ | Mô tả chi tiết lý do |
| decision_number | text (50) | ❌ | Số quyết định |
| decision_date | ngày | ✅ | Ngày ban hành quyết định |
| effective_date | ngày | ✅ | Ngày có hiệu lực |
| amount | tiền VNĐ | ❌ | Số tiền thưởng hoặc phạt (nếu có) |
| issued_by | FK → employees | ❌ | Người ký quyết định |
| document_url | text (500) | ❌ | Link quyết định trên S3 |
| note | văn bản dài | ❌ | – |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |

---

## Nhóm 9 – Tài liệu & Hệ thống

### 9.1. `work_history` – Lịch sử công tác

Ghi lại **mọi thay đổi quan trọng** trong sự nghiệp nhân viên tại công ty. Chỉ INSERT, không UPDATE.

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| employee_id | FK → employees | ✅ | – |
| event_type | enum | ✅ | `hire` · `promotion` · `demotion` · `transfer` · `salary_change` · `contract_renew` · `return_from_leave` · `termination` |
| from_department_id | FK → departments | ❌ | Phòng ban cũ (điều chuyển) |
| to_department_id | FK → departments | ❌ | Phòng ban mới |
| from_position_id | FK → positions | ❌ | Chức vụ cũ |
| to_position_id | FK → positions | ❌ | Chức vụ mới |
| from_salary | tiền VNĐ | ❌ | Lương cũ |
| to_salary | tiền VNĐ | ❌ | Lương mới |
| effective_date | ngày | ✅ | Ngày có hiệu lực |
| reason | văn bản dài | ❌ | Lý do thay đổi |
| decision_number | text (50) | ❌ | Số quyết định (nếu có) |
| document_url | text (500) | ❌ | Link quyết định trên S3 |
| created_by | FK → users | ❌ | Người ghi nhận |
| created_at | thời điểm | ✅ | Tự động |

---

### 9.2. `documents` – Tài liệu hồ sơ nhân viên

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| employee_id | FK → employees | ✅ | Xoá nhân viên thì xoá luôn (CASCADE) |
| type | enum | ✅ | `cccd` · `cv` · `degree` · `contract` · `health_check` · `background` · `photo_3x4` · `family_book` · `resignation` · `other` |
| name | text (200) | ✅ | Tên tài liệu: "CCCD mặt trước", "Bằng đại học"… |
| file_name | text (255) | ✅ | Tên file gốc |
| file_url | text (500) | ✅ | URL file trên S3 |
| file_size | số nguyên | ❌ | Kích thước file (bytes). Tối đa 10MB |
| mime_type | text (100) | ❌ | Ví dụ: `application/pdf` · `image/jpeg` |
| issue_date | ngày | ❌ | Ngày cấp tài liệu |
| expiry_date | ngày | ❌ | Ngày hết hạn (CCCD, giấy khám sức khoẻ…) |
| note | text (255) | ❌ | – |
| uploaded_by | FK → users | ❌ | Người upload |
| created_at | thời điểm | ✅ | Tự động |

---

### 9.3. `announcements` – Thông báo nội bộ

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| title | text (255) | ✅ | Tiêu đề thông báo |
| content | văn bản dài | ✅ | Nội dung chi tiết |
| type | enum | ✅ | `general` · `policy` · `event` · `urgent`. Mặc định `general` |
| target_audience | enum | ✅ | `all` · `department` · `role` · `individual`. Mặc định `all` |
| target_ids | json | ❌ | Danh sách ID đối tượng nhận: `[1, 2, 3]`. `NULL` khi `target_audience = all` |
| publish_date | thời điểm | ❌ | Thời điểm đăng. `NULL` = đăng ngay |
| expiry_date | thời điểm | ❌ | Thời điểm hết hiệu lực |
| is_pinned | boolean | ✅ | Ghim lên đầu danh sách. Mặc định `false` |
| attachment_url | text (500) | ❌ | File đính kèm trên S3 |
| created_by | FK → users | ✅ | Người đăng thông báo |
| created_at | thời điểm | ✅ | Tự động |
| updated_at | thời điểm | ✅ | Tự động cập nhật |

---

### 9.4. `audit_logs` – Nhật ký thao tác

> **Bảng này chỉ INSERT, tuyệt đối không UPDATE hay DELETE. Giữ tối thiểu 2 năm.**

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|:--------:|-------|
| id | ID tự tăng | ✅ | Khóa chính |
| user_id | FK → users | ❌ | `NULL` nếu hành động từ hệ thống (scheduler, import…) |
| action | text (50) | ✅ | `CREATE` · `UPDATE` · `DELETE` · `LOGIN` · `LOGOUT` · `EXPORT` |
| entity_type | text (50) | ✅ | Tên bảng: `employee` · `salary` · `contract` · `leave_request`… |
| entity_id | số nguyên | ❌ | ID bản ghi bị tác động |
| old_values | json | ❌ | Dữ liệu **trước** khi thay đổi (snapshot) |
| new_values | json | ❌ | Dữ liệu **sau** khi thay đổi |
| ip_address | text (45) | ❌ | IPv4 hoặc IPv6 |
| user_agent | text (500) | ❌ | Thông tin trình duyệt/thiết bị |
| description | văn bản dài | ❌ | Mô tả ngôn ngữ tự nhiên: "HR Lan cập nhật lương NV0051" |
| created_at | thời điểm | ✅ | Tự động |

---

## Thứ tự Migration

Tạo bảng theo thứ tự sau để tránh lỗi Foreign Key constraint:

1. `roles`
2. `permissions`
3. `role_permissions`
4. `users`
5. `refresh_tokens`
6. `departments` *(chưa thêm FK manager_id → employees)*
7. `positions`
8. `employees` → sau đó **ALTER** `departments` thêm FK `manager_id`
9. `family_members`
10. `dependents`
11. `contracts`
12. `leave_types`
13. `holidays`
14. `leave_requests`
15. `leave_balances`
16. `attendances`
17. `salaries`
18. `salary_components`
19. `trainings`
20. `employee_trainings`
21. `performance_reviews`
22. `disciplines_rewards`
23. `work_history`
24. `documents`
25. `announcements`
26. `audit_logs`

> Sau bước 8: `ALTER TABLE departments ADD CONSTRAINT fk_dept_manager FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;`

---

## Seed Data cần chuẩn bị

| File | Nội dung | Nguồn |
|------|----------|-------|
| seed-roles | 5 roles + permissions mặc định | Thiết kế ở trên |
| seed-leave-types | 9 loại nghỉ phép | BLLĐ 2019 + Luật BHXH |
| seed-holidays-2025 | Lịch nghỉ lễ năm 2025 | Nghị định 18/2024/NĐ-CP |
| seed-holidays-2026 | Lịch nghỉ lễ năm 2026 | Dự kiến theo quy định |
| seed-departments | Phòng ban mẫu (IT, HR, FIN, SALE, OPS) | Demo data |
| seed-positions | Chức vụ mẫu theo phòng ban | Demo data |
| seed-employees-demo | 10–15 nhân viên mẫu đủ case | Demo & testing |

---

*Cập nhật: 26/05/2026 – Version 1.2 – Bỏ SQL, viết lại dạng bảng mô tả*
