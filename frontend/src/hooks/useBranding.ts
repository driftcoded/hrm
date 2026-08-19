import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getBranding,
  removeBrandingFavicon,
  removeBrandingLogo,
  updateBrandingCompanyName,
  uploadBrandingFavicon,
  uploadBrandingLogo,
} from '@/services/settings.service';
import type { BrandingSettings, UpdateBrandingPayload } from '@/types/settings.types';

export const BRANDING_QUERY_KEY = ['settings', 'branding'] as const;

/**
 * Public data — no `enabled: isAuthenticated` gate. `BrandMark` renders on
 * `/login` before any token exists, and the favicon/title effect in `App.tsx`
 * needs this to resolve regardless of auth state.
 */
export function useBranding() {
  return useQuery({ queryKey: BRANDING_QUERY_KEY, queryFn: getBranding });
}

/**
 * `TVariables` explicit (not inferred from `mutationFn`): a zero-argument
 * `mutationFn` (the two `remove*` cases below) is structurally assignable to
 * a one-argument function type, so letting TS infer `TVariables` from the
 * parameter would silently widen it to `unknown` instead of `void`, and
 * `mutateAsync()` would then demand an argument that doesn't exist.
 */
function useBrandingMutation<TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<BrandingSettings>,
) {
  const queryClient = useQueryClient();

  return useMutation<BrandingSettings, unknown, TVariables>({
    mutationFn,
    onSuccess: (data) => {
      queryClient.setQueryData(BRANDING_QUERY_KEY, data);
    },
  });
}

export function useUpdateCompanyName() {
  return useBrandingMutation<UpdateBrandingPayload>(updateBrandingCompanyName);
}

export function useUploadLogo() {
  return useBrandingMutation<File>(uploadBrandingLogo);
}

export function useRemoveLogo() {
  return useBrandingMutation(removeBrandingLogo);
}

export function useUploadFavicon() {
  return useBrandingMutation<File>(uploadBrandingFavicon);
}

export function useRemoveFavicon() {
  return useBrandingMutation(removeBrandingFavicon);
}
