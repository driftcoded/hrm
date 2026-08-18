import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';

const { Paragraph } = Typography;

/** Placeholder dashboard page rendered inside AppLayout. */
export function DashboardPage() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t('dashboard.title')} breadcrumbs={[{ label: t('nav.dashboard') }]} />
      <Paragraph>{t('dashboard.welcome')}</Paragraph>
    </>
  );
}
