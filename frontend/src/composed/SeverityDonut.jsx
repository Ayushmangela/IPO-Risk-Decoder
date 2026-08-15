import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  SEVERITY_LABELS,
  SEVERITY_COLOR_HEX,
  CHART_COLORS,
  CHART_FONT_MONO,
  CHART_TOOLTIP_STYLE,
} from '../constants';

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
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        <Legend
          verticalAlign="middle"
          layout="vertical"
          align="right"
          iconType="square"
          iconSize={8}
          formatter={(value, entry) => (
            <span style={{ color: CHART_COLORS.textSecondary, fontSize: 12 }}>
              {value}
              <span
                style={{
                  color: CHART_COLORS.textMuted,
                  fontFamily: CHART_FONT_MONO,
                  fontSize: 11,
                  marginLeft: 6,
                }}
              >
                {entry?.payload?.value ?? 0}
              </span>
            </span>
          )}
          wrapperStyle={{ fontSize: 12, lineHeight: 1.9 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
