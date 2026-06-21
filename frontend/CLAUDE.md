# HRM Frontend – Vite + React + Ant Design

## Bash commands
- `npm run dev` – Vite dev server (http://localhost:5173)
- `npm run build` – Build production
- `npm run preview` – Preview production build
- `npm run lint` – ESLint + Prettier check

## Tech stack
React 18, TypeScript, Vite, Ant Design v5, React Router v6,
TanStack Query, Zustand, axios, dayjs (locale 'vi'), i18next.

## Folder rule (BẮT BUỘC)
- `pages/` – chỉ chứa route-level component
- `components/` – component tái sử dụng (KHÔNG fetch API ở đây)
- `services/` – axios calls, MỌI API call phải đi qua đây
- `hooks/` – custom hooks (`useEmployees`, `useAuth`)
- `store/` – Zustand stores
- `types/` – TypeScript interfaces dùng chung

## Code style
- Functional component + hooks (KHÔNG dùng class component)
- File: PascalCase cho component (`EmployeeList.tsx`), camelCase cho khác
- KHÔNG inline style, dùng AntD theme/token hoặc CSS module
- Form: dùng `Form` của AntD, KHÔNG dùng react-hook-form (đỡ conflict)
- Date: dùng `dayjs` với locale 'vi', KHÔNG dùng moment hoặc Date

## Format hiển thị (CHUẨN VN)
- Tiền tệ: `1.000.000 ₫` (dấu chấm phân cách hàng nghìn)
- Ngày: `DD/MM/YYYY` hoặc `DD/MM/YYYY HH:mm`
- Số CCCD: hiển thị che giữa `001***876543` ở danh sách
- SĐT: `0901 234 567` (cách 4-3-3)

## API call pattern
Mọi component KHÔNG fetch trực tiếp. Phải qua:
1. Định nghĩa service trong `services/employee.service.ts`
2. Wrap trong custom hook dùng TanStack Query
3. Component chỉ gọi hook

## Khi tạo trang mới, LUÔN
1. Tạo types trong `types/` trước
2. Tạo service trong `services/`
3. Tạo hook trong `hooks/`
4. Cuối cùng mới đến page/component
5. Thêm route vào `routes/RouterConfig.tsx`
6. Thêm menu item vào `Sidebar`

## i18n
Tất cả text hiển thị PHẢI qua `t('key')`, KHÔNG hardcode tiếng Việt
trong JSX. Keys định nghĩa ở `locales/vi.json`.