# HRM Backend – NestJS

## Tổng quan dự án
Hệ thống quản lý nhân sự (HRM) cho công ty Việt Nam.

## Bash commands
- `npm run start:dev` – Dev mode với hot reload
- `npm run build` – Build production
- `npm run lint` – ESLint check
- `npm run test` – Chạy unit test
- `npm run migration:generate -- src/database/migrations/<Name>`
- `npm run migration:run` – Apply migrations
- `npm run seed` – Seed master data: roles, ngày lễ, 9 loại nghỉ phép, users
  (KHÔNG seed tỉnh/xã: danh mục hành chính là file JSON tĩnh trong
  `src/common/data/`, và cấp huyện đã bị bỏ từ 01/07/2025)
- `npm run seed:demo` – Seed dữ liệu demo (phòng ban, chức vụ, nhân viên mẫu)
- `npm run seed:contract` – Seed hợp đồng cho nhân viên demo
- `npm run seed:attendance` – Seed bảng công 01/07–19/08/2026 (thêm `-- --reset` để
  xoá và sinh lại)
- `npm run seed:leave` – Seed đơn nghỉ phép 20/08–30/09/2026 (đã duyệt / chờ duyệt /
  bị từ chối). Chạy **qua LeaveRequestsService**, không insert SQL, nên quỹ phép và
  ngày công `leave` khớp đúng logic thật; `-- --reset` xoá qua service để hoàn quỹ.
  Cần `seed:demo` trước, và nên chạy SAU `seed:attendance` (khung ngày không giao
  nhau nên không có ngày công nào bị ghi đè)

## Code style
- TypeScript strict mode, không dùng `any` (dùng `unknown` nếu cần)
- Naming:
  - Files: kebab-case (`employee.service.ts`)
  - Classes: PascalCase (`EmployeeService`)
  - Variables/methods: camelCase
  - DB columns: snake_case (`employee_code`, `cccd_number`)
  - DTOs: `<Action><Entity>Dto` (`CreateEmployeeDto`, `UpdateLeaveDto`)
- KHÔNG dùng `default export`, luôn dùng named export
- Import absolute path qua `@/` (cấu hình trong tsconfig)

## Kiến trúc module (PHẢI tuân thủ)
Mỗi module theo pattern:
  controller → service → repository → entity
- Controller: CHỈ nhận request/response, validate DTO, không có business logic
- Service: TẤT CẢ business logic ở đây
- Repository: Truy vấn DB qua TypeORM
- KHÔNG gọi repository trực tiếp từ controller

## Response format (BẮT BUỘC)
Mọi response phải qua TransformInterceptor về format:
{
  "success": true,
  "data": {...},
  "timestamp": "ISO-8601"
}
Lỗi xử lý qua HttpExceptionFilter, KHÔNG throw Error trần:
{
  "success": false,
  "error": { "code": "SNAKE_CASE_CODE", "message": "English dev message" },
  "timestamp": "ISO-8601"
}
VALIDATION_ERROR thêm "details": [{ "field", "code", "message" }].
KHÔNG có "message" trong success response. "message" trong error dùng tiếng Anh cho log.

## Validation chuẩn Việt Nam (BẮT BUỘC)
- CCCD: 12 chữ số (`/^\d{12}$/`)
- Mã số thuế: 10 hoặc 13 số (`/^\d{10}(-\d{3})?$/`)
- Số sổ BHXH: 10 chữ số
- SĐT: định dạng +84xxxxxxxxx hoặc 0xxxxxxxxx
- Email: chuẩn RFC 5322
- Họ tên: cho phép dấu tiếng Việt, tối thiểu 2 từ

## Domain knowledge – Tính lương VN
Tỷ lệ NLĐ đóng: BHXH 8%, BHYT 1.5%, BHTN 1% (tổng 10.5%)
Thuế TNCN biểu lũy tiến **5 bậc** từ 01/01/2026 (Luật 109/2025/QH15): 5%/10%/20%/30%/35%
Giảm trừ bản thân: **15.5tr**/tháng. Người phụ thuộc: **6.2tr**/người/tháng (từ 01/01/2026)
Trần BHXH/BHYT = 20 × mức tham chiếu (2.34tr → 2.53tr từ 01/07/2026)
Xem chi tiết: docs/business-rules.md

## Bảo mật (NEVER violate)
- KHÔNG bao giờ commit `.env`
- Password BẮT BUỘC hash bcrypt salt rounds 10
- KHÔNG log password, token, CCCD ra console
- SQL query PHẢI dùng parameterized (TypeORM QueryBuilder)
- File `.env.example` luôn cập nhật khi thêm env mới

## Git workflow
- Branch: `feature/<ten-tinh-nang>`, `fix/<ten-loi>`
- Commit theo Conventional Commits:
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- PR PHẢI có description + screenshot test
- KHÔNG commit trực tiếp lên `main` hoặc `develop`

## Khi viết code mới, LUÔN
1. Đọc `docs/architecture.md` trước
2. Tạo DTO + validation trước, rồi mới đến logic
3. Viết unit test cho service
4. Cập nhật Swagger qua `@ApiOperation` decorator