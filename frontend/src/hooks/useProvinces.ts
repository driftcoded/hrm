import { useQuery } from '@tanstack/react-query';
import { listProvinces, listWards } from '@/services/masterData.service';
import type { Province, Ward } from '@/types/masterData.types';

/** Cache key — `['provinces']` per docs/architecture.md §4.1 / §8.1. */
export const PROVINCE_KEYS = {
  root: ['provinces'] as const,
  wards: (provinceCode: string) => ['provinces', 'wards', provinceCode] as const,
};

/**
 * The 34 provinces, for the address step of the employee form.
 *
 * Cached for the whole session (`staleTime: Infinity`): the list is a static
 * JSON file on the server, so re-fetching it can only ever return the same
 * bytes. `retry: false` and a first-class `isError` let the caller fall back to
 * a plain code input instead of a dropdown that spins for ever — creating an
 * employee must not depend on a reference lookup being up.
 */
export function useProvinces(enabled = true) {
  const query = useQuery({
    queryKey: PROVINCE_KEYS.root,
    queryFn: listProvinces,
    enabled,
    staleTime: Infinity,
    retry: false,
  });

  return {
    data: query.data as Province[] | undefined,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/**
 * Phường/xã/đặc khu của MỘT tỉnh.
 *
 * Luôn lọc theo tỉnh: cả nước có 3.321 đơn vị, tải hết về cho một dropdown là
 * ~600KB vô ích. Query tự tắt khi chưa chọn tỉnh, và mỗi tỉnh có cache key
 * riêng nên đổi qua đổi lại giữa hai tỉnh không gọi lại API.
 *
 * KHÔNG có hook quận/huyện: cấp huyện đã bị bỏ từ 01/07/2025.
 */
export function useWards(provinceCode: string | undefined, enabled = true) {
  const query = useQuery({
    queryKey: PROVINCE_KEYS.wards(provinceCode ?? ''),
    queryFn: () => listWards(provinceCode as string),
    enabled: enabled && Boolean(provinceCode),
    staleTime: Infinity,
    retry: false,
  });

  return {
    data: query.data as Ward[] | undefined,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
  };
}
