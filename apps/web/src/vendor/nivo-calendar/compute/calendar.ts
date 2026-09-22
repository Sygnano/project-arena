// Trimmed from @nivo/calendar's compute/calendar.ts: only the two helpers
// the TimeRange chart uses (its Calendar-chart layout code is left out).
import { BBox, CalendarDatum, CalendarSvgProps } from '../types'

/**
 * Compute min/max values.
 */
export const computeDomain = (
    data: CalendarSvgProps['data'],
    minSpec: NonNullable<CalendarSvgProps['minValue']>,
    maxSpec: NonNullable<CalendarSvgProps['maxValue']>
) => {
    const allValues = data.map((d: CalendarDatum) => d.value)
    const minValue = minSpec === 'auto' ? Math.min(...allValues) : minSpec
    const maxValue = maxSpec === 'auto' ? Math.max(...allValues) : maxSpec

    return [minValue, maxValue] as const
}

export const computeMonthLegendPositions = <Month extends { bbox: BBox }>({
    months,
    direction,
    position,
    offset,
}: Pick<Required<CalendarSvgProps>, 'direction'> & {
    offset: number
    position: 'before' | 'after'
    months: Month[]
}) => {
    return months.map(month => {
        let x = 0
        let y = 0
        let rotation = 0
        if (direction === 'horizontal' && position === 'before') {
            x = month.bbox.x + month.bbox.width / 2
            y = month.bbox.y - offset
        } else if (direction === 'horizontal' && position === 'after') {
            x = month.bbox.x + month.bbox.width / 2
            y = month.bbox.y + month.bbox.height + offset
        } else if (direction === 'vertical' && position === 'before') {
            x = month.bbox.x - offset
            y = month.bbox.y + month.bbox.height / 2
            rotation = -90
        } else {
            x = month.bbox.x + month.bbox.width + offset
            y = month.bbox.y + month.bbox.height / 2
            rotation = -90
        }

        return {
            ...month,
            x,
            y,
            rotation,
        }
    })
}
