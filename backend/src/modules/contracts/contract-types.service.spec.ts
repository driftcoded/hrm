import { ContractTypesService } from './contract-types.service';
import { ContractType } from './entities/contract.entity';

describe('ContractTypesService', () => {
  const service = new ContractTypesService();

  it('lists all 4 values of the contracts.contract_type enum', () => {
    const values = service.findAll().map((item) => item.value);

    expect(values).toEqual(Object.values(ContractType));
  });

  it('every type has a non-empty label and legal-basis description', () => {
    for (const item of service.findAll()) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it('returns the same data on every call (static, read-only list)', () => {
    expect(service.findAll()).toEqual(service.findAll());
  });
});
