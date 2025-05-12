/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { RulesClientContext } from '../../../../rules_client';
import type {
  ScheduleBackfillParams,
} from '../../../backfill/methods/schedule/types';
import { findGaps } from '../find_gaps';
import type { GetBackfillSchedulePayloadsResult, GetBackfillSchedulePayloadsParams } from './types';
import { ruleAuditEvent, RuleAuditAction } from '../../../../rules_client/common/audit_events';
import { RULE_SAVED_OBJECT_TYPE } from '../../../../saved_objects';
import { clampIntervalsForScheduling } from './utils';

/**
 * Builds the scheduling payloads for the first `maxGapPageSize` gaps of each rule.
 * @param context - The rules client context, which provides access to authorization, logging, and other utilities.
 * @param params - An object containing the following properties:
 *   @param params.rules - An array of rules to process. Each rule includes its ID, name, and pagination information.
 *   @param params.maxGapPageSize - The maximum number of gaps to process per page for each rule.
 *   @param params.range - The time range for which gaps should be retrieved and clamped. Includes `start` and `end` properties.
 * @returns a promise that resolves to the payloads and the rules that have gaps pending for processing
 */
export const getBackfillSchedulePayloads = async (
  context: RulesClientContext,
  { rules, maxGapPageSize, range }: GetBackfillSchedulePayloadsParams
): Promise<GetBackfillSchedulePayloadsResult> => {
  const nextRunRules: GetBackfillSchedulePayloadsResult['nextRunRules'] = [];
  const { start, end } = range;
  const payloads = await Promise.all(
    rules.map(async ({ id: ruleId, name: ruleName, gapPagination: { page } }) => {
      const {data: gaps, total } = await findGaps(context, {
        ruleId,
        start,
        end,
        page,
        statuses: ['partially_filled', 'unfilled'],
        perPage: maxGapPageSize,
        sortField: '@timestamp',
        // It is important that the sort order is maintained becuase further functions 
        // assume that the list is sorted asc
        sortOrder: 'asc',
      });

      const backfillRequestPayload: ScheduleBackfillParams[0] = {
        ruleId,
        ranges: gaps.flatMap((gap) => {
          const state = gap.getState();
          const clampedIntervals = clampIntervalsForScheduling(state.unfilledIntervals, {start, end})
          return clampedIntervals.map(({ gte, lte }) => {
            return {
              start: gte,
              end: lte,
            };
          });
        }),
      };

      context.auditLogger?.log(
        ruleAuditEvent({
          action: RuleAuditAction.FILL_GAPS,
          savedObject: { type: RULE_SAVED_OBJECT_TYPE, id: ruleId, name: ruleName },
        })
      );

      if (page * maxGapPageSize < total) {
        nextRunRules.push({
          id: ruleId,
          name: ruleName,
          gapPagination: {
            page: page + 1,
          },
        });
      }

      return backfillRequestPayload;
    })
  );

  return {
    // Even though we are specifying that we want gaps with partially filled or unfilled intervals
    // it is possible for findGaps to return gaps with intervals that fullfil those conditions but that are in an 
    // in_progress state, therefore they won't have unfilledIntervals for scheduling.
    // In that case the ranges array of the payload that we have constructed might be empty
    // so we filter those ones out
    payloads: payloads.filter(({ ranges }) => ranges.length > 0),
    nextRunRules,
  };
};