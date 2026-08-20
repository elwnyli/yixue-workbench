import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Brain,
  BookMarked,
  BookCopy,
  BookOpenText,
  Bot,
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
  FolderOpen,
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
  Moon,
  Palette,
  Plus,
  Copy,
  RotateCcw,
  Save,
  SearchCheck,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react'
import { seedState } from './data/seed'
import { generateFeedback } from './lib/feedback'
import { cloneSeedState, createId, downloadWorkspace, importMarkdownReadings, loadWorkspace, saveWorkspace, syncObsidianVault } from './lib/storage'
import type {
  ActivityLog,
  DecisionStatus,
  ExpressionCard,
  FeedbackItem,
  KnowledgeSource,
  ProjectTemplate,
  QualityCheck,
  ReadingItem,
  TermEntry,
  TranslationTask,
  ViewKey,
  WorkspaceState,
} from './types'

const navigation: Array<{ key: ViewKey; label: string; icon: typeof Home }> = [
  { key: 'overview', label: '学习总览', icon: Home },
  { key: 'projects', label: '项目与模板', icon: FolderKanban },
  { key: 'reading', label: '译学晨读', icon: BookOpenText },
  { key: 'studio', label: '翻译工坊', icon: Languages },
  { key: 'library', label: '知识书架', icon: Database },
  { key: 'notebook', label: '表达手账', icon: BookMarked },
  { key: 'logs', label: '学习记忆', icon: Brain },
  { key: 'settings', label: '工作台设置', icon: Settings },
]

const stageMeta = {
  setup: { label: '项目配置', step: 1 },
  terms: { label: '术语准备', step: 2 },
  draft: { label: '批量初译', step: 3 },
  feedback: { label: '人工审校', step: 4 },
  quality: { label: 'LQA 质检', step: 5 },
  consistency: { label: '一致性检验', step: 6 },
  reflection: { label: '复盘反思', step: 7 },
  complete: { label: '已归档', step: 8 },
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
    const dark = workspace.settings.theme === 'dark' || (workspace.settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.dataset.accent = workspace.settings.accent
  }, [workspace.settings.theme, workspace.settings.accent])

  useEffect(() => {
    if (!workspace.settings.shortcutsEnabled) return
    const views: ViewKey[] = ['overview', 'projects', 'reading', 'studio', 'library', 'notebook', 'logs', 'settings']
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return
      const index = Number(event.key) - 1
      if (index >= 0 && index < views.length) {
        event.preventDefault()
        setActiveView(views[index])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [workspace.settings.shortcutsEnabled])

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

  const updateTemplate = (templateId: string, patch: Partial<ProjectTemplate>) => {
    setWorkspace((current) => ({
      ...current,
      templates: current.templates.map((template) => template.id === templateId ? { ...template, ...patch } : template),
    }))
  }

  const createTaskFromTemplate = (template: ProjectTemplate) => {
    const task: TranslationTask = {
      id: createId('task'), readingId: '', title: `${template.name}项目`, sourceText: '', sourceName: '用户创建',
      templateId: template.id, sourceLanguage: template.sourceLanguage, targetLanguage: template.targetLanguage,
      brief: template.prompts.translation, audience: template.audience, terms: [], initialTranslation: '', revisedTranslation: '',
      qualityChecks: [], consistencyNotes: '', reflection: '', stage: 'setup', feedback: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    setWorkspace((current) => ({ ...current, tasks: [task, ...current.tasks] }))
    setActiveTaskId(task.id)
    setActiveView('studio')
    setToast('项目已创建，请补充原文和任务信息')
  }

  const startReading = (reading: ReadingItem) => {
    const existing = workspace.tasks.find((task) => task.readingId === reading.id && task.stage !== 'complete')
    if (existing) {
      setActiveTaskId(existing.id)
      setActiveView('studio')
      setToast('已回到这项翻译任务')
      return
    }

    const template = workspace.templates[0]
    const task: TranslationTask = {
      id: createId('task'),
      readingId: reading.id,
      title: reading.title,
      sourceText: reading.sourceText,
      sourceName: reading.sourceName,
      sourceUrl: reading.sourceUrl,
      templateId: template?.id,
      sourceLanguage: template?.sourceLanguage ?? '英语（en）',
      targetLanguage: template?.targetLanguage ?? '简体中文（zh-CN）',
      brief: reading.prompt,
      audience: workspace.settings.primaryAudience,
      terms: [],
      initialTranslation: '',
      revisedTranslation: '',
      qualityChecks: [],
      consistencyNotes: '',
      reflection: '',
      stage: 'setup',
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
    if (task.revisedTranslation.trim().length < 8) {
      setToast('请先完成审校后的修订译文')
      return
    }
    const sourceNumbers = task.sourceText.match(/\d+(?:[.,]\d+)*/g) ?? []
    const targetNumbers = task.revisedTranslation.match(/\d+(?:[.,]\d+)*/g) ?? []
    const untranslated = task.revisedTranslation.match(/\b[A-Za-z]{5,}\b/g) ?? []
    const checks: QualityCheck[] = [
      { id: createId('qa'), label: '数字完整性', detail: sourceNumbers.join('|') === targetNumbers.join('|') ? '源文与译文数字序列一致。' : '数字序列可能不一致，请人工核对。', status: sourceNumbers.join('|') === targetNumbers.join('|') ? 'pass' : 'warning' },
      { id: createId('qa'), label: '未翻译片段', detail: untranslated.length ? `发现可能遗留的源语言片段：${untranslated.slice(0, 6).join('、')}` : '未发现明显的长英文残留。', status: untranslated.length ? 'warning' : 'pass' },
      { id: createId('qa'), label: '术语覆盖', detail: task.terms.filter((term) => term.status === 'approved' && term.target && !task.revisedTranslation.includes(term.target)).length ? '部分已批准译名未出现在修订稿中。' : '已批准术语未发现明显缺失。', status: task.terms.some((term) => term.status === 'approved' && term.target && !task.revisedTranslation.includes(term.target)) ? 'warning' : 'pass' },
      { id: createId('qa'), label: '译文长度', detail: task.revisedTranslation.length < task.sourceText.length * 0.25 ? '译文相对源文偏短，建议检查漏译。' : '长度比例未触发漏译预警。', status: task.revisedTranslation.length < task.sourceText.length * 0.25 ? 'warning' : 'pass' },
    ]
    updateTask(task.id, { stage: 'quality', qualityChecks: checks })
    setToast('审校已保存，LQA 检查完成')
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
          {activeView === 'projects' && (
            <ProjectTemplates
              templates={workspace.templates}
              onUpdate={updateTemplate}
              onDuplicate={(template) => {
                const copy = { ...template, id: createId('template'), name: `${template.name}（副本）`, prompts: { ...template.prompts }, qualityRules: [...template.qualityRules] }
                setWorkspace((current) => ({ ...current, templates: [...current.templates, copy] }))
                setToast('模板副本已创建')
              }}
              onCreateTask={createTaskFromTemplate}
            />
          )}
          {activeView === 'reading' && <MorningReading readings={workspace.readings} onStart={startReading} />}
          {activeView === 'studio' && (
            <Studio
              tasks={workspace.tasks}
              templates={workspace.templates}
              activeTask={activeTask}
              onSelectTask={setActiveTaskId}
              onUpdate={updateTask}
              onSubmitDraft={submitDraft}
              onDecision={decideFeedback}
              onReason={updateFeedbackReason}
              onSaveExpression={saveExpression}
              onEnterRevision={enterRevision}
              onComplete={completeTask}
              onToast={setToast}
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
              onSyncObsidian={async () => {
                try {
                  const result = await syncObsidianVault(workspace)
                  setToast(result === 'synced' ? '已同步到所选 Obsidian Vault' : '浏览器不支持文件夹同步，已下载 Markdown')
                } catch (error) {
                  if ((error as Error).name !== 'AbortError') setToast('未能同步，请重新选择 Vault 文件夹')
                }
              }}
              onImportMarkdown={async (files) => {
                const readings = await importMarkdownReadings(files)
                setWorkspace((current) => ({ ...current, readings: [...readings, ...current.readings] }))
                setToast(`已导入 ${readings.length} 份 Markdown 材料`)
              }}
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
              <div className="mini-flow workflow-mini">
                {['配置', '术语', '初译', '审校', 'LQA', '一致性', '反思', '归档'].map((label, index) => (
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

function ProjectTemplates({ templates, onUpdate, onDuplicate, onCreateTask }: {
  templates: ProjectTemplate[]
  onUpdate: (id: string, patch: Partial<ProjectTemplate>) => void
  onDuplicate: (template: ProjectTemplate) => void
  onCreateTask: (template: ProjectTemplate) => void
}) {
  const [activeId, setActiveId] = useState(templates[0]?.id ?? '')
  const [promptKey, setPromptKey] = useState<keyof ProjectTemplate['prompts']>('system')
  const template = templates.find((item) => item.id === activeId) ?? templates[0]
  if (!template) return <EmptyState icon={FolderKanban} title="还没有项目模板" text="创建模板后即可开始项目。" />
  const promptLabels: Record<keyof ProjectTemplate['prompts'], string> = { system: '角色边界', translation: '翻译提示', terminology: '术语提示', review: '审校提示', quality: '质检提示' }
  return (
    <div className="stack-lg">
      <PageIntro kicker="Project profiles" title="项目与模板" text="把领域、读者、语言方向、提示词和质检规则装进可复用模板；每个项目仍可单独调整。" />
      <div className="template-layout">
        <aside className="template-catalog">
          {templates.map((item) => <button key={item.id} className={item.id === template.id ? 'template-card active' : 'template-card'} onClick={() => setActiveId(item.id)}><span>{item.domain}</span><strong>{item.name}</strong><small>{item.description}</small><i>{item.sourceLanguage} → {item.targetLanguage}</i></button>)}
          <button className="template-add" onClick={() => onDuplicate(template)}><Plus size={17} />以当前模板新建</button>
        </aside>
        <section className="panel template-editor">
          <div className="template-editor-head"><div><span>正在编辑</span><h2>{template.name}</h2></div><div><button className="button soft" onClick={() => onDuplicate(template)}><Copy size={16} />复制模板</button><button className="button primary" onClick={() => onCreateTask(template)}><FolderKanban size={16} />用此模板创建项目</button></div></div>
          <div className="template-fields">
            <label>模板名称<input value={template.name} onChange={(event) => onUpdate(template.id, { name: event.target.value })} /></label>
            <label>领域<input value={template.domain} onChange={(event) => onUpdate(template.id, { domain: event.target.value })} /></label>
            <label>源语言<input value={template.sourceLanguage} onChange={(event) => onUpdate(template.id, { sourceLanguage: event.target.value })} /></label>
            <label>目标语言<input value={template.targetLanguage} onChange={(event) => onUpdate(template.id, { targetLanguage: event.target.value })} /></label>
            <label className="wide">默认目标读者<input value={template.audience} onChange={(event) => onUpdate(template.id, { audience: event.target.value })} /></label>
            <label className="wide">模板说明<textarea value={template.description} onChange={(event) => onUpdate(template.id, { description: event.target.value })} /></label>
          </div>
          <div className="prompt-workbench">
            <div className="prompt-tabs">{(Object.keys(promptLabels) as Array<keyof ProjectTemplate['prompts']>).map((key) => <button key={key} className={promptKey === key ? 'active' : ''} onClick={() => setPromptKey(key)}>{promptLabels[key]}</button>)}</div>
            <div className="prompt-editor"><label>{promptLabels[promptKey]}<small>可以直接粘贴从其他地方获得的提示词，再按项目需要修改。</small></label><textarea value={template.prompts[promptKey]} onChange={(event) => onUpdate(template.id, { prompts: { ...template.prompts, [promptKey]: event.target.value } })} /></div>
          </div>
          <label className="rules-editor">LQA 规则（每行一条）<textarea value={template.qualityRules.join('\n')} onChange={(event) => onUpdate(template.id, { qualityRules: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></label>
          <p className="autosave-note"><CheckCircle2 size={15} />模板修改自动保存在当前浏览器。</p>
        </section>
      </div>
    </div>
  )
}

function Studio({ tasks, templates, activeTask, onSelectTask, onUpdate, onSubmitDraft, onDecision, onReason, onSaveExpression, onEnterRevision, onComplete, onToast }: {
  tasks: TranslationTask[]
  templates: ProjectTemplate[]
  activeTask?: TranslationTask
  onSelectTask: (id: string) => void
  onUpdate: (id: string, patch: Partial<TranslationTask>) => void
  onSubmitDraft: (task: TranslationTask) => Promise<void>
  onDecision: (task: TranslationTask, feedbackId: string, status: DecisionStatus) => void
  onReason: (task: TranslationTask, feedbackId: string, reason: string) => void
  onSaveExpression: (task: TranslationTask, feedback: FeedbackItem) => void
  onEnterRevision: (task: TranslationTask) => void
  onComplete: (task: TranslationTask) => void
  onToast: (message: string) => void
}) {
  const [submitting, setSubmitting] = useState(false)
  if (!activeTask) return <EmptyState icon={Languages} title="还没有翻译任务" text="请先从译学晨读创建任务。" />
  const task = activeTask
  const template = templates.find((item) => item.id === task.templateId) ?? templates[0]
  const accepted = task.feedback.filter((item) => item.status === 'accepted').length

  const handleSubmit = async () => {
    setSubmitting(true)
    await onSubmitDraft(task)
    setSubmitting(false)
  }

  const extractTerms = () => {
    const stop = new Set(['which', 'their', 'there', 'these', 'those', 'should', 'would', 'could', 'about', 'remain', 'when', 'people', 'information'])
    const words = task.sourceText.match(/\b[A-Za-z][A-Za-z-]{4,}\b/g) ?? []
    const unique = Array.from(new Set(words.map((word) => word.toLowerCase()))).filter((word) => !stop.has(word)).slice(0, 10)
    const existing = new Set(task.terms.map((term) => term.source.toLowerCase()))
    const additions: TermEntry[] = unique.filter((word) => !existing.has(word)).map((word) => ({ id: createId('term'), source: word, target: '', note: '机器候选，待人工核验', status: 'pending' }))
    onUpdate(task.id, { terms: [...task.terms, ...additions] })
    onToast(additions.length ? `已提取 ${additions.length} 个候选术语` : '没有发现新的候选术语')
  }

  const patchTerm = (id: string, patch: Partial<TermEntry>) => onUpdate(task.id, { terms: task.terms.map((term) => term.id === id ? { ...term, ...patch } : term) })

  const enterTerms = () => {
    if (!task.title.trim() || !task.sourceText.trim()) { onToast('请先填写项目名称和原文'); return }
    onUpdate(task.id, { stage: 'terms' })
    onToast('项目配置已保存，开始术语准备')
  }

  return (
    <div className="stack-lg">
      <div className="studio-header">
        <PageIntro kicker="过程化翻译" title="翻译工坊" text="AI 提供候选和问题；你负责核验、决定并说明理由。" />
        <select value={task.id} onChange={(event) => onSelectTask(event.target.value)} aria-label="选择翻译任务">
          {tasks.map((item) => <option key={item.id} value={item.id}>{item.stage === 'complete' ? '✓ ' : ''}{item.title}</option>)}
        </select>
      </div>
      <div className="stepper workflow-stepper">
        {[
          ['配置', '项目与模板'],
          ['术语', '提取与核验'],
          ['初译', '独立形成'],
          ['审校', '人机协同'],
          ['LQA', '规则质检'],
          ['一致性', '术语与风格'],
          ['反思', '迁移策略'],
          ['归档', '过程证据'],
        ].map(([label, sub], index) => {
          const done = index + 1 < stageMeta[task.stage].step || task.stage === 'complete'
          const current = index + 1 === stageMeta[task.stage].step
          return <div key={label} className={done ? 'done' : current ? 'current' : ''}><span>{done ? <Check size={15} /> : index + 1}</span><div><strong>{label}</strong><small>{sub}</small></div></div>
        })}
      </div>

      {task.stage === 'setup' && (
        <div className="studio-grid">
          <section className="panel setup-panel">
            <div className="panel-label"><FolderKanban size={17} /> 项目档案</div>
            <label>项目名称<input value={task.title} onChange={(event) => onUpdate(task.id, { title: event.target.value })} /></label>
            <label>项目模板<select value={task.templateId ?? template?.id} onChange={(event) => { const next = templates.find((item) => item.id === event.target.value); if (next) onUpdate(task.id, { templateId: next.id, sourceLanguage: next.sourceLanguage, targetLanguage: next.targetLanguage, audience: next.audience, brief: next.prompts.translation }) }}>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <div className="form-pair"><label>源语言<input value={task.sourceLanguage} onChange={(event) => onUpdate(task.id, { sourceLanguage: event.target.value })} /></label><label>目标语言<input value={task.targetLanguage} onChange={(event) => onUpdate(task.id, { targetLanguage: event.target.value })} /></label></div>
            <label>目标读者<input value={task.audience} onChange={(event) => onUpdate(task.id, { audience: event.target.value })} /></label>
            <label>任务要求<textarea value={task.brief} onChange={(event) => onUpdate(task.id, { brief: event.target.value })} /></label>
          </section>
          <section className="panel setup-panel">
            <div className="panel-label"><BookOpenText size={17} /> 原文与来源</div>
            <label>来源名称<input value={task.sourceName} onChange={(event) => onUpdate(task.id, { sourceName: event.target.value })} /></label>
            <label>原文<textarea className="source-input" value={task.sourceText} onChange={(event) => onUpdate(task.id, { sourceText: event.target.value })} placeholder="粘贴单段或多段原文……" /></label>
            <div className="template-glimpse"><span>当前模板提示</span><p>{template?.prompts.system}</p></div>
            <button className="button primary full" onClick={enterTerms}>保存配置，进入术语准备 <ArrowRight size={17} /></button>
          </section>
        </div>
      )}

      {task.stage === 'terms' && (
        <div className="stack-md">
          <section className="panel term-toolbar"><div><span className="panel-label"><SearchCheck size={17} /> 候选术语与项目术语库</span><p>自动提取只产生候选项；译名和核验说明由你确认。</p></div><div><button className="button soft" onClick={() => onUpdate(task.id, { terms: [...task.terms, { id: createId('term'), source: '', target: '', note: '', status: 'pending' }] })}><Plus size={16} />手动添加</button><button className="button primary" onClick={extractTerms}><WandSparkles size={16} />从原文提取</button></div></section>
          <section className="panel term-table">
            <div className="term-row term-head"><span>源语术语</span><span>首选译名</span><span>核验说明</span><span>状态</span></div>
            {task.terms.map((term) => <div className="term-row" key={term.id}><input value={term.source} onChange={(event) => patchTerm(term.id, { source: event.target.value })} placeholder="source term" /><input value={term.target} onChange={(event) => patchTerm(term.id, { target: event.target.value })} placeholder="首选译名" /><input value={term.note} onChange={(event) => patchTerm(term.id, { note: event.target.value })} placeholder="来源／语境／待核验" /><button className={term.status === 'approved' ? 'term-status approved' : 'term-status'} onClick={() => patchTerm(term.id, { status: term.status === 'approved' ? 'pending' : 'approved' })}>{term.status === 'approved' ? <Check size={14} /> : null}{term.status === 'approved' ? '已批准' : '待核验'}</button></div>)}
            {!task.terms.length && <EmptyState icon={SearchCheck} title="还没有候选术语" text="可以自动提取，也可以手动添加；没有关键术语时可直接继续。" />}
          </section>
          <div className="action-bar"><div><strong>{task.terms.filter((term) => term.status === 'approved').length}</strong> 个已批准项目术语</div><button className="button primary" onClick={() => onUpdate(task.id, { stage: 'draft' })}>进入批量初译 <ArrowRight size={17} /></button></div>
        </div>
      )}

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
            <div className="panel-label"><Languages size={17} /> 独立／批量初译</div>
            <div className="notice"><Info size={16} /><span>提交初译后才会显示反馈，避免 AI 提前替代你的判断。</span></div>
            <div className="prompt-note"><Bot size={15} /><span><strong>{workspaceModelLabel(template)}</strong>{template?.prompts.translation}</span></div>
            <textarea value={task.initialTranslation} onChange={(event) => onUpdate(task.id, { initialTranslation: event.target.value })} placeholder="在这里完成你的第一版译文……" />
            <div className="editor-foot"><span>{task.sourceText.split(/\n+/).filter(Boolean).length} 个文本段 · {task.initialTranslation.length} 字</span><button className="button primary" disabled={submitting} onClick={handleSubmit}>{submitting ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} 提交初译并进入审校</button></div>
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
          <section className="panel review-editor"><div className="panel-label"><Languages size={17} /> 人工审校后的修订稿</div><textarea value={task.revisedTranslation} onChange={(event) => onUpdate(task.id, { revisedTranslation: event.target.value })} placeholder="结合已核验的建议完成修订；最终决定仍由你作出……" /></section>
          <div className="action-bar"><div><strong>{accepted}</strong> 条建议已采纳，{task.feedback.length - accepted} 条未采纳</div><button className="button primary" onClick={() => onEnterRevision(task)}>完成审校，运行 LQA <ArrowRight size={17} /></button></div>
        </div>
      )}

      {task.stage === 'quality' && (
        <div className="stack-md">
          <section className="panel quality-board"><div className="quality-head"><div><span className="panel-label"><ShieldCheck size={17} /> LQA 规则质检</span><h2>{task.qualityChecks.filter((item) => item.status === 'warning').length} 项需要人工复核</h2></div><small>自动检查只能发现可计算的风险，不代表译文质量已经合格。</small></div><div className="quality-list">{task.qualityChecks.map((item) => <div className={item.status} key={item.id}><span>{item.status === 'pass' ? <Check size={16} /> : <Info size={16} />}</span><div><strong>{item.label}</strong><p>{item.detail}</p></div></div>)}</div></section>
          <div className="action-bar"><div>依据模板“{template?.name}”执行基础检查</div><button className="button primary" onClick={() => onUpdate(task.id, { stage: 'consistency' })}>完成复核，检查一致性 <ArrowRight size={17} /></button></div>
        </div>
      )}

      {task.stage === 'consistency' && (
        <div className="studio-grid">
          <section className="panel consistency-panel"><div className="panel-label"><Link2 size={17} /> 术语一致性</div>{task.terms.filter((term) => term.status === 'approved').map((term) => { const used = Boolean(term.target && task.revisedTranslation.includes(term.target)); return <div className="consistency-row" key={term.id}><span className={used ? 'used' : 'missing'}>{used ? <Check size={14} /> : <Info size={14} />}</span><strong>{term.source}</strong><ArrowRight size={14} /><b>{term.target || '未填写译名'}</b><small>{used ? '终稿中已使用' : '终稿中未检出'}</small></div> })}{!task.terms.some((term) => term.status === 'approved') && <EmptyState icon={Link2} title="没有已批准术语" text="本项目不需要术语对照，仍可记录风格和专名检查。" />}</section>
          <section className="panel reflection-panel"><div className="panel-label"><ListChecks size={17} /> 一致性检查记录</div><h2>哪些问题已经核对，哪些仍需交稿前确认？</h2><p>记录术语、专名、数字、语气或格式的一致性判断，避免把“未检出”误写为“已验证”。</p><textarea value={task.consistencyNotes} onChange={(event) => onUpdate(task.id, { consistencyNotes: event.target.value })} placeholder="例如：human agency 全文统一译为“人的能动性”；机构名称仍需核对官方中文版……" /><button className="button primary full" onClick={() => onUpdate(task.id, { stage: 'reflection' })}>保存一致性记录，进入学习反思 <ArrowRight size={17} /></button></section>
        </div>
      )}

      {task.stage === 'reflection' && (
        <div className="studio-grid revision-grid">
          <section className="panel editor-panel"><div className="panel-label"><Languages size={17} /> 初译与终稿对照</div><div className="original-draft"><span>初译</span><p>{task.initialTranslation}</p></div><div className="final-draft"><span>终稿</span><p>{task.revisedTranslation}</p></div></section>
          <section className="panel reflection-panel">
            <div className="panel-label"><GraduationCap size={17} /> 决策反思</div>
            <h2>这次修订中，最重要的一个判断是什么？</h2>
            <p>不要复述“AI 给了建议”，请说明你如何核验、取舍，以及这项判断能否迁移到下一次任务。</p>
            <textarea value={task.reflection} onChange={(event) => onUpdate(task.id, { reflection: event.target.value })} placeholder="例如：我保留了“人工监督机制”，因为目标读者需要看到责任主体……" />
            <div className="decision-summary"><span><CheckCircle2 size={17} />采纳 {accepted}</span><span><ShieldCheck size={17} />LQA {task.qualityChecks.length} 项</span><span><BookMarked size={17} />表达可进入复习</span></div>
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

const workspaceModelLabel = (template?: ProjectTemplate) => template ? `${template.name}：` : '当前提示：'

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

function WorkspaceSettingsView({ workspace, onChange, onExport, onSyncObsidian, onImportMarkdown, onReset }: { workspace: WorkspaceState; onChange: (state: WorkspaceState) => void; onExport: () => void; onSyncObsidian: () => Promise<void>; onImportMarkdown: (files: FileList) => Promise<void>; onReset: () => void }) {
  const settings = workspace.settings
  const patch = (next: Partial<typeof settings>) => onChange({ ...workspace, settings: { ...settings, ...next } })
  return (
    <div className="stack-lg">
      <PageIntro kicker="Workspace preferences" title="设置" text="主题、快捷键、模型入口和本地知识库都由你控制；公开网页不会保存模型密钥。" />
      <div className="settings-grid">
        <section className="panel settings-section"><div className="settings-title"><CircleUserRound size={21} /><div><h2>学习者设置</h2><p>用于个性化界面和任务默认值。</p></div></div><label>显示名称<input value={settings.learnerName} onChange={(event) => patch({ learnerName: event.target.value })} /></label><label>主要学习对象<select value={settings.primaryAudience} onChange={(event) => patch({ primaryAudience: event.target.value as typeof settings.primaryAudience })}><option>翻译专业本科生</option><option>MTI学生</option></select></label></section>
        <section className="panel settings-section"><div className="settings-title"><Palette size={21} /><div><h2>界面外观</h2><p>主题和校样标记色实时生效。</p></div></div><div className="theme-choices">{(['system', 'light', 'dark'] as const).map((theme) => <button key={theme} className={settings.theme === theme ? 'active' : ''} onClick={() => patch({ theme })}><Moon size={16} /><strong>{theme === 'system' ? '跟随系统' : theme === 'light' ? '浅色' : '深色'}</strong></button>)}</div><label>校样标记色<select value={settings.accent} onChange={(event) => patch({ accent: event.target.value as typeof settings.accent })}><option value="proof">校样朱红</option><option value="teal">术语青绿</option><option value="plum">批注紫</option></select></label></section>
        <section className="panel settings-section"><div className="settings-title"><Bot size={21} /><div><h2>AI 模型</h2><p>选择模型身份；真实调用仍需安全端点。</p></div></div><label>服务类型<select value={settings.aiProvider} onChange={(event) => patch({ aiProvider: event.target.value as typeof settings.aiProvider, feedbackMode: event.target.value === '演示模式' ? 'demo' : 'endpoint' })}><option>演示模式</option><option>OpenAI 兼容</option><option>DeepSeek</option><option>自定义</option></select></label><label>模型名称<input value={settings.aiModel} onChange={(event) => patch({ aiModel: event.target.value })} placeholder="例如 deepseek-chat" /></label>{settings.feedbackMode === 'endpoint' && <label>安全端点地址<input type="url" value={settings.aiEndpoint} onChange={(event) => patch({ aiEndpoint: event.target.value })} placeholder="https://your-worker.example/api/feedback" /><small>服务器负责保管密钥；调用失败时自动回退到演示反馈。</small></label>}<div className="security-note"><ShieldCheck size={17} />GitHub Pages 不能安全保存 API 密钥，因此这里不提供密钥输入框。</div></section>
        <section className="panel settings-section"><div className="settings-title"><WandSparkles size={21} /><div><h2>快捷键</h2><p>减少在长流程中的鼠标切换。</p></div></div><button className={settings.shortcutsEnabled ? 'toggle-row on' : 'toggle-row'} onClick={() => patch({ shortcutsEnabled: !settings.shortcutsEnabled })}><span><strong>启用导航快捷键</strong><small>Option / Alt + 1—8 切换主要页面</small></span><i>{settings.shortcutsEnabled ? '已开启' : '已关闭'}</i></button></section>
        <section className="panel settings-section"><div className="settings-title"><FolderOpen size={21} /><div><h2>Obsidian 知识库</h2><p>由你选择 Vault，平台只写入指定子文件夹。</p></div></div><label>同步文件夹名称<input value={settings.obsidianFolderName} onChange={(event) => patch({ obsidianFolderName: event.target.value })} /></label><div className="data-actions"><button className="button primary" onClick={() => void onSyncObsidian()}><FolderOpen size={16} />同步任务到 Vault</button><label className="button soft file-button"><Upload size={16} />导入 Markdown<input type="file" accept=".md,text/markdown" multiple onChange={(event) => { if (event.target.files?.length) void onImportMarkdown(event.target.files); event.target.value = '' }} /></label></div><p className="fine-print">Chrome、Edge 等浏览器可直接选择 Vault；不支持文件夹访问的浏览器会改为下载 Markdown。导入文件会进入“译学晨读”，平台不会扫描整个 Vault。</p></section>
        <section className="panel settings-section wide"><div className="settings-title"><Download size={21} /><div><h2>数据与研究记录</h2><p>导出项目模板、任务版本、反馈决策、术语、LQA 与时间线。</p></div></div><div className="data-actions"><button className="button soft" onClick={onExport}><Download size={17} />导出 JSON 数据</button><button className="button danger" onClick={onReset}><RotateCcw size={17} />恢复演示数据</button></div><p className="fine-print">当前版本使用 localStorage。清理浏览器数据会删除学习记录，请在正式试用前定期导出。若未来采集学生数据，应另行完成知情同意、权限控制、匿名化和机构伦理要求。</p></section>
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
