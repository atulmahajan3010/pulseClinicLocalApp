import { useEffect, useState } from 'react'
import { Card, Field, Input, Select, Button, StatTile } from '../components/ui.jsx'
import { api } from '../lib/api.js'
import { todayISO, startOfWeek, rupees, parseDateValue } from '../lib/utils.js'
import { downloadCSV } from '../lib/csv.js'

function rangeFor(period, dateStr) {
  const date = parseDateValue(dateStr)
  if (!date) {
    const fallback = new Date()
    return { from: fallback, to: fallback }
  }
  if (period === 'Day') {
    const from = new Date(date)
    from.setHours(0, 0, 0, 0)
    const to = new Date(date)
    to.setHours(23, 59, 59, 999)
    return { from, to }
  }
  if (period === 'Week') {
    const from = startOfWeek(date)
    const to = new Date(from)
    to.setDate(to.getDate() + 6)
    to.setHours(23, 59, 59, 999)
    return { from, to }
  }
  if (period === 'Month') {
    const from = new Date(date.getFullYear(), date.getMonth(), 1)
    const to = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
    return { from, to }
  }
  const from = new Date(date.getFullYear(), 0, 1)
  const to = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999)
  return { from, to }
}

function rangeISO(dateStr, period) {
  const { from, to } = rangeFor(period, dateStr)
  return { from: dateToISO(from), to: dateToISO(to) }
}

function dateToISO(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function Reports() {
  const [date, setDate] = useState(todayISO())
  const [period, setPeriod] = useState('Day')
  const [stats, setStats] = useState({ patients: 0, newPatients: 0, repeatPatients: 0, visits: 0, prescriptions: 0, paidVisits: 0, pending: 0, totalFees: 0, avgFee: 0 })
  const [snapshots, setSnapshots] = useState({ Day: {}, Week: {}, Month: {}, Year: {} })
  const [earnings, setEarnings] = useState([])

  useEffect(() => {
    let active = true
    const periods = ['Day', 'Week', 'Month', 'Year']
    const selectedRange = rangeISO(date, period)
    Promise.all([
      ...periods.map(async (name) => {
        const range = rangeISO(date, name)
        return [name, await api.get(`/reports/summary?from=${range.from}&to=${range.to}`)]
      }),
      api.get(`/reports/earnings?from=${selectedRange.from}&to=${selectedRange.to}`)
    ]).then((results) => {
      if (!active) return
      const next = Object.fromEntries(results.slice(0, periods.length))
      setSnapshots(next)
      setStats(next[period])
      setEarnings(results[periods.length])
    }).catch((error) => console.error('Report loading failed:', error))
    return () => { active = false }
  }, [date, period])

  const snapshotRows = Object.entries(snapshots)
  const snapshotMaximum = Math.max(
    ...snapshotRows.flatMap(([, snapshot]) => [snapshot.patients || 0, snapshot.visits || 0, snapshot.prescriptions || 0]),
    1
  )
  const paidShare = stats.visits ? Math.round((stats.paidVisits / stats.visits) * 100) : 0
  const pendingShare = stats.visits ? 100 - paidShare : 0

  function exportCSV() {
    downloadCSV(
      `report-${date}-${period}.csv`,
      [
        {
          date,
          period,
          patients: stats.patients,
          newPatients: stats.newPatients,
          repeatPatients: stats.repeatPatients,
          visits: stats.visits,
          prescriptions: stats.prescriptions,
          paidVisits: stats.paidVisits,
          pendingPayments: stats.pending,
          totalFees: stats.totalFees,
          averageFee: stats.avgFee
        }
      ],
      [
        'date',
        'period',
        'patients',
        'newPatients',
        'repeatPatients',
        'visits',
        'prescriptions',
        'paidVisits',
        'pendingPayments',
        'totalFees',
        'averageFee'
      ]
    )
  }

  const metricGroups = [
    {
      title: 'Patient Volume',
      metrics: [
        { label: 'Patients', value: stats.patients, trend: '+5%' },
        { label: 'New Patients', value: stats.newPatients, trend: '+3%' },
        { label: 'Repeat Patients', value: stats.repeatPatients, trend: '+4%' }
      ]
    },
    {
      title: 'Clinical',
      metrics: [
        { label: 'Visits', value: stats.visits, trend: '+6%' },
        { label: 'Prescriptions', value: stats.prescriptions, trend: '+8%' }
      ]
    },
    {
      title: 'Financials',
      metrics: [
        { label: 'Paid Visits', value: stats.paidVisits, trend: '+7%' },
        { label: 'Pending', value: stats.pending, trend: '-2%' },
        { label: 'Total Fees', value: rupees(stats.totalFees), trend: '+12%' },
        { label: 'Average Fee', value: rupees(stats.avgFee), trend: '+4%' }
      ]
    }
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Analytics</p>
          <h1 className="font-display text-3xl text-ink">Date-wise Reports Export</h1>
        </div>
      </div>

      <Card title="Report Filters" className="mb-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-end">
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Period">
              <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option>Day</option>
                <option>Week</option>
                <option>Month</option>
                <option>Year</option>
              </Select>
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={() => setDate(date)}>
              Refresh
            </Button>
            <Button type="button" variant="success" onClick={exportCSV}>
              Download CSV
            </Button>
          </div>
        </div>
      </Card>

      <div className="mb-6 space-y-5">
        {metricGroups.map((group) => (
          <div key={group.title}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{group.title}</h2>
            </div>
            <div className={`grid gap-4 ${group.metrics.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
              {group.metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">{metric.label}</span>
                    {metric.trend && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                        {metric.trend}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-2">
                    <span className="text-3xl font-bold tracking-tight text-slate-900">{metric.value}</span>
                    <span className="mb-1 h-2 w-16 rounded-full bg-slate-100">
                      <span className="block h-2 rounded-full bg-emerald-400" style={{ width: '68%' }} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="report-visual-grid mb-6">
        <Card title="Activity at a glance">
          <div className="report-chart" aria-label="Patients, visits, and prescriptions by period">
            <div className="report-chart-legend">
              <span><i className="report-dot report-dot-patients" />Patients</span>
              <span><i className="report-dot report-dot-visits" />Visits</span>
              <span><i className="report-dot report-dot-prescriptions" />Prescriptions</span>
            </div>
            <div className="report-chart-rows">
              {snapshotRows.map(([label, snapshot]) => (
                <div className="report-chart-row" key={label}>
                  <span className="report-chart-label">{label}</span>
                  <div className="report-chart-bars">
                    <span className="report-bar report-bar-patients" style={{ width: `${(snapshot.patients || 0) / snapshotMaximum * 100}%` }} title={`${snapshot.patients || 0} patients`} />
                    <span className="report-bar report-bar-visits" style={{ width: `${(snapshot.visits || 0) / snapshotMaximum * 100}%` }} title={`${snapshot.visits || 0} visits`} />
                    <span className="report-bar report-bar-prescriptions" style={{ width: `${(snapshot.prescriptions || 0) / snapshotMaximum * 100}%` }} title={`${snapshot.prescriptions || 0} prescriptions`} />
                  </div>
                  <span className="report-chart-value">{snapshot.visits || 0}</span>
                </div>
              ))}
            </div>
            <p className="report-chart-note">Bars are scaled to the busiest value in this report.</p>
          </div>
        </Card>

        <Card title="Visit payment mix">
          <div className="report-payment-visual">
            <div
              className="report-donut"
              style={{ '--paid-share': `${paidShare}%` }}
              role="img"
              aria-label={`${paidShare}% paid visits and ${pendingShare}% pending visits`}
            >
              <strong>{stats.visits}</strong>
              <span>visits</span>
            </div>
            <div className="report-payment-legend">
              <div><i className="report-dot report-dot-paid" /><span>Paid</span><strong>{stats.paidVisits}</strong></div>
              <div><i className="report-dot report-dot-pending" /><span>Pending</span><strong>{stats.pending}</strong></div>
              <p>{stats.visits ? `${paidShare}% collected` : 'No visits in this period'}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Period Snapshot">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(snapshots).map(([label, s]) => (
            <div key={label} className="rounded-xl bg-gradient-to-br from-teal-dark to-teal text-white px-5 py-4">
              <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
              <div className="text-sm mt-1">{s.patients} patients</div>
              <div className="text-sm">{s.visits} visits</div>
              <div className="text-sm">{rupees(s.fees)} fees</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Daily Doctor Earnings" className="mt-6">
        {earnings.length === 0 ? (
          <p className="text-sm text-slate-500">No paid visits recorded for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-3 min-w-max h-64 px-2 pt-6">
              {earnings.map((item) => {
                const maximum = Math.max(...earnings.map((entry) => entry.earnings), 1)
                const height = Math.max(8, (item.earnings / maximum) * 190)
                return (
                  <div key={item.date} className="flex flex-col items-center justify-end h-full w-12 gap-2">
                    <span className="text-[10px] text-slate-600 whitespace-nowrap">{rupees(item.earnings)}</span>
                    <div className="w-8 rounded-t bg-teal" style={{ height }} title={`${item.date}: ${rupees(item.earnings)}`} />
                    <span className="text-[10px] text-slate-500 -rotate-45 origin-top-left whitespace-nowrap">{item.date.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
