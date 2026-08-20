import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Brain,
  BookMarked,
  BookCopy,
  BookOpenText,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Download,
  Database,
  ExternalLink,
  FileClock,
  FolderKanban,
  GraduationCap,
  History,
  Home,
  Info,
  Languages,
  LibraryBig,
  Link2,
  ListChecks,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  Save,
  SearchCheck,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import { seedState } from './data/seed'
import { generateFeedback } from './lib/feedback'
import { cloneSeedState, createId, downloadWorkspace, loadWorkspace, saveWorkspace } from './lib/storage'
import type {
  ActivityLog,
  DecisionStatus,
  ExpressionCard,
  FeedbackItem,
  KnowledgeSource,
  ReadingItem,
  TranslationTask,
  ViewKey,
  WorkspaceState,
} from './types'

const navigation: Array<{ key: ViewKey; label: string; icon: typeof Home }> = [
  { key: 'overview', label: '学习总览', icon: Home },
  { key: 'reading', label: '译学晨读', icon: BookOpenText },
  { key: 'studio', label: '翻译工坊', icon: Languages },
  { key: 'library', label: '知识书架', icon: Database },
  { key: 'notebook', label: '表达手账', icon: BookMarked },
  { key: 'logs', label: '学习记忆', icon: Brain },
  { key: 'settings', label: '工作台设置', icon: Settings },
]

const stageMeta = {
  draft: { label: '初译', step: 1 },
  feedback: { label: '反馈决策', step: 2 },
  revision: { label: '修订反思', step: 3 },
  complete: { label: '已归档', step: 4 },
} as const

const roleIcon = {
  任务分析: Target,
  术语核验: SearchCheck,
  译文审校: MessageSquareText,
  学习反思: GraduationCap,
}

const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )

const dueToday = (iso: string) => new Date(iso).getTime() <= new Date().setHours(23, 59, 59, 999)

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => loadWorkspace())
  const [activeView, setActiveView] = useState<ViewKey>('overview')
  const [activeTaskId, setActiveTaskId] = useState(() => loadWorkspace().tasks[0]?.id ?? '')
  const [toast, setToast] = useState('')

  useEffect(() => saveWorkspace(workspace), [workspace])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const activeTask = workspace.tasks.find((task) => task.id === activeTaskId) ?? workspace.tasks[0]
  const completedCount = workspace.tasks.filter((task) => task.stage === 'complete').length
  const dueCards = workspace.expressions.filter((card) => dueToday(card.nextReviewAt))

  const log = (entry: Omit<ActivityLog, 'id' | 'createdAt'>) => {
    const next: ActivityLog = { ...entry, id: createId('log'), createdAt: new Date().toISOString() }
    setWorkspace((current) => ({ ...current, logs: [next, ...current.logs] }))
  }

  const updateTask = (taskId: string, patch: Partial<TranslationTask>) => {
    setWorkspace((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task,
      ),
    }))
  }

  const startReading = (reading: ReadingItem) => {
    const existing = workspace.tasks.find((task) => task.readingId === reading.id && task.stage !== 'complete')
    if (existing) {
      setActiveTaskId(existing.id)
      setActiveView('studio')
      setToast('已回到这项翻译任务')
      return
    }

    const task: TranslationTask = {
      id: createId('task'),
      readingId: reading.id,
      title: reading.title,
      sourceText: reading.sourceText,
      sourceName: reading.sourceName,
      sourceUrl: reading.sourceUrl,
      brief: reading.prompt,
      audience: workspace.settings.primaryAudience,
      initialTranslation: '',
      revisedTranslation: '',
      reflection: '',
      stage: 'draft',
      feedback: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const entry: ActivityLog = {
      id: createId('log'),
      type: 'task',
      title: '创建翻译任务',
      detail: `从晨读“${reading.title}”创建任务。`,
      taskId: task.id,
      createdAt: new Date().toISOString(),
    }
    setWorkspace((current) => ({ ...current, tasks: [task, ...current.tasks], logs: [entry, ...current.logs] }))
    setActiveTaskId(task.id)
    setActiveView('studio')
    setToast('翻译任务已创建')
  }

  const submitDraft = async (task: TranslationTask) => {
    if (task.initialTranslation.trim().length < 8) {
      setToast('请先完成一版初译')
      return
    }
    updateTask(task.id, { stage: 'feedback' })
    setToast('正在生成分角色反馈…')
    const endpoint = workspace.settings.feedbackMode === 'endpoint' ? workspace.settings.aiEndpoint : ''
    const feedback = await generateFeedback(task, endpoint)
    updateTask(task.id, { feedback, stage: 'feedback', revisedTranslation: task.initialTranslation })
    log({
      type: 'feedback',
      title: '生成协同反馈',
      detail: `针对“${task.title}”生成 ${feedback.length} 条分角色反馈。`,
      taskId: task.id,
    })
    setToast(`已生成 ${feedback.length} 条反馈`)
  }

  const decideFeedback = (task: TranslationTask, feedbackId: string, status: DecisionStatus) => {
    const feedback = task.feedback.map((item) => (item.id === feedbackId ? { ...item, status } : item))
    updateTask(task.id, { feedback })
    const target = task.feedback.find((item) => item.id === feedbackId)
    log({
      type: 'decision',
      title: status === 'accepted' ? '采纳反馈建议' : '拒绝反馈建议',
      detail: target?.title ?? '反馈决策',
      taskId: task.id,
    })
  }

  const updateFeedbackReason = (task: TranslationTask, feedbackId: string, reason: string) => {
    updateTask(task.id, {
      feedback: task.feedback.map((item) => (item.id === feedbackId ? { ...item, reason } : item)),
    })
  }

  const saveExpression = (task: TranslationTask, feedback: FeedbackItem) => {
    if (!feedback.expression || !feedback.meaning) return
    if (workspace.expressions.some((card) => card.expression === feedback.expression)) {
      setToast('这条表达已在手账中')
      return
    }
    const card: ExpressionCard = {
      id: createId('expression'),
      expression: feedback.expression,
      meaning: feedback.meaning,
      context: feedback.observation,
      sourceTaskId: task.id,
      sourceLabel: task.title,
      level: 0,
      nextReviewAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
    const entry: ActivityLog = {
      id: createId('log'),
      type: 'expression',
      title: '收藏表达',
      detail: `${feedback.expression} → ${feedback.meaning}`,
      taskId: task.id,
      createdAt: new Date().toISOString(),
    }
    setWorkspace((current) => ({
      ...current,
      expressions: [card, ...current.expressions],
      logs: [entry, ...current.logs],
    }))
    setToast('已加入表达手账')
  }

  const enterRevision = (task: TranslationTask) => {
    if (task.feedback.some((item) => item.status === 'pending')) {
      setToast('请先处理每一条反馈')
      return
    }
    updateTask(task.id, { stage: 'revision' })
    setToast('反馈决策已保存，进入修订')
  }

  const completeTask = (task: TranslationTask) => {
    if (task.revisedTranslation.trim().length < 8 || task.reflection.trim().length < 6) {
      setToast('请完成修订译文和学习反思')
      return
    }
    const completedAt = new Date().toISOString()
    updateTask(task.id, { stage: 'complete', completedAt })
    log({
      type: 'revision',
      title: '归档翻译任务',
      detail: `完成“${task.title}”的初译、反馈决策、修订与反思。`,
      taskId: task.id,
    })
    setToast('任务已归档，完整过程已记录')
  }

  const reviewExpression = (card: ExpressionCard, remembered: boolean) => {
    const intervals = [0, 1, 3, 7, 14, 30]
    const nextLevel = remembered ? Math.min(card.level + 1, intervals.length - 1) : Math.max(card.level - 1, 0)
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + intervals[nextLevel])
    setWorkspace((current) => ({
      ...current,
      expressions: current.expressions.map((item) =>
        item.id === card.id ? { ...item, level: nextLevel, nextReviewAt: nextDate.toISOString() } : item,
      ),
      logs: [
        {
          id: createId('log'),
          type: 'review',
          title: remembered ? '表达复习：记得' : '表达复习：需要巩固',
          detail: card.expression,
          createdAt: new Date().toISOString(),
        },
        ...current.logs,
      ],
    }))
    setToast(remembered ? `下次将在第 ${intervals[nextLevel]} 天复习` : '已缩短复习间隔')
  }

  const recordPractice = (card: ExpressionCard, response: string) => {
    log({
      type: 'review',
      title: '完成迁移练习',
      detail: `${card.expression}：${response}`,
      taskId: card.sourceTaskId,
    })
    setToast('迁移练习已写入学习记忆')
  }

  const resetWorkspace = () => {
    const next = cloneSeedState()
    setWorkspace(next)
    setActiveTaskId(next.tasks[0]?.id ?? '')
    setActiveView('overview')
    setToast('演示数据已恢复')
  }

  const viewTitle = navigation.find((item) => item.key === activeView)?.label ?? '译学工作台'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setActiveView('overview')} aria-label="返回学习总览">
          <span className="brand-mark"><Languages size={22} /></span>
          <span><strong>译学工作台</strong><small>Translation Learning Lab</small></span>
        </button>

        <nav className="main-nav" aria-label="主导航">
          <p className="nav-caption">学习空间</p>
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                className={activeView === item.key ? 'nav-item active' : 'nav-item'}
                onClick={() => setActiveView(item.key)}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.key === 'notebook' && dueCards.length > 0 && <b>{dueCards.length}</b>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="privacy-card">
            <ShieldCheck size={18} />
            <div><strong>本地优先</strong><span>学习数据仅存当前浏览器</span></div>
          </div>
          <div className="learner-chip">
            <span>{workspace.settings.learnerName.slice(0, 1)}</span>
            <div><strong>{workspace.settings.learnerName}</strong><small>{workspace.settings.primaryAudience}</small></div>
            <ChevronRight size={16} />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><span className="mobile-brand">译学工作台 · </span>{viewTitle}</div>
          <div className="topbar-meta"><span>{new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())}</span><CircleUserRound size={20} /></div>
        </header>

        <div className="page-wrap">
          {activeView === 'overview' && (
            <Overview
              learnerName={workspace.settings.learnerName}
              tasks={workspace.tasks}
              expressions={workspace.expressions}
              readings={workspace.readings}
              activeTask={activeTask}
              completedCount={completedCount}
              dueCount={dueCards.length}
              onNavigate={setActiveView}
              onOpenTask={(id) => { setActiveTaskId(id); setActiveView('studio') }}
              onStartReading={startReading}
            />
          )}
          {activeView === 'reading' && <MorningReading readings={workspace.readings} onStart={startReading} />}
          {activeView === 'studio' && (
            <Studio
              tasks={workspace.tasks}
              activeTask={activeTask}
              onSelectTask={setActiveTaskId}
              onUpdate={updateTask}
              onSubmitDraft={submitDraft}
              onDecision={decideFeedback}
              onReason={updateFeedbackReason}
              onSaveExpression={saveExpression}
              onEnterRevision={enterRevision}
              onComplete={completeTask}
            />
          )}
          {activeView === 'library' && <KnowledgeLibrary sources={workspace.knowledgeSources} />}
          {activeView === 'notebook' && (
            <Notebook cards={workspace.expressions} onReview={reviewExpression} onPractice={recordPractice} />
          )}
          {activeView === 'logs' && <ProcessArchive workspace={workspace} />}
          {activeView === 'settings' && (
            <WorkspaceSettingsView
              workspace={workspace}
              onChange={setWorkspace}
              onExport={() => downloadWorkspace(workspace)}
              onReset={resetWorkspace}
            />
          )}
        </div>

        <nav className="mobile-nav" aria-label="移动端导航">
          {navigation.map((item) => {
            const Icon = item.icon
            return <button key={item.key} className={activeView === item.key ? 'active' : ''} onClick={() => setActiveView(item.key)}><Icon size={20} /><span>{item.label.slice(0, 2)}</span></button>
          })}
        </nav>
      </main>

      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  )
}

function Overview({
  learnerName,
  tasks,
  expressions,
  readings,
  activeTask,
  completedCount,
  dueCount,
  onNavigate,
  onOpenTask,
  onStartReading,
}: {
  learnerName: string
  tasks: TranslationTask[]
  expressions: ExpressionCard[]
  readings: ReadingItem[]
  activeTask?: TranslationTask
  completedCount: number
  dueCount: number
  onNavigate: (view: ViewKey) => void
  onOpenTask: (id: string) => void
  onStartReading: (reading: ReadingItem) => void
}) {
  const today = readings[0]
  return (
    <div className="stack-lg">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="kicker"><span className="proof-dot" /> {learnerName} · 今日校样台</span>
          <h1>译文会完成，<br />判断要留下。</h1>
          <p>把源文、核验、取舍与修订摆在同一张工作台上。这里不替你交稿，只让每一次选择都有来路。</p>
          <div className="hero-actions">
            {activeTask && activeTask.stage !== 'complete' ? (
              <button className="button primary" onClick={() => onOpenTask(activeTask.id)}>继续当前任务 <ArrowRight size={17} /></button>
            ) : (
              <button className="button primary" onClick={() => onStartReading(today)}>开始今日晨读 <ArrowRight size={17} /></button>
            )}
            <button className="button ghost" onClick={() => onNavigate('reading')}>浏览学习材料</button>
          </div>
        </div>
        <div className="proof-sheet" aria-hidden="true">
          <div className="proof-head"><span>TRANSLATION PROOF</span><b>08 / 20</b></div>
          <div className="proof-columns">
            <div><small>SOURCE</small><p>Human oversight remains essential when automated systems influence decisions…</p></div>
            <div><small>VERSION 02</small><p>自动化系统影响人的相关决策时，人工监督机制仍不可或缺。</p></div>
          </div>
          <div className="proof-note"><span>核</span><p>agency → 主体作用<br />保留责任主体</p></div>
          <div className="proof-stamp">DECISION<br />RECORDED</div>
        </div>
      </section>

      <section className="metric-grid">
        <Metric icon={FolderKanban} label="进行中的任务" value={String(tasks.filter((task) => task.stage !== 'complete').length)} note="保持一次只专注一个任务" tone="green" />
        <Metric icon={CheckCircle2} label="已归档任务" value={String(completedCount)} note="含初译、修订和反思" tone="orange" />
        <Metric icon={LibraryBig} label="表达手账" value={String(expressions.length)} note={`${dueCount} 条等待复习`} tone="blue" />
        <Metric icon={History} label="证据节点" value={String(tasks.reduce((sum, task) => sum + task.feedback.length, 0))} note="反馈、决定与来源" tone="sand" />
      </section>

      <section className="two-column">
        <div className="panel focus-card">
          <div className="section-heading"><div><span>正在进行</span><h2>学习闭环</h2></div><button onClick={() => onNavigate('studio')}>查看全部 <ArrowRight size={15} /></button></div>
          {activeTask ? (
            <>
              <div className="task-summary">
                <div className="task-icon"><Languages size={24} /></div>
                <div><span className="eyebrow">{stageMeta[activeTask.stage].label}</span><h3>{activeTask.title}</h3><p>{activeTask.brief}</p></div>
              </div>
              <div className="mini-flow">
                {['动态输入', '独立初译', '协同反馈', '修订反思'].map((label, index) => (
                  <div key={label} className={index < stageMeta[activeTask.stage].step ? 'done' : index === stageMeta[activeTask.stage].step - 1 ? 'current' : ''}>
                    <span>{index < stageMeta[activeTask.stage].step ? <Check size={13} /> : index + 1}</span><small>{label}</small>
                  </div>
                ))}
              </div>
              <button className="button soft full" onClick={() => onOpenTask(activeTask.id)}>进入翻译工坊 <ArrowRight size={16} /></button>
            </>
          ) : <EmptyState icon={FolderKanban} title="还没有翻译任务" text="从晨读材料创建第一项任务。" />}
        </div>

        <div className="panel reading-preview">
          <div className="section-heading"><div><span>5—10 分钟</span><h2>今日译学晨读</h2></div><Clock3 size={20} /></div>
          <div className="preview-art"><span>{today.tags[0]}</span><BookOpenText size={42} /></div>
          <span className="eyebrow">{today.eyebrow}</span>
          <h3>{today.title}</h3>
          <p>{today.summary}</p>
          <div className="tag-row">{today.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <button className="button text" onClick={() => onStartReading(today)}>阅读并开始微翻译 <ArrowRight size={16} /></button>
        </div>
      </section>

      <section className="memory-ribbon">
        <div><span>工作台记住什么</span><h2>当前任务、翻译决定、可迁移策略</h2></div>
        <p>借鉴统一学习空间的思路，但记忆对象不是聊天内容，而是有来源、有版本、有理由的翻译过程。</p>
        <button onClick={() => onNavigate('logs')}>查看学习记忆 <ArrowRight size={16} /></button>
      </section>
    </div>
  )
}

function Metric({ icon: Icon, label, value, note, tone }: { icon: typeof Home; label: string; value: string; note: string; tone: string }) {
  return <div className={`metric-card ${tone}`}><div className="metric-icon"><Icon size={21} /></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>
}

function MorningReading({ readings, onStart }: { readings: ReadingItem[]; onStart: (reading: ReadingItem) => void }) {
  const [selected, setSelected] = useState(readings[0]?.id)
  const item = readings.find((reading) => reading.id === selected) ?? readings[0]
  return (
    <div className="stack-lg">
      <PageIntro kicker="动态输入" title="译学晨读" text="从可追溯材料中发现一个值得翻译的问题，而不是等待模型直接给出答案。" />
      <div className="reading-layout">
        <div className="reading-list">
          {readings.map((reading) => (
            <button key={reading.id} className={reading.id === item.id ? 'reading-item active' : 'reading-item'} onClick={() => setSelected(reading.id)}>
              <div><span>{reading.eyebrow}</span><strong>{reading.title}</strong><small><Clock3 size={13} /> {reading.readingMinutes} 分钟 · {reading.tags[0]}</small></div>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
        <article className="panel reading-detail">
          <div className="detail-topline"><span className="kicker"><BookOpenText size={15} /> {item.eyebrow}</span><span>{item.publishedAt}</span></div>
          <h1>{item.title}</h1>
          <p className="lead">{item.summary}</p>
          <div className="source-box"><div className="quote-mark">“</div><p>{item.sourceText}</p></div>
          <div className="source-meta">
            <div><Link2 size={17} /><span><strong>{item.sourceName}</strong><small>{item.sourceNote}</small></span></div>
            {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">查看主题来源 <ExternalLink size={14} /></a>}
          </div>
          <div className="micro-task"><span>微型翻译任务</span><p>{item.prompt}</p></div>
          <div className="tag-row">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <button className="button primary" onClick={() => onStart(item)}>带着任务进入翻译工坊 <ArrowRight size={17} /></button>
        </article>
      </div>
    </div>
  )
}

function KnowledgeLibrary({ sources }: { sources: KnowledgeSource[] }) {
  const kinds = ['全部', ...Array.from(new Set(sources.map((source) => source.kind)))]
  const [filter, setFilter] = useState('全部')
  const visible = filter === '全部' ? sources : sources.filter((source) => source.kind === filter)
  const [activeId, setActiveId] = useState(sources[0]?.id ?? '')
  const active = visible.find((source) => source.id === activeId) ?? visible[0]

  return (
    <div className="stack-lg">
      <PageIntro kicker="来源优先" title="知识书架" text="把规范、术语库、平行文本和课程材料放在反馈之前；每条资料都保留身份、用途与核验状态。" />
      <section className="library-toolbar">
        <div className="kind-tabs" aria-label="资源类型">
          {kinds.map((kind) => <button key={kind} className={filter === kind ? 'active' : ''} onClick={() => setFilter(kind)}>{kind}</button>)}
        </div>
        <span><Database size={15} /> {visible.length} 项资料</span>
      </section>
      <div className="library-layout">
        <div className="source-catalog">
          {visible.map((source) => (
            <button key={source.id} className={active?.id === source.id ? 'source-card active' : 'source-card'} onClick={() => setActiveId(source.id)}>
              <span className={`source-kind kind-${source.kind}`}>{source.kind}</span>
              <strong>{source.title}</strong>
              <small>{source.organization}</small>
              <div>{source.tags.slice(0, 2).map((tag) => <i key={tag}>{tag}</i>)}</div>
            </button>
          ))}
        </div>
        {active ? (
          <article className="panel source-dossier">
            <div className="dossier-index">SOURCE / {String(sources.indexOf(active) + 1).padStart(2, '0')}</div>
            <div className="panel-label"><BookCopy size={17} /> {active.kind} · {active.organization}</div>
            <h2>{active.title}</h2>
            <p className="dossier-summary">{active.description}</p>
            <dl>
              <div><dt>语言</dt><dd>{active.language}</dd></div>
              <div><dt>最近核验</dt><dd>{active.verifiedAt}</dd></div>
              <div><dt>使用边界</dt><dd>{active.usageNote}</dd></div>
            </dl>
            <div className="tag-row">{active.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            {active.url ? <a className="button primary inline-button" href={active.url} target="_blank" rel="noreferrer">打开原始来源 <ExternalLink size={16} /></a> : <div className="notice"><Info size={16} /><span>这项资源仍待接入和核验，当前不能作为正式术语依据。</span></div>}
          </article>
        ) : <EmptyState icon={Database} title="没有匹配的资料" text="切换资源类型查看其他条目。" />}
      </div>
      <div className="boundary-note"><ShieldCheck size={18} /><p><strong>不是“上传即可信”。</strong> 知识书架负责组织来源和版本；具体术语在用于译文前，仍需回到原始文件和适用语境核验。</p></div>
    </div>
  )
}

function Studio({ tasks, activeTask, onSelectTask, onUpdate, onSubmitDraft, onDecision, onReason, onSaveExpression, onEnterRevision, onComplete }: {
  tasks: TranslationTask[]
  activeTask?: TranslationTask
  onSelectTask: (id: string) => void
  onUpdate: (id: string, patch: Partial<TranslationTask>) => void
  onSubmitDraft: (task: TranslationTask) => Promise<void>
  onDecision: (task: TranslationTask, feedbackId: string, status: DecisionStatus) => void
  onReason: (task: TranslationTask, feedbackId: string, reason: string) => void
  onSaveExpression: (task: TranslationTask, feedback: FeedbackItem) => void
  onEnterRevision: (task: TranslationTask) => void
  onComplete: (task: TranslationTask) => void
}) {
  const [submitting, setSubmitting] = useState(false)
  if (!activeTask) return <EmptyState icon={Languages} title="还没有翻译任务" text="请先从译学晨读创建任务。" />
  const task = activeTask
  const accepted = task.feedback.filter((item) => item.status === 'accepted').length

  const handleSubmit = async () => {
    setSubmitting(true)
    await onSubmitDraft(task)
    setSubmitting(false)
  }

  return (
    <div className="stack-lg">
      <div className="studio-header">
        <PageIntro kicker="过程化翻译" title="翻译工坊" text="AI 提供候选和问题；你负责核验、决定并说明理由。" />
        <select value={task.id} onChange={(event) => onSelectTask(event.target.value)} aria-label="选择翻译任务">
          {tasks.map((item) => <option key={item.id} value={item.id}>{item.stage === 'complete' ? '✓ ' : ''}{item.title}</option>)}
        </select>
      </div>
      <div className="stepper">
        {[
          ['初译', '独立形成第一版'],
          ['反馈', '分角色审视'],
          ['修订', '决定并说明'],
          ['归档', '沉淀为证据'],
        ].map(([label, sub], index) => {
          const done = index + 1 < stageMeta[task.stage].step || task.stage === 'complete'
          const current = index + 1 === stageMeta[task.stage].step
          return <div key={label} className={done ? 'done' : current ? 'current' : ''}><span>{done ? <Check size={15} /> : index + 1}</span><div><strong>{label}</strong><small>{sub}</small></div></div>
        })}
      </div>

      {task.stage === 'draft' && (
        <div className="studio-grid">
          <section className="panel source-panel">
            <div className="panel-label"><BookOpenText size={17} /> 原文与任务</div>
            <h2>{task.title}</h2>
            <div className="brief-grid"><div><span>目标读者</span><strong>{task.audience}</strong></div><div><span>任务要求</span><strong>{task.brief}</strong></div></div>
            <div className="source-text">{task.sourceText}</div>
            <div className="source-meta compact"><div><Link2 size={16} /><span><strong>{task.sourceName}</strong><small>来源信息将随任务一起归档</small></span></div>{task.sourceUrl && <a href={task.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a>}</div>
          </section>
          <section className="panel editor-panel">
            <div className="panel-label"><Languages size={17} /> 独立初译</div>
            <div className="notice"><Info size={16} /><span>提交初译后才会显示反馈，避免 AI 提前替代你的判断。</span></div>
            <textarea value={task.initialTranslation} onChange={(event) => onUpdate(task.id, { initialTranslation: event.target.value })} placeholder="在这里完成你的第一版译文……" />
            <div className="editor-foot"><span>{task.initialTranslation.length} 字</span><button className="button primary" disabled={submitting} onClick={handleSubmit}>{submitting ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} 提交初译并获取反馈</button></div>
          </section>
        </div>
      )}

      {task.stage === 'feedback' && (
        <div className="stack-md">
          <section className="panel comparison-strip"><div><span>你的初译</span><p>{task.initialTranslation}</p></div><div className="feedback-stat"><strong>{task.feedback.length}</strong><span>条分角色反馈</span><small>{task.feedback.filter((item) => item.status !== 'pending').length} 条已处理</small></div></section>
          <div className="feedback-grid">
            {task.feedback.map((feedback) => {
              const Icon = roleIcon[feedback.role]
              return (
                <article className={`panel feedback-card ${feedback.status}`} key={feedback.id}>
                  <div className="feedback-role"><span><Icon size={18} /></span><div><small>{feedback.role}</small><h3>{feedback.title}</h3></div></div>
                  <p>{feedback.observation}</p>
                  <div className="suggestion"><strong>建议</strong><p>{feedback.suggestion}</p></div>
                  <div className="evidence"><Link2 size={14} />{feedback.evidence}</div>
                  {feedback.expression && <button className="expression-add" onClick={() => onSaveExpression(task, feedback)}><BookMarked size={15} />收藏表达：{feedback.expression}</button>}
                  <div className="decision-row">
                    <button className={feedback.status === 'accepted' ? 'accept selected' : 'accept'} onClick={() => onDecision(task, feedback.id, 'accepted')}><Check size={15} />采纳</button>
                    <button className={feedback.status === 'rejected' ? 'reject selected' : 'reject'} onClick={() => onDecision(task, feedback.id, 'rejected')}><X size={15} />不采纳</button>
                  </div>
                  {feedback.status !== 'pending' && <input value={feedback.reason} onChange={(event) => onReason(task, feedback.id, event.target.value)} placeholder="简要记录你的判断理由（建议填写）" />}
                </article>
              )
            })}
          </div>
          <div className="action-bar"><div><strong>{accepted}</strong> 条建议将作为修订参考</div><button className="button primary" onClick={() => onEnterRevision(task)}>完成反馈决策，进入修订 <ArrowRight size={17} /></button></div>
        </div>
      )}

      {task.stage === 'revision' && (
        <div className="studio-grid revision-grid">
          <section className="panel editor-panel">
            <div className="panel-label"><Languages size={17} /> 修订译文</div>
            <div className="original-draft"><span>初译</span><p>{task.initialTranslation}</p></div>
            <textarea value={task.revisedTranslation} onChange={(event) => onUpdate(task.id, { revisedTranslation: event.target.value })} placeholder="根据你的判断完成修订……" />
            <div className="editor-foot"><span>已采纳 {accepted} 条建议</span><span>{task.revisedTranslation.length} 字</span></div>
          </section>
          <section className="panel reflection-panel">
            <div className="panel-label"><GraduationCap size={17} /> 决策反思</div>
            <h2>这次修订中，最重要的一个判断是什么？</h2>
            <p>不要复述“AI 给了建议”，请说明你如何核验、取舍，以及这项判断能否迁移到下一次任务。</p>
            <textarea value={task.reflection} onChange={(event) => onUpdate(task.id, { reflection: event.target.value })} placeholder="例如：我保留了“人工监督机制”，因为目标读者需要看到责任主体……" />
            <div className="decision-summary"><span><CheckCircle2 size={17} />采纳 {accepted}</span><span><X size={17} />拒绝 {task.feedback.length - accepted}</span><span><BookMarked size={17} />表达可进入复习</span></div>
            <button className="button primary full" onClick={() => onComplete(task)}><Save size={17} />归档任务与过程记录</button>
          </section>
        </div>
      )}

      {task.stage === 'complete' && (
        <section className="panel completion-panel">
          <div className="completion-mark"><CheckCircle2 size={38} /></div>
          <span className="kicker">完整学习闭环已归档</span>
          <h1>{task.title}</h1>
          <p>初译、反馈决策、修订译文、来源和学习反思均已保留，可用于个人复盘和后续研究数据导出。</p>
          <div className="completion-grid"><div><span>初译</span><p>{task.initialTranslation}</p></div><div><span>终稿</span><p>{task.revisedTranslation}</p></div><div><span>反思</span><p>{task.reflection}</p></div></div>
          <div className="completion-meta"><span><Clock3 size={15} />{task.completedAt ? dateLabel(task.completedAt) : '已完成'}</span><span><ListChecks size={15} />{task.feedback.length} 条反馈决策</span><span><Link2 size={15} />{task.sourceName}</span></div>
        </section>
      )}
    </div>
  )
}

function Notebook({ cards, onReview, onPractice }: { cards: ExpressionCard[]; onReview: (card: ExpressionCard, remembered: boolean) => void; onPractice: (card: ExpressionCard, response: string) => void }) {
  const due = cards.filter((card) => dueToday(card.nextReviewAt))
  const [activeId, setActiveId] = useState(due[0]?.id ?? cards[0]?.id)
  const active = cards.find((card) => card.id === activeId)
  const [revealed, setRevealed] = useState(false)
  const [mode, setMode] = useState<'recall' | 'transfer'>('recall')
  const [practiceText, setPracticeText] = useState('')
  const [practiceSaved, setPracticeSaved] = useState(false)
  useEffect(() => { setRevealed(false); setPracticeText(''); setPracticeSaved(false) }, [activeId, mode])
  return (
    <div className="stack-lg">
      <div className="notebook-heading">
        <PageIntro kicker="检索练习" title="表达手账" text="收藏不是终点。先从记忆中提取，再把表达迁移到新的翻译语境。" />
        <div className="practice-switch"><button className={mode === 'recall' ? 'active' : ''} onClick={() => setMode('recall')}>语境回忆</button><button className={mode === 'transfer' ? 'active' : ''} onClick={() => setMode('transfer')}>迁移改写</button></div>
      </div>
      <section className="notebook-stats"><div><strong>{cards.length}</strong><span>累计表达</span></div><div><strong>{due.length}</strong><span>今日待复习</span></div><div><strong>{cards.filter((card) => card.level >= 3).length}</strong><span>进入长期记忆</span></div></section>
      {active ? (
        <div className="notebook-layout">
          <div className="card-list panel">
            <div className="panel-label"><LibraryBig size={17} /> 复习队列</div>
            {cards.map((card) => <button key={card.id} onClick={() => setActiveId(card.id)} className={card.id === active.id ? 'active' : ''}><div><strong>{card.expression}</strong><small>{dueToday(card.nextReviewAt) ? '今日到期' : `下次：${dateLabel(card.nextReviewAt)}`}</small></div><span>L{card.level}</span></button>)}
          </div>
          <div className="flashcard-panel">
            {mode === 'recall' ? <>
              <div className="flashcard">
                <span className="kicker">语境回忆 · Level {active.level}</span>
                <h2>{active.expression}</h2>
                <p className="context">{active.context}</p>
                <div className={revealed ? 'answer revealed' : 'answer'}><small>参考含义</small><strong>{revealed ? active.meaning : '先在心里完成回忆'}</strong></div>
                <div className="flash-source"><Link2 size={15} />{active.sourceLabel}</div>
              </div>
              {!revealed ? <button className="button proof-button" onClick={() => setRevealed(true)}>显示参考答案</button> : <div className="review-actions"><button onClick={() => { onReview(active, false); setRevealed(false) }}><RotateCcw size={17} />需要巩固</button><button onClick={() => { onReview(active, true); setRevealed(false) }}><Check size={17} />记得并会用</button></div>}
            </> : <div className="transfer-sheet">
              <span className="kicker">迁移改写 · 不显示标准答案</span>
              <h2>用上这条表达，完成一个新的译文判断。</h2>
              <div className="transfer-expression"><small>本轮表达</small><strong>{active.expression}</strong><span>{active.meaning}</span></div>
              <p>提示：为“高校在引入自动化评价工具时仍需保留人的最终判断”写一句审慎的英文表述，并说明适用读者。</p>
              <textarea value={practiceText} onChange={(event) => { setPracticeText(event.target.value); setPracticeSaved(false) }} placeholder="先独立完成一句表达，再写下你的语体或读者判断……" />
              <button className="button primary" disabled={practiceText.trim().length < 12 || practiceSaved} onClick={() => { onPractice(active, practiceText.trim()); setPracticeSaved(true) }}>{practiceSaved ? <Check size={17} /> : <Save size={17} />}{practiceSaved ? '已写入学习记忆' : '保存迁移尝试'}</button>
            </div>}
          </div>
        </div>
      ) : <EmptyState icon={BookMarked} title="表达手账还是空的" text="在处理反馈时，把有价值的表达收藏到这里。" />}
    </div>
  )
}

function ProcessArchive({ workspace }: { workspace: WorkspaceState }) {
  const completed = workspace.tasks.filter((task) => task.stage === 'complete')
  const decisionCount = workspace.tasks.reduce((sum, task) => sum + task.feedback.filter((item) => item.status !== 'pending').length, 0)
  const reflections = completed.filter((task) => task.reflection.trim()).slice(0, 3)
  const recentDecision = workspace.logs.find((entry) => entry.type === 'decision')
  return (
    <div className="stack-lg">
      <PageIntro kicker="三层学习记忆" title="学习记忆与研究档案" text="工作台记住当前任务、翻译决定和可迁移策略，而不是无差别保存所有对话。" />
      <section className="memory-layers">
        <article><span>L1 · 当前上下文</span><strong>{workspace.tasks.find((task) => task.stage !== 'complete')?.title ?? '暂无进行中的任务'}</strong><p>服务眼前任务，随版本更新。</p></article>
        <article><span>L2 · 决策证据</span><strong>{recentDecision?.title ?? '尚未形成反馈决策'}</strong><p>{decisionCount} 条采纳或拒绝记录，可回到具体任务。</p></article>
        <article><span>L3 · 可迁移策略</span><strong>{reflections[0]?.reflection || '完成任务反思后在这里沉淀策略'}</strong><p>只保留学习者明确写下的判断，不由系统替你推断。</p></article>
      </section>
      <section className="archive-summary">
        <div><FileClock size={22} /><span>事件记录<strong>{workspace.logs.length}</strong></span></div>
        <div><ListChecks size={22} /><span>反馈决策<strong>{decisionCount}</strong></span></div>
        <div><CheckCircle2 size={22} /><span>完整任务<strong>{completed.length}</strong></span></div>
        <div><Link2 size={22} /><span>可追溯来源<strong>{new Set(workspace.tasks.map((task) => task.sourceName)).size}</strong></span></div>
      </section>
      {reflections.length > 0 && <section className="strategy-board"><div className="section-heading"><div><span>来自已归档任务</span><h2>策略便笺</h2></div><Brain size={20} /></div><div>{reflections.map((task) => <blockquote key={task.id}><p>{task.reflection}</p><cite>{task.title}</cite></blockquote>)}</div></section>}
      <section className="panel timeline-panel">
        <div className="section-heading"><div><span>按时间倒序</span><h2>过程时间线</h2></div><span className="data-note">仅显示当前浏览器数据</span></div>
        <div className="timeline">
          {workspace.logs.map((entry, index) => (
            <div className="timeline-row" key={entry.id}><span className={`timeline-dot type-${entry.type}`} />{index < workspace.logs.length - 1 && <i />}
              <div className="timeline-time">{dateLabel(entry.createdAt)}</div><div className="timeline-content"><span>{entry.type}</span><strong>{entry.title}</strong><p>{entry.detail}</p></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function WorkspaceSettingsView({ workspace, onChange, onExport, onReset }: { workspace: WorkspaceState; onChange: (state: WorkspaceState) => void; onExport: () => void; onReset: () => void }) {
  const settings = workspace.settings
  const patch = (next: Partial<typeof settings>) => onChange({ ...workspace, settings: { ...settings, ...next } })
  return (
    <div className="stack-lg">
      <PageIntro kicker="工作台配置" title="设置" text="首版以本地优先为原则；真实模型通过安全的服务器端端点接入。" />
      <div className="settings-grid">
        <section className="panel settings-section"><div className="settings-title"><CircleUserRound size={21} /><div><h2>学习者设置</h2><p>用于个性化界面和任务默认值。</p></div></div><label>显示名称<input value={settings.learnerName} onChange={(event) => patch({ learnerName: event.target.value })} /></label><label>主要学习对象<select value={settings.primaryAudience} onChange={(event) => patch({ primaryAudience: event.target.value as typeof settings.primaryAudience })}><option>翻译专业本科生</option><option>MTI学生</option></select></label></section>
        <section className="panel settings-section"><div className="settings-title"><Sparkles size={21} /><div><h2>反馈引擎</h2><p>公开网页不得保存模型密钥。</p></div></div><div className="mode-switch"><button className={settings.feedbackMode === 'demo' ? 'active' : ''} onClick={() => patch({ feedbackMode: 'demo' })}><strong>演示反馈</strong><span>可重复、无需联网</span></button><button className={settings.feedbackMode === 'endpoint' ? 'active' : ''} onClick={() => patch({ feedbackMode: 'endpoint' })}><strong>安全端点</strong><span>调用自有服务器</span></button></div>{settings.feedbackMode === 'endpoint' && <label>反馈 API 地址<input type="url" value={settings.aiEndpoint} onChange={(event) => patch({ aiEndpoint: event.target.value })} placeholder="https://your-worker.example/api/feedback" /><small>端点负责保管密钥，并返回约定格式的 feedback 数组；调用失败时自动回退到演示反馈。</small></label>}<div className="security-note"><ShieldCheck size={17} />不要把 OpenAI、DeepSeek 或其他服务的 API 密钥写入 GitHub 仓库或浏览器代码。</div></section>
        <section className="panel settings-section wide"><div className="settings-title"><Download size={21} /><div><h2>数据与研究记录</h2><p>导出任务、版本、反馈决策、表达卡和时间线。</p></div></div><div className="data-actions"><button className="button soft" onClick={onExport}><Download size={17} />导出 JSON 数据</button><button className="button danger" onClick={onReset}><RotateCcw size={17} />恢复演示数据</button></div><p className="fine-print">当前版本使用 localStorage。清理浏览器数据会删除学习记录，请在正式试用前定期导出。若未来采集学生数据，应另行完成知情同意、权限控制、匿名化和机构伦理要求。</p></section>
      </div>
    </div>
  )
}

function PageIntro({ kicker, title, text }: { kicker: string; title: string; text: string }) {
  return <div className="page-intro"><span>{kicker}</span><h1>{title}</h1><p>{text}</p></div>
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Home; title: string; text: string }) {
  return <div className="empty-state"><span><Icon size={25} /></span><h3>{title}</h3><p>{text}</p></div>
}

export default App
