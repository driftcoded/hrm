/**
 * Sinh `vn-provinces.json` + `vn-wards.json` từ danh mục hành chính chính thống
 * của cơ quan thuế (`Danh-sach-Phuong-xa-moi-2025.xlsx`, sheet "DM Phường xã mới").
 *
 * CHẠY LẠI KHI NÀO: chỉ khi có danh mục hành chính mới. Dữ liệu sinh ra được
 * commit vào repo — app KHÔNG gọi API bên ngoài lúc chạy, vì đây là dữ liệu hồ
 * sơ nhân sự và không được phụ thuộc một dịch vụ thứ ba còn sống hay không.
 *
 *   npx ts-node scripts/build-vn-admin-data.ts <đường-dẫn-file.csv>
 *
 * VÌ SAO DÙNG FILE NÀY THAY VÌ provinces.open-api.vn:
 * file của cơ quan thuế mang 3 thứ mà API cộng đồng không có —
 *   1. `Mã tỉnh (BNV)` 01–34: hệ mã hành chính MỚI sau sáp nhập 01/07/2025.
 *   2. `Mã phường/xã mới` dạng TMS: đúng mã hệ thống thuế dùng, nên số liệu
 *      quyết toán thuế TNCN ở Giai đoạn 6 không phải map thêm một lần nữa.
 *   3. `Mã/Tên Quận huyện TMS (cũ)`: ánh xạ về cấp huyện ĐÃ BỊ BỎ, giúp đọc
 *      được hồ sơ nhân viên tuyển trước 01/07/2025 thay vì vứt dữ liệu đi.
 *
 * ĐỘ TIN CẬY: đã đối chiếu với provinces.open-api.vn v2 (nguồn độc lập) —
 * 34/34 tỉnh khớp, 0 tỉnh lệch số lượng xã/phường, 3.310/3.321 tên khớp tuyệt
 * đối. 11 tên còn lại chỉ khác dấu gạch nối / chính tả (`alba` ↔ `al ba`,
 * `Lục Sỹ Thành` ↔ `Lục Si Thành`), không phải khác đơn vị hành chính.
 */

import { createReadStream } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { createInterface } from 'readline';
import { dirname, resolve } from 'path';

/** Thư mục đích – cùng chỗ với `vn-provinces.json` mà app đang đọc. */
const OUTPUT_DIR = resolve(__dirname, '..', 'src', 'common', 'data');

const HEADER_ROW_INDEX = 2;

interface ProvinceRecord {
  /** Mã BNV mới, 2 chữ số, "01"–"34". */
  code: string;
  name: string;
  type: 'city' | 'province';
  /** Mã tỉnh trong hệ thống thuế (TMS), ví dụ "101". */
  tmsCode: string;
}

interface WardRecord {
  /** Mã TMS của phường/xã, ví dụ "10105001". */
  code: string;
  name: string;
  /** `ProvinceRecord.code`. */
  provinceCode: string;
  type: 'phuong' | 'xa' | 'dac_khu';
  /**
   * Quận/huyện cũ mà phường/xã này tách ra — cấp huyện đã bị bỏ từ 01/07/2025
   * (Luật 72/2025/QH15). Giữ lại CHỈ để đọc/đối chiếu hồ sơ cũ, không dùng để
   * nhập liệu mới.
   */
  legacyDistrictCode: string;
  legacyDistrictName: string;
}

/** Parser CSV tối giản, đủ cho file này: có dấu ngoặc kép và dấu phẩy trong ô. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // "" bên trong ô = một dấu ngoặc kép thật.
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }

  cells.push(cell);
  return cells.map((value) => value.trim());
}

/**
 * File nguồn ghi tên tỉnh không nhất quán ("Thành phố Hà Nội" nhưng
 * "Tp Hải Phòng"). Chuẩn hoá về một kiểu để dropdown không nhìn như dữ liệu vá.
 */
function normalizeProvinceName(raw: string): { name: string; type: 'city' | 'province' } {
  const value = raw.replace(/\s+/g, ' ').trim();

  if (/^(tp\.?|thành phố)\s+/i.test(value)) {
    return {
      name: `Thành phố ${value.replace(/^(tp\.?|thành phố)\s+/i, '')}`,
      type: 'city',
    };
  }

  return { name: value.replace(/^tỉnh\s+/i, 'Tỉnh '), type: 'province' };
}

function classifyWard(name: string): WardRecord['type'] {
  if (/^phường\s/i.test(name)) return 'phuong';
  if (/^đặc khu\s/i.test(name)) return 'dac_khu';
  return 'xa';
}

async function main(): Promise<void> {
  const source = process.argv[2];

  if (!source) {
    throw new Error(
      'Thiếu đường dẫn file CSV.\n' +
        '  npx ts-node scripts/build-vn-admin-data.ts "<file>.csv"',
    );
  }

  const stream = createInterface({
    input: createReadStream(resolve(source), { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let index = 0;
  let columns: Record<string, number> = {};
  const provinces = new Map<string, ProvinceRecord>();
  const wards: WardRecord[] = [];
  const seenWardCodes = new Set<string>();

  for await (const line of stream) {
    const cells = parseCsvLine(line);

    if (index === HEADER_ROW_INDEX) {
      columns = Object.fromEntries(
        cells.map((header, position) => [header, position]).filter(([header]) => header !== ''),
      ) as Record<string, number>;
      index++;
      continue;
    }

    if (index < HEADER_ROW_INDEX) {
      index++;
      continue;
    }

    index++;

    /**
     * Tra ô theo TIỀN TỐ của tiêu đề, không phải khớp tuyệt đối: file nguồn có
     * cột tên `"Mã Quận huyện TMS (cũ) CQT đã rà soát"` — phần đuôi là ghi chú
     * quy trình của cơ quan thuế và rất dễ đổi ở bản phát hành sau. Khớp tuyệt
     * đối sẽ âm thầm trả về chuỗi rỗng thay vì báo lỗi.
     */
    const at = (headerPrefix: string): string => {
      const key = Object.keys(columns).find((header) => header.startsWith(headerPrefix));
      if (key === undefined) {
        throw new Error(
          `Không tìm thấy cột bắt đầu bằng "${headerPrefix}". Cột có trong file: ${Object.keys(columns).join(' | ')}`,
        );
      }
      return cells[columns[key]]?.trim() ?? '';
    };
    const wardName = at('Tên Phường/Xã mới');

    // Bỏ dòng trống ở cuối file / dòng phân cách.
    if (!wardName) {
      continue;
    }

    const provinceCode = at('Mã tỉnh (BNV)').padStart(2, '0');
    const { name, type } = normalizeProvinceName(at('Tên tỉnh/TP mới'));

    if (!provinces.has(provinceCode)) {
      provinces.set(provinceCode, {
        code: provinceCode,
        name,
        type,
        tmsCode: at('Mã tỉnh (TMS)'),
      });
    }

    const wardCode = at('Mã phường/xã mới');

    // Mã phải là duy nhất toàn quốc: nó sẽ là khoá ghi vào `employees.ward_code`.
    if (seenWardCodes.has(wardCode)) {
      throw new Error(`Mã phường/xã bị trùng trong file nguồn: ${wardCode} (${wardName})`);
    }
    seenWardCodes.add(wardCode);

    wards.push({
      code: wardCode,
      name: wardName.replace(/\s+/g, ' '),
      provinceCode,
      type: classifyWard(wardName),
      legacyDistrictCode: at('Mã Quận huyện'),
      legacyDistrictName: at('Tên Quận huyện'),
    });
  }

  const provinceList = [...provinces.values()].sort((a, b) => a.code.localeCompare(b.code));
  wards.sort((a, b) => a.code.localeCompare(b.code));

  // Kiểm tra chốt chặn: con số phải khớp danh mục chính thức, nếu không thì
  // file nguồn đã đổi và người chạy script cần biết NGAY.
  if (provinceList.length !== 34) {
    throw new Error(`Cần đúng 34 tỉnh/thành, file nguồn cho ${provinceList.length}`);
  }
  if (wards.length !== 3321) {
    throw new Error(`Cần đúng 3.321 phường/xã/đặc khu, file nguồn cho ${wards.length}`);
  }

  const orphans = wards.filter((ward) => !provinces.has(ward.provinceCode));
  if (orphans.length > 0) {
    throw new Error(`${orphans.length} phường/xã trỏ tới mã tỉnh không tồn tại`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    resolve(OUTPUT_DIR, 'vn-provinces.json'),
    `${JSON.stringify(provinceList, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    resolve(OUTPUT_DIR, 'vn-wards.json'),
    `${JSON.stringify(wards, null, 2)}\n`,
    'utf8',
  );

  const byType = wards.reduce<Record<string, number>>((accumulator, ward) => {
    accumulator[ward.type] = (accumulator[ward.type] ?? 0) + 1;
    return accumulator;
  }, {});

  console.log(`Đã ghi vào ${dirname(resolve(OUTPUT_DIR, 'vn-wards.json'))}`);
  console.log(`  vn-provinces.json : ${provinceList.length} tỉnh/thành`);
  console.log(
    `  vn-wards.json     : ${wards.length} đơn vị ` +
      `(phường ${byType.phuong ?? 0} / xã ${byType.xa ?? 0} / đặc khu ${byType.dac_khu ?? 0})`,
  );
}

main().catch((error: unknown) => {
  console.error('Sinh dữ liệu thất bại:', error instanceof Error ? error.message : error);
  process.exit(1);
});
