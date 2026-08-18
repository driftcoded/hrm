import { Card, Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';

interface ComingSoonPageProps {
  /** i18n key for the module name, e.g. `nav.employees`. */
  titleKey: string;
  /** Which build phase delivers this module — shown so the state is explicit. */
  phase: string;
}

/**
 * Placeholder for a module whose feature ships in a later phase.
 *
 * The sidebar lists every module from the start, so these routes exist to keep
 * navigation honest: a real page with an explicit "coming soon" state, rather
 * than a dead link or a redirect that looks like a bug.
 */
export function ComingSoonPage({ titleKey, phase }: ComingSoonPageProps) {
  const { t } = useTranslation();
  const title = t(titleKey);

  return (
    <>
      <PageHeader title={title} />
      <Card variant="borderless">
        <Empty
          description={
            <>
              <p>{t('comingSoon.title', { module: title })}</p>
              <p>{t('comingSoon.phase', { phase })}</p>
            </>
          }
        />
      </Card>
    </>
  );
}
