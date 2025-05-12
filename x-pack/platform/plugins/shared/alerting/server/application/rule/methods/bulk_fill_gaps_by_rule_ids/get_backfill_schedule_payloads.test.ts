import { RulesClientContext } from '@kbn/alerting-plugin/server/rules_client'
import { rulesClientContextMock } from '@kbn/alerting-plugin/server/rules_client/rules_client.mock'
import { Gap } from '@kbn/alerting-plugin/server/lib/rule_gaps/gap'
import { GetBackfillSchedulePayloadsResult } from './types'
import { findGaps } from '../find_gaps'
import { getBackfillSchedulePayloads } from './get_backfill_schedule_payloads'

jest.mock('../find_gaps', () => {
    return {
        findGaps: jest.fn()
    }
})

const findGapsMock = findGaps as jest.Mock

describe("getBackfillSchedulePayloads", () => {
    let context: RulesClientContext
    let backfillSchedulePayloads: GetBackfillSchedulePayloadsResult
    const backfillingDateRange = { start: '2025-05-09T09:15:09.457Z', end: '2025-05-09T09:24:09.457Z' }
    const createRule = (id: string, name: string) => ({ id, name, gapPagination: { page: 1 } })
    const range = (start: string, end: string) => ({ gte: start, lte: end })
    const createGap = (unfilledIntervals: ReturnType<typeof range>[]): Gap => {
        return {
            getState: () => ({
                unfilledIntervals
            })
        } as Gap
    }

    const rulesAndGaps = [
        {
            rule: createRule('some-rule-id-1', 'rule-with-one-gap'),
            gaps: [
                createGap(
                    [
                        range('2025-05-09T09:15:09.457Z', '2025-05-09T09:20:09.457Z'),
                        range('2025-05-09T09:21:09.457Z', '2025-05-09T09:22:09.457Z'),
                    ]
                )
            ]
        },
        {
            rule: createRule('some-rule-id-2', 'rule-with-2-gaps'),
            gaps: [
                createGap(
                    [
                        range('2025-05-09T09:15:09.457Z', '2025-05-09T09:20:09.457Z'),
                        range('2025-05-09T09:21:09.457Z', '2025-05-09T09:22:09.457Z'),
                    ]
                ),
                createGap(
                    [
                        range('2025-05-09T09:23:09.457Z', '2025-05-09T09:24:09.457Z'),
                    ]
                )
            ]
        }
    ]

    beforeEach(async () => {
        context = rulesClientContextMock.create()

        // For each rule only return the first gap gap
        rulesAndGaps.forEach(({ gaps }) => {
            findGapsMock.mockResolvedValueOnce({
                data: [gaps[0]],
                total: gaps.length,
                page: 1,
                perPage: 1
            })
        })

        backfillSchedulePayloads = await getBackfillSchedulePayloads(context, {
            rules: rulesAndGaps.map(({ rule }) => rule),
            range: backfillingDateRange,
            // So we query one gap at a time per rule
            maxGapPageSize: 1
        })
    })

    afterEach(() => {
        jest.resetAllMocks()
    })

    it('should fetch the gaps for each rule with the right parameters', () => {
        rulesAndGaps.forEach(({ rule }, idx) => {
            const callOrder = idx + 1
            expect(findGapsMock).toHaveBeenNthCalledWith(callOrder, context, {
                ruleId: rule.id,
                start: backfillingDateRange.start,
                end: backfillingDateRange.end,
                page: rule.gapPagination.page,
                statuses: ['partially_filled', 'unfilled'],
                perPage: 1,
                sortField: '@timestamp',
                sortOrder: 'asc'
            })
        })
    })

    it('should return the expected backfill scheduling payload', () => {
        expect(backfillSchedulePayloads.payloads.length).toEqual(2)
        backfillSchedulePayloads.payloads.forEach((payload, idx) => {
            expect(payload.ruleId).toEqual(rulesAndGaps[idx].rule.id)
            const firstGap = rulesAndGaps[idx].gaps[0]
            const expectedSchedulingRanges =
                firstGap.getState().unfilledIntervals.map(range => {
                    const { gte, lte } = range
                    return {
                        start: gte,
                        end: lte
                    }
                })
            expect(payload.ranges).toEqual(expectedSchedulingRanges)
        })
    })

    it('should return a list of rules that have more gaps than the maxGapPageSize', () => {
        expect(backfillSchedulePayloads.nextRunRules).toEqual([
            {
                ...rulesAndGaps[1].rule,
                gapPagination: {
                    page: 2
                }
            }
        ])
    })
})