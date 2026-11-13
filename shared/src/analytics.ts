/** Heat overlay rule from the design: 0.6 * min(avgSeconds, 50) / 50, never below 0.06. */
export const HEAT_MAX_SECONDS = 50;
export const HEAT_MAX_OPACITY = 0.6;
export const HEAT_MIN_OPACITY = 0.06;

export function heatOpacity(avgSeconds: number): number {
  const clamped = Math.min(Math.max(avgSeconds, 0), HEAT_MAX_SECONDS);
  const opacity = (HEAT_MAX_OPACITY * clamped) / HEAT_MAX_SECONDS;
  return Math.round(Math.max(HEAT_MIN_OPACITY, opacity) * 1000) / 1000;
}
