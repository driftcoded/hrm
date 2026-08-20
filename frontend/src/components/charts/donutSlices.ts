/**
 * Slot assignment for `DonutChart` — kept out of the component's file so the
 * component module exports only a component (React Fast Refresh requirement).
 *
 * The seven slots map to `--hrm-chart-1…7` in styles/tokens.css, a fixed order
 * validated for colour-vision separation against the white card surface. Slots are
 * assigned IN ORDER and never cycled: an eighth generated hue would be
 * indistinguishable from an existing one under CVD, so the tail folds into one
 * grey "other" slice instead.
 */

export const DONUT_SLOT_COUNT = 7;

export type DonutSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'other';

export interface DonutSlice {
  /** Stable identity, also the React key. */
  key: string;
  label: string;
  value: number;
  slot: DonutSlot;
  /**
   * Class setting `--slice` to a colour of the caller's own, used INSTEAD of the
   * slot colour. For a chart whose colours belong to a domain (attendance
   * statuses) rather than to the categorical order.
   */
  className?: string;
}

/** Reserved key of the folded tail, so it cannot collide with a real entity id. */
export const DONUT_OTHER_KEY = '__other__';

/**
 * Take the first `DONUT_SLOT_COUNT` entries and fold the rest into one "other"
 * slice, so a company with 30 departments still gets a readable legend.
 *
 * `items` must already be ordered the way they should be drawn (largest first,
 * normally) — this only slices and sums the tail.
 */
export function foldDonutSlices(
  items: ReadonlyArray<{ key: string; label: string; value: number }>,
  otherLabel: string,
): DonutSlice[] {
  const head = items.slice(0, DONUT_SLOT_COUNT).map((item, index) => ({
    ...item,
    slot: (index + 1) as DonutSlot,
  }));
  const tail = items.slice(DONUT_SLOT_COUNT).reduce((sum, item) => sum + item.value, 0);

  return tail > 0
    ? [...head, { key: DONUT_OTHER_KEY, label: otherLabel, value: tail, slot: 'other' as const }]
    : head;
}
