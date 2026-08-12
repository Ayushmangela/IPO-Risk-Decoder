import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { CHART_COLORS } from '../constants';

export default function CategoryBarChart({ categoryCounts }) {
  const data = Object.entries(categoryCounts || {}).map(([category, count]) => ({ category, count }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} stroke={CHART_COLORS.gridLine} />
        <XAxis type="number" tick={{ fill: CHART_COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="category"
          width={92}
          tick={{ fill: CHART_COLORS.textSecondary, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={{
            background: '#1c2025',
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: 6,
            fontSize: 12,
            color: '#edeef0',
          }}
        />
        <Bar dataKey="count" fill={CHART_COLORS.accent} radius={[0, 3, 3, 0]} barSize={16} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
