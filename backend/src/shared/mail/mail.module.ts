import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailConfig } from '@/config/mail.config';
import { SystemMailSettings } from './entities/system-mail-settings.entity';
import { MailSettingsController } from './mail-settings.controller';
import { MailSettingsRepository } from './mail-settings.repository';
import { MailSettingsService } from './mail-settings.service';
import { MAIL_TRANSPORT } from './mail.constants';
import { MailTransport } from './mail-transport.interface';
import { MailService } from './mail.service';
import { DevFileMailTransport } from './transports/dev-file-mail.transport';
import { SmtpMailTransport } from './transports/smtp-mail.transport';

/**
 * Selects the mail driver based on `MAIL_TRANSPORT`:
 *  - `dev` (default): writes emails to an HTML file under logs/mail, so
 *    forgot-password can be tested locally without configuring SMTP.
 *  - `smtp`: sends for real via SMTP; host/port/user/password are read from
 *    `system_mail_settings` (DB, configured by an admin via `/settings/mail`).
 *
 * Logs a clear warning if still set to `dev` in production (emails will NOT be sent).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SystemMailSettings])],
  controllers: [MailSettingsController],
  providers: [
    MailSettingsRepository,
    MailSettingsService,
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService, MailSettingsRepository],
      useFactory: (
        configService: ConfigService,
        mailSettingsRepository: MailSettingsRepository,
      ): MailTransport => {
        const mail = configService.getOrThrow<MailConfig>('mail');
        const nodeEnv = configService.get<string>('app.nodeEnv');
        const logger = new Logger('MailModule');

        if (mail.transport === 'smtp') {
          logger.log('Mail transport: SMTP (system_mail_settings)');
          return new SmtpMailTransport(mailSettingsRepository, configService);
        }

        if (nodeEnv === 'production') {
          logger.warn(
            'MAIL_TRANSPORT=dev ở môi trường production: email sẽ CHỈ được ghi ra file, KHÔNG gửi thật. Đặt MAIL_TRANSPORT=smtp.',
          );
        }

        logger.log(`Mail transport: dev (file) -> ${mail.devOutputDir}`);
        return new DevFileMailTransport(mail.devOutputDir);
      },
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
