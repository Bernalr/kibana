/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { chunk } from 'lodash';
import type { RulesClientContext } from '../../../../rules_client';
import type {
  ScheduleBackfillResults,
} from '../../../backfill/methods/schedule/types';
import { MAX_SCHEDULE_BACKFILL_BULK_SIZE } from '../../../../../common/constants';
import type { BulkFillGapsByRuleIdsParams, BulkFillGapsByRuleIdsResult } from './types';
import { validateRuleAccess } from './validate_rule_access';
import { bulkFillGapsImpl } from './bulk_fill_gaps_impl';

export const bulkFillGapsByRuleIds = async (
  context: RulesClientContext,
  { rules, range }: BulkFillGapsByRuleIdsParams
): Promise<BulkFillGapsByRuleIdsResult> => {
  const outcomes: ScheduleBackfillResults[] = [];
  const { validatedRules, errors: validationErrors } = await validateRuleAccess(context, rules);

  for (const rulesChunk of chunk(validatedRules, MAX_SCHEDULE_BACKFILL_BULK_SIZE)) {
    const results = await bulkFillGapsImpl(context, { rules: rulesChunk, range });
    outcomes.push(...results);
  }

  const eventLogClient = await context.getEventLogClient();
  await eventLogClient.refreshIndex();
  return { outcomes, validationErrors };
};