// Trimmed from @nivo/calendar's hooks.ts: only the hooks TimeRange uses.
import { useMemo } from 'react'
import { ScaleQuantize, scaleQuantize } from 'd3-scale'
import { computeDomain, computeMonthLegendPositions } from './compute/calendar'
import { BBox, CalendarSvgProps } from './types'

export const useColorScale = ({
    data,
    minValue,
    maxValue,
    colors,
    colorScale,
}: Pick<Required<CalendarSvgProps>, 'data' | 'minValue' | 'maxValue' | 'colors'> &
    Pick<CalendarSvgProps, 'colorScale'>) =>
    useMemo(() => {
        if (colorScale) return colorScale
        const domain = computeDomain(data, minValue, maxValue)
        const defaultColorScale = scaleQuantize<string>().domain(domain).range(colors)
        return defaultColorScale
    }, [data, minValue, maxValue, colors, colorScale])

export const useMonthLegends = <Month extends { bbox: BBox }>({
    months,
    direction,
    monthLegendPosition,
    monthLegendOffset,
}: {
    months: Month[]
    direction: 'horizontal' | 'vertical'
    monthLegendPosition: 'before' | 'after'
    monthLegendOffset: number
}) =>
    useMemo(
        () =>
            computeMonthLegendPositions({
                months,
                direction,
                position: monthLegendPosition,
                offset: monthLegendOffset,
            }),
        [months, direction, monthLegendPosition, monthLegendOffset]
    )
