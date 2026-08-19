import { apiClient } from '@/lib/axios';
import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  BrandingSettings,
  MailSettings,
  TestMailResult,
  UpdateBrandingPayload,
  UpdateMailSettingsPayload,
} from '@/types/settings.types';

/** Public — no Authorization required; `/login` reads this before the user signs in. */
export async function getBranding(): Promise<BrandingSettings> {
  const { data } = await apiClient.get<ApiSuccessResponse<BrandingSettings>>('/settings/branding');
  return data.data;
}

export async function updateBrandingCompanyName(
  payload: UpdateBrandingPayload,
): Promise<BrandingSettings> {
  const { data } = await apiClient.patch<ApiSuccessResponse<BrandingSettings>>(
    '/settings/branding',
    payload,
  );
  return data.data;
}

/**
 * `Content-Type` is deliberately NOT set — see uploadEmployeeAvatar for why
 * (the browser must add the multipart boundary itself).
 */
export async function uploadBrandingLogo(file: File): Promise<BrandingSettings> {
  const form = new FormData();
  form.append('logo', file);
  const { data } = await apiClient.post<ApiSuccessResponse<BrandingSettings>>(
    '/settings/branding/logo',
    form,
  );
  return data.data;
}

export async function removeBrandingLogo(): Promise<BrandingSettings> {
  const { data } = await apiClient.delete<ApiSuccessResponse<BrandingSettings>>(
    '/settings/branding/logo',
  );
  return data.data;
}

export async function uploadBrandingFavicon(file: File): Promise<BrandingSettings> {
  const form = new FormData();
  form.append('favicon', file);
  const { data } = await apiClient.post<ApiSuccessResponse<BrandingSettings>>(
    '/settings/branding/favicon',
    form,
  );
  return data.data;
}

export async function removeBrandingFavicon(): Promise<BrandingSettings> {
  const { data } = await apiClient.delete<ApiSuccessResponse<BrandingSettings>>(
    '/settings/branding/favicon',
  );
  return data.data;
}

/** Admin only — the backend answers 403 for every other role. */
export async function getMailSettings(): Promise<MailSettings> {
  const { data } = await apiClient.get<ApiSuccessResponse<MailSettings>>('/settings/mail');
  return data.data;
}

export async function updateMailSettings(
  payload: UpdateMailSettingsPayload,
): Promise<MailSettings> {
  const { data } = await apiClient.patch<ApiSuccessResponse<MailSettings>>(
    '/settings/mail',
    payload,
  );
  return data.data;
}

/** Sends with the CONFIGURATION ALREADY SAVED, not the payload — see backend MailSettingsService.sendTest. */
export async function sendTestMail(to: string): Promise<TestMailResult> {
  const { data } = await apiClient.post<ApiSuccessResponse<TestMailResult>>('/settings/mail/test', {
    to,
  });
  return data.data;
}
