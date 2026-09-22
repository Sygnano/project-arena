import {
    timeDays,
    timeDay,
    timeMonday,
    timeTuesday,
    timeWednesday,
    timeThursday,
    timeFriday,
    timeSaturday,
    timeSunday,
} from 'd3-time'
import { timeFormat } from 'd3-time-format'
import { alignBox, BoxAlign } from '@nivo/core'
import { DateOrString, Weekday } from '../types'

// Interfaces
interface ComputeBaseProps {
    direction: 'horizontal' | 'vertical'
}

interface ComputeBaseSpaceProps {
    daySpacing: number
    offset: number
}

interface ComputeBaseDimensionProps {
    cellWidth: number
    cellHeight: number
}

interface ComputeCellSize extends ComputeBaseProps, ComputeBaseSpaceProps {
    totalDays: number
    width: number
    height: number
    square: boolean
}

interface ComputeCellPositions
    extends ComputeBaseProps,
        ComputeBaseSpaceProps,
        ComputeBaseDimensionProps {
    from?: DateOrString
    to?: DateOrString
    data: {
        date: Date
        day: string
        value: number
    }[]
    colorScale: (value: number) => string
    emptyColor: string
    firstWeekday: Weekday
    originX: number
    originY: number
}

interface ComputeOrigin extends ComputeBaseProps, ComputeBaseDimensionProps {
    align: BoxAlign
    width: number
    height: number
    offset: number
    daySpacing: number
    columns: number
    rows: number
}

interface ComputeWeekdays
    extends Omit<ComputeBaseProps, 'daysInRange'>,
        Omit<ComputeBaseSpaceProps, 'offset'>,
        ComputeBaseDimensionProps {
    ticks?: number[]
    arrayOfWeekdays?: string[]
    firstWeekday: Weekday
    originX: number
    originY: number
}

interface Day {
    coordinates: {
        x: number
        y: number
    }
    firstWeek: number
    month: number
    year: number
    date: Date
    color: string
    day: string
    value?: number
}

interface Month {
    date: Date
    bbox: {
        x: number
        y: number
        width: number
        height: number
    }
    firstWeek: number
    month: number
    year: number
}

interface ComputeMonths
    extends ComputeBaseProps,
        Omit<ComputeBaseSpaceProps, 'offset'>,
        ComputeBaseDimensionProps {
    days: Day[]
}

interface ComputeTotalDays {
    from?: DateOrString
    to?: DateOrString
    data: {
        date: Date
        day: string
        value: number
    }[]
}

// used for days range and data matching
const dayFormat = timeFormat('%Y-%m-%d')

/**
 * Compute day cell size according to
 * current context.
 */
export const computeCellSize = ({
    direction,
    daySpacing,
    offset,
    square,
    totalDays,
    width,
    height,
}: ComputeCellSize) => {
    const daysInRange = 7
    let rows
    let columns
    let widthRest = width
    let heightRest = height
    if (direction === 'horizontal') {
        widthRest -= offset
        rows = daysInRange
        columns = Math.ceil(totalDays / daysInRange)
    } else {
        heightRest -= offset
        columns = daysInRange
        rows = Math.ceil(totalDays / daysInRange)
    }
    // + 1 since we have to apply spacing to the rigth and left
    const cellHeight = (heightRest - daySpacing * (rows + 1)) / rows
    const cellWidth = (widthRest - daySpacing * (columns + 1)) / columns
    // do we want square?
    const size = Math.min(cellHeight, cellWidth)
    return {
        columns,
        rows,
        cellHeight: square ? size : cellHeight,
        cellWidth: square ? size : cellWidth,
    }
}

export const ARRAY_OF_WEEKDAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
]

export function getFirstWeekdayIndex(weekday: Weekday) {
    return ARRAY_OF_WEEKDAYS.findIndex(item => item.toLowerCase() === weekday)
}

export const getDayIndex = (date: Date, firstWeekday: Weekday) => {
    const days = [0, 1, 2, 3, 4, 5, 6]
    const day = date.getDay()
    const offsetDay = day - getFirstWeekdayIndex(firstWeekday)
    const [dayIndex] = days.slice(offsetDay)
    return dayIndex
}

const getTimeInterval = (firstWeekday: Weekday) => {
    return [
        timeSunday,
        timeMonday,
        timeTuesday,
        timeWednesday,
        timeThursday,
        timeFriday,
        timeSaturday,
    ][getFirstWeekdayIndex(firstWeekday)]
}

function shiftArray<T>(arr: T[], x: number): T[] {
    if (!arr.length || !x) return arr

    x = x % arr.length
    return arr.slice(x, arr.length).concat(arr.slice(0, x))
}

function computeGrid({
    startDate,
    date,
    direction,
    firstWeekday,
}: {
    startDate: Date
    date: Date
    direction: 'horizontal' | 'vertical'
    firstWeekday: Weekday
}) {
    const timeInterval = getTimeInterval(firstWeekday)
    const firstWeek = timeInterval.count(startDate, date)
    const month = date.getMonth()
    const year = date.getFullYear()

    let currentColumn = 0
    let currentRow = 0
    if (direction === 'horizontal') {
        currentColumn = firstWeek
        currentRow = getDayIndex(date, firstWeekday)
    } else {
        currentColumn = getDayIndex(date, firstWeekday)
        currentRow = firstWeek
    }

    return { currentColumn, year, currentRow, firstWeek, month, date }
}

/**
 * Computes the origin (top-left corner) of the day-cell grid within the
 * available chart space, honoring `align` the same way Calendar's
 * computeLayout does via alignBox — TimeRange previously ignored `align`
 * entirely and always rendered flush at the top-left (plus the weekday
 * label offset), which left visibly uncentered dead space whenever the
 * `square` cell size ended up bound by one axis (e.g. a date range with
 * fewer weeks than the container is tall for).
 *
 * `offset` reserves space for the weekday legend on one axis (the left when
 * horizontal, the top when vertical) — that reserved strip is excluded from
 * the space being aligned here, since it's a fixed margin, not something to
 * center. Returns the *raw* aligned position (before `offset` is folded
 * back in) — callers compose it differently for the day grid itself (whose
 * origin sits just past the margin, i.e. `+ offset`) versus the weekday
 * labels (which sit inside the margin, i.e. unchanged), so both stay
 * correctly positioned relative to each other after alignment shifts the
 * grid off (0, 0).
 */
export const computeOrigin = ({
    direction,
    align,
    width,
    height,
    offset,
    daySpacing,
    cellWidth,
    cellHeight,
    columns,
    rows,
}: ComputeOrigin) => {
    const gridWidth = columns * cellWidth + daySpacing * (columns + 1)
    const gridHeight = rows * cellHeight + daySpacing * (rows + 1)

    const availableWidth = direction === 'horizontal' ? width - offset : width
    const availableHeight = direction === 'horizontal' ? height : height - offset

    return alignBox(
        { x: 0, y: 0, width: gridWidth, height: gridHeight },
        { x: 0, y: 0, width: availableWidth, height: availableHeight },
        align
    )
}

export const computeCellPositions = ({
    direction,
    colorScale,
    emptyColor,
    from,
    to,
    data,
    cellWidth,
    cellHeight,
    daySpacing,
    firstWeekday,
    originX,
    originY,
}: ComputeCellPositions) => {
    // `originX`/`originY` come from computeOrigin, which already folds in
    // the weekday-legend `offset` on whichever axis it reserves (see that
    // function's doc comment) — unlike the old hardcoded `daySpacing`
    // (+ offset) base this replaced, so `offset` isn't added again here.
    const x = originX + daySpacing
    const y = originY + daySpacing

    // we need to determine whether we need to add days to move to correct position
    const start = from ? from : data[0].date
    const end = to ? to : data[data.length - 1].date
    const startDate = start instanceof Date ? start : new Date(start)
    const endDate = end instanceof Date ? end : new Date(end)
    const dateRange = timeDays(startDate, endDate).map(dayDate => {
        return {
            date: dayDate,
            day: dayFormat(dayDate),
        }
    })

    const dataWithCellPosition = dateRange.map(day => {
        const dayData = data.find(item => item.day === day.day)

        const { currentColumn, currentRow, firstWeek, year, month, date } = computeGrid({
            startDate,
            date: day.date,
            direction,
            firstWeekday,
        })

        const coordinates = {
            x: x + daySpacing * currentColumn + cellWidth * currentColumn,
            y: y + daySpacing * currentRow + cellHeight * currentRow,
        }

        if (!dayData) {
            return {
                ...day,
                coordinates,
                firstWeek,
                month,
                year,
                date,
                color: emptyColor,
                width: cellWidth,
                height: cellHeight,
            }
        }

        return {
            ...dayData,
            coordinates,
            firstWeek,
            month,
            year,
            date,
            color: colorScale(dayData.value),
            width: cellWidth,
            height: cellHeight,
        }
    })

    return dataWithCellPosition
}

export const computeWeekdays = ({
    cellHeight,
    cellWidth,
    direction,
    daySpacing,
    ticks = [1, 3, 5],
    firstWeekday,
    arrayOfWeekdays = ARRAY_OF_WEEKDAYS,
    originX,
    originY,
}: ComputeWeekdays) => {
    const sizes = {
        width: cellWidth + daySpacing,
        height: cellHeight + daySpacing,
    }
    const shiftedWeekdays = shiftArray(arrayOfWeekdays, getFirstWeekdayIndex(firstWeekday))
    // The reserved weekday-legend margin (0..offset) stays a fixed strip on
    // one side regardless of `align` — see computeOrigin's doc comment — so
    // the label's position along THAT axis (x for horizontal, y for
    // vertical) is unaffected by alignment. The position along the OTHER
    // axis must track the day grid's own originX/originY, or labels stay
    // pinned to where the grid used to start before alignment moved it.
    return ticks.map(day => ({
        value: shiftedWeekdays[day],
        rotation: direction === 'horizontal' ? 0 : -90,
        y:
            direction === 'horizontal'
                ? originY + sizes.height * (day + 1) - sizes.height / 3
                : originY,
        x:
            direction === 'horizontal'
                ? originX
                : originX + sizes.width * (day + 1) - sizes.width / 3,
    }))
}

export const computeMonthLegends = ({
    direction,
    daySpacing,
    days,
    cellHeight,
    cellWidth,
}: ComputeMonths) => {
    const accumulator: {
        months: Record<string, Month>
        weeks: Day[]
    } = {
        months: {},
        weeks: [],
    }

    return days.reduce((acc, day) => {
        if (acc.weeks.length === day.firstWeek || (!acc.weeks.length && day.firstWeek === 1)) {
            acc.weeks.push(day)

            const key = `${day.year}-${day.month}`

            if (!Object.keys(acc.months).includes(key)) {
                const bbox = { x: 0, y: 0, width: 0, height: 0 }

                if (direction === 'horizontal') {
                    bbox.x = day.coordinates.x - daySpacing
                    bbox.height = cellHeight + daySpacing
                    bbox.width = cellWidth + daySpacing * 2
                } else {
                    bbox.y = day.coordinates.y - daySpacing
                    bbox.height = cellHeight + daySpacing * 2
                    bbox.width = cellWidth + daySpacing * 2
                }

                acc.months[key] = {
                    date: day.date,
                    bbox,
                    firstWeek: day.firstWeek,
                    month: 0,
                    year: 0,
                }
            } else {
                // enhance width/height
                //
                // This trigger only fires once per column, on that column's
                // chronologically-first day (see the condition above) — so
                // when a column's first day is still `key`'s month but later
                // days in that same column already belong to the next month
                // (e.g. a Sunday-to-Saturday week spanning a month
                // boundary), this is that column's *only* chance to be
                // counted anywhere. `+ 1` includes it in `key`'s width;
                // without it, the width stopped just short of this column
                // and the next month's bbox only starts at the following
                // one, leaving a full column between them attributed to
                // neither month's legend.
                if (direction === 'horizontal') {
                    acc.months[key].bbox.width =
                        (day.firstWeek - acc.months[key].firstWeek + 1) * (cellWidth + daySpacing)
                } else {
                    acc.months[key].bbox.height =
                        (day.firstWeek - acc.months[key].firstWeek + 1) * (cellHeight + daySpacing)
                }
            }
        }
        return acc
    }, accumulator)
}

export const computeTotalDays = ({ from, to, data }: ComputeTotalDays) => {
    let startDate
    let endDate
    if (from) {
        startDate = from instanceof Date ? from : new Date(from)
    } else {
        startDate = data[0].date
    }

    if (from && to) {
        endDate = to instanceof Date ? to : new Date(to)
    } else {
        endDate = data[data.length - 1].date
    }

    return startDate.getDay() + timeDay.count(startDate, endDate)
}
