import { clampIntervalsForScheduling } from "./utils"

type Interval = ReturnType<typeof interval>
const interval = (start: string, end: string) => ({ gte: start, lte: end })

const buildTestCase = (testDescription: string, intervals: Interval[], range: { start: string, end: string }, result: Interval[]) => ({
    testDescription,
    intervals,
    range,
    result
})

const testCases = [
    buildTestCase(
        "when the list of intervals is outside the range on the left, it should return an empty list",
        [
            interval("2025-05-09T09:12:09.457Z", "2025-05-09T09:13:09.457Z"),
            interval("2025-05-09T09:14:09.457Z", "2025-05-09T09:15:09.457Z"),
        ],
        {
            start: "2025-05-09T09:15:09.457Z",
            end: "2025-05-09T09:17:09.457Z"
        },
        []
    ),
    buildTestCase(
        "when the list of intervals overlaps on the left, it should clamp the overlapping interval on the start",
        [
            interval("2025-05-09T09:12:09.457Z", "2025-05-09T09:13:09.457Z"),
            interval("2025-05-09T09:14:09.457Z", "2025-05-09T09:15:09.457Z"),
        ],
        {
            start: "2025-05-09T09:14:50.457Z",
            end: "2025-05-09T09:17:09.457Z"
        },
        [
            interval("2025-05-09T09:14:50.457Z", "2025-05-09T09:15:09.457Z"),
        ]
    ),
    buildTestCase(
        "when the list of intervals overlaps with the range on both left and right, it should clamp the overlapping intervals",
        [
            interval("2025-05-09T09:12:09.457Z", "2025-05-09T09:13:09.457Z"),
            interval("2025-05-09T09:15:09.457Z", "2025-05-09T09:16:09.457Z"),
            interval("2025-05-09T09:17:09.458Z", "2025-05-09T09:20:09.457Z"),
            interval("2025-05-09T09:21:09.458Z", "2025-05-09T09:22:09.457Z"),
        ],
        {
            start: "2025-05-09T09:15:50.457Z",
            end: "2025-05-09T09:18:09.457Z"
        },
        [
            interval("2025-05-09T09:15:50.457Z", "2025-05-09T09:16:09.457Z"),
            interval("2025-05-09T09:17:09.458Z", "2025-05-09T09:18:09.457Z"),
        ]
    ),
    buildTestCase(
        "when the list of intervals is included inside the range, it should not clamp anything",
        [
            interval("2025-05-09T09:12:09.457Z", "2025-05-09T09:13:09.457Z"),
            interval("2025-05-09T09:14:09.457Z", "2025-05-09T09:15:09.457Z"),
        ],
        {
            start: "2025-05-09T08:11:50.457Z",
            end: "2025-05-09T09:17:09.457Z"
        },
        [
            interval("2025-05-09T09:12:09.457Z", "2025-05-09T09:13:09.457Z"),
            interval("2025-05-09T09:14:09.457Z", "2025-05-09T09:15:09.457Z"),
        ]
    ),
    buildTestCase(
        "when the list of intervals overlaps on the right, it should clamp the overlapping interval on the end",
        [
            interval("2025-05-09T09:12:09.457Z", "2025-05-09T09:13:09.457Z"),
            interval("2025-05-09T09:14:09.457Z", "2025-05-09T09:15:09.457Z"),
        ],
        {
            start: "2025-05-09T09:11:50.457Z",
            end: "2025-05-09T09:14:55.457Z"
        },
        [
            interval("2025-05-09T09:12:09.457Z", "2025-05-09T09:13:09.457Z"),
            interval("2025-05-09T09:14:09.457Z", "2025-05-09T09:14:55.457Z"),
        ]
    ),
    buildTestCase(
        "when the list of intervals is outside the range on the right, it should return an empty list",
        [
            interval("2025-05-09T09:18:09.457Z", "2025-05-09T09:20:09.457Z"),
            interval("2025-05-09T09:21:09.457Z", "2025-05-09T09:22:09.457Z"),
        ],
        {
            start: "2025-05-09T09:15:09.457Z",
            end: "2025-05-09T09:17:09.457Z"
        },
        []
    ),
]

describe('clampIntervalsForScheduling', () => {
    testCases.forEach(({ testDescription, intervals, range, result }) => {
        it(testDescription, () => {
            expect(clampIntervalsForScheduling(intervals, range)).toEqual(result)
        })
    })
})