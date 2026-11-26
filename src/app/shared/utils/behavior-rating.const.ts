import type { BehaviorRating } from '../../domain';

/**
 * Rating tones from the brand ramps (data-viz colours): positive = emerald/teal, needs attention = amber/rose.
 * `solid` for the selected pill, `soft` for chips and trajectory.
 */
export const RATING_TONE: Readonly<Record<BehaviorRating, { solid: string; soft: string }>> = {
  '+H': { solid: 'bg-green-600 text-white', soft: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' },
  '+M': { solid: 'bg-teal-600 text-white', soft: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300' },
  '+L': { solid: 'bg-teal-400 text-primary-900', soft: 'bg-teal-50 text-teal-700 dark:bg-teal-400/15 dark:text-teal-200' },
  '-H': { solid: 'bg-yellow-400 text-primary-900', soft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-400/20 dark:text-yellow-200' },
  '-M': { solid: 'bg-orange-500 text-white', soft: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300' },
  '-L': { solid: 'bg-red-600 text-white', soft: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300' },
};
