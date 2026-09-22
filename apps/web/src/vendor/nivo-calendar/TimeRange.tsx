import { useMemo, forwardRef, Ref } from 'react'
import { Container, SvgWrapper, useValueFormatter, useDimensions } from '@nivo/core'
import { useTheme } from '@nivo/theming'
import { BoxLegendSvg } from '@nivo/legends'
import { Text } from '@nivo/text'
import {
    computeWeekdays,
    computeCellSize,
    computeCellPositions,
    computeMonthLegends,
    computeTotalDays,
    computeOrigin,
} from './compute/timeRange'
import { useMonthLegends, useColorScale } from './hooks'
import { TimeRangeDay } from './TimeRangeDay'
import { CalendarMonthLegends } from './CalendarMonthLegends'
import { TimeRangeSvgProps } from './types'
import { timeRangeDefaultProps } from './props'

const InnerTimeRange = ({
    margin: partialMargin,
    width,
    height,
    square = timeRangeDefaultProps.square,
    align = timeRangeDefaultProps.align,
    colors = timeRangeDefaultProps.colors,
    colorScale,
    emptyColor = timeRangeDefaultProps.emptyColor,
    from,
    to,
    data: _data,
    direction = timeRangeDefaultProps.direction,
    minValue = timeRangeDefaultProps.minValue,
    maxValue = timeRangeDefaultProps.maxValue,
    valueFormat,
    legendFormat,
    monthLegend = timeRangeDefaultProps.monthLegend,
    monthLegendOffset = timeRangeDefaultProps.monthLegendOffset,
    monthLegendPosition = timeRangeDefaultProps.monthLegendPosition,
    weekdayLegendOffset = timeRangeDefaultProps.weekdayLegendOffset,
    weekdayTicks,
    weekdays = timeRangeDefaultProps.weekdays,
    dayBorderColor = timeRangeDefaultProps.dayBorderColor,
    dayBorderWidth = timeRangeDefaultProps.dayBorderWidth,
    daySpacing = timeRangeDefaultProps.daySpacing,
    dayRadius = timeRangeDefaultProps.dayRadius,
    isInteractive = timeRangeDefaultProps.isInteractive,
    tooltip = timeRangeDefaultProps.tooltip,
    onClick,
    onMouseEnter,
    onMouseLeave,
    onMouseMove,
    legends = timeRangeDefaultProps.legends,
    role = timeRangeDefaultProps.role,
    firstWeekday = timeRangeDefaultProps.firstWeekday,
    forwardedRef,
}: TimeRangeSvgProps & {
    forwardedRef: Ref<SVGSVGElement>
}) => {
    const { margin, innerWidth, innerHeight, outerWidth, outerHeight } = useDimensions(
        width,
        height,
        partialMargin
    )

    const data = useMemo(
        () =>
            _data
                .map(data => ({ ...data, date: new Date(`${data.day}T00:00:00`) }))
                .sort((left, right) => left.day.localeCompare(right.day)),
        [_data]
    )

    const theme = useTheme()
    const colorScaleFn = useColorScale({ data, minValue, maxValue, colors, colorScale })

    const totalDays = computeTotalDays({
        from,
        to,
        data,
    })

    const { cellHeight, cellWidth, columns, rows } = computeCellSize({
        square,
        offset: weekdayLegendOffset,
        totalDays: totalDays,
        width: innerWidth,
        height: innerHeight,
        daySpacing,
        direction,
    })

    // The raw aligned position of the day grid within the space left over
    // after reserving the weekday-legend margin — see computeOrigin's doc
    // comment on why the day grid (computeCellPositions, offset added back
    // in) and the weekday labels (computeWeekdays, used as-is — they sit
    // inside that reserved margin) each compose this differently.
    const [alignedX, alignedY] = computeOrigin({
        direction,
        align,
        width: innerWidth,
        height: innerHeight,
        offset: weekdayLegendOffset,
        daySpacing,
        cellWidth,
        cellHeight,
        columns,
        rows,
    })
    const gridOriginX = direction === 'horizontal' ? alignedX + weekdayLegendOffset : alignedX
    const gridOriginY = direction === 'horizontal' ? alignedY : alignedY + weekdayLegendOffset

    const days = computeCellPositions({
        offset: weekdayLegendOffset,
        colorScale: colorScaleFn,
        emptyColor,
        cellHeight,
        cellWidth,
        from,
        to,
        data,
        direction,
        daySpacing,
        firstWeekday,
        originX: gridOriginX,
        originY: gridOriginY,
    })

    // map the days and reduce the month
    const months = Object.values(
        computeMonthLegends({
            daySpacing,
            direction,
            cellHeight,
            cellWidth,
            days,
        }).months
    )

    const weekdayLegends = computeWeekdays({
        direction,
        cellHeight,
        cellWidth,
        daySpacing,
        ticks: weekdayTicks,
        firstWeekday,
        arrayOfWeekdays: weekdays,
        originX: alignedX,
        originY: alignedY,
    })

    const monthLegends = useMonthLegends({
        months,
        direction,
        monthLegendPosition,
        monthLegendOffset,
    })

    const formatValue = useValueFormatter(valueFormat)
    const formatLegend = useValueFormatter(legendFormat)

    return (
        <SvgWrapper
            width={outerWidth}
            height={outerHeight}
            margin={margin}
            role={role}
            ref={forwardedRef}
        >
            {weekdayLegends.map(legend => (
                <Text
                    key={`${legend.value}-${legend.x}-${legend.y}`}
                    transform={`translate(${legend.x},${legend.y}) rotate(${legend.rotation})`}
                    textAnchor="start"
                    style={theme.labels.text}
                >
                    {legend.value}
                </Text>
            ))}
            {days.map(d => {
                return (
                    <TimeRangeDay
                        key={d.date.toString()}
                        data={d}
                        x={d.coordinates.x}
                        rx={dayRadius}
                        y={d.coordinates.y}
                        ry={dayRadius}
                        width={cellWidth}
                        height={cellHeight}
                        color={d.color}
                        borderWidth={dayBorderWidth}
                        borderColor={dayBorderColor}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onMouseMove={onMouseMove}
                        isInteractive={isInteractive}
                        tooltip={tooltip}
                        onClick={onClick}
                        formatValue={formatValue}
                    />
                )
            })}
            <CalendarMonthLegends months={monthLegends} legend={monthLegend} theme={theme} />

            {legends.map((legend, i) => {
                const legendData = colorScaleFn.ticks(legend.itemCount).map(value => ({
                    id: value,
                    label: formatLegend(value),
                    color: colorScaleFn(value),
                }))

                return (
                    <BoxLegendSvg
                        key={i}
                        {...legend}
                        containerWidth={width}
                        containerHeight={height}
                        data={legendData}
                    />
                )
            })}
        </SvgWrapper>
    )
}

export const TimeRange = forwardRef(
    (
        {
            isInteractive = timeRangeDefaultProps.isInteractive,
            renderWrapper,
            theme,
            ...props
        }: TimeRangeSvgProps,
        ref: Ref<SVGSVGElement>
    ) => (
        <Container {...{ isInteractive, renderWrapper, theme }}>
            <InnerTimeRange isInteractive={isInteractive} {...props} forwardedRef={ref} />
        </Container>
    )
)
