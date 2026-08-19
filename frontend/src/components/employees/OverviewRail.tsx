import { Alert, Avatar, Button, Card, Skeleton } from 'antd';
import {
  ArrowRightOutlined,
  CalendarOutlined,
  ManOutlined,
  TeamOutlined,
  UserOutlined,
  WomanOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { EmployeeStats, UpcomingBirthday } from '@/types/employee.types';
import { formatPercent } from '@/utils/format';
import { HeadcountDonut } from './HeadcountDonut';
import styles from './OverviewRail.module.css';

/**
 * The right-hand column of `/employees`: headcount donut, quick stats, upcoming
 * birthdays.
 *
 * It is CONTEXT, not the point of the screen, so every state here degrades
 * quietly — a failed stats call renders one inline notice and the employee table
 * beside it keeps working (docs/ui-conventions.md §7). Nothing in this rail is
 * allowed to block the list.
 *
 * On tablet and below the whole rail moves below the table (see the page's
 * layout CSS) rather than squeezing the table into an unusable width.
 */

export interface OverviewRailProps {
  stats: EmployeeStats | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Opens the department report — the donut's "see details" affordance. */
  onOpenDepartments: () => void;
}

/** `MM-DD` -> `25/05`. Deliberately year-less: a birthday has no year. */
function formatBirthday(birthday: string): string {
  const [month, day] = birthday.split('-');
  return `${day}/${month}`;
}

function BirthdayRow({ person }: { person: UpcomingBirthday }) {
  const { t } = useTranslation();

  return (
    <li className={styles.birthdayRow}>
      <Avatar size={32} src={person.avatarUrl ?? undefined} icon={<UserOutlined />} />
      <div className={styles.birthdayBody}>
        <span className={styles.birthdayName} title={person.fullName}>
          {person.fullName}
        </span>
        <span className={styles.birthdayMeta}>
          {formatBirthday(person.birthday)}
          {' · '}
          {person.daysUntil === 0
            ? t('employees.overview.birthdayToday')
            : t('employees.overview.birthdayIn', { days: person.daysUntil })}
        </span>
      </div>
    </li>
  );
}

export function OverviewRail({
  stats,
  isLoading,
  isError,
  onRetry,
  onOpenDepartments,
}: OverviewRailProps) {
  const { t } = useTranslation();

  if (isError) {
    return (
      <Alert
        type="warning"
        showIcon
        message={t('employees.overview.error')}
        action={
          <Button size="small" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  if (isLoading || !stats) {
    return (
      <Card variant="borderless" title={t('employees.overview.title')}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  const { byGender, total } = stats;
  const percentOf = (value: number): string =>
    total > 0 ? formatPercent((value / total) * 100) : formatPercent(0);

  return (
    <div className={styles.rail}>
      <Card variant="borderless" title={t('employees.overview.title')}>
        <HeadcountDonut data={stats.byDepartment} total={stats.total} />
        <Button type="link" className={styles.railLink} onClick={onOpenDepartments}>
          {t('employees.overview.viewDepartments')} <ArrowRightOutlined />
        </Button>
      </Card>

      <Card variant="borderless" title={t('employees.overview.quickStats')}>
        <ul className={styles.statList}>
          <li className={styles.statRow}>
            <ManOutlined className={styles.statIconMale} aria-hidden="true" />
            <span className={styles.statLabel}>{t('employees.gender.male')}</span>
            <span className={styles.statValue}>
              {byGender.male} ({percentOf(byGender.male)})
            </span>
          </li>
          <li className={styles.statRow}>
            <WomanOutlined className={styles.statIconFemale} aria-hidden="true" />
            <span className={styles.statLabel}>{t('employees.gender.female')}</span>
            <span className={styles.statValue}>
              {byGender.female} ({percentOf(byGender.female)})
            </span>
          </li>
          {/* Only shown when someone is actually recorded as "other" — an
              always-visible 0 row would read as a category the company tracks. */}
          {byGender.other > 0 && (
            <li className={styles.statRow}>
              <TeamOutlined className={styles.statIconOther} aria-hidden="true" />
              <span className={styles.statLabel}>{t('employees.gender.other')}</span>
              <span className={styles.statValue}>
                {byGender.other} ({percentOf(byGender.other)})
              </span>
            </li>
          )}
          <li className={styles.statRow}>
            <CalendarOutlined className={styles.statIconNeutral} aria-hidden="true" />
            <span className={styles.statLabel}>{t('employees.overview.averageAge')}</span>
            <span className={styles.statValue}>{stats.averageAge ?? '—'}</span>
          </li>
          <li className={styles.statRow}>
            <TeamOutlined className={styles.statIconNeutral} aria-hidden="true" />
            <span className={styles.statLabel}>{t('employees.overview.averageTenure')}</span>
            <span className={styles.statValue}>
              {stats.averageTenureYears === null
                ? '—'
                : t('employees.overview.years', { value: stats.averageTenureYears })}
            </span>
          </li>
        </ul>
      </Card>

      <Card
        variant="borderless"
        title={t('employees.overview.birthdays', { days: stats.windowDays })}
      >
        {stats.upcomingBirthdays.length === 0 ? (
          <p className={styles.emptyText}>{t('employees.overview.noBirthdays')}</p>
        ) : (
          <ul className={styles.birthdayList}>
            {stats.upcomingBirthdays.map((person) => (
              <BirthdayRow key={person.employeeId} person={person} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
