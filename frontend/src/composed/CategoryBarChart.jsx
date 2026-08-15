import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { CHART_COLORS, CHART_FONT_MONO, CHART_TOOLTIP_STYLE } from '../constants';

export default function CategoryBarChart({ categoryCounts }) {
  const data = Object.entries(categoryCounts || {}).map(([category, count]) => ({ category, count }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
        {/* Vertical gridlines only: they carry the value reading for a
            horizontal bar chart. Horizontal lines between categories would
            be pure chrome. */}
        <CartesianGrid horizontal={false} stroke={CHART_COLORS.gridLine} strokeDasharray="2 4" />
        <XAxis
          type="number"
          tick={{ fill: CHART_COLORS.textMuted, fontSize: 11, fontFamily: CHART_FONT_MONO }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="category"
          width={92}
          tick={{ fill: CHART_COLORS.textSecondary, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={CHART_TOOLTIP_STYLE} />
        <Bar dataKey="count" fill={CHART_COLORS.accent} radius={[0, 3, 3, 0]} barSize={16} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
