import { Tag } from 'antd';

/**
 * Yes/no cell for the boolean columns (`isActive`, `isPaid`, `requireApproval`).
 *
 * Always renders the word as well as the colour — colour must never be the only
 * carrier of meaning (docs/ui-conventions.md §11).
 */
export interface BooleanTagProps {
  value: boolean;
  trueLabel: string;
  falseLabel: string;
  /** Colour used for `true`. `default` (grey) is always used for `false`. */
  trueColor?: 'success' | 'processing' | 'warning';
}

export function BooleanTag({
  value,
  trueLabel,
  falseLabel,
  trueColor = 'success',
}: BooleanTagProps) {
  return <Tag color={value ? trueColor : 'default'}>{value ? trueLabel : falseLabel}</Tag>;
}
