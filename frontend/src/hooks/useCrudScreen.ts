import { useCallback, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import type { CrudResource } from '@/hooks/useCrudResource';

/**
 * The create/edit/delete wiring shared by every Settings screen: modal state,
 * submit + inline error, and the delete confirmation.
 *
 * Notification channels here follow the "KHÔNG thông báo trùng" rule
 * (docs/ui-conventions.md §8) — each event is reported through exactly one:
 *
 *   - submit failure  -> `submitError`, rendered as an inline `Alert` inside the
 *                        still-open modal. No toast on top of it.
 *   - save success    -> `message.success`, because the modal has just closed and
 *                        there is no inline surface left to show it in.
 *   - delete refused  -> `Modal.error`. The confirm modal is gone by then, and
 *                        "you cannot delete this because 6 employees still work
 *                        here" is a sentence that does not fit in a 3s toast.
 *   - delete success  -> `message.success`.
 *
 * Server error text is never rendered: `useApiErrorMessage` maps `error.code` to
 * an i18n string (`error.message` from the API is English developer text).
 */

export interface CrudScreenOptions<TRow, TPayload> {
  resource: CrudResource<unknown, TPayload>;
  /** Entity name for modal titles/messages, already translated. */
  entityName: string;
  /** How a row is named in the delete confirmation, e.g. `(row) => row.name`. */
  rowTitle: (row: TRow) => string;
}

export interface CrudScreen<TRow, TPayload> {
  /** `null` while closed; the row being edited, or `'create'` for a new one. */
  isModalOpen: boolean;
  editing: TRow | null;
  openCreate: () => void;
  openEdit: (row: TRow) => void;
  closeModal: () => void;
  /** Inline submit error for the modal; `null` when there is none. */
  submitError: string | null;
  /** Create or update depending on `editing`. Resolves `true` when it saved. */
  submit: (payload: TPayload | Partial<TPayload>) => Promise<boolean>;
  isSaving: boolean;
  confirmDelete: (row: TRow) => void;
  isDeleting: boolean;
}

interface RowWithId {
  id: number;
}

export function useCrudScreen<TRow extends RowWithId, TPayload>(
  options: CrudScreenOptions<TRow, TPayload>,
): CrudScreen<TRow, TPayload> {
  const { resource, entityName, rowTitle } = options;
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const resolveError = useApiErrorMessage();

  const [isModalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TRow | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const openCreate = useCallback(() => {
    setEditing(null);
    setSubmitError(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((row: TRow) => {
    setEditing(row);
    setSubmitError(null);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSubmitError(null);
  }, []);

  const submit = useCallback(
    async (payload: TPayload | Partial<TPayload>): Promise<boolean> => {
      setSubmitError(null);
      try {
        if (editing) {
          await resource.updateItem(editing.id, payload as Partial<TPayload>);
        } else {
          await resource.createItem(payload as TPayload);
        }
        setModalOpen(false);
        // The modal is closed, so a toast is the only surface left (§8).
        message.success(
          editing
            ? t('crud.updateSuccess', { entity: entityName })
            : t('crud.createSuccess', { entity: entityName }),
        );
        return true;
      } catch (error) {
        // Stays inline in the open modal — no toast for the same event (§8).
        setSubmitError(resolveError(error));
        return false;
      }
    },
    [editing, entityName, message, resolveError, resource, t],
  );

  const confirmDelete = useCallback(
    (row: TRow) => {
      modal.confirm({
        title: t('crud.deleteTitle', { entity: entityName }),
        content: t('crud.deleteContent', { name: rowTitle(row) }),
        okText: t('crud.deleteOk'),
        okButtonProps: { danger: true },
        cancelText: t('common.cancel'),
        // Deleting is irreversible for holidays/leave types, so never let a
        // stray click on the backdrop count as confirmation.
        maskClosable: false,
        onOk: async () => {
          try {
            await resource.removeItem(row.id);
            message.success(t('crud.deleteSuccess', { entity: entityName }));
          } catch (error) {
            // The confirm dialog has already closed: explain the refusal in a
            // dialog of its own rather than a toast that scrolls away.
            modal.error({
              title: t('crud.deleteBlockedTitle'),
              content: resolveError(error),
              okText: t('crud.understood'),
            });
          }
        },
      });
    },
    [entityName, message, modal, resolveError, resource, rowTitle, t],
  );

  return {
    isModalOpen,
    editing,
    openCreate,
    openEdit,
    closeModal,
    submitError,
    submit,
    isSaving: resource.isSaving,
    confirmDelete,
    isDeleting: resource.isDeleting,
  };
}
