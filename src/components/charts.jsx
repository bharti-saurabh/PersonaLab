import React from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Cell,
  PieChart, Pie, LineChart, Line,
} from 'recharts'

export const PALETTE = ['#004977', '#d03027', '#3d77a6', '#f59e0b', '#16a34a', '#8b5cf6']
const AX = { fontSize: 12, fill: '#617498' }

export function ChartFrame({ title, subtitle, children, height = 260, right }) {
  return (
    <div className="card p-4">
      {(title || right) && (
        <div className="flex items-start justify-between mb-3">
          <div>
            {title && <h4 className="font-semibold text-ink-800 text-sm">{title}</h4>}
            {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  )
}

export function BarsCard({ title, subtitle, data, bars, height = 260, layout = 'horizontal', xKey = 'name' }) {
  return (
    <ChartFrame title={title} subtitle={subtitle} height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 6, right: 12, left: layout === 'vertical' ? 24 : 0, bottom: 6 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eaeef3" />
        {layout === 'vertical' ? (
          <>
            <XAxis type="number" tick={AX} domain={[0, 100]} />
            <YAxis type="category" dataKey={xKey} tick={AX} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={AX} />
            <YAxis tick={AX} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.name || b.key} radius={[4, 4, 0, 0]} fill={b.color || PALETTE[i % PALETTE.length]} />
        ))}
      </BarChart>
    </ChartFrame>
  )
}

export function RadarCard({ title, subtitle, data, series, height = 280 }) {
  return (
    <ChartFrame title={title} subtitle={subtitle} height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#617498' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#aebccf' }} />
        {series.map((s, i) => (
          <Radar key={s.key} name={s.name} dataKey={s.key} stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.18} />
        ))}
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip contentStyle={tooltipStyle} />
      </RadarChart>
    </ChartFrame>
  )
}

export function DonutCard({ title, subtitle, data, height = 240 }) {
  return (
    <ChartFrame title={title} subtitle={subtitle} height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {data.map((d, i) => <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ChartFrame>
  )
}

export function LineCard({ title, subtitle, data, lines, xKey = 'name', height = 260 }) {
  return (
    <ChartFrame title={title} subtitle={subtitle} height={height}>
      <LineChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 6 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eaeef3" />
        <XAxis dataKey={xKey} tick={AX} />
        <YAxis tick={AX} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {lines.map((l, i) => <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} />)}
      </LineChart>
    </ChartFrame>
  )
}

const tooltipStyle = { borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(16,21,29,0.12)', fontSize: 12 }
