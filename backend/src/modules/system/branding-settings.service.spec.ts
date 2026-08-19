import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from '@/shared/storage/storage.service';
import { BrandingSettingsRepository } from './branding-settings.repository';
import { BrandingSettingsService } from './branding-settings.service';
import { SystemBrandingSettings } from './entities/system-branding-settings.entity';

function makeRow(
  overrides: Partial<SystemBrandingSettings> = {},
): SystemBrandingSettings {
  return {
    id: 1,
    companyName: 'HRM',
    logoUrl: null,
    faviconUrl: null,
    updatedBy: null,
    updater: null,
    updatedAt: new Date('2026-08-19T02:00:00.000Z'),
    ...overrides,
  };
}

describe('BrandingSettingsService', () => {
  let service: BrandingSettingsService;
  let repository: jest.Mocked<BrandingSettingsRepository>;
  let storage: jest.Mocked<StorageService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandingSettingsService,
        {
          provide: BrandingSettingsRepository,
          useValue: {
            get: jest.fn().mockResolvedValue(makeRow()),
            update: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: StorageService,
          useValue: {
            putSystemAsset: jest.fn(),
            removeByUrl: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(BrandingSettingsService);
    repository = module.get(BrandingSettingsRepository);
    storage = module.get(StorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('trả về companyName/logoUrl/faviconUrl, không lộ updatedBy', async () => {
      const result = await service.get();

      expect(result).toEqual({
        companyName: 'HRM',
        logoUrl: null,
        faviconUrl: null,
        updatedAt: '2026-08-19T02:00:00.000Z',
      });
      expect(result).not.toHaveProperty('updatedBy');
    });
  });

  describe('updateCompanyName', () => {
    it('trim tên công ty và ghi updatedBy', async () => {
      await service.updateCompanyName({ companyName: '  Công ty ABC  ' }, 7);

      expect(repository.update).toHaveBeenCalledWith({
        companyName: 'Công ty ABC',
        updatedBy: 7,
      });
    });
  });

  describe('uploadLogo', () => {
    it('lưu logo mới rồi xoá logo cũ (đọc URL cũ TRƯỚC khi ghi đè)', async () => {
      repository.get.mockResolvedValueOnce(
        makeRow({ logoUrl: '/uploads/branding/logo-old.png' }),
      );
      storage.putSystemAsset.mockResolvedValue({
        key: 'branding/logo-new.png',
        url: '/uploads/branding/logo-new.png',
        driver: 'local',
      });

      await service.uploadLogo({ buffer: Buffer.from('x') }, 3);

      expect(storage.putSystemAsset).toHaveBeenCalledWith(
        'logo',
        expect.anything(),
      );
      expect(repository.update).toHaveBeenCalledWith({
        logoUrl: '/uploads/branding/logo-new.png',
        updatedBy: 3,
      });
      expect(storage.removeByUrl).toHaveBeenCalledWith(
        '/uploads/branding/logo-old.png',
      );
    });
  });

  describe('removeLogo', () => {
    it('xoá file rồi set logoUrl = null', async () => {
      repository.get.mockResolvedValueOnce(
        makeRow({ logoUrl: '/uploads/branding/logo-old.png' }),
      );

      await service.removeLogo(5);

      expect(repository.update).toHaveBeenCalledWith({
        logoUrl: null,
        updatedBy: 5,
      });
      expect(storage.removeByUrl).toHaveBeenCalledWith(
        '/uploads/branding/logo-old.png',
      );
    });
  });

  describe('uploadFavicon / removeFavicon', () => {
    it('uploadFavicon dùng đúng kind "favicon" và cột faviconUrl', async () => {
      storage.putSystemAsset.mockResolvedValue({
        key: 'branding/favicon-new.png',
        url: '/uploads/branding/favicon-new.png',
        driver: 'local',
      });

      await service.uploadFavicon({ buffer: Buffer.from('x') }, 1);

      expect(storage.putSystemAsset).toHaveBeenCalledWith(
        'favicon',
        expect.anything(),
      );
      expect(repository.update).toHaveBeenCalledWith({
        faviconUrl: '/uploads/branding/favicon-new.png',
        updatedBy: 1,
      });
    });

    it('removeFavicon không đụng tới logoUrl', async () => {
      repository.get.mockResolvedValueOnce(
        makeRow({
          logoUrl: '/uploads/branding/logo.png',
          faviconUrl: '/uploads/branding/favicon.png',
        }),
      );

      await service.removeFavicon(1);

      expect(repository.update).toHaveBeenCalledWith({
        faviconUrl: null,
        updatedBy: 1,
      });
      expect(storage.removeByUrl).toHaveBeenCalledWith(
        '/uploads/branding/favicon.png',
      );
      expect(storage.removeByUrl).not.toHaveBeenCalledWith(
        '/uploads/branding/logo.png',
      );
    });
  });
});
