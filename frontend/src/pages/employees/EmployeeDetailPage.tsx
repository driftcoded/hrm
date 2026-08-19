import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Alert, App, Button, Card, Descriptions, Skeleton, Space, Tabs, Tag } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { AvatarUploader } from '@/components/employees/AvatarUploader';
import { DeleteEmployeeModal } from '@/components/employees/DeleteEmployeeModal';
import { EmployeeStatusTag } from '@/components/employees/EmployeeStatusTag';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useEmployee, useEmployeeMutations } from '@/hooks/useEmployees';
import {
  useCanDeleteEmployees,
  useCanWriteContracts,
  useCanWriteEmployees,
} from '@/hooks/usePermissions';
import { formatDate } from '@/utils/format';
import { ComingSoonTab } from './tabs/ComingSoonTab';
import { ContractsTab } from './tabs/ContractsTab';
import { FamilyTab } from './tabs/FamilyTab';
import { PersonalTab } from './tabs/PersonalTab';
import styles from './EmployeeDetailPage.module.css';

/**
 * `/employees/:id` — one employee, in eight tabs.
 *
 * TABS KEEP THEIR STATE (PLAN test §3.2 "click tab không reload lại tab khác").
 * Two things make that true: AntD keeps a rendered pane mounted once visited
 * (`destroyOnHidden` is left off), and each tab's data has its own TanStack
 * Query key, so returning to one reads the cache instead of refetching. Editing
 * the personal tab, opening contracts and coming back leaves the form as it was.
 *
 * The active tab is in the URL (`?tab=contracts`), so a link can point at a
 * specific tab and F5 stays where the user was.
 *
 * Five of the eight tabs have no backend yet (lương, phép, chấm công, khen
 * thưởng, đánh giá — phases 4 to 7). They render `ComingSoonTab` naming the
 * phase rather than being hidden: the eight tabs are the shape of an employee
 * record here, and hiding five would make the screen look finished.
 */

const TAB_PARAM = 'tab';

export function EmployeeDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();

  const canWrite = useCanWriteEmployees();
  const canDelete = useCanDeleteEmployees();
  const canWriteContracts = useCanWriteContracts();

  const employeeId = Number(params.id);
  const isValidId = Number.isInteger(employeeId) && employeeId > 0;

  const { data: employee, isLoading, isError, error, refetch } = useEmployee(
    isValidId ? employeeId : undefined,
  );
  const mutations = useEmployeeMutations();

  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeTab = searchParams.get(TAB_PARAM) ?? 'personal';

  const handleTabChange = (key: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(TAB_PARAM, key);
        return next;
      },
      { replace: true },
    );
  };

  /**
   * Deliberately NOT wrapped in try/catch: a failure has to reach `PersonalTab`
   * untouched so it can map `error.code` to its own i18n string and show it
   * inline beside the form (§8). Re-throwing a `new Error(...)` here would force
   * the tab to render `.message` instead, and the day anything but this call
   * threw, the backend's English developer text would land on screen.
   *
   * The success toast is inside this function because the tab has no toast of
   * its own — one channel per event, as always.
   */
  const handleSavePersonal = async (payload: Parameters<typeof mutations.updateEmployee>[1]) => {
    await mutations.updateEmployee(employeeId, payload);
    message.success(t('employees.detail.saved'));
  };

  const handleDelete = (values: {
    reason: string;
    terminationType?: string;
    terminationDate: string;
  }) => {
    void (async () => {
      setDeleteError(null);
      try {
        await mutations.updateEmployee(employeeId, {
          terminationReason: values.reason,
          terminationDate: values.terminationDate,
          ...(values.terminationType ? { terminationType: values.terminationType as never } : {}),
        });
        await mutations.removeEmployee(employeeId);
        setDeleteOpen(false);
        message.success(t('employees.delete.success', { name: employee?.fullName ?? '' }));
        // The record is gone from the normal listing, so this page has nothing
        // left to show — go back to the list rather than 404 on the next fetch.
        void navigate('/employees', { replace: true });
      } catch (removeError) {
        setDeleteError(resolveError(removeError));
      }
    })();
  };

  const tabItems = useMemo(() => {
    if (!employee) {
      return [];
    }

    return [
      {
        key: 'personal',
        label: t('employees.tabs.personal'),
        children: (
          <PersonalTab
            employee={employee}
            canEdit={canWrite}
            isSaving={mutations.isSaving}
            onSave={handleSavePersonal}
          />
        ),
      },
      {
        key: 'contracts',
        label: t('employees.tabs.contracts'),
        children: <ContractsTab employeeId={employee.id} canWrite={canWriteContracts} />,
      },
      {
        key: 'salary',
        label: t('employees.tabs.salary'),
        children: <ComingSoonTab titleKey="employees.tabs.salary" phase="6" />,
      },
      {
        key: 'leave',
        label: t('employees.tabs.leave'),
        children: <ComingSoonTab titleKey="employees.tabs.leave" phase="5" />,
      },
      {
        key: 'attendance',
        label: t('employees.tabs.attendance'),
        children: <ComingSoonTab titleKey="employees.tabs.attendance" phase="4" />,
      },
      {
        key: 'rewards',
        label: t('employees.tabs.rewards'),
        children: <ComingSoonTab titleKey="employees.tabs.rewards" phase="7" />,
      },
      {
        key: 'reviews',
        label: t('employees.tabs.reviews'),
        children: <ComingSoonTab titleKey="employees.tabs.reviews" phase="7" />,
      },
      {
        key: 'family',
        label: t('employees.tabs.family'),
        children: <FamilyTab employeeId={employee.id} canWrite={canWrite} />,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canWrite, canWriteContracts, employee, mutations.isSaving, t]);

  if (!isValidId) {
    return <Alert type="error" showIcon message={t('employees.detail.invalidId')} />;
  }

  if (isLoading) {
    return (
      <Card variant="borderless">
        <Skeleton active avatar paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (isError || !employee) {
    return (
      <Alert
        type="error"
        showIcon
        message={resolveError(error) || t('employees.detail.loadError')}
        action={
          <Space>
            <Button size="small" onClick={refetch}>
              {t('common.retry')}
            </Button>
            <Button size="small" onClick={() => void navigate('/employees')}>
              {t('employees.detail.backToList')}
            </Button>
          </Space>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        className={styles.back}
        onClick={() => void navigate('/employees')}
      >
        {t('employees.detail.backToList')}
      </Button>

      <Card variant="borderless">
        <div className={styles.header}>
          <AvatarUploader
            currentUrl={employee.avatarUrl}
            isUploading={mutations.isUploading}
            disabled={!canWrite}
            onUpload={async (file) => {
              try {
                await mutations.uploadAvatar(employee.id, file);
                message.success(t('employees.avatar.uploaded'));
              } catch (uploadError) {
                // No inline surface inside the uploader for this, so a toast is
                // the only channel — and it is the only one used (§8).
                message.error(resolveError(uploadError));
                throw uploadError;
              }
            }}
          />

          <div className={styles.identity}>
            <div className={styles.nameRow}>
              <h2 className={styles.name}>{employee.fullName}</h2>
              <EmployeeStatusTag status={employee.status} />
              {employee.deletedAt && (
                <Tag color="default">{t('employees.status.deleted')}</Tag>
              )}
            </div>
            <p className={styles.code}>{employee.employeeCode}</p>

            <Descriptions column={{ xs: 1, sm: 2, xl: 4 }} size="small" className={styles.summary}>
              <Descriptions.Item label={t('employees.columns.department')}>
                {employee.department?.name ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('employees.columns.position')}>
                {employee.position?.name ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('employees.columns.hireDate')}>
                {formatDate(employee.hireDate)}
              </Descriptions.Item>
              <Descriptions.Item label={t('employees.fields.directManager')}>
                {employee.directManager?.name ?? '—'}
              </Descriptions.Item>
            </Descriptions>
          </div>

          {canDelete && !employee.deletedAt && (
            <div className={styles.headerActions}>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
              >
                {t('common.delete')}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card variant="borderless">
        <Tabs items={tabItems} activeKey={activeTab} onChange={handleTabChange} />
      </Card>

      <DeleteEmployeeModal
        open={isDeleteOpen}
        employeeName={employee.fullName}
        isDeleting={mutations.isDeleting || mutations.isSaving}
        error={deleteError}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
