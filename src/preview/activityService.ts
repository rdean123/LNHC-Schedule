// PREVIEW MODE ONLY. Stands in for features/administration/activityService.ts.
import type * as Real from '../features/administration/activityService';
import { delay, log } from './db';

export const getActivityLog: typeof Real.getActivityLog = async (limit = 100) => {
  await delay();
  return log
    .slice(0, limit)
    .map((l) => ({ id: l.id, when: l.when, actorName: l.actor, summary: l.summary }));
};
