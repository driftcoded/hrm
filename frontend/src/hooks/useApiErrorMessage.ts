import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  UNKNOWN_ERROR_CODE,
  apiErrorKey,
  getApiError,
  getHttpStatus,
  getLockRemainingMinutes,
} from '@/utils/apiError';

/**
 * Maps an API error to user-facing text.
 *
 * `error.message` from the backend is English developer text (api-spec.md
 * §1.2) and must never be rendered — we translate `error.code` instead and
 * fall back to a generic sentence for codes we don't know yet.
 */
export function useApiErrorMessage() {
  const { t } = useTranslation();

  return useCallback(
    (error: unknown): string => {
      const { code } = getApiError(error);
      return t(apiErrorKey(code), {
        defaultValue: t(apiErrorKey(UNKNOWN_ERROR_CODE)),
      });
    },
    [t],
  );
}

/**
 * Login-specific mapping. The three failure modes the login form must
 * distinguish (per the auth contract):
 *   - `401 INVALID_CREDENTIALS` — wrong username/password
 *   - `423 ACCOUNT_LOCKED`      — already locked (show remaining time if the
 *                                 backend sends one)
 *   - `429`                     — this attempt just tripped the 15-minute
 *                                 lockout (5 failed attempts)
 */
export function useLoginErrorMessage() {
  const { t } = useTranslation();
  const resolveGeneric = useApiErrorMessage();

  return useCallback(
    (error: unknown): string => {
      const status = getHttpStatus(error);
      const { code } = getApiError(error);
      const minutes = getLockRemainingMinutes(error);

      if (status === 429 || code === 'RATE_LIMIT_EXCEEDED') {
        return minutes === null
          ? t('errors.api.LOGIN_ATTEMPTS_EXCEEDED')
          : t('errors.api.LOGIN_ATTEMPTS_EXCEEDED_WITH_TIME', { minutes });
      }

      if (status === 423 || code === 'ACCOUNT_LOCKED') {
        return minutes === null
          ? t('errors.api.ACCOUNT_LOCKED')
          : t('errors.api.ACCOUNT_LOCKED_WITH_TIME', { minutes });
      }

      return resolveGeneric(error);
    },
    [resolveGeneric, t],
  );
}
