import {
  SPRINT_NUMBERS,
  SPRINT_PROJECT_MAX_LENGTH,
  SPRINT_SCORE_MAX,
  type SprintMarkFields,
  type SprintNumber,
  type UpsertSprintInput,
} from '../models';
import { NOTE_MAX_LENGTH } from './attendance-validation.rules';

export const isSprintNumber = (n: number): n is SprintNumber => (SPRINT_NUMBERS as readonly number[]).includes(n);

/** Validates and normalizes a sprint mark: sprint 1–4, required project + summary (trimmed), whole score 0–100. */
export function normalizeSprintInput(
  input: UpsertSprintInput,
): { ok: true; value: SprintMarkFields } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (!isSprintNumber(input.sprintNumber)) issues.push(`Sprint must be one of ${SPRINT_NUMBERS.join(', ')}.`);
  const projectName = input.projectName.trim();
  if (!projectName) issues.push('Project name is required.');
  else if (projectName.length > SPRINT_PROJECT_MAX_LENGTH)
    issues.push(`Project name must be ${SPRINT_PROJECT_MAX_LENGTH} characters or fewer.`);
  if (!Number.isInteger(input.score) || input.score < 0 || input.score > SPRINT_SCORE_MAX)
    issues.push(`Score must be a whole number from 0 to ${SPRINT_SCORE_MAX}.`);
  const deliverableSummary = input.deliverableSummary.trim();
  if (!deliverableSummary) issues.push('Deliverable summary is required.');
  else if (deliverableSummary.length > NOTE_MAX_LENGTH)
    issues.push(`Deliverable summary must be ${NOTE_MAX_LENGTH} characters or fewer.`);
  return issues.length
    ? { ok: false, issues }
    : { ok: true, value: { sprintNumber: input.sprintNumber, projectName, score: input.score, deliverableSummary } };
}

/** Mean sprint score (rounded), or `null` when nothing is marked yet. */
export function sprintAverage(marks: readonly { readonly score: number }[]): number | null {
  if (marks.length === 0) return null;
  return Math.round(marks.reduce((sum, m) => sum + m.score, 0) / marks.length);
}

export type SprintBand = 'STRONG' | 'SOLID' | 'DEVELOPING';

/** Score bands for colouring: ≥ 85 strong, ≥ 70 solid, otherwise developing. */
export function sprintBand(score: number): SprintBand {
  if (score >= 85) return 'STRONG';
  if (score >= 70) return 'SOLID';
  return 'DEVELOPING';
}
