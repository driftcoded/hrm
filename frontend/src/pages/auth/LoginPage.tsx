import { Button, Card, Form, Input, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import styles from './LoginPage.module.css';

const { Title } = Typography;

/** Placeholder login page — real auth wiring lands in Giai đoạn 1. */
export function LoginPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.wrapper}>
      <Card className={styles.card}>
        <Title level={3} className={styles.title}>
          {t('auth.loginTitle')}
        </Title>
        <Form layout="vertical">
          <Form.Item label={t('auth.email')} name="email">
            <Input autoComplete="email" />
          </Form.Item>
          <Form.Item label={t('auth.password')} name="password">
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {t('auth.loginButton')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
