import { RulesClientContext } from "@kbn/alerting-plugin/server/rules_client"
import { rulesClientContextMock } from "@kbn/alerting-plugin/server/rules_client/rules_client.mock"
import {getBackfillSchedulePayloads} from './get_backfill_schedule_payloads'
import { scheduleBackfill } from '../../../backfill/methods/schedule';
import { ScheduleBackfillResults } from "../../../backfill/methods/schedule/types";
import { bulkFillGapsImpl } from "./bulk_fill_gaps_impl";
import { BulkFillGapsByRuleIdsParams } from "./types";
jest.mock('./get_backfill_schedule_payloads', () => {
    return {
        getBackfillSchedulePayloads: jest.fn()
    }
})

const getBackfillSchedulePayloadsMock = getBackfillSchedulePayloads as jest.Mock

jest.mock('../../../backfill/methods/schedule', () => {
    return {
        scheduleBackfill: jest.fn()
    }
})

const scheduleBackfillMock = scheduleBackfill as jest.Mock


describe('bulkFillGapsImpl', () => {
    let rulesClientContext: RulesClientContext
    const ruleToBeScheduledOnce = {
        id: 'rule-id-1',
        name: 'my-rule-1'
    }
    const ruleToBeScheduledTwice = {
        id: 'rule-id-2',
        name: 'my-rule-2'
    }
    const rules = [
        ruleToBeScheduledOnce,
        ruleToBeScheduledTwice
    ] as BulkFillGapsByRuleIdsParams['rules']

    const range = { start: '2025-05-09T09:15:09.457Z', end: '2025-05-09T09:24:09.457Z' }

    const payloadToScheduleRun1 = [{foo: 'firstPayloadsToSchedule'}]
    const payloadToScheduleRun2: never[] = []

    const schedulingResults1: ScheduleBackfillResults  = []

    let totalOutcomes: ScheduleBackfillResults[]

    const withPagination = (obj: object, page = 1) => ({...obj, gapPagination: {page}})

    beforeEach(async () => {
        rulesClientContext = rulesClientContextMock.create()

        getBackfillSchedulePayloadsMock.mockResolvedValueOnce({
            payloads: payloadToScheduleRun1,
            nextRunRules: [withPagination(ruleToBeScheduledTwice, 2)]
        })

        getBackfillSchedulePayloadsMock.mockResolvedValueOnce({
            payloads: payloadToScheduleRun2,
            nextRunRules: []
        })

        scheduleBackfillMock.mockResolvedValueOnce(schedulingResults1)

        totalOutcomes = await bulkFillGapsImpl(rulesClientContext, {rules, range})
    })

    afterEach(() => {
        jest.resetAllMocks()
    })

    it('should fetch the backfill scheduling payloads for the rules', () => {
        expect(getBackfillSchedulePayloadsMock).toHaveBeenCalledTimes(2)
        expect(getBackfillSchedulePayloadsMock).toHaveBeenNthCalledWith(1, rulesClientContext, {
            rules: rules.map((rule) => withPagination(rule)),
            maxGapPageSize: 100,
            range
        })

        expect(getBackfillSchedulePayloadsMock).toHaveBeenNthCalledWith(2, rulesClientContext, {
            rules: [withPagination(ruleToBeScheduledTwice, 2)],
            maxGapPageSize: 100,
            range
        })
    })

    it('should schedule the backfill payloads', () => {
        // The second time the backfill function is called, it returns an empty list of payloads
        // therefore the second call to scheduleBackfill must be skipped
        expect(scheduleBackfillMock).toHaveBeenCalledTimes(1)
        expect(scheduleBackfillMock).toHaveBeenNthCalledWith(1, rulesClientContext, payloadToScheduleRun1)
    })

    it('should return the scheduling outcomes', () => {
        expect(totalOutcomes).toHaveLength(1)
        expect(totalOutcomes[0]).toBe(schedulingResults1)
    })
})