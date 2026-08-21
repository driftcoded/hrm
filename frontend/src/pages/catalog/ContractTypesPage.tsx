import { Alert, Tag, type TableProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { useContractTypes } from '@/hooks/useContractTypes';
import type { ContractType } from '@/types/masterData.types';
import styles from './catalogPage.module.css';

/**
 * `/catalog/contract-types` — READ-ONLY on purpose.
 *
 * PLAN.md §2.2 asks for "bảng + modal", but there is deliberately no
 * `contract_types` table and no write endpoint in the backend: the four types are
 * the ones defined by Bộ luật Lao động 2019, and each carries different legal
 * consequences for BHXH, the probation cap and the termination notice period.
 * They are not something a company configures — inventing an editor here would
 * produce Add/Edit/Delete buttons that can only ever 404, so the page states the
 * legal basis instead and shows the list.
 *
 * `seasonal` is included because BLLĐ 2019 abolished it: historical contracts
 * still reference it, so it must be readable even though no new one can be signed.
 */
export function ContractTypesPage() {
  const { t } = useTranslation();
  const { contractTypes, isLoading, isError, refetch } = useContractTypes();

  const rows = contractTypes ?? [];

  const columns: TableProps<ContractType>['columns'] = [
    {
      title: t('settings.contractTypes.label'),
      dataIndex: 'label',
      key: 'label',
      width: 320,
      render: (label: string, row) => (
        <span className={styles.strongCell}>
          {label}
          {row.value === 'seasonal' && (
            <>
              {' '}
              <Tag color="warning">{t('settings.contractTypes.abolished')}</Tag>
            </>
          )}
        </span>
      ),
    },
    {
      title: t('settings.contractTypes.value'),
      dataIndex: 'value',
      key: 'value',
      width: 150,
      render: (value: string) => <span className={styles.mono}>{value}</span>,
    },
    {
      title: t('settings.contractTypes.legalBasis'),
      dataIndex: 'description',
      key: 'description',
    },
  ];

  return (
    <>
      <PageHeader
        title={t('nav.contractTypes')}
        subtitle={t('settings.contractTypes.subtitle')}
      />

      <Alert
        className={styles.notice}
        type="info"
        showIcon
        title={t('settings.contractTypes.fixedByLawTitle')}
        description={t('settings.contractTypes.fixedByLaw')}
      />

      <DataTableCard<ContractType>
        columns={columns}
        rows={rows}
        rowKey="value"
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorMessage={t('settings.contractTypes.loadError')}
        total={rows.length}
        scrollX={900}
      />
    </>
  );
}
