/** Kiểu dữ liệu của ba phân hệ HR Processes (PLAN giai đoạn 7). */

// -------------------------------------------------- khen thưởng / kỷ luật ----

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

// ------------------------------------------------------ đánh giá hiệu suất ----

export const REVIEW_PERIODS = [
  'monthly',
  'quarterly',
  'biannual',
  'annual',
] as const;

export type ReviewPeriod = (typeof REVIEW_PERIODS)[number];

export const REVIEW_RATINGS = [
  'excellent',
  'good',
  'average',
  'below_average',
  'poor',
] as const;

export type ReviewRating = (typeof REVIEW_RATINGS)[number];

export const REVIEW_STATUSES = ['draft', 'submitted', 'acknowledged'] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface PerformanceReview {
  id: number;
  employeeId: number;
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
    departmentName: string | null;
  };
  reviewerId: number;
  reviewerName: string | null;
  reviewPeriod: ReviewPeriod;
  periodYear: number;
  periodQuarter: number | null;
  periodMonth: number | null;
  kpiScore: number | null;
  attitudeScore: number | null;
  skillScore: number | null;
  /** Server tính từ ba tiêu chí trên; không gửi lên. */
  overallScore: number | null;
  rating: ReviewRating | null;
  strengths: string | null;
  weaknesses: string | null;
  recommendations: string | null;
  status: ReviewStatus;
  acknowledgedAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface ReviewFilters {
  page?: number;
  limit?: number;
  employeeId?: number;
  departmentId?: number;
  periodYear?: number;
  reviewPeriod?: ReviewPeriod;
  status?: ReviewStatus;
  rating?: ReviewRating;
}

export interface CreateReviewPayload {
  employeeId: number;
  reviewPeriod: ReviewPeriod;
  periodYear: number;
  periodQuarter?: number;
  periodMonth?: number;
  kpiScore?: number;
  attitudeScore?: number;
  skillScore?: number;
  strengths?: string;
  weaknesses?: string;
  recommendations?: string;
  note?: string;
}

export type UpdateReviewPayload = Partial<
  Omit<CreateReviewPayload, 'employeeId'>
>;

// ---------------------------------------------------------------- đào tạo ----

export const TRAINING_TYPES = [
  'internal',
  'external',
  'online',
  'on_the_job',
] as const;

export type TrainingType = (typeof TRAINING_TYPES)[number];

export const TRAINING_STATUSES = [
  'planned',
  'ongoing',
  'completed',
  'cancelled',
] as const;

export type TrainingStatus = (typeof TRAINING_STATUSES)[number];

export const TRAINING_RESULTS = [
  'passed',
  'failed',
  'incomplete',
  'exempted',
] as const;

export type TrainingResult = (typeof TRAINING_RESULTS)[number];

export interface Training {
  id: number;
  code: string;
  name: string;
  type: TrainingType;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  trainer: string | null;
  cost: number;
  /** `null` = không giới hạn số người. */
  maxParticipants: number | null;
  participantCount: number;
  status: TrainingStatus;
  attachmentUrl: string | null;
  note: string | null;
  createdAt: string;
}

export interface TrainingFilters {
  page?: number;
  limit?: number;
  status?: TrainingStatus;
  type?: TrainingType;
  search?: string;
}

export interface TrainingPayload {
  code: string;
  name: string;
  type: TrainingType;
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  trainer?: string;
  cost?: number;
  maxParticipants?: number;
  attachmentUrl?: string;
  note?: string;
  status?: TrainingStatus;
}

export interface TrainingParticipant {
  id: number;
  employeeId: number;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
  registrationDate: string;
  completionDate: string | null;
  result: TrainingResult | null;
  score: number | null;
  certificateUrl: string | null;
  note: string | null;
  /** Chỉ có ở lịch sử đào tạo của một nhân viên. */
  training?: {
    id: number;
    code: string;
    name: string;
    type: TrainingType;
    startDate: string | null;
    endDate: string | null;
  };
}

/** Người đã có trong khoá được bỏ qua và trả về ở `alreadyEnrolled`. */
export interface EnrollResult {
  enrolled: number;
  alreadyEnrolled: string[];
}

export interface CompleteTrainingPayload {
  result: TrainingResult;
  completionDate?: string;
  score?: number;
  certificateUrl?: string;
  note?: string;
}
