/** `GET/PATCH /settings/branding` — mirrors backend `BrandingSettingsResponseDto`. */
export interface BrandingSettings {
  companyName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  updatedAt: string;
}

export interface UpdateBrandingPayload {
  companyName: string;
}

/**
 * `GET/PATCH /settings/mail` — mirrors backend `MailSettingsResponseDto`.
 * `hasPassword` is the ONLY signal about the stored password; the real value
 * never leaves the server.
 */
export interface MailSettings {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  hasPassword: boolean;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  updatedAt: string;
}

/**
 * Form/PATCH payload. `smtpPassword` omitted or empty = keep the password
 * already stored server-side — see backend `UpdateMailSettingsDto`.
 */
export interface UpdateMailSettingsPayload {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername?: string | null;
  smtpPassword?: string;
  smtpFromEmail: string;
  smtpFromName?: string | null;
}

export interface TestMailResult {
  sent: boolean;
  reference: string;
}
