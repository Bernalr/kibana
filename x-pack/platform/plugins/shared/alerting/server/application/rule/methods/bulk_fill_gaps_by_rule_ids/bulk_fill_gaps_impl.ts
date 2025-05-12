/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { RulesClientContext } from '../../../../rules_client';
import type {
  ScheduleBackfillResults,
} from '../../../backfill/methods/schedule/types';
import { scheduleBackfill } from '../../../backfill/methods/schedule';
import type { BulkFillGapsByRuleIdsParams } from './types';
import { getBackfillSchedulePayloads } from './get_backfill_schedule_payloads';

export const bulkFillGapsImpl = async (
  context: RulesClientContext,
  { rules, range }: BulkFillGapsByRuleIdsParams
): Promise<ScheduleBackfillResults[]> => {
  const outcomes: ScheduleBackfillResults[] = [];

  let rulesToBackfill = rules.map(({ id, name }) => {
    return {
      id,
      name,
      gapPagination: {
        // We start fetching gaps from page 1
        page: 1,
      },
    };
  });

  while (rulesToBackfill.length > 0) {
    // We stagger the processing of each rule gaps by fetching 100 at a time. If a rule has more gaps, then the rule is added to
    // nextRunRules to be processed in the next iteration
    const { payloads, nextRunRules } = await getBackfillSchedulePayloads(context, {
      rules: rulesToBackfill,
      // Since the gaps of a rule are paginated, we process them 100 at a time
      maxGapPageSize: 100,
      range,
    });

    rulesToBackfill = nextRunRules;
    if (payloads.length > 0) {
      const results = await scheduleBackfill(context, payloads);
      outcomes.push(results);
    }
  }

  return outcomes;
};
