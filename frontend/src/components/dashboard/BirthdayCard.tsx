import { Avatar, Card, Empty, List, Skeleton, Tag, Tooltip, Typography } from 'antd';
import { GiftOutlined, InfoCircleOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { UpcomingBirthday } from '@/types/employee.types';
import styles from './BirthdayCard.module.css';

const { Text } = Typography;

interface BirthdayCardProps {
  birthdays: UpcomingBirthday[];
  loading?: boolean;
}

export function BirthdayCard({ birthdays, loading }: BirthdayCardProps) {
  const { t } = useTranslation();

  function dayTag(daysUntil: number) {
    if (daysUntil === 0) return <Tag color="red">{t('dashboard.birthday.today')}</Tag>;
    if (daysUntil === 1) return <Tag color="orange">{t('dashboard.birthday.tomorrow')}</Tag>;
    return <Tag>{t('dashboard.birthday.inDays', { count: daysUntil })}</Tag>;
  }

  return (
    <Card
      variant="borderless"
      className={styles.card}
      title={
        <span className={styles.cardTitle}>
          <GiftOutlined />
          {t('dashboard.birthday.title')}
          <Tooltip title={t('dashboard.birthday.hint')}>
            <button
              type="button"
              className={styles.hintButton}
              aria-label={t('dashboard.birthday.hint')}
            >
              <InfoCircleOutlined />
            </button>
          </Tooltip>
        </span>
      }
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : birthdays.length === 0 ? (
        <Empty description={t('dashboard.birthday.empty')} />
      ) : (
        <List<UpcomingBirthday>
          dataSource={birthdays}
          rowKey="employeeId"
          size="small"
          renderItem={(item) => (
            <List.Item className={styles.item}>
              <span className={styles.person}>
                <Avatar size={32} src={item.avatarUrl ?? undefined} icon={<UserOutlined />} />
                <Text className={styles.name}>{item.fullName}</Text>
              </span>
              {dayTag(item.daysUntil)}
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
