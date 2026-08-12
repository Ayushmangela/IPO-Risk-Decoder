import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { SEVERITY_LABELS, SEVERITY_COLOR_HEX, CHART_COLORS } from '../constants';

export default function SeverityDonut({ risks }) {
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  risks.forEach((r) => {
    if (counts[r.score] !== undefined) counts[r.score] += 1;
  });
  const data = [5, 4, 3, 2, 1].map((score) => ({
    name: SEVERITY_LABELS[score],
    value: counts[score],
    score,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={58}
          outerRadius={86}
          paddingAngle={2}
          stroke="none"
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell key={d.score} fill={SEVERITY_COLOR_HEX[d.score]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: '#1c2025',
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: 6,
            fontSize: 12,
            color: '#edeef0',
          }}
        />
        <Legend
          verticalAlign="middle"
          layout="vertical"
          align="right"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: CHART_COLORS.textSecondary }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
