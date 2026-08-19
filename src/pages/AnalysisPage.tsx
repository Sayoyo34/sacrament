import { useState } from 'react'
import type { Genre, LedgerEntry, SavingsEvent, Tag, Task } from '../types'
import TopTabs from '../components/TopTabs'
import { Bars, Donut, type Slice } from '../components/Charts'
import { TagFilter } from '../components/Pickers'
import { readableColor } from '../palette'
import { themeOf } from '../theme'
import { daysCounted, matchesTags, monthLabel, monthOf, recentMonths, thisMonth, yearOf } from '../utils'

type Tab = 'expense' | 'savings'
type Span = 'month' | 'year' | 'all'

const UNSET_COLOR = '#a8a29e'

interface Props {
  entries: LedgerEntry[]
  genres: Genre[]
  tags: Tag[]
  tasks: Task[]
  savingsEvents: SavingsEvent[]
}

export default function AnalysisPage({ entries, genres, tags, tasks, savingsEvents }: Props) {
  const theme = themeOf('analysis')
  const [tab, setTab] = useState<Tab>('expense')
  const [month, setMonth] = useState(thisMonth())
  const [span, setSpan] = useState<Span>('month')
  const [year, setYear] = useState(yearOf(thisMonth()))
  const [filterTags, setFilterTags] = useState<string[]>([])

  // 記録のある月＋今月を選択肢にする
  const monthOptions = Array.from(
    new Set([...entries.map(e => monthOf(e.date)), ...savingsEvents.map(e => monthOf(e.date)), thisMonth()])
  ).filter(Boolean).sort().reverse()

  const yearOptions = Array.from(new Set(monthOptions.map(yearOf))).sort().reverse()

  /** 選んだ集計期間に入るか */
  function inSpan(date: string) {
    if (span === 'all') return true
    if (span === 'year') return yearOf(date) === year
    return monthOf(date) === month
  }

  const spanLabel = span === 'all' ? '全期間' : span === 'year' ? `${year}年` : monthLabel(month)

  const filterNames = filterTags
    .map(id => tags.find(t => t.id === id)?.name)
    .filter(Boolean)
    .map(n => `#${n}`)
    .join(' ')

  // ── 支出分析：ジャンル別の内訳 ──
  const scopedExpenses = entries.filter(e => inSpan(e.date) && e.amount < 0 && matchesTags(e.tagIds, filterTags))
  const expenseTotal = scopedExpenses.reduce((s, e) => s + Math.abs(e.amount), 0)

  const byGenre = new Map<string, number>()
  scopedExpenses.forEach(e => {
    byGenre.set(e.genreId, (byGenre.get(e.genreId) ?? 0) + Math.abs(e.amount))
  })

  // タグ別の合計。1件が複数タグを持つため合計は支出総額と一致しない
  const spanExpenses = entries.filter(e => inSpan(e.date) && e.amount < 0)
  const byTag = tags
    .map(t => ({
      tag: t,
      value: spanExpenses
        .filter(e => e.tagIds.includes(t.id))
        .reduce((s, e) => s + Math.abs(e.amount), 0),
    }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)

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

  // その月の貯金の記録。切り崩しも含めて新しい順に並べる
  const monthEvents = savingsEvents
    .filter(e => monthOf(e.date) === month)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))

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
      const color = g?.color ?? theme.accent
      // テーマ色は既に読みやすい濃さだが、ジャンル色は薄い場合があるので文字用は別に用意する
      return { task: t, done, rate: denominator > 0 ? done / denominator : 0, color, textColor: g ? readableColor(color) : color }
    })
    .sort((a, b) => b.rate - a.rate)

  const spanPicker = (
    <div className="span-picker">
      <div className="type-toggle">
        <button className={span !== 'month' ? 'btn-sub' : ''} style={span === 'month' ? { background: theme.accent } : undefined} onClick={() => setSpan('month')}>月</button>
        <button className={span !== 'year' ? 'btn-sub' : ''} style={span === 'year' ? { background: theme.accent } : undefined} onClick={() => setSpan('year')}>年</button>
        <button className={span !== 'all' ? 'btn-sub' : ''} style={span === 'all' ? { background: theme.accent } : undefined} onClick={() => setSpan('all')}>全期間</button>
      </div>
      {span === 'month' && (
        <select value={month} onChange={e => setMonth(e.target.value)}>
          {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      )}
      {span === 'year' && (
        <select value={year} onChange={e => setYear(e.target.value)}>
          {yearOptions.map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
      )}
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
        {tab === 'expense' ? (
          <>
            {spanPicker}
            <TagFilter tags={tags} selected={filterTags} onChange={setFilterTags} />

            {expenseTotal === 0 ? (
              <p className="empty-hint">
                {filterTags.length > 0
                  ? <>絞り込みに一致する支出がありません<br />タグを外すと全件集計されます</>
                  : <>{spanLabel}の支出がありません<br />家計簿に記録すると集計されます</>}
              </p>
            ) : (
              <>
                <div className="chart-wrap">
                  <Donut slices={slices} total={expenseTotal} caption={filterNames || spanLabel} />
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
                            <span className="row-amount" style={{ color: readableColor(s.color), fontSize: '0.8rem' }}>{pct}%</span>
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {byTag.length > 0 && filterTags.length === 0 && (
                  <>
                    <div className="section-header"><h3>タグ別の合計</h3></div>
                    <ul className="item-list">
                      {byTag.map(({ tag, value }) => (
                        <li key={tag.id}>
                          <button className="row-card" onClick={() => setFilterTags([tag.id])}>
                            <span className="genre-dot" style={{ background: `${tag.color}33`, width: 34, height: 34, fontSize: 15, color: readableColor(tag.color), fontWeight: 700 }}>#</span>
                            <span className="row-main">
                              <span className="row-title" style={{ color: readableColor(tag.color) }}>#{tag.name}</span>
                              <span className="bar">
                                <span className="bar-fill" style={{ width: `${(value / byTag[0].value) * 100}%`, background: tag.color }} />
                              </span>
                            </span>
                            <span className="row-amount">¥{value.toLocaleString()}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="summary" style={{ textAlign: 'center', padding: '0 0 0.5rem' }}>
                      1件に複数タグが付くため、合計は支出総額と一致しません
                    </p>
                  </>
                )}

                <p className="summary" style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
                  収入は集計に含めていません
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <div className="month-picker">
              <select value={month} onChange={e => setMonth(e.target.value)}>
                {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </div>

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
                {dailyStats.map(({ task, done, rate, color, textColor }) => (
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
                        <span className="row-amount" style={{ color: textColor, fontSize: '0.8rem' }}>
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

            <div className="section-header"><h3>{monthLabel(month)}の記録</h3></div>
            {monthEvents.length === 0 ? (
              <p className="empty-hint">この月の記録がありません</p>
            ) : (
              <ul className="item-list">
                {monthEvents.map(ev => (
                  <li key={ev.id}>
                    <div className="row-card" style={{ cursor: 'default' }}>
                      <span
                        className="genre-dot"
                        style={{ background: `${ev.amount < 0 ? '#e53e3e' : theme.accent}33`, width: 34, height: 34, fontSize: 17 }}
                      >
                        {ev.amount < 0 ? '✂️' : '🐷'}
                      </span>
                      <span className="row-main">
                        <span className="row-title">{ev.label}</span>
                        <span className="row-sub">{ev.date}</span>
                      </span>
                      <span
                        className="row-amount"
                        style={{ color: ev.amount < 0 ? '#e53e3e' : theme.accent }}
                      >
                        {ev.amount < 0 ? '−' : '+'}¥{Math.abs(ev.amount).toLocaleString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
