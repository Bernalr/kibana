
import { validateRuleAccess } from './validate_rule_access'
import { bulkFillGapsImpl } from './bulk_fill_gaps_impl'
import { rulesClientContextMock } from '@kbn/alerting-plugin/server/rules_client/rules_client.mock'
import { bulkFillGapsByRuleIds } from './bulk_fill_gaps_by_rule_id'
import { BulkFillGapsByRuleIdsParams, BulkFillGapsByRuleIdsResult } from './types'
import { RulesClientContext } from '@kbn/alerting-plugin/server/rules_client'
jest.mock('./validate_rule_access', () => {
    return {
        validateRuleAccess: jest.fn()
    }
})

jest.mock('./bulk_fill_gaps_impl', () => {
    return {
        bulkFillGapsImpl: jest.fn()
    }
})

jest.mock('../../../../../common/constants', () => {
    const actual = jest.requireActual('../../../../../common/constants')
    return {
        ...actual,
        // Set it to 2 to make the function create chunks of 2 rules
        MAX_SCHEDULE_BACKFILL_BULK_SIZE: 2
    }
})

const range = { start: '2025-05-09T09:15:09.457Z', end: '2025-05-09T09:24:09.457Z' }
const rules = Array.from({ length: 5 }, (_, idx) => ({ id: `rule-${idx}` })) as BulkFillGapsByRuleIdsParams['rules']
const schedulingOutcomes = rules.map(({ id }) => ({ outcome: id }))
const validationErrors: never[] = []

describe("bulkFillGapsByRuleIds", () => {
    let results: BulkFillGapsByRuleIdsResult
    let rulesClientContext: RulesClientContext
    let refreshIndexMock: jest.Mock
    let validateRuleAccessMock: jest.Mock
    let bulkFillGapsImplMock: jest.Mock

    beforeEach(async () => {
        rulesClientContext = rulesClientContextMock.create()
        const eventLogClientMock = rulesClientContext.getEventLogClient as jest.Mock

        validateRuleAccessMock = validateRuleAccess as jest.Mock
        bulkFillGapsImplMock = bulkFillGapsImpl as jest.Mock

        refreshIndexMock = jest.fn()
        eventLogClientMock.mockResolvedValue({ refreshIndex: refreshIndexMock })
        validateRuleAccessMock.mockResolvedValueOnce({ validatedRules: rules, errors: validationErrors })

        bulkFillGapsImplMock.mockResolvedValueOnce([schedulingOutcomes[0], schedulingOutcomes[1]])

        bulkFillGapsImplMock.mockResolvedValueOnce([schedulingOutcomes[2], schedulingOutcomes[3]])

        bulkFillGapsImplMock.mockResolvedValueOnce([schedulingOutcomes[4]])

        results = await bulkFillGapsByRuleIds(rulesClientContext, { rules, range })

    })

    afterEach(() => {
        jest.resetAllMocks()
    })

    it('should validate that the user has access to the rules', () => {
        expect(validateRuleAccessMock).toHaveBeenCalledTimes(1)
        expect(validateRuleAccess).toHaveBeenCalledWith(rulesClientContext, rules)
    })

    it('should return the backfill outcomes', () => {
        expect(results.outcomes).toEqual(schedulingOutcomes)
    })

    it('should return the validation errors', () => {
        expect(results.validationErrors).toBe(validationErrors)
    })

    it('should split the list of rules into chunks specified by MAX_SCHEDULE_BACKFILL_BULK_SIZE', () => {
        expect(bulkFillGapsImpl).toHaveBeenCalledTimes(3)
        expect(bulkFillGapsImpl).toHaveBeenNthCalledWith(1, rulesClientContext, { rules: [rules[0], rules[1]], range })
        expect(bulkFillGapsImpl).toHaveBeenNthCalledWith(2, rulesClientContext, { rules: [rules[2], rules[3]], range })
        expect(bulkFillGapsImpl).toHaveBeenNthCalledWith(3, rulesClientContext, { rules: [rules[4]], range })
    })

    it('should refresh the index of the event client', () => {
        expect(refreshIndexMock).toHaveBeenCalledTimes(1)
    })
})
