import { Module } from '@nestjs/common';
import { ContractTypesController } from './contract-types.controller';
import { ContractTypesService } from './contract-types.service';

/**
 * Only exposes the read-only `/contract-types` endpoint (Phase 2.1).
 * Contract CRUD (`/contracts`, api-spec.md §6) is Phase 4 – it will be its
 * own `ContractsModule`, sharing the entity defined in this folder.
 */
@Module({
  controllers: [ContractTypesController],
  providers: [ContractTypesService],
  exports: [ContractTypesService],
})
export class ContractTypesModule {}
