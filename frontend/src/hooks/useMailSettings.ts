import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMailSettings, sendTestMail, updateMailSettings } from '@/services/settings.service';
import { useCanManageSettings } from '@/hooks/usePermissions';

export const MAIL_SETTINGS_QUERY_KEY = ['settings', 'mail'] as const;

/**
 * `enabled: canManage` — `GET /settings/mail` is admin-only and answers 403
 * for every other role, so a non-admin who reaches the page (e.g. via a
 * bookmarked URL) never fires a request guaranteed to fail.
 */
export function useMailSettings() {
  const canManage = useCanManageSettings();

  return useQuery({
    queryKey: MAIL_SETTINGS_QUERY_KEY,
    queryFn: getMailSettings,
    enabled: canManage,
  });
}

export function useUpdateMailSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMailSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(MAIL_SETTINGS_QUERY_KEY, data);
    },
  });
}

/** Does NOT touch the cached settings — a test send never changes what's stored. */
export function useSendTestMail() {
  return useMutation({ mutationFn: sendTestMail });
}
