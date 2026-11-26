import type { SprintNumber, UpsertSprintInput } from '../models';
import { normalizeSprintInput, sprintAverage, sprintBand } from './sprint.rules';

const base: UpsertSprintInput = {
  apprenticeId: 'a',
  sprintNumber: 2,
  projectName: '  Inventory API ',
  score: 88,
  deliverableSummary: ' Shipped CRUD + auth ',
};

describe('sprint rules', () => {
  it('trims and accepts a valid mark', () => {
    expect(normalizeSprintInput(base)).toEqual({
      ok: true,
      value: { sprintNumber: 2, projectName: 'Inventory API', score: 88, deliverableSummary: 'Shipped CRUD + auth' },
    });
  });

  it('rejects bad sprint numbers, scores and empty text', () => {
    const bad = normalizeSprintInput({
      ...base,
      sprintNumber: 5 as SprintNumber,
      score: 101,
      projectName: ' ',
      deliverableSummary: '',
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues).toHaveLength(4);
    expect(normalizeSprintInput({ ...base, score: 72.5 }).ok).toBe(false);
  });

  it('averages scores and bands them', () => {
    expect(sprintAverage([])).toBeNull();
    expect(sprintAverage([{ score: 80 }, { score: 91 }])).toBe(86);
    expect([sprintBand(85), sprintBand(70), sprintBand(69)]).toEqual(['STRONG', 'SOLID', 'DEVELOPING']);
  });
});
