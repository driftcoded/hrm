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
- `npm run seed` – Seed master data (tỉnh/huyện/xã, ngày lễ, roles)

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
  "message": "...",
  "timestamp": "ISO-8601"
}
Lỗi xử lý qua HttpExceptionFilter, KHÔNG throw Error trần.

## Validation chuẩn Việt Nam (BẮT BUỘC)
- CCCD: 12 chữ số (`/^\d{12}$/`)
- Mã số thuế: 10 hoặc 13 số (`/^\d{10}(-\d{3})?$/`)
- Số sổ BHXH: 10 chữ số
- SĐT: định dạng +84xxxxxxxxx hoặc 0xxxxxxxxx
- Email: chuẩn RFC 5322
- Họ tên: cho phép dấu tiếng Việt, tối thiểu 2 từ

## Domain knowledge – Tính lương VN
Tỷ lệ NLĐ đóng: BHXH 8%, BHYT 1.5%, BHTN 1% (tổng 10.5%)
Thuế TNCN biểu lũy tiến 7 bậc (5% → 35%)
Giảm trừ bản thân: 11tr/tháng. Người phụ thuộc: 4.4tr/người/tháng
Xem chi tiết: docs/vn-business-rules.md

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