import { useState } from 'react'
import type { Genre, LedgerEntry, SavingsEvent, Task } from '../types'
import TopTabs from '../components/TopTabs'
import { Bars, Donut, type Slice } from '../components/Charts'
import { themeOf } from '../theme'
import { daysCounted, monthLabel, monthOf, recentMonths, thisMonth } from '../utils'

type Tab = 'expense' | 'savings'

const UNSET_COLOR = '#cbd5e1'

interface Props {
  entries: LedgerEntry[]
  genres: Genre[]
  tasks: Task[]
  savingsEvents: SavingsEvent[]
}

export default function AnalysisPage({ entries, genres, tasks, savingsEvents }: Props) {
  const theme = themeOf('analysis')
  const [tab, setTab] = useState<Tab>('expense')
  const [month, setMonth] = useState(thisMonth())

  // 記録のある月＋今月を選択肢にする
  const monthOptions = Array.from(
    new Set([...entries.map(e => monthOf(e.date)), ...savingsEvents.map(e => monthOf(e.date)), thisMonth()])
  ).filter(Boolean).sort().reverse()

  // ── 支出分析：ジャンル別の内訳 ──
  const monthExpenses = entries.filter(e => monthOf(e.date) === month && e.amount < 0)
  const expenseTotal = monthExpenses.reduce((s, e) => s + Math.abs(e.amount), 0)

  const byGenre = new Map<string, number>()
  monthExpenses.forEach(e => {
    byGenre.set(e.genreId, (byGenre.get(e.genreId) ?? 0) + Math.abs(e.amount))
  })

  const slices: Slice[] = [...byGenre.entries()]
    .map(([genreId, value]) => {
      const g = genres.find(x => x.id === genreId)
      return {
        id: genreId || 'unset',
        name: g?.name ?? '未分類',
        icon: g?.icon ?? '❔',
        value,
        color: g?.color ?? UNSET_COLOR,
      }
    })
    .sort((a, b) => b.value - a.value)

  // ── 貯金履歴：月別の貯めた額 ──
  const months = recentMonths(6)
  const savingsByMonth = months.map(m => ({
    key: m,
    label: `${Number(m.split('-')[1])}月`,
    value: savingsEvents
      .filter(e => monthOf(e.date) === m && e.amount > 0)
      .reduce((s, e) => s + e.amount, 0),
  }))

  const monthEarned = savingsEvents
    .filter(e => monthOf(e.date) === month && e.amount > 0)
    .reduce((s, e) => s + e.amount, 0)
  const monthWithdrawn = savingsEvents
    .filter(e => monthOf(e.date) === month && e.amount < 0)
    .reduce((s, e) => s + Math.abs(e.amount), 0)

  // タスク別の貢献額（その月に貯めた分）
  const byTask = new Map<string, number>()
  savingsEvents
    .filter(e => monthOf(e.date) === month && e.amount > 0)
    .forEach(e => { byTask.set(e.label, (byTask.get(e.label) ?? 0) + e.amount) })
  const taskRanking = [...byTask.entries()].sort((a, b) => b[1] - a[1])

  // ── 繰り返しタスクの達成率 ──
  const denominator = daysCounted(month)
  const dailyStats = tasks
    .filter(t => t.repeat === 'daily')
    .map(t => {
      const done = t.completedDates.filter(d => monthOf(d) === month).length
      const g = genres.find(x => x.id === t.genreId)
      return { task: t, done, rate: denominator > 0 ? done / denominator : 0, color: g?.color ?? theme.accent }
    })
    .sort((a, b) => b.rate - a.rate)

  const monthPicker = (
    <div className="month-picker">
      <select value={month} onChange={e => setMonth(e.target.value)}>
        {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
      </select>
    </div>
  )

  return (
    <div className="page">
      <TopTabs
        tabs={[{ id: 'expense' as Tab, label: '支出分析' }, { id: 'savings' as Tab, label: '貯金履歴' }]}
        active={tab}
        onChange={setTab}
        accent={theme.accent}
        soft={theme.soft}
      />

      <div className="page-scroll">
        {monthPicker}

        {tab === 'expense' ? (
          <>
            {expenseTotal === 0 ? (
              <p className="empty-hint">この月の支出がありません<br />家計簿に記録すると集計されます</p>
            ) : (
              <>
                <div className="chart-wrap">
                  <Donut slices={slices} total={expenseTotal} caption="支出合計" />
                </div>

                <div className="section-header"><h3>ジャンル別の内訳</h3></div>
                <ul className="item-list">
                  {slices.map(s => {
                    const pct = Math.round((s.value / expenseTotal) * 100)
                    return (
                      <li key={s.id}>
                        <div className="row-card" style={{ cursor: 'default' }}>
                          <span className="genre-dot" style={{ background: `${s.color}33`, width: 34, height: 34, fontSize: 17 }}>
                            {s.icon}
                          </span>
                          <span className="row-main">
                            <span className="row-title">{s.name}</span>
                            <span className="bar">
                              <span className="bar-fill" style={{ width: `${pct}%`, background: s.color }} />
                            </span>
                          </span>
                          <span className="row-right">
                            <span className="row-amount">¥{s.value.toLocaleString()}</span>
                            <span className="row-amount" style={{ color: s.color, fontSize: '0.8rem' }}>{pct}%</span>
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                <p className="summary" style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
                  収入は集計に含めていません
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <div className="card">
              <Bars data={savingsByMonth} color={theme.accent} highlight={month} />
            </div>

            <div className="card">
              <div className="calc-row">
                <span>{monthLabel(month)}に貯めた額</span>
                <span>¥{monthEarned.toLocaleString()}</span>
              </div>
              <div className="calc-row">
                <span>切り崩した額</span>
                <span>−¥{monthWithdrawn.toLocaleString()}</span>
              </div>
              <hr className="divider" />
              <div className="calc-total">
                <span>差し引き</span>
                <span>¥{(monthEarned - monthWithdrawn).toLocaleString()}</span>
              </div>
            </div>

            <div className="section-header"><h3>何で貯めたか</h3></div>
            {taskRanking.length === 0 ? (
              <p className="empty-hint">この月の記録がありません</p>
            ) : (
              <ul className="item-list">
                {taskRanking.map(([label, value]) => (
                  <li key={label}>
                    <div className="row-card" style={{ cursor: 'default' }}>
                      <span className="genre-dot" style={{ background: `${theme.accent}33`, width: 34, height: 34, fontSize: 17 }}>🐷</span>
                      <span className="row-main">
                        <span className="row-title">{label}</span>
                        <span className="bar">
                          <span className="bar-fill" style={{ width: `${(value / monthEarned) * 100}%`, background: theme.accent }} />
                        </span>
                      </span>
                      <span className="row-amount">¥{value.toLocaleString()}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="section-header"><h3>デイリーミッションの達成率</h3></div>
            {dailyStats.length === 0 ? (
              <p className="empty-hint">繰り返しタスクがありません</p>
            ) : (
              <ul className="item-list">
                {dailyStats.map(({ task, done, rate, color }) => (
                  <li key={task.id}>
                    <div className="row-card" style={{ cursor: 'default' }}>
                      <span className="genre-dot" style={{ background: `${color}33`, width: 34, height: 34, fontSize: 17 }}>
                        {genres.find(g => g.id === task.genreId)?.icon ?? '📋'}
                      </span>
                      <span className="row-main">
                        <span className="row-title">{task.name}</span>
                        <span className="bar">
                          <span className="bar-fill" style={{ width: `${rate * 100}%`, background: color }} />
                        </span>
                      </span>
                      <span className="row-right">
                        <span className="row-note">{done} / {denominator}日</span>
                        <span className="row-amount" style={{ color, fontSize: '0.8rem' }}>
                          {Math.round(rate * 100)}%
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p className="summary" style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
              {month === thisMonth() ? '今月は本日までの日数で計算しています' : `${monthLabel(month)}の日数で計算しています`}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
