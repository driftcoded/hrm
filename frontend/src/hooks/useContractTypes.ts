import { useQuery } from '@tanstack/react-query';
import { listContractTypes } from '@/services/masterData.service';

export const CONTRACT_TYPE_KEYS = {
  root: ['contract-types'] as const,
};

/**
 * The four contract types from BLLĐ 2019. Read-only: there is no
 * `contract_types` table and no write endpoint, because the list is fixed by law
 * (see the note on ContractTypesPage). `staleTime: Infinity` — it cannot change
 * while the app is open.
 */
export function useContractTypes() {
  const query = useQuery({
    queryKey: CONTRACT_TYPE_KEYS.root,
    queryFn: listContractTypes,
    staleTime: Infinity,
  });

  return {
    contractTypes: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
