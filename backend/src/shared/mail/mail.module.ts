import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailConfig } from '@/config/mail.config';
import { MAIL_TRANSPORT } from './mail.constants';
import { MailTransport } from './mail-transport.interface';
import { MailService } from './mail.service';
import { DevFileMailTransport } from './transports/dev-file-mail.transport';
import { SesMailTransport } from './transports/ses-mail.transport';

/**
 * Chọn driver mail theo `MAIL_TRANSPORT`:
 *  - `dev` (mặc định): ghi email ra file HTML trong logs/mail → test được
 *    forgot-password ở local mà không cần AWS credentials.
 *  - `ses`: gửi thật qua AWS SES (chỉ dùng khi đã có credentials).
 *
 * Ở production mà vẫn để `dev` thì log cảnh báo rõ ràng (email sẽ KHÔNG được gửi).
 */
@Global()
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): MailTransport => {
        const mail = configService.getOrThrow<MailConfig>('mail');
        const nodeEnv = configService.get<string>('app.nodeEnv');
        const logger = new Logger('MailModule');

        if (mail.transport === 'ses') {
          logger.log('Mail transport: AWS SES');
          return new SesMailTransport(mail.awsRegion, mail.from, mail.fromName);
        }

        if (nodeEnv === 'production') {
          logger.warn(
            'MAIL_TRANSPORT=dev ở môi trường production: email sẽ CHỈ được ghi ra file, KHÔNG gửi thật. Đặt MAIL_TRANSPORT=ses.',
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
