/** Kiểu dữ liệu của phân hệ Khen thưởng / Kỷ luật (PLAN giai đoạn 7). */

export const DISCIPLINE_REWARD_TYPES = ['reward', 'discipline'] as const;

export type DisciplineRewardType = (typeof DISCIPLINE_REWARD_TYPES)[number];

/** Bản ghi này KHÔNG mang tiền — tiền thưởng đi qua bảng lương. */
export interface DisciplineReward {
  id: number;
  employeeId: number;
  type: DisciplineRewardType;
  category: string;
  title: string;
  description: string;
  decisionNumber: string | null;
  decisionDate: string;
  effectiveDate: string;
  issuedBy: { id: number; fullName: string } | null;
  documentUrl: string | null;
  note: string | null;
  createdAt: string;
}

export interface DisciplineRewardPayload {
  type: DisciplineRewardType;
  category: string;
  title: string;
  description: string;
  decisionNumber?: string;
  decisionDate: string;
  effectiveDate: string;
  issuedById?: number;
  documentUrl?: string;
  note?: string;
}
