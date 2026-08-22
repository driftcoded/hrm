import { PROVINCES, WARDS, WARDS_BY_PROVINCE } from './administrative-units';

/**
 * Danh mục hành chính đọc từ CSV gốc.
 *
 * Bài kiểm này canh chính bước đọc file: một lần xuất lại từ Excel làm lệch cột
 * hay đổi cách viết tên sẽ hỏng lặng lẽ — hồ sơ nhân viên vẫn lưu được, chỉ là
 * lưu sai mã phường/xã.
 */
describe('administrative units', () => {
  it('đọc đủ 34 tỉnh/thành và 3.321 phường/xã/đặc khu', () => {
    expect(PROVINCES).toHaveLength(34);
    expect(WARDS).toHaveLength(3321);
  });

  it('phân loại đúng số lượng từng loại đơn vị', () => {
    const count = (type: string) =>
      WARDS.filter((ward) => ward.type === type).length;

    expect(count('phuong')).toBe(687);
    expect(count('xa')).toBe(2621);
    expect(count('dac_khu')).toBe(13);
  });

  it('viết đủ chữ "Thành phố" cho cả sáu thành phố trung ương', () => {
    const cities = PROVINCES.filter((province) => province.type === 'city');

    expect(cities).toHaveLength(6);
    // File gốc ghi tắt "Tp Hải Phòng"; danh sách trả ra phải thống nhất.
    expect(cities.map((city) => city.name)).toContain('Thành phố Hải Phòng');
    expect(PROVINCES.every((province) => !province.name.startsWith('Tp'))).toBe(
      true,
    );
  });

  it('mã phường/xã là duy nhất và đã sắp xếp', () => {
    const codes = WARDS.map((ward) => ward.code);

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual([...codes].sort((a, b) => a.localeCompare(b)));
  });

  it('mọi phường/xã đều trỏ về một tỉnh có thật', () => {
    const provinceCodes = new Set(PROVINCES.map((province) => province.code));
    const orphans = WARDS.filter(
      (ward) => !provinceCodes.has(ward.provinceCode),
    );

    expect(orphans).toEqual([]);
  });

  it('gom theo tỉnh phủ hết danh sách', () => {
    const grouped = Object.values(WARDS_BY_PROVINCE).reduce(
      (total, list) => total + list.length,
      0,
    );

    expect(Object.keys(WARDS_BY_PROVINCE)).toHaveLength(34);
    expect(grouped).toBe(WARDS.length);
  });

  it('giữ lại quận/huyện cũ để đối chiếu hồ sơ trước 01/07/2025', () => {
    const hoanKiem = WARDS.find((ward) => ward.code === '10105001');

    expect(hoanKiem).toMatchObject({
      name: 'Phường Hoàn Kiếm',
      provinceCode: '01',
      type: 'phuong',
      legacyDistrictCode: '10105',
      legacyDistrictName: 'Quận Hoàn Kiếm',
    });
    expect(WARDS.every((ward) => ward.legacyDistrictCode.length > 0)).toBe(
      true,
    );
  });
});
