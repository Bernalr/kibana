/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ScheduleBackfillParams, ScheduleBackfillResults } from '../../../backfill/methods/schedule/types';
import type { BulkOperationError } from '../../../../rules_client';

type RuleId = string;

export interface BulkFillGapsByRuleIdsParams {
  rules: Array<{
    id: RuleId;
    name: string;
    alertTypeId: string;
    consumer: string;
  }>;
  range: {
    start: string;
    end: string;
  };
}

export interface BulkFillGapsByRuleIdsResult {
  outcomes: ScheduleBackfillResults[];
  validationErrors: BulkOperationError[];
}


export interface GetBackfillSchedulePayloadsParams {
  rules: Array<
    Pick<BulkFillGapsByRuleIdsParams['rules'][0], 'id' | 'name'> & {
      gapPagination: { page: number };
    }
  >;
  range: BulkFillGapsByRuleIdsParams['range'];
  maxGapPageSize: number;
}

export interface GetBackfillSchedulePayloadsResult {
  payloads: ScheduleBackfillParams;
  nextRunRules: GetBackfillSchedulePayloadsParams['rules'];
}