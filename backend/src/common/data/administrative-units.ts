import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Danh mục hành chính Việt Nam, đọc thẳng từ file CSV gốc của cơ quan thuế.
 *
 * NGUỒN LÀ CHÍNH FILE HỌ PHÁT HÀNH, không phải một bản JSON sinh lại từ nó.
 * Bản phái sinh thì phải nhớ sinh lại mỗi lần danh mục đổi, và không có gì báo
 * khi người ta quên — file gốc nằm ngay đây thì không có bước nào để quên.
 *
 * Cấp huyện đã chấm dứt hoạt động từ 01/07/2025 (Luật 72/2025/QH15): còn hai
 * cấp là 34 tỉnh/thành và 3.321 phường/xã/đặc khu. Cột "Quận huyện TMS (cũ)"
 * trong file chỉ để đối chiếu hồ sơ tuyển trước mốc đó.
 *
 * Mã phường/xã dùng hệ MÃ CƠ QUAN THUẾ (TMS), ví dụ `10105001`, chứ không phải
 * mã GSO: quyết toán thuế TNCN nộp theo mã này, dùng thẳng thì không phải map
 * thêm một lần nữa.
 *
 * Đọc và phân tích MỘT LẦN lúc nạp module — danh mục bất biến trong một lần
 * chạy, đọc lại mỗi request là phí.
 */

/** Tên file giữ nguyên nội dung bản phát hành `Danh-sach-Phuong-xa-moi-2025.xlsx`. */
const SOURCE_FILE = 'vn-administrative-units-2025.csv';

export interface Province {
  code: string;
  name: string;
  type: 'city' | 'province';
  /** Mã tỉnh trong hệ thống thuế, khác mã Bộ Nội vụ ở cột `code`. */
  tmsCode: string;
}

export interface Ward {
  code: string;
  name: string;
  provinceCode: string;
  type: 'phuong' | 'xa' | 'dac_khu';
  /** Quận/huyện CŨ mà đơn vị này tách ra — chỉ để đối chiếu hồ sơ cũ. */
  legacyDistrictCode: string;
  legacyDistrictName: string;
}

/** Cột trong file gốc, đếm từ 0. Dòng tiêu đề là dòng thứ ba. */
const COLUMN = {
  provinceCode: 2,
  provinceName: 3,
  provinceTmsCode: 4,
  legacyDistrictCode: 5,
  legacyDistrictName: 6,
  wardCode: 8,
  wardName: 9,
} as const;

/**
 * Tách một dòng CSV, có xử lý ô đặt trong nháy kép.
 *
 * Bản phát hành hiện tại không có ô nào cần nháy kép, nhưng một lần xuất lại từ
 * Excel là có thể có — tách bằng `split(',')` khi đó sẽ cắt đôi tên xã mà không
 * báo gì.
 */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      cells.push(cell);
      cell = '';
    } else {
      cell += character;
    }
  }

  cells.push(cell);

  return cells;
}

/**
 * Chuẩn hoá tên tỉnh/thành.
 *
 * File gốc viết không thống nhất: Hà Nội và Huế ghi đủ "Thành phố", còn Hải
 * Phòng, Đà Nẵng, TP.HCM và Cần Thơ ghi tắt "Tp". Để nguyên thì danh sách xổ
 * xuống trong form nhân viên có hai kiểu tên, và "Tp Hải Phòng" còn bị xếp
 * nhầm thành tỉnh.
 */
function normaliseProvinceName(name: string): string {
  return name.replace(/^(Tp\.?|TP\.?)\s+/, 'Thành phố ');
}

function provinceTypeOf(name: string): Province['type'] {
  return name.startsWith('Thành phố') ? 'city' : 'province';
}

function wardTypeOf(name: string): Ward['type'] {
  if (name.startsWith('Phường')) {
    return 'phuong';
  }

  if (name.startsWith('Xã')) {
    return 'xa';
  }

  if (name.startsWith('Đặc khu')) {
    return 'dac_khu';
  }

  /*
   * Dừng ngay lúc khởi động thay vì gán bừa một loại: tên không khớp tiền tố
   * nào nghĩa là bản phát hành đã đổi cấu trúc, và một danh mục hành chính sai
   * loại sẽ đi thẳng vào hồ sơ nhân viên.
   */
  throw new Error(
    `Không nhận ra loại đơn vị hành chính từ tên "${name}" trong ${SOURCE_FILE}`,
  );
}

function load(): { provinces: Province[]; wards: Ward[] } {
  const raw = readFileSync(join(__dirname, SOURCE_FILE), 'utf8');
  // `utf8` giữ lại BOM nếu Excel ghi kèm; bỏ đi trước khi tách cột.
  const lines = raw.replace(/^﻿/, '').split(/\r?\n/);

  const provinces = new Map<string, Province>();
  const wards: Ward[] = [];

  for (const line of lines) {
    const cells = splitCsvLine(line);
    const wardCode = cells[COLUMN.wardCode]?.trim();
    const wardName = cells[COLUMN.wardName]?.trim();

    // Bỏ qua hai dòng trống đầu file, dòng tiêu đề và dòng trống cuối.
    if (!wardCode || !wardName || !/^\d+$/.test(wardCode)) {
      continue;
    }

    const provinceCode = cells[COLUMN.provinceCode].trim();
    const provinceName = normaliseProvinceName(
      cells[COLUMN.provinceName].trim(),
    );

    if (!provinces.has(provinceCode)) {
      provinces.set(provinceCode, {
        code: provinceCode,
        name: provinceName,
        type: provinceTypeOf(provinceName),
        tmsCode: cells[COLUMN.provinceTmsCode].trim(),
      });
    }

    wards.push({
      code: wardCode,
      name: wardName,
      provinceCode,
      type: wardTypeOf(wardName),
      legacyDistrictCode: cells[COLUMN.legacyDistrictCode].trim(),
      legacyDistrictName: cells[COLUMN.legacyDistrictName].trim(),
    });
  }

  if (wards.length === 0) {
    throw new Error(`${SOURCE_FILE} không có dòng dữ liệu nào đọc được`);
  }

  // Sắp theo mã để thứ tự trả về ổn định, không phụ thuộc thứ tự dòng trong file.
  return {
    provinces: [...provinces.values()].sort((left, right) =>
      left.code.localeCompare(right.code),
    ),
    wards: wards.sort((left, right) => left.code.localeCompare(right.code)),
  };
}

const loaded = load();

export const PROVINCES: readonly Province[] = Object.freeze(loaded.provinces);
export const WARDS: readonly Ward[] = Object.freeze(loaded.wards);

/**
 * Gom sẵn theo tỉnh. Form nhân viên luôn lọc theo tỉnh, và quét tuyến tính
 * 3.321 phần tử cho mỗi lần đổi tỉnh là công vô ích.
 */
export const WARDS_BY_PROVINCE: Readonly<Record<string, readonly Ward[]>> =
  Object.freeze(
    WARDS.reduce<Record<string, Ward[]>>((accumulator, ward) => {
      (accumulator[ward.provinceCode] ??= []).push(ward);
      return accumulator;
    }, {}),
  );
