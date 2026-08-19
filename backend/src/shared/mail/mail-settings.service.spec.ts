import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { encryptSecret } from '@/common/utils/encryption.util';
import { SystemMailSettings } from './entities/system-mail-settings.entity';
import { MailSettingsRepository } from './mail-settings.repository';
import { MailSettingsService } from './mail-settings.service';
import { sendSmtpMessage } from './transports/smtp-mail.transport';

jest.mock('./transports/smtp-mail.transport', () => ({
  sendSmtpMessage: jest.fn(),
}));

const ENCRYPTION_KEY = 'a'.repeat(64);
const mockedSendSmtpMessage = sendSmtpMessage as jest.MockedFunction<
  typeof sendSmtpMessage
>;

function makeRow(
  overrides: Partial<SystemMailSettings> = {},
): SystemMailSettings {
  return {
    id: 1,
    smtpHost: null,
    smtpPort: null,
    smtpSecure: true,
    smtpUsername: null,
    smtpPasswordEncrypted: null,
    smtpFromEmail: null,
    smtpFromName: null,
    updatedBy: null,
    updater: null,
    updatedAt: new Date('2026-08-19T02:00:00.000Z'),
    ...overrides,
  };
}

describe('MailSettingsService', () => {
  let service: MailSettingsService;
  let repository: jest.Mocked<MailSettingsRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailSettingsService,
        {
          provide: MailSettingsRepository,
          useValue: {
            get: jest.fn().mockResolvedValue(makeRow()),
            update: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue({
              encryptionKey: ENCRYPTION_KEY,
            }),
          },
        },
      ],
    }).compile();

    service = module.get(MailSettingsService);
    repository = module.get(MailSettingsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getForAdmin', () => {
    it('KHÔNG BAO GIỜ trả smtpPasswordEncrypted, chỉ hasPassword', async () => {
      repository.get.mockResolvedValueOnce(
        makeRow({ smtpPasswordEncrypted: 'ciphertext-xyz' }),
      );

      const result = await service.getForAdmin();

      expect(result.hasPassword).toBe(true);
      expect(result).not.toHaveProperty('smtpPasswordEncrypted');
      expect(JSON.stringify(result)).not.toContain('ciphertext-xyz');
    });

    it('hasPassword = false khi chưa cấu hình', async () => {
      const result = await service.getForAdmin();

      expect(result.hasPassword).toBe(false);
    });
  });

  describe('update', () => {
    it('có smtpPassword mới → mã hoá rồi ghi smtpPasswordEncrypted', async () => {
      await service.update(
        {
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpSecure: false,
          smtpFromEmail: 'no-reply@example.com',
          smtpPassword: 'my-secret',
        },
        9,
      );

      const patch = repository.update.mock.calls[0][0];
      expect(patch.smtpPasswordEncrypted).toBeDefined();
      expect(patch.smtpPasswordEncrypted).not.toBe('my-secret');
      expect(patch.updatedBy).toBe(9);
    });

    it('bỏ trống smtpPassword → KHÔNG đụng tới smtpPasswordEncrypted đã lưu', async () => {
      await service.update(
        {
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpSecure: false,
          smtpFromEmail: 'no-reply@example.com',
        },
        9,
      );

      const patch = repository.update.mock.calls[0][0];
      expect(patch).not.toHaveProperty('smtpPasswordEncrypted');
    });

    it('smtpUsername/smtpFromName rỗng → lưu null, không lưu chuỗi rỗng', async () => {
      await service.update(
        {
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpSecure: false,
          smtpFromEmail: 'no-reply@example.com',
          smtpUsername: '',
          smtpFromName: '',
        },
        9,
      );

      const patch = repository.update.mock.calls[0][0];
      expect(patch.smtpUsername).toBeNull();
      expect(patch.smtpFromName).toBeNull();
    });
  });

  describe('sendTest', () => {
    it('chưa cấu hình đủ (thiếu host) → 422 MAIL_SETTINGS_INCOMPLETE, không gọi SMTP', async () => {
      await expect(service.sendTest('a@b.com')).rejects.toMatchObject({
        response: { code: 'MAIL_SETTINGS_INCOMPLETE' },
      });
      expect(mockedSendSmtpMessage).not.toHaveBeenCalled();
    });

    it('đã cấu hình → gửi bằng cấu hình ĐÃ LƯU, giải mã đúng mật khẩu', async () => {
      const encrypted = encryptSecret('real-password', ENCRYPTION_KEY);
      repository.get.mockResolvedValueOnce(
        makeRow({
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpFromEmail: 'no-reply@example.com',
          smtpUsername: 'user',
          smtpPasswordEncrypted: encrypted,
        }),
      );
      mockedSendSmtpMessage.mockResolvedValue({ messageId: 'abc123' });

      const result = await service.sendTest('admin@example.com');

      expect(result).toEqual({ sent: true, reference: 'abc123' });
      expect(mockedSendSmtpMessage).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'real-password' }),
        expect.objectContaining({ to: 'admin@example.com' }),
      );
    });

    it('SMTP server từ chối (vd sai mật khẩu) → 422 MAIL_TEST_FAILED với message thật, KHÔNG rơi vào 500', async () => {
      repository.get.mockResolvedValueOnce(
        makeRow({
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpFromEmail: 'no-reply@example.com',
        }),
      );
      mockedSendSmtpMessage.mockRejectedValue(
        new Error('Invalid login: 535 5.7.0 Invalid credentials'),
      );

      await expect(service.sendTest('a@b.com')).rejects.toMatchObject({
        response: {
          code: 'MAIL_TEST_FAILED',
          message: 'Invalid login: 535 5.7.0 Invalid credentials',
        },
      });
    });
  });
});
