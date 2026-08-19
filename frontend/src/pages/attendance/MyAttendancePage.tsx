import { useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Empty,
  Skeleton,
  Space,
  Tag,
} from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
  LoginOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar';
import { AttendanceStatusTag } from '@/components/attendance/AttendanceStatusTag';
import { StatTile } from '@/components/employees/StatTile';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import {
  useAttendanceClock,
  useMyAttendance,
  useOvertimeRequests,
} from '@/hooks/useAttendances';
import type { AttendanceRecord } from '@/types/attendance.types';
import styles from './MyAttendancePage.module.css';

/**
 * `/attendance` — bảng chấm công tháng của CHÍNH người đang đăng nhập
 * (PLAN 4.2 "Calendar view cá nhân").
 *
 * Đây là màn hình mặc định của module với MỌI vai trò, kể cả HR: ai cũng phải
 * chấm công cho mình trước khi xem của người khác. Bảng toàn công ty nằm ở tab
 * riêng và chỉ hiện với vai trò xem được.
 *
 * HAI CON SỐ LÀM THÊM GIỜ ĐỨNG CẠNH NHAU và được gọi tên khác nhau: giờ đã ở
 * lại làm (dữ kiện) và giờ đã duyệt (được trả tiền). Chỉ hiện một trong hai sẽ
 * khiến người xem tưởng mình sắp được trả cho toàn bộ số giờ ở lại.
 */
export function MyAttendancePage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();

  const [cursor, setCursor] = useState<Dayjs>(dayjs());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const month = cursor.month() + 1;
  const year = cursor.year();

  const { data, isLoading, isError, error, refetch } = useMyAttendance(month, year);
  const clock = useAttendanceClock();

  // Đơn làm thêm ĐÃ DUYỆT của chính mình trong tháng — vẽ dấu chấm trên lịch.
  const overtime = useOvertimeRequests({
    month,
    year,
    status: 'approved',
    limit: 100,
  });

  const records = useMemo(() => data?.records ?? [], [data]);
  const selectedRecord = useMemo(
    () => records.find((record) => record.workDate === selectedDate) ?? null,
    [records, selectedDate],
  );

  const today = dayjs().format('YYYY-MM-DD');
  const todayRecord = records.find((record) => record.workDate === today) ?? null;

  const runClock = (action: 'in' | 'out') => {
    void (async () => {
      try {
        await (action === 'in' ? clock.checkIn(undefined) : clock.checkOut(undefined));
        message.success(t(`attendance.clock.${action}Success`));
      } catch (clockError) {
        message.error(resolveError(clockError));
      }
    })();
  };

  const summary = data?.summary;
  // Chưa tải xong thì hiện gạch ngang, không hiện số 0 — 0 là một con số có
  // nghĩa ("không vắng ngày nào"), dùng nó cho trạng thái đang tải là nói dối.
  const dash = '—';

  return (
    <div className={styles.page}>
      {/* ------------------------------------------------ chấm công hôm nay --- */}
      <Card variant="borderless">
        <div className={styles.clockRow}>
          <div>
            <p className={styles.clockLabel}>{t('attendance.clock.today')}</p>
            <p className={styles.clockDate}>{dayjs().format('dddd, DD/MM/YYYY')}</p>
          </div>

          <div className={styles.clockTimes}>
            <ClockSlot
              label={t('attendance.fields.checkIn')}
              value={todayRecord?.checkIn}
              emptyLabel={t('attendance.clock.notYet')}
            />
            <ClockSlot
              label={t('attendance.fields.checkOut')}
              value={todayRecord?.checkOut}
              emptyLabel={t('attendance.clock.notYet')}
            />
          </div>

          <Space>
            <Button
              type="primary"
              icon={<LoginOutlined />}
              loading={clock.isClockingIn}
              disabled={Boolean(todayRecord?.checkIn)}
              onClick={() => runClock('in')}
            >
              {t('attendance.clock.in')}
            </Button>
            <Button
              icon={<LogoutOutlined />}
              loading={clock.isClockingOut}
              disabled={!todayRecord?.checkIn || Boolean(todayRecord?.checkOut)}
              onClick={() => runClock('out')}
            >
              {t('attendance.clock.out')}
            </Button>
          </Space>
        </div>
      </Card>

      {/* ------------------------------------------------------ tổng hợp --- */}
      {isError ? (
        <Alert
          type="error"
          showIcon
          message={resolveError(error) || t('attendance.loadError')}
          action={
            <Button size="small" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        <div className={styles.tiles}>
          {/*
            Không có ô nào ghi "so với tháng trước": `attendances` chỉ lưu từng
            ngày công, và một con số so sánh bịa ra sẽ nằm cạnh những con số
            thật. Mỗi ô tự nói con số của nó nghĩa là gì.
          */}
          <StatTile
            icon={<CalendarOutlined />}
            tone="blue"
            label={t('attendance.summary.presentDays')}
            value={summary ? `${summary.presentDays}/${summary.workingDays}` : dash}
            caption={t('attendance.summary.presentDaysCaption')}
          />
          <StatTile
            icon={<ClockCircleOutlined />}
            tone="teal"
            label={t('attendance.summary.totalWorkHours')}
            value={summary ? `${summary.totalWorkHours}` : dash}
            caption={t('attendance.summary.totalWorkHoursCaption')}
          />
          <StatTile
            icon={<FieldTimeOutlined />}
            tone="orange"
            label={t('attendance.summary.lateDays')}
            value={summary ? `${summary.lateDays}` : dash}
            caption={t('attendance.summary.lateDaysCaption')}
          />
          <StatTile
            icon={<ExclamationCircleOutlined />}
            tone="purple"
            label={t('attendance.summary.absentDays')}
            value={summary ? `${summary.absentDays}` : dash}
            caption={t('attendance.summary.absentDaysCaption')}
          />
        </div>
      )}

      {/* --------------------------------------------------------- lịch --- */}
      <Card
        variant="borderless"
        title={t('attendance.calendar.title')}
        extra={
          <DatePicker
            picker="month"
            allowClear={false}
            value={cursor}
            format="MM/YYYY"
            onChange={(next) => {
              if (next) {
                setCursor(next);
                setSelectedDate(null);
              }
            }}
          />
        }
      >
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <div className={styles.calendarLayout}>
            <AttendanceCalendar
              month={month}
              year={year}
              records={records}
              approvedOvertime={overtime.data?.items ?? []}
              selectedDate={selectedDate}
              onSelectDate={(date) => setSelectedDate(date)}
            />

            <aside className={styles.detail}>
              <h3 className={styles.detailTitle}>
                {selectedDate
                  ? dayjs(selectedDate).format('DD/MM/YYYY')
                  : t('attendance.calendar.pickDay')}
              </h3>

              {selectedDate ? (
                <DayDetail record={selectedRecord} />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('attendance.calendar.pickDayHint')}
                />
              )}

              {summary && (
                <>
                  <h4 className={styles.overtimeTitle}>
                    {t('attendance.summary.overtimeSection')}
                  </h4>
                  {/*
                    Hai con số này KHÔNG thay nhau được: bên trên là số giờ đã ở
                    lại làm, bên dưới là số giờ được trả tiền. Chỉ hiện một cái
                    sẽ khiến người xem tưởng mình được trả cho tất cả.
                  */}
                  <Descriptions column={1} size="small" colon={false}>
                    <Descriptions.Item label={t('attendance.summary.overtimeHours')}>
                      {summary.overtimeHours}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={t('attendance.summary.approvedOvertimeHours')}
                    >
                      <strong>{summary.approvedOvertimeHours}</strong>
                    </Descriptions.Item>
                  </Descriptions>
                  <p className={styles.overtimeNote}>
                    {t('attendance.summary.overtimeNote')}
                  </p>
                </>
              )}
            </aside>
          </div>
        )}
      </Card>
    </div>
  );
}

function ClockSlot({
  label,
  value,
  emptyLabel,
}: {
  label: string;
  value?: string | null;
  emptyLabel: string;
}) {
  return (
    <div className={styles.clockSlot}>
      <span className={styles.clockSlotLabel}>{label}</span>
      <span className={value ? styles.clockSlotValue : styles.clockSlotEmpty}>
        {value ?? emptyLabel}
      </span>
    </div>
  );
}

function DayDetail({ record }: { record: AttendanceRecord | null }) {
  const { t } = useTranslation();

  if (!record) {
    return <Tag>{t('attendance.calendar.noRecord')}</Tag>;
  }

  return (
    <Descriptions column={1} size="small" colon={false}>
      <Descriptions.Item label={t('attendance.columns.status')}>
        <AttendanceStatusTag status={record.status} />
      </Descriptions.Item>
      <Descriptions.Item label={t('attendance.fields.checkIn')}>
        {record.checkIn ?? '—'}
      </Descriptions.Item>
      <Descriptions.Item label={t('attendance.fields.checkOut')}>
        {record.checkOut ?? '—'}
      </Descriptions.Item>
      <Descriptions.Item label={t('attendance.columns.workHours')}>
        {record.workHours ?? '—'}
      </Descriptions.Item>
      {record.lateMinutes > 0 && (
        <Descriptions.Item label={t('attendance.columns.lateMinutes')}>
          {record.lateMinutes}
        </Descriptions.Item>
      )}
      {record.earlyLeaveMinutes > 0 && (
        <Descriptions.Item label={t('attendance.columns.earlyLeaveMinutes')}>
          {record.earlyLeaveMinutes}
        </Descriptions.Item>
      )}
      {record.note && (
        <Descriptions.Item label={t('attendance.fields.note')}>
          {record.note}
        </Descriptions.Item>
      )}
    </Descriptions>
  );
}
