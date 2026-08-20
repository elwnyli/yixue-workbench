import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  BookOpen,
  Bot,
  Boxes,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Copy,
  Database,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FolderKanban,
  History,
  Home,
  Languages,
  Link2,
  ListChecks,
  LoaderCircle,
  Moon,
  Newspaper,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Pause,
  Play,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Upload,
  WandSparkles,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { cloneSeed, createId, createSegment } from "./data";
import { detectLanguage, runAI } from "./services/ai";
import {
  createBatchJob,
  mergeBatchProject,
  retryFailedJob,
  runBatchStep,
} from "./services/batch";
import { syncContentSources } from "./services/content";
import { lookupTerm } from "./services/lookup";
import { parseFile, parsePastedText } from "./services/parser";
import { inspectProject, inspectSegment } from "./services/quality";
import {
  downloadText,
  exportWorkspace,
  loadWorkspace,
  parseWorkspaceImport,
  saveWorkspace,
} from "./storage";
import type {
  Feedback,
  NewsItem,
  PersonalReference,
  PhraseCard,
  Project,
  ProjectFile,
  QuickSession,
  Segment,
  SkillManifest,
  StyleGuide,
  TermEntry,
  TranslationMode,
  TranslationUnit,
  ViewKey,
  Workspace,
} from "./types";
import "./v2.css";

const navigation: Array<{
  key: ViewKey;
  label: string;
  icon: typeof Home;
  shortcut: number;
}> = [
  { key: "home", label: "工作台概览", icon: Home, shortcut: 1 },
  { key: "quick", label: "快速翻译", icon: Zap, shortcut: 2 },
  { key: "projects", label: "翻译项目", icon: FolderKanban, shortcut: 3 },
  { key: "news", label: "每日译闻", icon: Newspaper, shortcut: 4 },
  { key: "review", label: "复习中心", icon: Brain, shortcut: 5 },
  { key: "assets", label: "语言资产", icon: Database, shortcut: 6 },
  { key: "skills", label: "Skill 中心", icon: Boxes, shortcut: 7 },
  { key: "settings", label: "设置", icon: Settings, shortcut: 8 },
];

const emptyQuick = (): QuickSession => ({
  id: createId("quick"),
  source: "",
  detectedLanguage: "待识别",
  sourceLanguage: "英语（en）",
  targetLanguage: "简体中文（zh-CN）",
  domain: "通用",
  textType: "段落",
  audience: "普通读者",
  style: "自然",
  mode: "student-first",
  studentDraft: "",
  aiReference: "",
  finalTranslation: "",
  feedback: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
const isDue = (iso: string) => new Date(iso).getTime() <= Date.now();
const projectSegments = (project: Project) =>
  project.files.flatMap((file) => file.segments);
const projectProgress = (project: Project) => {
  const segments = projectSegments(project);
  return segments.length
    ? Math.round(
        (segments.filter((item) =>
          ["confirmed", "completed"].includes(item.status),
        ).length /
          segments.length) *
          100,
      )
    : 0;
};

export default function AppV2() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("home");
  const [quick, setQuick] = useState<QuickSession>(() => emptyQuick());
  const [activeProjectId, setActiveProjectId] = useState("project-demo");
  const [projectAutoOpen, setProjectAutoOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<
    "loading" | "saved" | "saving" | "error"
  >("loading");

  useEffect(() => {
    void loadWorkspace()
      .then((state) => {
        setWorkspace(state);
        setQuick(state.quickSessions[0] ?? emptyQuick());
        setSaveState("saved");
      })
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error ? error.message : "无法读取V2工作区",
        );
        setSaveState("error");
      });
  }, []);

  useEffect(() => {
    if (!workspace || !workspace.settings.autoSave) return;
    setSaveState("saving");
    const timer = window.setTimeout(
      () =>
        void saveWorkspace(workspace)
          .then(() => setSaveState("saved"))
          .catch(() => setSaveState("error")),
      450,
    );
    return () => window.clearTimeout(timer);
  }, [workspace]);

  useEffect(() => {
    if (
      !workspace?.settings.autoSave ||
      ![
        quick.source,
        quick.studentDraft,
        quick.finalTranslation,
        quick.aiReference,
      ].some((value) => value.trim())
    )
      return;
    const timer = window.setTimeout(
      () =>
        setWorkspace((current) =>
          current
            ? {
                ...current,
                quickSessions: [
                  { ...quick, updatedAt: new Date().toISOString() },
                  ...current.quickSessions.filter(
                    (item) => item.id !== quick.id,
                  ),
                ],
              }
            : current,
        ),
      650,
    );
    return () => window.clearTimeout(timer);
  }, [quick, workspace?.settings.autoSave]);

  useEffect(() => {
    if (!workspace) return;
    const dark =
      workspace.settings.theme === "dark" ||
      (workspace.settings.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.v2theme = dark ? "dark" : "light";
  }, [workspace?.settings.theme]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return;
      const item = navigation.find((nav) => nav.shortcut === Number(event.key));
      if (item) {
        event.preventDefault();
        setActiveView(item.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (loadError)
    return (
      <div className="v2-loading load-failed">
        <AlertTriangle />
        <strong>工作区读取失败</strong>
        <p>{loadError}</p>
        <small>
          原数据没有被演示数据覆盖；迁移失败时已保留备份。请不要清除浏览器站点数据。
        </small>
        <button
          className="v2-btn primary"
          onClick={() => window.location.reload()}
        >
          重新读取
        </button>
      </div>
    );
  if (!workspace)
    return (
      <div className="v2-loading">
        <LoaderCircle className="spin" />
        <strong>正在恢复 V2 工作区…</strong>
      </div>
    );

  const patch = (fn: (current: Workspace) => Workspace) =>
    setWorkspace((current) => (current ? fn(current) : current));
  const activeProject =
    workspace.projects.find((project) => project.id === activeProjectId) ??
    workspace.projects[0];
  const dueCards = workspace.phraseCards.filter((card) =>
    isDue(card.nextReviewAt),
  );

  const navigate = (view: ViewKey) => {
    if (view === "projects") setProjectAutoOpen(false);
    setActiveView(view);
  };
  const saveQuickSession = () => {
    if (
      !quick.source.trim() ||
      !(quick.finalTranslation || quick.studentDraft).trim()
    ) {
      setToast("请先填写原文和译文");
      return;
    }
    const next = {
      ...quick,
      finalTranslation: quick.finalTranslation || quick.studentDraft,
      updatedAt: new Date().toISOString(),
    };
    patch((current) => ({
      ...current,
      quickSessions: [
        next,
        ...current.quickSessions.filter((item) => item.id !== next.id),
      ],
    }));
    setQuick(next);
    setToast("快速翻译过程已保存");
  };

  const createProject = (project: Project) => {
    patch((current) => ({
      ...current,
      projects: [project, ...current.projects],
    }));
    setActiveProjectId(project.id);
    setProjectAutoOpen(true);
    setActiveView("projects");
    setToast("项目已创建，正在进入双语编辑器");
  };

  return (
    <div className="v2-shell">
      <aside className="v2-sidebar">
        <button className="v2-brand" onClick={() => navigate("home")}>
          <span>
            <Languages size={19} />
          </span>
          <div>
            <strong>译学工作台</strong>
            <small>V2 · TRANSLATION DESK</small>
          </div>
        </button>
        <nav>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={activeView === item.key ? "active" : ""}
                onClick={() => navigate(item.key)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                <kbd>⌥{item.shortcut}</kbd>
                {item.key === "review" && dueCards.length > 0 && (
                  <b>{dueCards.length}</b>
                )}
              </button>
            );
          })}
        </nav>
        <div className="v2-sidebar-bottom">
          <div
            className={
              workspace.settings.provider === "deepseek-proxy" &&
              workspace.settings.endpoint
                ? "connection online"
                : "connection"
            }
          >
            {workspace.settings.provider === "deepseek-proxy" &&
            workspace.settings.endpoint ? (
              <Wifi size={15} />
            ) : (
              <WifiOff size={15} />
            )}
            <span>
              <strong>
                {workspace.settings.provider === "demo"
                  ? "演示模式"
                  : "DeepSeek代理"}
              </strong>
              <small>
                {workspace.settings.provider === "demo"
                  ? "不会发送文本"
                  : workspace.settings.model}
              </small>
            </span>
          </div>
          <div className="profile-dot">
            <span>{workspace.settings.learnerName.slice(0, 1)}</span>
            <div>
              <strong>{workspace.settings.learnerName}</strong>
              <small>翻译学习者</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="v2-main">
        <header className="v2-topbar">
          <div>
            <span>译学工作台</span>
            <ChevronRight size={13} />
            {navigation.find((item) => item.key === activeView)?.label}
          </div>
          <div>
            <span className={`save-state ${saveState}`}>
              {saveState === "saving" ? (
                <LoaderCircle className="spin" size={14} />
              ) : saveState === "error" ? (
                <AlertTriangle size={14} />
              ) : (
                <Check size={14} />
              )}
              {saveState === "saving"
                ? "正在保存"
                : saveState === "error"
                  ? "保存失败"
                  : "已自动保存"}
            </span>
            <button
              onClick={() =>
                patch((current) => ({
                  ...current,
                  settings: {
                    ...current.settings,
                    theme: current.settings.theme === "dark" ? "light" : "dark",
                  },
                }))
              }
              aria-label="切换主题"
            >
              {workspace.settings.theme === "dark" ? (
                <Sun size={17} />
              ) : (
                <Moon size={17} />
              )}
            </button>
          </div>
        </header>
        <div className="v2-page">
          {activeView === "home" && (
            <Dashboard
              workspace={workspace}
              dueCards={dueCards}
              onNavigate={navigate}
              onOpenProject={(id) => {
                setActiveProjectId(id);
                setProjectAutoOpen(true);
                setActiveView("projects");
              }}
              onTrainNews={(news) => {
                setQuick({
                  ...emptyQuick(),
                  domain: news.tags[0] ?? "通用",
                  textType: "资讯",
                  audience: "普通读者",
                });
                navigate("quick");
                setToast("训练已创建，请从原始来源选择可使用的片段");
              }}
            />
          )}
          {activeView === "quick" && (
            <QuickTranslate
              session={quick}
              workspace={workspace}
              onChange={setQuick}
              onWorkspace={patch}
              onSave={saveQuickSession}
              onToast={setToast}
              onSaveAsProject={(source, target) => {
                if (!source.trim()) {
                  setToast("请先输入原文");
                  return;
                }
                const file = parsePastedText("快速翻译转项目", source);
                const first = file.segments[0];
                if (!first) {
                  setToast("没有可转为项目的片段");
                  return;
                }
                first.target = target;
                first.initialTarget = quick.studentDraft;
                first.studentDraft = quick.studentDraft;
                first.status = target ? "needs-confirmation" : "untranslated";
                createProject(buildProject("快速翻译项目", [file], workspace));
              }}
            />
          )}
          {activeView === "projects" && (
            <Projects
              workspace={workspace}
              activeProject={activeProject}
              initialMode={projectAutoOpen ? "editor" : "list"}
              onSelectProject={setActiveProjectId}
              onWorkspace={patch}
              onCreate={createProject}
              onToast={setToast}
            />
          )}
          {activeView === "news" && (
            <NewsFeed
              workspace={workspace}
              onWorkspace={patch}
              onPractice={(news, excerpt, paragraphId) => {
                const now = new Date().toISOString();
                const exercise = {
                  id: createId("practice"),
                  contentId: news.id,
                  sourceUrl: news.url,
                  sourceText: excerpt,
                  selectedExcerpt: excerpt,
                  sourceParagraphId: paragraphId,
                  sourceLanguage: news.language,
                  targetLanguage:
                    news.language === "英语"
                      ? "简体中文（zh-CN）"
                      : "英语（en）",
                  domain: news.category,
                  style: "自然",
                  audience: "普通读者",
                  mode: "student-first" as const,
                  studentDraft: "",
                  aiPretranslation: "",
                  aiReference: "",
                  finalTranslation: "",
                  feedback: [],
                  createdAt: now,
                  updatedAt: now,
                };
                patch((current) => ({
                  ...current,
                  practices: [exercise, ...current.practices],
                }));
                setQuick({
                  ...emptyQuick(),
                  source: excerpt,
                  detectedLanguage: news.language,
                  domain: news.category,
                  textType: news.contentType,
                  audience: "普通读者",
                  mode: "student-first",
                });
                navigate("quick");
                setToast("选段已建立为翻译练习，并保留文章来源");
              }}
            />
          )}
          {activeView === "review" && (
            <ReviewCenter
              cards={workspace.phraseCards}
              records={workspace.reviewRecords}
              onWorkspace={patch}
              onToast={setToast}
            />
          )}
          {activeView === "assets" && (
            <LanguageAssets
              workspace={workspace}
              onWorkspace={patch}
              onToast={setToast}
            />
          )}
          {activeView === "skills" && (
            <SkillCenter
              workspace={workspace}
              onWorkspace={patch}
              onToast={setToast}
            />
          )}
          {activeView === "settings" && (
            <SettingsPage
              workspace={workspace}
              onWorkspace={patch}
              onToast={setToast}
            />
          )}
        </div>
      </main>
      <nav className="v2-mobile-nav">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              className={activeView === item.key ? "active" : ""}
              onClick={() => navigate(item.key)}
            >
              <Icon size={18} />
              <span>{item.label.slice(0, 2)}</span>
            </button>
          );
        })}
      </nav>
      {toast && (
        <div className="v2-toast">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}

function Dashboard({
  workspace,
  dueCards,
  onNavigate,
  onOpenProject,
  onTrainNews,
}: {
  workspace: Workspace;
  dueCards: PhraseCard[];
  onNavigate: (view: ViewKey) => void;
  onOpenProject: (id: string) => void;
  onTrainNews: (item: NewsItem) => void;
}) {
  const active = workspace.projects.find(
    (project) => project.status === "active",
  );
  const words = workspace.projects
    .flatMap(projectSegments)
    .reduce((sum, segment) => sum + segment.target.length, 0);
  const revisions = workspace.projects
    .flatMap(projectSegments)
    .reduce((sum, segment) => sum + segment.revisions.length, 0);
  return (
    <div className="v2-stack">
      <section className="desk-hero">
        <div>
          <span className="overline">
            TODAY'S DESK ·{" "}
            {new Intl.DateTimeFormat("zh-CN", {
              month: "long",
              day: "numeric",
              weekday: "long",
            }).format(new Date())}
          </span>
          <h1>
            今天的译稿，
            <br />
            从哪一步继续？
          </h1>
          <p>快速处理一段文字，或回到有上下文、有术语、有版本记录的项目。</p>
          <div>
            <button
              className="v2-btn primary"
              onClick={() => onNavigate("quick")}
            >
              <Zap size={17} />
              开始快速翻译
            </button>
            <button
              className="v2-btn inverse"
              onClick={() => onNavigate("projects")}
            >
              <Plus size={17} />
              创建翻译项目
            </button>
          </div>
        </div>
        <div className="evidence-rail">
          <span className="rail-label">PROCESS EVIDENCE</span>
          {["学生初译", "AI建议", "修改决定", "最终译文"].map(
            (label, index) => (
              <div key={label}>
                <i>{index + 1}</i>
                <strong>{label}</strong>
                <small>
                  {
                    [
                      "保留第一判断",
                      "单独标识来源",
                      "采纳或拒绝",
                      "确认后入库",
                    ][index]
                  }
                </small>
              </div>
            ),
          )}
        </div>
      </section>
      <section className="dashboard-grid">
        <article className="work-block span-2">
          <BlockHead
            eyebrow="继续工作"
            title="进行中的项目"
            action="查看全部"
            onAction={() => onNavigate("projects")}
          />
          {active ? (
            <div className="current-project">
              <div>
                <span>
                  {active.domain} · {active.sourceLanguage} →{" "}
                  {active.targetLanguage}
                </span>
                <h2>{active.name}</h2>
                <p>{active.description}</p>
                <div className="progress-track">
                  <i style={{ width: `${projectProgress(active)}%` }} />
                </div>
                <small>
                  {projectProgress(active)}% ·{" "}
                  {
                    projectSegments(active).filter(
                      (item) => item.status === "confirmed",
                    ).length
                  }
                  /{projectSegments(active).length} 个片段已确认
                </small>
              </div>
              <button
                className="v2-btn primary"
                onClick={() => onOpenProject(active.id)}
              >
                继续翻译 <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <Empty
              title="还没有进行中的项目"
              text="创建项目后会在这里显示进度。"
            />
          )}
        </article>
        <article className="work-block review-today">
          <BlockHead
            eyebrow="到期"
            title="今日复习"
            action="开始"
            onAction={() => onNavigate("review")}
          />
          <strong>{dueCards.length}</strong>
          <p>术语与表达等待回忆</p>
          <div>
            {dueCards.slice(0, 3).map((card) => (
              <span key={card.id}>{card.source}</span>
            ))}
          </div>
        </article>
        <article className="work-block">
          <BlockHead
            eyebrow="真实来源入口"
            title="今日译闻"
            action="全部"
            onAction={() => onNavigate("news")}
          />
          {workspace.news.slice(0, 2).map((item) => (
            <div className="news-mini" key={item.id}>
              <span>{item.source}</span>
              <strong>{item.title}</strong>
              <button onClick={() => onTrainNews(item)}>转为训练</button>
            </div>
          ))}
        </article>
        <article className="work-block">
          <BlockHead eyebrow="本周记录" title="学习数据" />
          <div className="stat-lines">
            <div>
              <strong>{words}</strong>
              <span>译文字数</span>
            </div>
            <div>
              <strong>{revisions}</strong>
              <span>修改版本</span>
            </div>
            <div>
              <strong>
                {
                  workspace.projects.filter(
                    (item) => item.status === "completed",
                  ).length
                }
              </strong>
              <span>完成项目</span>
            </div>
          </div>
          <p className="data-boundary">
            只展示当前浏览器的真实记录；数据不足时不推断学习效果。
          </p>
        </article>
        <article className="work-block">
          <BlockHead
            eyebrow="常用资源"
            title="语言资产"
            action="管理"
            onAction={() => onNavigate("assets")}
          />
          <div className="asset-summary">
            <span>
              <Database size={17} />
              <b>{workspace.translationMemory.length}</b> 翻译记忆
            </span>
            <span>
              <BookMarked size={17} />
              <b>{workspace.terms.length}</b> 项术语
            </span>
            <span>
              <Boxes size={17} />
              <b>
                {workspace.skills.filter((item) => item.enabled).length}
              </b>{" "}
              个Skill
            </span>
          </div>
        </article>
      </section>
    </div>
  );
}

function QuickTranslate({
  session,
  workspace,
  onChange,
  onWorkspace,
  onSave,
  onToast,
  onSaveAsProject,
}: {
  session: QuickSession;
  workspace: Workspace;
  onChange: (session: QuickSession) => void;
  onWorkspace: (fn: (current: Workspace) => Workspace) => void;
  onSave: () => void;
  onToast: (message: string) => void;
  onSaveAsProject: (source: string, target: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [rightTab, setRightTab] = useState<
    "ai" | "terms" | "phrases" | "quality"
  >("ai");
  const update = (next: Partial<QuickSession>) =>
    onChange({ ...session, ...next, updatedAt: new Date().toISOString() });
  const matchedTerms = workspace.terms.filter((term) =>
    session.source.toLowerCase().includes(term.source.toLowerCase()),
  );
  const issues = inspectSegment(
    {
      ...createSegment(
        session.id,
        1,
        session.source,
        session.finalTranslation || session.studentDraft,
        session.studentDraft,
      ),
      status: "translated",
    },
    workspace.terms,
  );
  const run = async () => {
    if (!session.source.trim()) {
      onToast("请先输入原文");
      return;
    }
    if (session.mode === "student-first" && !session.studentDraft.trim()) {
      onToast("“先自行翻译”模式需要先提交初译");
      return;
    }
    setRunning(true);
    const result = await runAI(session, workspace.settings);
    update({
      aiReference: session.mode === "analysis-only" ? "" : result.reference,
      feedback: result.feedback,
      finalTranslation: session.finalTranslation || session.studentDraft,
    });
    setRightTab("ai");
    setRunning(false);
    onToast(
      result.provider === "demo"
        ? "已生成演示反馈；未向外部服务发送文本"
        : "DeepSeek建议已返回",
    );
  };
  const addTM = () => {
    const target = session.finalTranslation || session.studentDraft;
    if (!session.source.trim() || !target.trim()) {
      onToast("请先确认译文");
      return;
    }
    const unit: TranslationUnit = {
      id: createId("tu"),
      source: session.source,
      target,
      sourceLanguage: session.sourceLanguage,
      targetLanguage: session.targetLanguage,
      domain: session.domain,
      quality: "approved",
      useCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onWorkspace((current) => ({
      ...current,
      translationMemory: [unit, ...current.translationMemory],
    }));
    onToast("已写入个人翻译记忆");
  };
  const extract = () => {
    const candidates = Array.from(
      new Set(session.source.match(/\b[A-Za-z][A-Za-z-]{4,}\b/g) ?? []),
    ).slice(0, 6);
    const additions: TermEntry[] = candidates
      .filter(
        (word) =>
          !workspace.terms.some(
            (term) => term.source.toLowerCase() === word.toLowerCase(),
          ),
      )
      .map((word) => ({
        id: createId("term"),
        source: word,
        target: "",
        definition: "",
        domain: session.domain,
        partOfSpeech: "",
        allowed: [],
        forbidden: [],
        example: session.source,
        sourceRef: "快速翻译候选，待人工核验",
        status: "candidate",
      }));
    onWorkspace((current) => ({
      ...current,
      terms: [...additions, ...current.terms],
    }));
    setRightTab("terms");
    onToast(`已生成 ${additions.length} 个候选术语，尚未批准`);
  };
  const addCard = () => {
    const target = session.finalTranslation || session.studentDraft;
    if (!target) {
      onToast("请先确认译文");
      return;
    }
    const card: PhraseCard = {
      id: createId("card"),
      type: "retranslation",
      source: session.source,
      target,
      context: session.source,
      usage: "快速翻译终稿复习",
      domain: session.domain,
      sourceRef: "快速翻译",
      errorRecord:
        session.studentDraft && session.studentDraft !== target
          ? session.studentDraft
          : "",
      explanation: "",
      tags: [session.domain],
      mastery: 0,
      nextReviewAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    onWorkspace((current) => ({
      ...current,
      phraseCards: [card, ...current.phraseCards],
    }));
    onToast("已加入今日复习");
  };
  return (
    <div className="quick-page">
      <PageHead
        eyebrow="QUICK TRANSLATE"
        title="快速翻译"
        text="学生译文、AI参考和最终确认各自保留；AI不会覆盖你的第一版。"
        actions={
          <>
            <button
              className="v2-btn subtle"
              onClick={() =>
                onSaveAsProject(
                  session.source,
                  session.finalTranslation || session.studentDraft,
                )
              }
            >
              <FolderKanban size={16} />
              保存为项目
            </button>
            <button className="v2-btn primary" onClick={onSave}>
              <Save size={16} />
              保存过程
            </button>
          </>
        }
      />
      <section className="task-strip">
        <label>
          源语言
          <select
            value={session.sourceLanguage}
            onChange={(event) => update({ sourceLanguage: event.target.value })}
          >
            <option>自动识别</option>
            <option>英语（en）</option>
            <option>简体中文（zh-CN）</option>
          </select>
        </label>
        <ArrowRight size={15} />
        <label>
          目标语言
          <select
            value={session.targetLanguage}
            onChange={(event) => update({ targetLanguage: event.target.value })}
          >
            <option>简体中文（zh-CN）</option>
            <option>英语（en）</option>
          </select>
        </label>
        <label>
          领域
          <select
            value={session.domain}
            onChange={(event) => update({ domain: event.target.value })}
          >
            {["通用", "教育", "科技", "新闻", "商务", "中医药"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          文本类型
          <select
            value={session.textType}
            onChange={(event) => update({ textType: event.target.value })}
          >
            {["段落", "新闻", "学术摘要", "说明文", "宣传材料"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          目标读者
          <input
            value={session.audience}
            onChange={(event) => update({ audience: event.target.value })}
          />
        </label>
        <label>
          风格
          <select
            value={session.style}
            onChange={(event) => update({ style: event.target.value })}
          >
            {["自然", "正式", "简洁", "学术", "口语化"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </section>
      <section className="mode-tabs">
        {(
          [
            ["student-first", "先自行翻译"],
            ["reference", "生成参考译文"],
            ["analysis-only", "只分析，不生成"],
          ] as Array<[TranslationMode, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            className={session.mode === value ? "active" : ""}
            onClick={() => update({ mode: value })}
          >
            {label}
          </button>
        ))}
        <span>
          {workspace.settings.provider === "demo" ? (
            <>
              <ShieldCheck size={14} />
              演示模式：文本不会外发
            </>
          ) : (
            <>
              <Bot size={14} />
              {workspace.settings.model}
            </>
          )}
        </span>
      </section>
      <div className="quick-workspace">
        <section className="translation-column source-col">
          <header>
            <span>01 · 原文</span>
            <small>{session.detectedLanguage}</small>
          </header>
          <textarea
            value={session.source}
            onChange={(event) =>
              update({
                source: event.target.value,
                detectedLanguage: detectLanguage(event.target.value),
              })
            }
            placeholder="输入或粘贴句子、段落、摘要或短篇文本……"
          />
          <footer>
            <span>{session.source.length} 字符</span>
            <button
              onClick={() =>
                update({
                  source: "",
                  studentDraft: "",
                  aiReference: "",
                  finalTranslation: "",
                  feedback: [],
                })
              }
            >
              清空
            </button>
          </footer>
        </section>
        <section className="translation-column target-col">
          <header>
            <span>
              02 · {session.mode === "reference" ? "译文编辑" : "学生译文"}
            </span>
            <small>
              {workspace.settings.autoSave ? "自动保存" : "尚未保存"}
            </small>
          </header>
          <textarea
            value={session.studentDraft}
            onChange={(event) =>
              update({
                studentDraft: event.target.value,
                finalTranslation:
                  session.finalTranslation || event.target.value,
              })
            }
            placeholder={
              session.mode === "reference"
                ? "可以先留空，生成参考后再独立修改……"
                : "在查看AI建议前完成你的第一版译文……"
            }
          />
          <footer>
            <span>{session.studentDraft.length} 字</span>
            <button
              className="run-button"
              disabled={running}
              onClick={() => void run()}
            >
              {running ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Sparkles size={15} />
              )}
              {session.mode === "analysis-only" ? "运行分析" : "获取辅助建议"}
            </button>
          </footer>
        </section>
        <aside className="assist-panel">
          <div className="assist-tabs">
            <button
              className={rightTab === "ai" ? "active" : ""}
              onClick={() => setRightTab("ai")}
            >
              AI建议
            </button>
            <button
              className={rightTab === "terms" ? "active" : ""}
              onClick={() => setRightTab("terms")}
            >
              术语 {matchedTerms.length}
            </button>
            <button
              className={rightTab === "phrases" ? "active" : ""}
              onClick={() => setRightTab("phrases")}
            >
              表达
            </button>
            <button
              className={rightTab === "quality" ? "active" : ""}
              onClick={() => setRightTab("quality")}
            >
              质量 {issues.length}
            </button>
          </div>
          <div className="assist-content">
            {rightTab === "ai" &&
              (session.feedback.length ? (
                session.feedback.map((item) => (
                  <FeedbackCard
                    key={item.id}
                    item={item}
                    onDecision={(decision) =>
                      update({
                        feedback: session.feedback.map((feedback) =>
                          feedback.id === item.id
                            ? { ...feedback, decision }
                            : feedback,
                        ),
                      })
                    }
                  />
                ))
              ) : (
                <Empty
                  title="还没有AI建议"
                  text="选择一种模式并运行后，建议会在这里单独显示。"
                />
              ))}
            {rightTab === "terms" && (
              <>
                {matchedTerms.map((term) => (
                  <div className="term-match" key={term.id}>
                    <span>{term.status}</span>
                    <strong>{term.source}</strong>
                    <ArrowRight size={13} />
                    <b>{term.target || "待定"}</b>
                    <small>{term.sourceRef}</small>
                  </div>
                ))}
                <button className="panel-action" onClick={extract}>
                  <WandSparkles size={14} />
                  提取候选术语
                </button>
              </>
            )}
            {rightTab === "phrases" && (
              <>
                <p className="panel-copy">
                  终稿确认后，可以把整句或选定表达加入复习中心。本次保存不会自动认定为“优秀表达”。
                </p>
                <button className="panel-action" onClick={addCard}>
                  <BookMarked size={14} />
                  加入重新翻译卡
                </button>
              </>
            )}
            {rightTab === "quality" &&
              (issues.length ? (
                issues.map((issue) => (
                  <div className={`issue-row ${issue.severity}`} key={issue.id}>
                    <AlertTriangle size={15} />
                    <div>
                      <strong>{issue.type}</strong>
                      <p>{issue.message}</p>
                      <small>{issue.suggestion}</small>
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  title="未触发基础规则"
                  text="这不等于译文已经通过人工审校。"
                />
              ))}
          </div>
        </aside>
      </div>
      <section className="proof-rail">
        <header>
          <span>译稿证据轨</span>
          <small>每一步独立保存，不自动覆盖</small>
        </header>
        <div className="proof-grid">
          <ProofNode
            index="A"
            label="学生初译"
            text={session.studentDraft || "尚未填写"}
          />
          <ProofNode
            index="B"
            label="AI参考 · 明确标识"
            text={session.aiReference || "尚未生成"}
            ai
          />
          <ProofNode index="C" label="学生修改 / 最终确认" editable>
            <textarea
              value={session.finalTranslation}
              onChange={(event) =>
                update({ finalTranslation: event.target.value })
              }
              placeholder="根据你的判断形成终稿……"
            />
          </ProofNode>
        </div>
        <footer>
          <button onClick={addTM}>
            <Database size={15} />
            写入翻译记忆
          </button>
          <button onClick={extract}>
            <BookMarked size={15} />
            提取术语
          </button>
          <button onClick={addCard}>
            <Brain size={15} />
            加入复习
          </button>
          <button
            onClick={() =>
              downloadText(
                "quick-translation.txt",
                session.finalTranslation || session.studentDraft,
              )
            }
          >
            <Download size={15} />
            下载译文
          </button>
        </footer>
      </section>
    </div>
  );
}

function Projects({
  workspace,
  activeProject,
  initialMode,
  onSelectProject,
  onWorkspace,
  onCreate,
  onToast,
}: {
  workspace: Workspace;
  activeProject?: Project;
  initialMode: "list" | "editor";
  onSelectProject: (id: string) => void;
  onWorkspace: (fn: (current: Workspace) => Workspace) => void;
  onCreate: (project: Project) => void;
  onToast: (message: string) => void;
}) {
  const [mode, setMode] = useState<"list" | "create" | "editor">(initialMode);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Project["status"]>("all");
  const open = (id: string) => {
    onSelectProject(id);
    setMode("editor");
  };
  const visibleProjects = workspace.projects.filter(
    (project) =>
      (status === "all" || project.status === status) &&
      `${project.name}${project.description}${project.domain}${project.files.map((file) => file.name).join("")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  if (mode === "create")
    return (
      <ProjectCreator
        workspace={workspace}
        onCancel={() => setMode("list")}
        onCreate={(project) => {
          onCreate(project);
          setMode("editor");
        }}
        onToast={onToast}
      />
    );
  if (mode === "editor" && activeProject)
    return (
      <ProjectEditor
        project={activeProject}
        workspace={workspace}
        onBack={() => setMode("list")}
        onWorkspace={onWorkspace}
        onToast={onToast}
      />
    );
  return (
    <div className="v2-stack">
      <PageHead
        eyebrow="PROJECTS"
        title="翻译项目"
        text="长文本和多文件任务在片段、上下文、语言资产与历史版本中推进。"
        actions={
          <button className="v2-btn primary" onClick={() => setMode("create")}>
            <Plus size={16} />
            创建项目
          </button>
        }
      />
      <section className="project-toolbar">
        <div>
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索项目名称、领域或文件……"
          />
        </div>
        <label>
          <SlidersHorizontal size={15} />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="all">全部状态</option>
            {(
              [
                "draft",
                "active",
                "paused",
                "review",
                "completed",
                "archived",
              ] as const
            ).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="project-table">
        <header>
          <span>项目</span>
          <span>文件</span>
          <span>片段进度</span>
          <span>质量问题</span>
          <span>最近修改</span>
          <span />
        </header>
        {visibleProjects.map((project) => {
          const issues = workspace.qualityIssues.filter(
            (item) =>
              projectSegments(project).some(
                (segment) => segment.id === item.segmentId,
              ) && !item.resolved,
          ).length;
          return (
            <button
              className="project-row"
              key={project.id}
              onClick={() => open(project.id)}
            >
              <span>
                <i>{project.status}</i>
                <strong>{project.name}</strong>
                <small>
                  {project.domain} · {project.sourceLanguage} →{" "}
                  {project.targetLanguage}
                </small>
              </span>
              <b>{project.files.length}</b>
              <span>
                <em>
                  <i style={{ width: `${projectProgress(project)}%` }} />
                </em>
                <small>{projectProgress(project)}%</small>
              </span>
              <b className={issues ? "warn" : ""}>{issues || "—"}</b>
              <small>{dateTime(project.updatedAt)}</small>
              <ChevronRight size={17} />
            </button>
          );
        })}
        {!visibleProjects.length && (
          <Empty
            title="没有符合条件的项目"
            text="调整关键词或状态筛选，或创建一个新项目。"
          />
        )}
      </section>
    </div>
  );
}

function ProjectCreator({
  workspace,
  onCancel,
  onCreate,
  onToast,
}: {
  workspace: Workspace;
  onCancel: () => void;
  onCreate: (project: Project) => void;
  onToast: (message: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [pasted, setPasted] = useState("");
  const [parsing, setParsing] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    sourceLanguage: "英语（en）",
    targetLanguage: "简体中文（zh-CN）",
    domain: "教育",
    textType: "政策文本",
    audience: "高校学生",
    style: "正式、自然",
    deadline: "",
    mode: "student-first" as Project["mode"],
    memoryId: "tm-personal",
    termbaseId: "tb-personal",
    styleGuideId: workspace.styleGuides[0]?.id ?? "",
    aiPretranslate: false,
    termLookup: true,
    culturalRecognition: true,
    mtToneCheck: true,
    strictTerminology: true,
    batchSize: workspace.settings.batchSize,
  });
  const importFiles = async (list: FileList) => {
    setParsing(true);
    try {
      const parsed = await Promise.all(Array.from(list).map(parseFile));
      setFiles((current) => [...current, ...parsed]);
      onToast(`已解析 ${parsed.length} 个文件`);
    } catch (error) {
      onToast((error as Error).message || "文件解析失败");
    } finally {
      setParsing(false);
    }
  };
  const addPasted = () => {
    if (!pasted.trim()) return;
    const file = parsePastedText(`${draft.name || "新项目"}-粘贴文本`, pasted);
    setFiles((current) => [...current, file]);
    setPasted("");
    onToast(`已切分为 ${file.segments.length} 个片段`);
  };
  const finish = () => {
    if (!draft.name.trim()) {
      onToast("请填写项目名称");
      setStep(1);
      return;
    }
    if (!files.length) {
      onToast("请至少导入一个文件或粘贴一段文本");
      setStep(2);
      return;
    }
    onCreate(buildProject(draft.name, files, workspace, draft));
  };
  return (
    <div className="v2-stack">
      <PageHead
        eyebrow="NEW PROJECT"
        title="创建翻译项目"
        text="文件先在浏览器中解析；只有启用AI处理时，相关片段才会发送到配置的服务。"
        actions={
          <button className="v2-btn subtle" onClick={onCancel}>
            <X size={16} />
            取消
          </button>
        }
      />
      <div className="create-steps">
        {["基本信息", "导入文件", "解析预览", "资源与AI", "确认"].map(
          (label, index) => (
            <button
              key={label}
              className={
                step === index + 1 ? "active" : step > index + 1 ? "done" : ""
              }
              onClick={() => setStep(index + 1)}
            >
              <span>{step > index + 1 ? <Check size={13} /> : index + 1}</span>
              {label}
            </button>
          ),
        )}
      </div>
      <section className="creator-layout">
        <div className="creator-main">
          {step === 1 && (
            <div className="form-sheet">
              <h2>项目是什么？</h2>
              <div className="field-grid">
                <label className="wide">
                  项目名称
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                    placeholder="例如：AI教育政策白皮书"
                  />
                </label>
                <label className="wide">
                  项目说明
                  <textarea
                    value={draft.description}
                    onChange={(event) =>
                      setDraft({ ...draft, description: event.target.value })
                    }
                  />
                </label>
                <label>
                  源语言
                  <select
                    value={draft.sourceLanguage}
                    onChange={(event) =>
                      setDraft({ ...draft, sourceLanguage: event.target.value })
                    }
                  >
                    <option>英语（en）</option>
                    <option>简体中文（zh-CN）</option>
                  </select>
                </label>
                <label>
                  目标语言
                  <select
                    value={draft.targetLanguage}
                    onChange={(event) =>
                      setDraft({ ...draft, targetLanguage: event.target.value })
                    }
                  >
                    <option>简体中文（zh-CN）</option>
                    <option>英语（en）</option>
                  </select>
                </label>
                <label>
                  领域
                  <select
                    value={draft.domain}
                    onChange={(event) =>
                      setDraft({ ...draft, domain: event.target.value })
                    }
                  >
                    {["教育", "科技", "新闻", "商务", "中医药", "通用"].map(
                      (item) => (
                        <option key={item}>{item}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  文本类型
                  <input
                    value={draft.textType}
                    onChange={(event) =>
                      setDraft({ ...draft, textType: event.target.value })
                    }
                  />
                </label>
                <label>
                  目标读者
                  <input
                    value={draft.audience}
                    onChange={(event) =>
                      setDraft({ ...draft, audience: event.target.value })
                    }
                  />
                </label>
                <label>
                  风格要求
                  <input
                    value={draft.style}
                    onChange={(event) =>
                      setDraft({ ...draft, style: event.target.value })
                    }
                  />
                </label>
                <label>
                  截止日期
                  <input
                    type="date"
                    value={draft.deadline}
                    onChange={(event) =>
                      setDraft({ ...draft, deadline: event.target.value })
                    }
                  />
                </label>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="form-sheet">
              <h2>导入文件或长文本</h2>
              <label className="file-drop">
                <Upload size={28} />
                <strong>
                  {parsing ? "正在解析…" : "选择 TXT、Markdown 或 DOCX"}
                </strong>
                <small>第一阶段在浏览器本地解析，不上传原文件。</small>
                <input
                  type="file"
                  multiple
                  accept=".txt,.md,.markdown,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => {
                    if (event.target.files?.length)
                      void importFiles(event.target.files);
                  }}
                />
              </label>
              <div className="or-line">
                <span>或者粘贴长文本</span>
              </div>
              <textarea
                className="paste-area"
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
                placeholder="粘贴后将按段落和句末标点切分……"
              />
              <button className="v2-btn subtle" onClick={addPasted}>
                <FileText size={16} />
                解析粘贴文本
              </button>
            </div>
          )}
          {step === 3 && (
            <div className="form-sheet">
              <h2>检查解析结果</h2>
              {files.map((file) => (
                <div className="parsed-file" key={file.id}>
                  <FileText size={18} />
                  <div>
                    <strong>{file.name}</strong>
                    <small>
                      {file.type.toUpperCase()} · {file.segments.length} 个片段
                      · {file.structure}
                    </small>
                  </div>
                  <button
                    onClick={() =>
                      setFiles(files.filter((item) => item.id !== file.id))
                    }
                  >
                    <X size={15} />
                  </button>
                  <div>
                    {file.segments.slice(0, 3).map((segment) => (
                      <p key={segment.id}>
                        <b>#{String(segment.order).padStart(3, "0")}</b>
                        {segment.source}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
              {!files.length && (
                <Empty
                  title="还没有解析内容"
                  text="返回上一步导入文件或粘贴文本。"
                />
              )}
            </div>
          )}
          {step === 4 && (
            <div className="form-sheet">
              <h2>绑定资源与能力</h2>
              <div className="mode-choice">
                <button
                  className={draft.mode === "student-first" ? "active" : ""}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      mode: "student-first",
                      aiPretranslate: false,
                    })
                  }
                >
                  <strong>学生先译</strong>
                  <small>先保存学生初译，再请求AI参考</small>
                </button>
                <button
                  className={draft.mode === "ai-pretranslate" ? "active" : ""}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      mode: "ai-pretranslate",
                      aiPretranslate: true,
                    })
                  }
                >
                  <strong>AI预翻译</strong>
                  <small>先生成待确认草稿，再逐段人工修改</small>
                </button>
              </div>
              <div className="resource-select">
                <label>
                  翻译记忆库
                  <select
                    value={draft.memoryId}
                    onChange={(event) =>
                      setDraft({ ...draft, memoryId: event.target.value })
                    }
                  >
                    <option value="tm-personal">
                      个人翻译记忆（{workspace.translationMemory.length}条）
                    </option>
                  </select>
                </label>
                <label>
                  术语库
                  <select
                    value={draft.termbaseId}
                    onChange={(event) =>
                      setDraft({ ...draft, termbaseId: event.target.value })
                    }
                  >
                    <option value="tb-personal">
                      个人术语库（{workspace.terms.length}条）
                    </option>
                  </select>
                </label>
                <label>
                  风格指南
                  <select
                    value={draft.styleGuideId}
                    onChange={(event) =>
                      setDraft({ ...draft, styleGuideId: event.target.value })
                    }
                  >
                    {workspace.styleGuides.map((guide) => (
                      <option key={guide.id} value={guide.id}>
                        {guide.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  每批片段数
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={draft.batchSize}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        batchSize: Math.max(1, Number(event.target.value)),
                      })
                    }
                  />
                </label>
              </div>
              <div className="check-options">
                <button
                  className={draft.termLookup ? "on" : ""}
                  onClick={() =>
                    setDraft({ ...draft, termLookup: !draft.termLookup })
                  }
                >
                  <span>{draft.termLookup ? <Check /> : <Circle />}</span>
                  <div>
                    <strong>术语检索</strong>
                    <small>优先匹配已批准术语</small>
                  </div>
                </button>
                <button
                  className={draft.culturalRecognition ? "on" : ""}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      culturalRecognition: !draft.culturalRecognition,
                    })
                  }
                >
                  <span>
                    {draft.culturalRecognition ? <Check /> : <Circle />}
                  </span>
                  <div>
                    <strong>文化概念识别</strong>
                    <small>结果保留解释来源</small>
                  </div>
                </button>
                <button
                  className={draft.mtToneCheck ? "on" : ""}
                  onClick={() =>
                    setDraft({ ...draft, mtToneCheck: !draft.mtToneCheck })
                  }
                >
                  <span>{draft.mtToneCheck ? <Check /> : <Circle />}</span>
                  <div>
                    <strong>机器翻译腔检测</strong>
                    <small>AI判断需要人工复核</small>
                  </div>
                </button>
                <button
                  className={draft.strictTerminology ? "on" : ""}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      strictTerminology: !draft.strictTerminology,
                    })
                  }
                >
                  <span>
                    {draft.strictTerminology ? <Check /> : <Circle />}
                  </span>
                  <div>
                    <strong>严格术语检查</strong>
                    <small>批准术语未使用时产生预警</small>
                  </div>
                </button>
              </div>
              <h3>启用的内置Skill</h3>
              <div className="skill-chips">
                {workspace.skills
                  .filter((item) => item.enabled)
                  .map((item) => (
                    <span key={item.id}>{item.name}</span>
                  ))}
              </div>
            </div>
          )}
          {step === 5 && (
            <div className="form-sheet confirm-sheet">
              <h2>确认项目设置</h2>
              <dl>
                <div>
                  <dt>项目</dt>
                  <dd>{draft.name || "未命名"}</dd>
                </div>
                <div>
                  <dt>语言方向</dt>
                  <dd>
                    {draft.sourceLanguage} → {draft.targetLanguage}
                  </dd>
                </div>
                <div>
                  <dt>任务语境</dt>
                  <dd>
                    {draft.domain} · {draft.textType} · {draft.audience}
                  </dd>
                </div>
                <div>
                  <dt>文件与片段</dt>
                  <dd>
                    {files.length} 个文件 ·{" "}
                    {files.reduce((sum, file) => sum + file.segments.length, 0)}{" "}
                    个片段
                  </dd>
                </div>
                <div>
                  <dt>AI</dt>
                  <dd>
                    {workspace.settings.provider === "demo"
                      ? "演示模式，不会发送文本"
                      : workspace.settings.model}
                  </dd>
                </div>
              </dl>
              <div className="boundary-box">
                <ShieldCheck size={18} />
                <p>
                  创建项目不会自动调用模型。即使启用预翻译，也会在实际发送片段前再次确认。
                </p>
              </div>
              <button className="v2-btn primary large" onClick={finish}>
                创建并进入编辑器 <ArrowRight size={17} />
              </button>
            </div>
          )}
        </div>
        <aside className="creator-summary">
          <span>项目摘要</span>
          <h3>{draft.name || "未命名项目"}</h3>
          <dl>
            <div>
              <dt>文件</dt>
              <dd>{files.length}</dd>
            </div>
            <div>
              <dt>片段</dt>
              <dd>
                {files.reduce((sum, file) => sum + file.segments.length, 0)}
              </dd>
            </div>
            <div>
              <dt>语言</dt>
              <dd>
                {draft.sourceLanguage.split("（")[0]} →{" "}
                {draft.targetLanguage.split("（")[0]}
              </dd>
            </div>
          </dl>
          <small>第 {step}/5 步</small>
        </aside>
      </section>
      <div className="creator-actions">
        <button
          className="v2-btn subtle"
          disabled={step === 1}
          onClick={() => setStep(Math.max(1, step - 1))}
        >
          上一步
        </button>
        {step < 5 && (
          <button
            className="v2-btn primary"
            onClick={() => setStep(Math.min(5, step + 1))}
          >
            下一步 <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function ProjectEditor({
  project,
  workspace,
  onBack,
  onWorkspace,
  onToast,
}: {
  project: Project;
  workspace: Workspace;
  onBack: () => void;
  onWorkspace: (fn: (current: Workspace) => Workspace) => void;
  onToast: (message: string) => void;
}) {
  const [activeFileId, setActiveFileId] = useState(project.files[0]?.id ?? "");
  const [activeSegmentId, setActiveSegmentId] = useState(
    project.files[0]?.segments[0]?.id ?? "",
  );
  const [filter, setFilter] = useState<"all" | Segment["status"]>("all");
  const [rightTab, setRightTab] = useState<
    | "pretranslation"
    | "ai"
    | "tm"
    | "terms"
    | "culture"
    | "context"
    | "quality"
    | "history"
    | "notes"
  >("pretranslation");
  const [rightOpen, setRightOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [askingAI, setAskingAI] = useState(false);
  const [lookupText, setLookupText] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const stopBatch = useRef<"" | "pause" | "cancel">("");
  const editBefore = useRef<Record<string, string>>({});
  const file =
    project.files.find((item) => item.id === activeFileId) ?? project.files[0];
  const filtered =
    filter === "all"
      ? (file?.segments ?? [])
      : (file?.segments.filter((item) => item.status === filter) ?? []);
  const allVisible = query.trim()
    ? filtered.filter((item) =>
        `${item.source}\n${item.target}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : filtered;
  const active =
    file?.segments.find((item) => item.id === activeSegmentId) ?? allVisible[0];
  const activeJob = workspace.batchJobs.find(
    (job) => job.id === project.activeBatchJobId,
  );
  const projectSegmentIds = new Set(
    projectSegments(project).map((segment) => segment.id),
  );
  const projectIssues = workspace.qualityIssues.filter(
    (item) => projectSegmentIds.has(item.segmentId) && !item.resolved,
  );
  const updateProject = (fn: (project: Project) => Project) =>
    onWorkspace((current) => ({
      ...current,
      projects: current.projects.map((item) =>
        item.id === project.id
          ? { ...fn(item), updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
  const updateSegment = (segmentId: string, patch: Partial<Segment>) =>
    updateProject((current) => ({
      ...current,
      files: current.files.map((item) =>
        item.id === file.id
          ? {
              ...item,
              segments: item.segments.map((segment) =>
                segment.id === segmentId ? { ...segment, ...patch } : segment,
              ),
            }
          : item,
      ),
    }));
  const updateTarget = (segment: Segment, target: string) =>
    updateSegment(segment.id, {
      target,
      studentDraft:
        project.mode === "student-first" && !segment.aiPretranslation
          ? target
          : segment.studentDraft,
      status: "translating",
      origin:
        segment.origin === "deepseek" || segment.origin === "ai-edited"
          ? "ai-edited"
          : "human",
      lastModifiedAt: new Date().toISOString(),
    });
  const finishManualEdit = (segment: Segment) => {
    const before = editBefore.current[segment.id];
    delete editBefore.current[segment.id];
    if (before === undefined || before === segment.target) return;
    updateSegment(segment.id, {
      revisions: [
        ...segment.revisions,
        {
          id: createId("revision"),
          before,
          after: segment.target,
          type: "manual",
          reason: "用户修改当前译文",
          createdAt: new Date().toISOString(),
          origin: segment.origin,
        },
      ],
    });
  };
  const requestCurrentAI = async () => {
    if (!active || askingAI) return;
    setAskingAI(true);
    const startedAt = new Date().toISOString();
    const session: QuickSession = {
      ...emptyQuick(),
      source: active.source,
      sourceLanguage: project.sourceLanguage,
      targetLanguage: project.targetLanguage,
      domain: project.domain,
      textType: project.textType,
      audience: project.audience,
      style: project.style,
      studentDraft: active.studentDraft || active.target,
      finalTranslation: active.target,
      mode: "reference",
    };
    const result = await runAI(session, workspace.settings);
    const completedAt = new Date().toISOString();
    updateSegment(active.id, {
      aiPretranslation: result.reference,
      aiFeedback: result.feedback,
      lastAIRequestAt: completedAt,
      aiState: {
        ...active.aiState,
        status: "completed",
        provider: result.provider,
        requestId: createId("request"),
        error: "",
        lastAttemptAt: startedAt,
        completedAt,
      },
    });
    onWorkspace((current) => ({
      ...current,
      aiRequestLogs: [
        {
          id: createId("ai-log"),
          action: "review-segment",
          provider: workspace.settings.provider,
          model: workspace.settings.model,
          projectId: project.id,
          segmentIds: [active.id],
          requestCharacters: active.source.length,
          status:
            result.provider === workspace.settings.provider
              ? "success"
              : "failed",
          error:
            result.provider === workspace.settings.provider
              ? ""
              : "安全代理调用失败，已回退为明确标识的演示结果",
          startedAt,
          completedAt,
        },
        ...current.aiRequestLogs,
      ],
    }));
    setRightTab("ai");
    setRightOpen(true);
    setAskingAI(false);
    onToast(
      result.provider === workspace.settings.provider
        ? "AI参考与反馈已保存"
        : "代理调用失败，已显示演示结果且未覆盖译文",
    );
  };
  const applyAIReference = (segment: Segment) => {
    if (!segment.aiPretranslation.trim()) {
      onToast("当前片段还没有AI参考译文");
      return;
    }
    updateSegment(segment.id, {
      target: segment.aiPretranslation,
      status: "needs-confirmation",
      origin: "deepseek",
      revisions: [
        ...segment.revisions,
        {
          id: createId("revision"),
          before: segment.target,
          after: segment.aiPretranslation,
          type: "ai-applied",
          reason: "用户主动应用AI参考译文",
          createdAt: new Date().toISOString(),
          origin: "deepseek",
          requestId: segment.aiState.requestId,
        },
      ],
      lastModifiedAt: new Date().toISOString(),
    });
    onToast("已应用AI参考并保留应用前译文，仍需人工确认");
  };
  const runLookup = async () => {
    if (!active || !lookupText.trim() || lookingUp) return;
    setLookingUp(true);
    try {
      const result = await lookupTerm(
        lookupText,
        active,
        project,
        workspace.terms,
        workspace.settings,
      );
      updateSegment(active.id, {
        termLookups: [
          result,
          ...active.termLookups.filter(
            (item) => item.term.toLowerCase() !== result.term.toLowerCase(),
          ),
        ],
      });
      onToast(
        result.provider === "local"
          ? "已从个人术语库找到结果"
          : "术语解释与来源已保存",
      );
    } catch (error) {
      onToast(error instanceof Error ? error.message : "术语查询失败");
    } finally {
      setLookingUp(false);
    }
  };
  const runBatch = async (
    scope: "project" | "file" | "selection",
    existing = activeJob,
  ) => {
    if (batchRunning) return;
    if (
      workspace.settings.provider === "deepseek-proxy" &&
      !window.confirm(
        "将按批次把所选原文、相邻上下文和匹配术语发送到你的安全代理。继续吗？",
      )
    )
      return;
    let job =
      existing &&
      ["paused", "failed", "queued", "running"].includes(existing.status)
        ? existing.status === "failed"
          ? retryFailedJob(existing)
          : {
              ...existing,
              status: "queued" as const,
              updatedAt: new Date().toISOString(),
            }
        : createBatchJob(project, scope, file.id, selectedIds);
    if (!job.segmentIds.length) {
      onToast(
        scope === "selection"
          ? "请先选择未翻译片段"
          : "当前范围没有可预翻译片段",
      );
      return;
    }
    stopBatch.current = "";
    setBatchRunning(true);
    let localProject = project;
    onWorkspace((current) => ({
      ...current,
      projects: current.projects.map((item) =>
        item.id === project.id ? { ...item, activeBatchJobId: job.id } : item,
      ),
      batchJobs: [
        job,
        ...current.batchJobs.filter((item) => item.id !== job.id),
      ],
    }));
    while (
      !stopBatch.current &&
      !["completed", "failed", "cancelled"].includes(job.status)
    ) {
      const baseline = localProject;
      const result = await runBatchStep(localProject, job, workspace);
      localProject = result.project;
      job = result.job;
      onWorkspace((current) => {
        const latest = current.projects.find((item) => item.id === project.id);
        return {
          ...current,
          projects: current.projects.map((item) =>
            item.id === project.id && latest
              ? {
                  ...mergeBatchProject(latest, baseline, result.project),
                  activeBatchJobId: result.job.id,
                }
              : item,
          ),
          batchJobs: [
            result.job,
            ...current.batchJobs.filter((item) => item.id !== result.job.id),
          ],
          aiRequestLogs: result.log
            ? [result.log, ...current.aiRequestLogs]
            : current.aiRequestLogs,
        };
      });
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
    if (
      stopBatch.current &&
      !["completed", "failed", "cancelled"].includes(job.status)
    ) {
      job = {
        ...job,
        status: stopBatch.current === "cancel" ? "cancelled" : "paused",
        updatedAt: new Date().toISOString(),
      };
      onWorkspace((current) => ({
        ...current,
        batchJobs: current.batchJobs.map((item) =>
          item.id === job.id ? job : item,
        ),
      }));
    }
    setBatchRunning(false);
    onToast(
      job.status === "completed"
        ? "批量预翻译已完成，所有结果仍需人工确认"
        : job.status === "failed"
          ? `任务完成，但有 ${job.failedSegmentIds.length} 个片段失败`
          : job.status === "cancelled"
            ? "批量任务已取消，已完成的片段仍保留"
            : "批量任务已暂停，可随时继续",
    );
  };
  const confirm = (segment: Segment) => {
    if (!segment.target.trim()) {
      onToast("译文为空，不能确认");
      return;
    }
    const revision = {
      id: createId("revision"),
      before: segment.initialTarget,
      after: segment.target,
      type: "confirmed" as const,
      reason: "用户确认当前片段",
      createdAt: new Date().toISOString(),
    };
    updateSegment(segment.id, {
      status: "confirmed",
      origin: segment.origin === "deepseek" ? "ai-edited" : "human",
      revisions: [...segment.revisions, revision],
      initialTarget: segment.initialTarget || segment.target,
    });
    onToast("片段已确认并记录版本");
  };
  const addTM = (segment: Segment) => {
    if (!segment.target.trim()) return;
    const unit: TranslationUnit = {
      id: createId("tu"),
      source: segment.source,
      target: segment.target,
      sourceLanguage: project.sourceLanguage,
      targetLanguage: project.targetLanguage,
      domain: project.domain,
      projectId: project.id,
      quality: segment.status === "confirmed" ? "approved" : "reviewed",
      useCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onWorkspace((current) => ({
      ...current,
      translationMemory: [unit, ...current.translationMemory],
    }));
    onToast("当前片段已写入翻译记忆");
  };
  const runQuality = () => {
    const segmentIds = new Set(
      projectSegments(project).map((segment) => segment.id),
    );
    const next = inspectProject(projectSegments(project), workspace.terms);
    onWorkspace((current) => ({
      ...current,
      qualityIssues: [
        ...current.qualityIssues.filter(
          (issue) => !segmentIds.has(issue.segmentId),
        ),
        ...next,
      ],
    }));
    setRightTab("quality");
    setRightOpen(true);
    onToast(`检查完成：发现 ${next.length} 个待复核问题`);
  };
  const split = (segment: Segment) => {
    const match = segment.source.match(/^(.+?[.!?。！？])\s+(.+)$/);
    if (!match) {
      onToast("未找到适合自动拆分的句末位置");
      return;
    }
    const first = {
      ...segment,
      source: match[1],
      target: "",
      initialTarget: "",
      status: "untranslated" as const,
      revisions: [],
    };
    const second = {
      ...segment,
      id: createId("segment"),
      order: segment.order + 1,
      source: match[2],
      target: "",
      initialTarget: "",
      status: "untranslated" as const,
      revisions: [],
    };
    updateProject((current) => ({
      ...current,
      files: current.files.map((item) =>
        item.id === file.id
          ? {
              ...item,
              segments: item.segments.flatMap((candidate) =>
                candidate.id === segment.id
                  ? [first, second]
                  : [
                      {
                        ...candidate,
                        order:
                          candidate.order > segment.order
                            ? candidate.order + 1
                            : candidate.order,
                      },
                    ],
              ),
            }
          : item,
      ),
    }));
    onToast("片段已拆分，原译文未自动分配");
  };
  const mergeNext = (segment: Segment) => {
    const index = file.segments.findIndex((item) => item.id === segment.id);
    const next = file.segments[index + 1];
    if (!next) {
      onToast("当前片段之后没有可合并片段");
      return;
    }
    updateProject((current) => ({
      ...current,
      files: current.files.map((item) =>
        item.id === file.id
          ? {
              ...item,
              segments: item.segments
                .filter((candidate) => candidate.id !== next.id)
                .map((candidate) =>
                  candidate.id === segment.id
                    ? {
                        ...candidate,
                        source: `${segment.source} ${next.source}`,
                        target: [segment.target, next.target]
                          .filter(Boolean)
                          .join(" "),
                        status: "needs-confirmation",
                      }
                    : {
                        ...candidate,
                        order:
                          candidate.order > next.order
                            ? candidate.order - 1
                            : candidate.order,
                      },
                ),
            }
          : item,
      ),
    }));
    onToast("已与下一片段合并，请重新确认译文");
  };
  const exportPure = () =>
    downloadText(
      `${project.name}-纯译文.txt`,
      project.files
        .map((item) =>
          item.segments.map((segment) => segment.target).join("\n\n"),
        )
        .join("\n\n"),
    );
  const exportBilingual = () =>
    downloadText(
      `${project.name}-双语对照.html`,
      `<!doctype html><meta charset="utf-8"><title>${project.name}</title><style>body{font-family:system-ui;max-width:1000px;margin:40px auto}table{border-collapse:collapse;width:100%}td{border:1px solid #ddd;padding:12px;vertical-align:top}.id{width:50px;color:#888}</style><h1>${project.name}</h1><table>${projectSegments(
        project,
      )
        .map(
          (segment) =>
            `<tr><td class="id">${segment.order}</td><td>${escapeHtml(segment.source)}</td><td>${escapeHtml(segment.target)}</td></tr>`,
        )
        .join("")}</table>`,
      "text/html;charset=utf-8",
    );
  if (!file || !active)
    return (
      <div className="v2-stack">
        <button className="back-link" onClick={onBack}>
          ← 返回项目列表
        </button>
        <Empty title="项目没有可编辑片段" text="请重新创建项目并导入文件。" />
      </div>
    );
  const batchDone = activeJob
    ? activeJob.completedSegmentIds.length + activeJob.failedSegmentIds.length
    : 0;
  const batchPercent = activeJob?.segmentIds.length
    ? Math.round((batchDone / activeJob.segmentIds.length) * 100)
    : 0;
  return (
    <div className="editor-page">
      <header className="editor-toolbar">
        <button className="icon-button" onClick={onBack}>
          ←
        </button>
        <div>
          <strong>{project.name}</strong>
          <small>{file.name}</small>
        </div>
        <div className="editor-progress">
          <span>{projectProgress(project)}%</span>
          <i>
            <b style={{ width: `${projectProgress(project)}%` }} />
          </i>
        </div>
        <label className="editor-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索原文或译文"
          />
        </label>
        <button onClick={runQuality}>
          <ShieldCheck size={15} />
          质量检查
        </button>
        <button onClick={exportPure}>
          <Download size={15} />
          纯译文
        </button>
        <button onClick={exportBilingual}>
          <FileCheck2 size={15} />
          双语文档
        </button>
        <span className="saved-label">
          <Check size={13} />
          自动保存
        </span>
        <button
          className="icon-button"
          onClick={() => setRightOpen(!rightOpen)}
        >
          {rightOpen ? (
            <PanelRightClose size={17} />
          ) : (
            <PanelRightOpen size={17} />
          )}
        </button>
      </header>
      <section className="batch-ribbon">
        <div>
          <span>AI 预翻译证据轨</span>
          <strong>
            {activeJob
              ? `${batchPercent}% · ${activeJob.completedSegmentIds.length}完成 / ${activeJob.failedSegmentIds.length}失败`
              : "翻译记忆优先，AI结果仅作为待确认草稿"}
          </strong>
        </div>
        <i>
          <b style={{ width: `${batchPercent}%` }} />
        </i>
        <div className="batch-actions">
          <button
            disabled={batchRunning}
            onClick={() => void runBatch("project", undefined)}
          >
            全部未翻译
          </button>
          <button
            disabled={batchRunning}
            onClick={() => void runBatch("file", undefined)}
          >
            当前文件
          </button>
          <button
            disabled={batchRunning || !selectedIds.length}
            onClick={() => void runBatch("selection", undefined)}
          >
            所选 {selectedIds.length || ""}
          </button>
          {batchRunning && (
            <>
              <button
                onClick={() => {
                  stopBatch.current = "pause";
                }}
              >
                <Pause size={13} />
                暂停
              </button>
              <button
                onClick={() => {
                  stopBatch.current = "cancel";
                }}
              >
                <X size={13} />
                取消
              </button>
            </>
          )}
          {activeJob?.status === "paused" && !batchRunning && (
            <button onClick={() => void runBatch(activeJob.scope, activeJob)}>
              <Play size={13} />
              继续
            </button>
          )}
          {activeJob?.status === "failed" && !batchRunning && (
            <button onClick={() => void runBatch(activeJob.scope, activeJob)}>
              <RefreshCcw size={13} />
              重试失败 {activeJob.failedSegmentIds.length}
            </button>
          )}
        </div>
      </section>
      <div className={rightOpen ? "editor-shell" : "editor-shell right-closed"}>
        <aside className="file-rail">
          <span>项目文件</span>
          {project.files.map((item) => (
            <button
              key={item.id}
              className={item.id === file.id ? "active" : ""}
              onClick={() => {
                setActiveFileId(item.id);
                setActiveSegmentId(item.segments[0]?.id ?? "");
              }}
            >
              <FileText size={15} />
              <div>
                <strong>{item.name}</strong>
                <small>{item.segments.length}个片段</small>
              </div>
            </button>
          ))}
          <span>片段状态</span>
          {(
            [
              ["all", "全部"],
              ["untranslated", "未翻译"],
              ["needs-confirmation", "待确认"],
              ["confirmed", "已确认"],
              ["issue", "有问题"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              <Circle size={12} />
              <div>
                <strong>{label}</strong>
                <small>
                  {value === "all"
                    ? file.segments.length
                    : file.segments.filter((item) => item.status === value)
                        .length}
                </small>
              </div>
            </button>
          ))}
        </aside>
        <section className="segment-list">
          {allVisible.length ? (
            allVisible.map((segment, index) => (
              <article
                key={segment.id}
                className={
                  segment.id === active.id
                    ? `segment-row active status-${segment.status}`
                    : `segment-row status-${segment.status}`
                }
                onClick={() => setActiveSegmentId(segment.id)}
              >
                <header>
                  <label
                    className="segment-select"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(segment.id)}
                      onChange={() =>
                        setSelectedIds((current) =>
                          current.includes(segment.id)
                            ? current.filter((id) => id !== segment.id)
                            : [...current, segment.id],
                        )
                      }
                      aria-label={`选择片段${segment.order}`}
                    />
                  </label>
                  <span>#{String(segment.order).padStart(3, "0")}</span>
                  <i>{segment.status}</i>
                  <b>{originLabel(segment.origin)}</b>
                  {segment.aiState.status === "failed" && (
                    <em title={segment.aiState.error}>AI失败</em>
                  )}
                  <small>{segment.target.length}字</small>
                </header>
                <div className="segment-source">
                  <span>SOURCE</span>
                  <p>{segment.source}</p>
                </div>
                {segment.aiPretranslation && (
                  <div className="segment-ai-proof">
                    <span>AI DRAFT</span>
                    <p>{segment.aiPretranslation}</p>
                  </div>
                )}
                <div className="segment-target">
                  <span>CURRENT</span>
                  <textarea
                    value={segment.target}
                    onClick={(event) => event.stopPropagation()}
                    onFocus={() => {
                      editBefore.current[segment.id] = segment.target;
                    }}
                    onChange={(event) =>
                      updateTarget(segment, event.target.value)
                    }
                    onBlur={() => finishManualEdit(segment)}
                    placeholder={
                      project.mode === "student-first"
                        ? "先完成你的初译……"
                        : "修改预译文或输入目标译文……"
                    }
                  />
                </div>
                <footer>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      split(segment);
                    }}
                  >
                    拆分
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      mergeNext(segment);
                    }}
                  >
                    与下段合并
                  </button>
                  {segment.aiPretranslation && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        applyAIReference(segment);
                      }}
                    >
                      恢复AI原稿
                    </button>
                  )}
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      updateSegment(segment.id, { status: "issue" });
                      onToast("已标记为有问题");
                    }}
                  >
                    <AlertTriangle size={13} />
                    标记问题
                  </button>
                  <button
                    className="confirm-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      confirm(segment);
                    }}
                  >
                    <Check size={14} />
                    确认译文
                  </button>
                </footer>
                {index === allVisible.length - 1 && (
                  <small className="list-end">已到当前文件末尾</small>
                )}
              </article>
            ))
          ) : (
            <Empty
              title="没有符合条件的片段"
              text="清除搜索词或切换片段状态后继续编辑。"
            />
          )}
        </section>
        {rightOpen && (
          <aside className="editor-assist">
            <nav>
              {(
                [
                  ["pretranslation", "AI预译文"],
                  ["ai", "修改建议"],
                  ["terms", "术语解释"],
                  ["culture", "文化背景"],
                  ["tm", "翻译记忆"],
                  ["context", "上下文"],
                  ["quality", "质量问题"],
                  ["history", "修改记录"],
                  ["notes", "批注笔记"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={rightTab === value ? "active" : ""}
                  onClick={() => setRightTab(value)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div>
              {rightTab === "pretranslation" && (
                <>
                  {active.aiPretranslation ? (
                    <div className="ai-reference">
                      <span>AI原始预译文 · 不随人工修改覆盖</span>
                      <p>{active.aiPretranslation}</p>
                      <div>
                        <button
                          onClick={() =>
                            navigator.clipboard
                              ?.writeText(active.aiPretranslation)
                              .then(() => onToast("AI预译文已复制"))
                          }
                        >
                          <Copy size={13} />
                          只复制
                        </button>
                        <button onClick={() => applyAIReference(active)}>
                          <WandSparkles size={13} />
                          应用为当前译文
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Empty
                      title="当前片段没有AI预译文"
                      text="运行批量预翻译，或在“修改建议”中请求片段级参考。"
                    />
                  )}
                </>
              )}
              {rightTab === "ai" && (
                <>
                  <div className="ai-boundary">
                    <Bot size={16} />
                    <span>
                      <strong>
                        {workspace.settings.provider === "demo"
                          ? "演示分析"
                          : workspace.settings.model}
                      </strong>
                      建议不会自动覆盖当前译文。
                    </span>
                  </div>
                  <button
                    className="panel-action"
                    disabled={askingAI}
                    onClick={() => void requestCurrentAI()}
                  >
                    {askingAI ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {askingAI ? "正在生成参考…" : "请求当前片段参考与反馈"}
                  </button>
                  {active.aiPretranslation && (
                    <div className="ai-reference">
                      <span>AI原始参考 · 已留痕</span>
                      <p>{active.aiPretranslation}</p>
                      <div>
                        <button
                          onClick={() =>
                            navigator.clipboard
                              ?.writeText(active.aiPretranslation)
                              .then(() => onToast("AI参考已复制"))
                          }
                        >
                          <Copy size={13} />
                          只复制
                        </button>
                        <button onClick={() => applyAIReference(active)}>
                          <WandSparkles size={13} />
                          应用到当前译文
                        </button>
                      </div>
                    </div>
                  )}
                  {active.aiFeedback.length
                    ? active.aiFeedback.map((item) => (
                        <FeedbackCard
                          key={item.id}
                          item={item}
                          onDecision={(decision) =>
                            updateSegment(active.id, {
                              aiFeedback: active.aiFeedback.map((feedback) =>
                                feedback.id === item.id
                                  ? { ...feedback, decision }
                                  : feedback,
                              ),
                            })
                          }
                        />
                      ))
                    : inspectSegment(active, workspace.terms)
                        .slice(0, 3)
                        .map((issue) => (
                          <div className="assist-note" key={issue.id}>
                            <span>{issue.type} · 本地规则</span>
                            <p>{issue.message}</p>
                            <small>{issue.suggestion}</small>
                          </div>
                        ))}
                </>
              )}
              {rightTab === "tm" && (
                <TMMatches
                  source={active.source}
                  units={workspace.translationMemory}
                  onApply={(unit) => {
                    updateSegment(active.id, {
                      target: unit.target,
                      origin: "tm-fuzzy",
                      status: "needs-confirmation",
                    });
                    onToast("已应用翻译记忆候选，仍需确认");
                  }}
                />
              )}
              {rightTab === "terms" && (
                <>
                  <div className="term-lookup">
                    <label>
                      查询当前片段中的词或短语
                      <input
                        value={lookupText}
                        onChange={(event) => setLookupText(event.target.value)}
                        placeholder="例如：human agency"
                      />
                    </label>
                    <button
                      disabled={!lookupText.trim() || lookingUp}
                      onClick={() => void runLookup()}
                    >
                      {lookingUp ? (
                        <LoaderCircle className="spin" size={13} />
                      ) : (
                        <Search size={13} />
                      )}
                      查询术语
                    </button>
                  </div>
                  {active.termLookups.map((result) => (
                    <div className="lookup-result" key={result.id}>
                      <span>
                        {result.provider === "local"
                          ? "个人术语库"
                          : "安全代理检索"}
                      </span>
                      <h3>
                        {result.term} <small>{result.partOfSpeech}</small>
                      </h3>
                      <p>{result.contextMeaning || result.meaning}</p>
                      <strong>
                        {result.recommendedTranslations.join("／") ||
                          "暂无推荐译法"}
                      </strong>
                      {result.forbiddenTranslations.length > 0 && (
                        <small>
                          不推荐：{result.forbiddenTranslations.join("、")}
                        </small>
                      )}
                      <div>
                        {result.sources.map((source, index) =>
                          source.url ? (
                            <a
                              key={`${source.title}-${index}`}
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {source.title}
                            </a>
                          ) : (
                            <i key={`${source.title}-${index}`}>
                              {source.title}
                            </i>
                          ),
                        )}
                      </div>
                      <button
                        onClick={() => {
                          const entry: TermEntry = {
                            id: createId("term"),
                            source: result.term,
                            target: result.recommendedTranslations[0] ?? "",
                            definition: result.contextMeaning || result.meaning,
                            domain: project.domain,
                            partOfSpeech: result.partOfSpeech,
                            allowed: result.recommendedTranslations,
                            forbidden: result.forbiddenTranslations,
                            example: result.examples[0] ?? "",
                            sourceRef: result.sources
                              .map((source) => source.title)
                              .join("；"),
                            status: "candidate",
                          };
                          onWorkspace((current) => ({
                            ...current,
                            terms: current.terms.some(
                              (term) =>
                                term.source.toLowerCase() ===
                                  entry.source.toLowerCase() &&
                                term.domain === entry.domain,
                            )
                              ? current.terms
                              : [entry, ...current.terms],
                          }));
                          onToast("已加入候选术语，需人工审核");
                        }}
                      >
                        加入术语库
                      </button>
                    </div>
                  ))}
                  {workspace.terms
                    .filter((term) =>
                      active.source
                        .toLowerCase()
                        .includes(term.source.toLowerCase()),
                    )
                    .map((term) => (
                      <div className="term-detail" key={term.id}>
                        <span>{term.status}</span>
                        <h3>{term.source}</h3>
                        <strong>{term.target || "待核验"}</strong>
                        <p>{term.definition}</p>
                        <small>{term.sourceRef}</small>
                      </div>
                    ))}
                </>
              )}
              {rightTab === "culture" &&
                (active.culturalNotes.length ? (
                  active.culturalNotes.map((note) => (
                    <div className="lookup-result" key={note.id}>
                      <span>
                        {note.category} · {note.provider}
                      </span>
                      <h3>{note.expression}</h3>
                      <p>{note.explanation}</p>
                      <strong>{note.translationAdvice}</strong>
                      <div>
                        {note.sources.map((source, index) =>
                          source.url ? (
                            <a
                              key={`${source.title}-${index}`}
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {source.title}
                            </a>
                          ) : (
                            <i key={`${source.title}-${index}`}>
                              {source.title}
                            </i>
                          ),
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="暂无可核验的文化背景"
                    text="文化概念识别依赖安全代理与来源检索；当前不会用无来源的模型解释填充此处。"
                  />
                ))}
              {rightTab === "context" && (
                <ContextView file={file} active={active} />
              )}
              {rightTab === "quality" &&
                (projectIssues.length ? (
                  projectIssues.map((issue) => {
                    const issueFile = project.files.find((item) =>
                      item.segments.some(
                        (segment) => segment.id === issue.segmentId,
                      ),
                    );
                    const issueSegment = issueFile?.segments.find(
                      (segment) => segment.id === issue.segmentId,
                    );
                    return (
                      <div
                        className={`issue-row ${issue.severity}`}
                        key={issue.id}
                      >
                        <AlertTriangle size={15} />
                        <div>
                          <strong>{issue.type}</strong>
                          <p>{issue.message}</p>
                          <small>
                            {issueFile?.name} · 片段 {issueSegment?.order}
                          </small>
                          <small>{issue.evidence}</small>
                          <div className="issue-actions">
                            <button
                              onClick={() => {
                                if (issueFile) setActiveFileId(issueFile.id);
                                setActiveSegmentId(issue.segmentId);
                              }}
                            >
                              定位到片段
                            </button>
                            <button
                              onClick={() => {
                                onWorkspace((current) => ({
                                  ...current,
                                  qualityIssues: current.qualityIssues.map(
                                    (item) =>
                                      item.id === issue.id
                                        ? {
                                            ...item,
                                            resolved: true,
                                            resolvedAt:
                                              new Date().toISOString(),
                                            resolutionNote: "用户标记为已处理",
                                          }
                                        : item,
                                  ),
                                }));
                                onToast("质量问题已标记为解决");
                              }}
                            >
                              <Check size={12} />
                              标记已解决
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <Empty
                    title="暂无质量问题"
                    text="点击顶部“质量检查”运行项目检查。"
                  />
                ))}
              {rightTab === "history" &&
                (active.revisions.length ? (
                  active.revisions.map((revision) => (
                    <div className="history-row" key={revision.id}>
                      <History size={15} />
                      <div>
                        <strong>{revision.type}</strong>
                        <span>{dateTime(revision.createdAt)}</span>
                        <p>{revision.reason}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="还没有修改记录"
                    text="确认或恢复版本后会保留记录。"
                  />
                ))}
              {rightTab === "notes" && (
                <>
                  <label className="note-field">
                    片段批注
                    <textarea
                      value={active.note}
                      onChange={(event) =>
                        updateSegment(active.id, { note: event.target.value })
                      }
                      placeholder="记录上下文、术语来源或待确认问题……"
                    />
                  </label>
                  <button
                    className="panel-action"
                    onClick={() => addTM(active)}
                  >
                    <Database size={14} />
                    写入翻译记忆
                  </button>
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function NewsFeed({
  workspace,
  onWorkspace,
  onPractice,
}: {
  workspace: Workspace;
  onWorkspace: (fn: (current: Workspace) => Workspace) => void;
  onPractice: (item: NewsItem, excerpt: string, paragraphId: string) => void;
}) {
  const [filter, setFilter] = useState("全部");
  const [readerId, setReaderId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [customExcerpt, setCustomExcerpt] = useState("");
  const items = workspace.news;
  const categories = [
    "全部",
    ...Array.from(new Set(items.map((item) => item.category))),
    "我的收藏",
    "已读",
  ];
  const visible = items.filter((item) =>
    filter === "全部" || filter === "我的收藏"
      ? filter === "全部" || item.saved
      : filter === "已读"
        ? item.read
        : item.category === filter,
  );
  const reader = items.find((item) => item.id === readerId);
  const changeItem = (id: string, patch: Partial<NewsItem>) =>
    onWorkspace((current) => ({
      ...current,
      news: current.news.map((item) =>
        item.id === id
          ? { ...item, ...patch, updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
  const sync = async () => {
    setSyncing(true);
    setSyncMessage("正在通过内容代理同步…");
    const report = await syncContentSources(workspace);
    onWorkspace((current) => ({
      ...current,
      news: report.items,
      sources: report.sources,
    }));
    setSyncMessage(
      report.error ||
        `新增 ${report.added} · 更新 ${report.updated} · 去重 ${report.deduplicated} · 失败 ${report.failed}`,
    );
    setSyncing(false);
  };
  const practice = (item: NewsItem, excerpt: string, paragraphId: string) => {
    if (!excerpt.trim()) {
      setSyncMessage("请先粘贴或选择一个可合法使用的短片段");
      return;
    }
    onPractice(item, excerpt.trim(), paragraphId);
    setReaderId("");
    setCustomExcerpt("");
  };
  return (
    <div className="v2-stack">
      <PageHead
        eyebrow="READ · VERIFY · TRANSLATE"
        title="译闻与素材"
        text="按来源与版权边界保存内容；实时同步只经过你配置的安全代理。"
        actions={
          <button
            className="v2-btn subtle"
            disabled={syncing}
            onClick={() => void sync()}
          >
            {syncing ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <RefreshCcw size={16} />
            )}
            {syncing ? "正在同步" : "刷新来源"}
          </button>
        }
      />
      {syncMessage && (
        <div
          className={
            syncMessage.includes("失败") || syncMessage.includes("未配置")
              ? "sync-status error"
              : "sync-status"
          }
        >
          {syncMessage}
        </div>
      )}
      <section className="news-toolbar">
        <div>
          {categories.map((item) => (
            <button
              className={filter === item ? "active" : ""}
              key={item}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span>
          <ShieldCheck size={15} />
          {items.length}条可追溯内容记录
        </span>
      </section>
      <div className="news-layout">
        <aside>
          <strong>来源状态</strong>
          {workspace.sources.map((source) => (
            <div key={source.id}>
              {source.lastError ? <WifiOff size={14} /> : <Wifi size={14} />}
              <span>{source.name}</span>
              <small>
                {source.enabled
                  ? source.lastError ||
                    (source.lastSyncedAt
                      ? dateTime(source.lastSyncedAt)
                      : "待首次同步")
                  : "未启用"}
              </small>
              <button
                onClick={() =>
                  onWorkspace((current) => ({
                    ...current,
                    sources: current.sources.map((item) =>
                      item.id === source.id
                        ? {
                            ...item,
                            enabled: !item.enabled,
                            updatedAt: new Date().toISOString(),
                          }
                        : item,
                    ),
                  }))
                }
              >
                {source.enabled ? "停用" : "启用"}
              </button>
            </div>
          ))}
          <p>
            元数据型内容不保存全文；开放许可、公共领域或用户自有文本才可在站内显示正文。
          </p>
        </aside>
        <section>
          {visible.map((item) => (
            <article className="news-item" key={item.id}>
              <header>
                <span>{item.source}</span>
                <time>{item.publishedAt}</time>
                <button
                  aria-label={item.saved ? "取消收藏" : "收藏"}
                  onClick={() => changeItem(item.id, { saved: !item.saved })}
                >
                  {item.saved ? (
                    <BookMarked size={16} />
                  ) : (
                    <BookOpen size={16} />
                  )}
                </button>
              </header>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>
              <div>
                <span>{item.category}</span>
                {item.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
                <i>
                  {item.level} · {item.readingMinutes}分钟
                </i>
              </div>
              <blockquote>{item.trainingDirection}</blockquote>
              <footer>
                <button
                  onClick={() => {
                    setReaderId(item.id);
                    changeItem(item.id, {
                      read: true,
                      readingProgress: Math.max(item.readingProgress, 15),
                    });
                  }}
                >
                  站内阅读 <Eye size={14} />
                </button>
                <button
                  onClick={() =>
                    changeItem(item.id, {
                      read: !item.read,
                      readingProgress: item.read ? 0 : 100,
                    })
                  }
                >
                  {item.read ? "标为未读" : "标记已读"}
                </button>
                <a href={item.url} target="_blank" rel="noreferrer">
                  原始来源 <Link2 size={14} />
                </a>
              </footer>
              <small>{item.sourceNote}</small>
            </article>
          ))}
          {!visible.length && (
            <Empty
              title="当前分类没有内容"
              text="切换分类，或配置并启用内容来源后刷新。"
            />
          )}
        </section>
      </div>
      {reader && (
        <div className="reader-drawer" role="dialog" aria-modal="true">
          <article>
            <header>
              <div>
                <span>
                  {reader.source} · {reader.category}
                </span>
                <h1>{reader.title}</h1>
                <small>
                  {reader.publishedAt} · {reader.level} ·{" "}
                  {reader.copyrightStatus}
                </small>
              </div>
              <button
                onClick={() => {
                  setReaderId("");
                  setCustomExcerpt("");
                }}
              >
                <X size={18} />
              </button>
            </header>
            <p className="reader-summary">{reader.summary}</p>
            <div className="reader-keywords">
              {reader.keywords.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            {reader.paragraphs.length ? (
              <div className="reader-body">
                {reader.paragraphs.map((paragraph) => (
                  <section key={paragraph.id}>
                    <span>¶{paragraph.order}</span>
                    <p>{paragraph.text}</p>
                    {paragraph.translatable && (
                      <button
                        onClick={() =>
                          practice(reader, paragraph.text, paragraph.id)
                        }
                      >
                        设为练习片段
                      </button>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <div className="copyright-boundary">
                <ShieldCheck size={18} />
                <p>
                  此记录只保存标题、来源和平台摘要。请打开原始来源，选择你有权用于学习的短片段，再粘贴到下方。
                </p>
              </div>
            )}
            <label className="excerpt-box">
              自选练习片段
              <textarea
                value={customExcerpt}
                onChange={(event) => setCustomExcerpt(event.target.value)}
                placeholder="粘贴一个有权使用的段落或句子；平台会记录原始链接。"
              />
            </label>
            <footer>
              <a
                className="v2-btn subtle"
                href={reader.url}
                target="_blank"
                rel="noreferrer"
              >
                打开原始来源 <Link2 size={14} />
              </a>
              <button
                className="v2-btn primary"
                disabled={!customExcerpt.trim()}
                onClick={() => practice(reader, customExcerpt, "user-selected")}
              >
                加入翻译练习 <ArrowRight size={14} />
              </button>
            </footer>
          </article>
        </div>
      )}
    </div>
  );
}

function ReviewCenter({
  cards,
  records,
  onWorkspace,
  onToast,
}: {
  cards: PhraseCard[];
  records: Workspace["reviewRecords"];
  onWorkspace: (fn: (current: Workspace) => Workspace) => void;
  onToast: (message: string) => void;
}) {
  const due = cards.filter((card) => isDue(card.nextReviewAt));
  const [activeId, setActiveId] = useState(due[0]?.id ?? cards[0]?.id ?? "");
  const [revealed, setRevealed] = useState(false);
  const [mode, setMode] = useState<
    "source-target" | "target-source" | "cloze" | "contrast" | "retranslate"
  >("source-target");
  const [attempt, setAttempt] = useState("");
  const active = cards.find((card) => card.id === activeId) ?? cards[0];
  const review = (result: "forgot" | "fuzzy" | "mastered") => {
    if (!active) return;
    const interval =
      result === "forgot"
        ? 0
        : result === "fuzzy"
          ? 2
          : Math.min(30, [1, 3, 7, 14, 30][Math.min(active.mastery, 4)]);
    const next = new Date();
    next.setDate(next.getDate() + interval);
    const mastery =
      result === "forgot"
        ? Math.max(0, active.mastery - 1)
        : result === "fuzzy"
          ? active.mastery
          : Math.min(5, active.mastery + 1);
    onWorkspace((current) => ({
      ...current,
      phraseCards: current.phraseCards.map((card) =>
        card.id === active.id
          ? {
              ...card,
              mastery: mastery as PhraseCard["mastery"],
              nextReviewAt: next.toISOString(),
            }
          : card,
      ),
      reviewRecords: [
        {
          id: createId("review"),
          cardId: active.id,
          mode,
          result,
          reviewedAt: new Date().toISOString(),
          nextReviewAt: next.toISOString(),
        },
        ...current.reviewRecords,
      ],
    }));
    setRevealed(false);
    const index = due.findIndex((card) => card.id === active.id);
    setActiveId(due[index + 1]?.id ?? due[0]?.id ?? "");
    onToast(`已安排下次复习：${interval ? `${interval}天后` : "今天稍后"}`);
  };
  const cloze = active?.target
    ? active.target.replace(
        active.target.match(/[\p{L}\p{Script=Han}]{2,}/u)?.[0] ?? active.target,
        "______",
      )
    : "";
  const contrast = cards.find(
    (card) => card.id !== active?.id && card.domain === active?.domain,
  );
  const prompt = !active
    ? ""
    : mode === "target-source"
      ? active.target
      : mode === "cloze"
        ? `${active.source}\n${cloze}`
        : active.source;
  const answer = !active
    ? ""
    : mode === "target-source"
      ? active.source
      : active.target;
  return (
    <div className="v2-stack">
      <PageHead
        eyebrow="REVIEW QUEUE"
        title="复习中心"
        text="五种模式使用不同的回忆任务，并把每次结果写入可解释的复习记录。"
      />
      <section className="review-stats">
        <div>
          <strong>{due.length}</strong>
          <span>今日到期</span>
        </div>
        <div>
          <strong>{cards.filter((card) => card.type === "term").length}</strong>
          <span>术语卡</span>
        </div>
        <div>
          <strong>
            {cards.filter((card) => card.type === "phrase").length}
          </strong>
          <span>表达卡</span>
        </div>
        <div>
          <strong>{records.length}</strong>
          <span>累计复习</span>
        </div>
      </section>
      <div className="review-modes">
        {(
          [
            ["source-target", "原文→译文"],
            ["target-source", "译文→原文"],
            ["cloze", "完形填空"],
            ["contrast", "相似辨析"],
            ["retranslate", "重新翻译"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className={mode === value ? "active" : ""}
            onClick={() => {
              setMode(value);
              setRevealed(false);
              setAttempt("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {active ? (
        <section className="review-stage">
          <aside>
            {cards.map((card) => (
              <button
                key={card.id}
                className={card.id === active.id ? "active" : ""}
                onClick={() => {
                  setActiveId(card.id);
                  setRevealed(false);
                  setAttempt("");
                }}
              >
                <span>{card.type}</span>
                <strong>{card.source}</strong>
                <small>掌握度 {card.mastery}/5</small>
              </button>
            ))}
          </aside>
          <article className="review-card">
            <span>
              {active.domain} · {active.type} · {mode}
            </span>
            <small>{active.context}</small>
            <h2 className="review-prompt">{prompt}</h2>
            {mode === "contrast" && (
              <div className="contrast-pair">
                <div>
                  <span>表达 A</span>
                  <strong>{active.target}</strong>
                </div>
                <div>
                  <span>表达 B</span>
                  <strong>{contrast?.target || "暂无同领域对照表达"}</strong>
                </div>
                <p>先说明两种表达的语境和功能差异，再查看参考说明。</p>
              </div>
            )}
            {(mode === "retranslate" || mode === "cloze") && (
              <textarea
                className="review-attempt"
                value={attempt}
                onChange={(event) => setAttempt(event.target.value)}
                placeholder={
                  mode === "retranslate"
                    ? "重新完成译文后再查看参考答案……"
                    : "填写空缺表达……"
                }
              />
            )}
            <div
              className={revealed ? "review-answer revealed" : "review-answer"}
            >
              <span>参考答案</span>
              <strong>{answer}</strong>
              <p>
                {mode === "contrast" && contrast
                  ? `对照：${contrast.target}。`
                  : ""}
                {active.explanation || active.usage}
              </p>
              {attempt && <small>本次作答：{attempt}</small>}
            </div>
            {!revealed ? (
              <button
                className="v2-btn primary"
                onClick={() => setRevealed(true)}
              >
                <Eye size={16} />
                显示答案
              </button>
            ) : (
              <div className="review-buttons">
                <button onClick={() => review("forgot")}>未掌握</button>
                <button onClick={() => review("fuzzy")}>模糊</button>
                <button onClick={() => review("mastered")}>掌握</button>
              </div>
            )}
            <footer>{active.sourceRef}</footer>
          </article>
        </section>
      ) : (
        <Empty
          title="复习队列为空"
          text="从快速翻译或项目中加入表达后，会在这里安排复习。"
        />
      )}
    </div>
  );
}

function LanguageAssets({
  workspace,
  onWorkspace,
  onToast,
}: {
  workspace: Workspace;
  onWorkspace: (fn: (current: Workspace) => Workspace) => void;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<"tm" | "terms" | "styles" | "references">(
    "tm",
  );
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{
    tab: typeof tab;
    id: string;
  } | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const tm = workspace.translationMemory.filter((unit) =>
    `${unit.source}${unit.target}`.toLowerCase().includes(query.toLowerCase()),
  );
  const terms = workspace.terms.filter((term) =>
    `${term.source}${term.target}`.toLowerCase().includes(query.toLowerCase()),
  );
  const references = workspace.personalReferences.filter((item) =>
    `${item.title}${item.source}${item.summary}${item.tags.join("")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const openEditor = (
    kind: typeof tab,
    item?: TranslationUnit | TermEntry | StyleGuide | PersonalReference,
  ) => {
    setEditing({ tab: kind, id: item?.id ?? "" });
    if (kind === "tm") {
      const value = item as TranslationUnit | undefined;
      setDraft({
        source: value?.source ?? "",
        target: value?.target ?? "",
        domain: value?.domain ?? "通用",
        quality: value?.quality ?? "reviewed",
      });
    }
    if (kind === "terms") {
      const value = item as TermEntry | undefined;
      setDraft({
        source: value?.source ?? "",
        target: value?.target ?? "",
        definition: value?.definition ?? "",
        domain: value?.domain ?? "通用",
        partOfSpeech: value?.partOfSpeech ?? "",
        allowed: value?.allowed.join("，") ?? "",
        forbidden: value?.forbidden.join("，") ?? "",
        example: value?.example ?? "",
        sourceRef: value?.sourceRef ?? "",
        status: value?.status ?? "candidate",
      });
    }
    if (kind === "styles") {
      const value = item as StyleGuide | undefined;
      setDraft({
        name: value?.name ?? "",
        audience: value?.audience ?? "",
        formality: value?.formality ?? "",
        punctuation: value?.punctuation ?? "",
        dates: value?.dates ?? "",
        names: value?.names ?? "",
        preferred: value?.preferred.join("，") ?? "",
        forbidden: value?.forbidden.join("，") ?? "",
      });
    }
    if (kind === "references") {
      const value = item as PersonalReference | undefined;
      setDraft({
        title: value?.title ?? "",
        source: value?.source ?? "",
        url: value?.url ?? "",
        summary: value?.summary ?? "",
        tags: value?.tags.join("，") ?? "",
      });
    }
  };
  const list = (value: string) =>
    value
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  const saveAsset = () => {
    if (
      (editing?.tab === "tm" || editing?.tab === "terms") &&
      (!draft.source?.trim() || !draft.target?.trim())
    ) {
      onToast("请填写源文和译文");
      return;
    }
    if (editing?.tab === "styles" && !draft.name?.trim()) {
      onToast("请填写风格指南名称");
      return;
    }
    if (editing?.tab === "references" && !draft.title?.trim()) {
      onToast("请填写资料标题");
      return;
    }
    const now = new Date().toISOString();
    const id = editing?.id || createId(editing?.tab ?? "asset");
    onWorkspace((current) => {
      if (editing?.tab === "tm") {
        const item: TranslationUnit = {
          id,
          source: draft.source,
          target: draft.target,
          sourceLanguage: "英语（en）",
          targetLanguage: "简体中文（zh-CN）",
          domain: draft.domain,
          quality: draft.quality as TranslationUnit["quality"],
          useCount:
            current.translationMemory.find((value) => value.id === id)
              ?.useCount ?? 0,
          createdAt:
            current.translationMemory.find((value) => value.id === id)
              ?.createdAt ?? now,
          updatedAt: now,
        };
        return {
          ...current,
          translationMemory: [
            item,
            ...current.translationMemory.filter((value) => value.id !== id),
          ],
        };
      }
      if (editing?.tab === "terms") {
        const duplicate = current.terms.find(
          (value) =>
            value.id !== id &&
            value.source.trim().toLowerCase() ===
              draft.source.trim().toLowerCase() &&
            value.domain === draft.domain,
        );
        if (duplicate) {
          onToast("同一领域已存在相同源语术语");
          return current;
        }
        const item: TermEntry = {
          id,
          source: draft.source,
          target: draft.target,
          definition: draft.definition,
          domain: draft.domain,
          partOfSpeech: draft.partOfSpeech,
          allowed: list(draft.allowed),
          forbidden: list(draft.forbidden),
          example: draft.example,
          sourceRef: draft.sourceRef,
          status: draft.status as TermEntry["status"],
        };
        return {
          ...current,
          terms: [item, ...current.terms.filter((value) => value.id !== id)],
        };
      }
      if (editing?.tab === "styles") {
        const item: StyleGuide = {
          id,
          name: draft.name,
          audience: draft.audience,
          formality: draft.formality,
          punctuation: draft.punctuation,
          dates: draft.dates,
          names: draft.names,
          preferred: list(draft.preferred),
          forbidden: list(draft.forbidden),
        };
        return {
          ...current,
          styleGuides: [
            item,
            ...current.styleGuides.filter((value) => value.id !== id),
          ],
        };
      }
      const item: PersonalReference = {
        id,
        title: draft.title,
        source: draft.source,
        url: draft.url,
        summary: draft.summary,
        tags: list(draft.tags),
        createdAt:
          current.personalReferences.find((value) => value.id === id)
            ?.createdAt ?? now,
        updatedAt: now,
      };
      return {
        ...current,
        personalReferences: [
          item,
          ...current.personalReferences.filter((value) => value.id !== id),
        ],
      };
    });
    setEditing(null);
    onToast(editing?.id ? "语言资产已更新" : "语言资产已新增");
  };
  const remove = (kind: typeof tab, id: string) => {
    if (!window.confirm("确定删除这条语言资产吗？此操作无法撤销。")) return;
    onWorkspace((current) => ({
      ...current,
      translationMemory:
        kind === "tm"
          ? current.translationMemory.filter((item) => item.id !== id)
          : current.translationMemory,
      terms:
        kind === "terms"
          ? current.terms.filter((item) => item.id !== id)
          : current.terms,
      styleGuides:
        kind === "styles"
          ? current.styleGuides.filter((item) => item.id !== id)
          : current.styleGuides,
      personalReferences:
        kind === "references"
          ? current.personalReferences.filter((item) => item.id !== id)
          : current.personalReferences,
    }));
    onToast("语言资产已删除");
  };
  const exportActive = () =>
    downloadText(
      `yixue-${tab}.json`,
      JSON.stringify(
        tab === "tm"
          ? workspace.translationMemory
          : tab === "terms"
            ? workspace.terms
            : tab === "styles"
              ? workspace.styleGuides
              : workspace.personalReferences,
        null,
        2,
      ),
      "application/json;charset=utf-8",
    );
  return (
    <div className="v2-stack">
      <PageHead
        eyebrow="LANGUAGE ASSETS"
        title="语言资产"
        text="把确认过的译法、术语和风格规则放在AI建议之前，并保留来源与审核状态。"
        actions={
          <>
            <button className="v2-btn subtle" onClick={exportActive}>
              <Download size={16} />
              导出当前库
            </button>
            <button
              className="v2-btn subtle"
              onClick={() => exportWorkspace(workspace)}
            >
              <Database size={16} />
              导出工作区
            </button>
          </>
        }
      />
      <div className="asset-tabs">
        {(
          [
            ["tm", "翻译记忆"],
            ["terms", "术语库"],
            ["styles", "风格指南"],
            ["references", "个人资料"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {label}
            <span>
              {value === "tm"
                ? workspace.translationMemory.length
                : value === "terms"
                  ? workspace.terms.length
                  : value === "styles"
                    ? workspace.styleGuides.length
                    : workspace.personalReferences.length}
            </span>
          </button>
        ))}
      </div>
      <section className="asset-workspace">
        <header>
          <div>
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索源文、译文、术语或来源……"
            />
          </div>
          <button onClick={() => openEditor(tab)}>
            <Plus size={15} />
            新增
          </button>
        </header>
        {tab === "tm" && (
          <div className="asset-table">
            <div className="asset-head">
              <span>源文</span>
              <span>译文</span>
              <span>领域 / 质量</span>
              <span>操作</span>
            </div>
            {tm.map((unit) => (
              <div className="asset-row" key={unit.id}>
                <p>{unit.source}</p>
                <p>{unit.target}</p>
                <span>
                  {unit.domain}
                  <small>
                    {unit.quality} · 使用{unit.useCount}次
                  </small>
                </span>
                <div className="row-actions">
                  <button onClick={() => openEditor("tm", unit)}>编辑</button>
                  <button onClick={() => remove("tm", unit.id)}>删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "terms" && (
          <div className="term-assets">
            {terms.map((term) => (
              <article key={term.id}>
                <header>
                  <span>{term.domain}</span>
                  <i>{term.status}</i>
                </header>
                <h2>{term.source}</h2>
                <strong>{term.target || "译名待核验"}</strong>
                <p>{term.definition || "尚未填写定义。"}</p>
                <dl>
                  <div>
                    <dt>允许译法</dt>
                    <dd>{term.allowed.join("、") || "—"}</dd>
                  </div>
                  <div>
                    <dt>禁用译法</dt>
                    <dd>{term.forbidden.join("、") || "—"}</dd>
                  </div>
                  <div>
                    <dt>来源</dt>
                    <dd>{term.sourceRef || "待补充"}</dd>
                  </div>
                </dl>
                <div className="row-actions">
                  {term.status === "candidate" && (
                    <>
                      <button
                        onClick={() =>
                          onWorkspace((current) => ({
                            ...current,
                            terms: current.terms.map((item) =>
                              item.id === term.id
                                ? { ...item, status: "approved" }
                                : item,
                            ),
                          }))
                        }
                      >
                        批准
                      </button>
                      <button
                        onClick={() =>
                          onWorkspace((current) => ({
                            ...current,
                            terms: current.terms.map((item) =>
                              item.id === term.id
                                ? { ...item, status: "rejected" }
                                : item,
                            ),
                          }))
                        }
                      >
                        拒绝
                      </button>
                    </>
                  )}
                  <button onClick={() => openEditor("terms", term)}>
                    编辑
                  </button>
                  <button onClick={() => remove("terms", term.id)}>删除</button>
                </div>
              </article>
            ))}
          </div>
        )}
        {tab === "styles" && (
          <div className="style-guides">
            {workspace.styleGuides
              .filter((guide) =>
                `${guide.name}${guide.audience}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((guide) => (
                <article key={guide.id}>
                  <span>STYLE GUIDE</span>
                  <h2>{guide.name}</h2>
                  <p>
                    {guide.audience} · {guide.formality}
                  </p>
                  <dl>
                    <div>
                      <dt>标点</dt>
                      <dd>{guide.punctuation}</dd>
                    </div>
                    <div>
                      <dt>日期</dt>
                      <dd>{guide.dates}</dd>
                    </div>
                    <div>
                      <dt>专名</dt>
                      <dd>{guide.names}</dd>
                    </div>
                    <div>
                      <dt>推荐</dt>
                      <dd>{guide.preferred.join("、")}</dd>
                    </div>
                    <div>
                      <dt>禁用</dt>
                      <dd>{guide.forbidden.join("、")}</dd>
                    </div>
                  </dl>
                  <div className="row-actions">
                    <button onClick={() => openEditor("styles", guide)}>
                      编辑
                    </button>
                    <button onClick={() => remove("styles", guide.id)}>
                      删除
                    </button>
                  </div>
                </article>
              ))}
          </div>
        )}
        {tab === "references" && (
          <div className="reference-list">
            {references.map((item) => (
              <article key={item.id}>
                <span>{item.source || "个人资料"}</span>
                <h2>{item.title}</h2>
                <p>{item.summary}</p>
                <div>
                  {item.tags.map((tag) => (
                    <i key={tag}>{tag}</i>
                  ))}
                </div>
                <footer>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      查看来源
                    </a>
                  )}
                  <button onClick={() => openEditor("references", item)}>
                    编辑
                  </button>
                  <button onClick={() => remove("references", item.id)}>
                    删除
                  </button>
                </footer>
              </article>
            ))}
            {!references.length && (
              <Empty
                title="还没有个人参考资料"
                text="新增标题、来源、链接与摘要，可用于保存 Obsidian 文件索引或权威资料入口。"
              />
            )}
          </div>
        )}
      </section>
      {editing && (
        <div className="asset-modal" role="dialog" aria-modal="true">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveAsset();
            }}
          >
            <header>
              <div>
                <span>{editing.id ? "编辑" : "新增"}</span>
                <h2>
                  {editing.tab === "tm"
                    ? "翻译记忆"
                    : editing.tab === "terms"
                      ? "术语"
                      : editing.tab === "styles"
                        ? "风格指南"
                        : "个人资料"}
                </h2>
              </div>
              <button type="button" onClick={() => setEditing(null)}>
                <X size={17} />
              </button>
            </header>
            <div className="asset-form">
              {Object.entries(draft).map(([key, value]) =>
                key === "quality" ? (
                  <label key={key}>
                    质量状态
                    <select
                      value={value}
                      onChange={(event) =>
                        setDraft({ ...draft, [key]: event.target.value })
                      }
                    >
                      <option value="draft">草稿</option>
                      <option value="reviewed">已复核</option>
                      <option value="approved">已批准</option>
                    </select>
                  </label>
                ) : key === "status" ? (
                  <label key={key}>
                    审核状态
                    <select
                      value={value}
                      onChange={(event) =>
                        setDraft({ ...draft, [key]: event.target.value })
                      }
                    >
                      <option value="candidate">候选</option>
                      <option value="approved">已批准</option>
                      <option value="rejected">已拒绝</option>
                    </select>
                  </label>
                ) : (
                  <label
                    key={key}
                    className={
                      ["definition", "summary", "example"].includes(key)
                        ? "wide"
                        : ""
                    }
                  >
                    {assetFieldLabel(key)}
                    {["definition", "summary", "example"].includes(key) ? (
                      <textarea
                        value={value}
                        onChange={(event) =>
                          setDraft({ ...draft, [key]: event.target.value })
                        }
                      />
                    ) : (
                      <input
                        type={key === "url" ? "url" : "text"}
                        value={value}
                        onChange={(event) =>
                          setDraft({ ...draft, [key]: event.target.value })
                        }
                      />
                    )}
                  </label>
                ),
              )}
            </div>
            <footer>
              <button type="button" onClick={() => setEditing(null)}>
                取消
              </button>
              <button className="v2-btn primary" type="submit">
                <Save size={14} />
                保存
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

function SkillCenter({
  workspace,
  onWorkspace,
  onToast,
}: {
  workspace: Workspace;
  onWorkspace: (fn: (current: Workspace) => Workspace) => void;
  onToast: (message: string) => void;
}) {
  const skills = workspace.skills;
  const [activeId, setActiveId] = useState(skills[0]?.id ?? "");
  const [showLogs, setShowLogs] = useState(false);
  const skill = skills.find((item) => item.id === activeId) ?? skills[0];
  const runSkill = () => {
    if (!skill?.enabled) {
      onToast("此Skill尚未启用或尚未实现");
      return;
    }
    const project =
      workspace.projects.find((item) => item.status === "active") ??
      workspace.projects[0];
    const segments = project ? projectSegments(project) : [];
    let outputSummary = "";
    let success = true;
    let error = "";
    if (!project) {
      success = false;
      error = "没有可处理的翻译项目";
    } else if (skill.id === "builtin.phrase-extractor") {
      const candidates = segments.filter(
        (segment) =>
          segment.status === "confirmed" &&
          segment.target.trim() &&
          !workspace.phraseCards.some((card) => card.source === segment.source),
      );
      const cards: PhraseCard[] = candidates.map((segment) => ({
        id: createId("card"),
        type: "phrase",
        source: segment.source,
        target: segment.target,
        context: project.name,
        usage: "来自用户确认译文，等待复习验证。",
        domain: project.domain,
        sourceRef: `${project.name} · 片段${segment.order}`,
        errorRecord: "",
        explanation: "由内置提取流程生成，未声称为权威译法。",
        tags: [project.domain],
        mastery: 0,
        nextReviewAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }));
      onWorkspace((current) => ({
        ...current,
        phraseCards: [...cards, ...current.phraseCards],
      }));
      outputSummary = `生成 ${cards.length} 张候选表达卡`;
    } else if (
      [
        "builtin.terminology-consistency",
        "builtin.mt-tone-check",
        "builtin.quality-analysis",
      ].includes(skill.id)
    ) {
      const all = inspectProject(segments, workspace.terms);
      const issues =
        skill.id === "builtin.terminology-consistency"
          ? all.filter((item) => item.type.includes("术语"))
          : skill.id === "builtin.mt-tone-check"
            ? all.filter(
                (item) =>
                  item.type.includes("机器翻译腔") ||
                  item.type.includes("表达"),
              )
            : all;
      const ids = new Set(segments.map((segment) => segment.id));
      onWorkspace((current) => ({
        ...current,
        qualityIssues: [
          ...current.qualityIssues.filter((item) => !ids.has(item.segmentId)),
          ...issues,
        ],
      }));
      outputSummary = `生成 ${issues.length} 条待人工复核问题`;
    } else {
      success = false;
      error = "此Skill需要安全代理或内容授权，当前版本尚未实现";
    }
    const log = {
      id: createId("skill-log"),
      skillId: skill.id,
      skillName: skill.name,
      inputType: project ? "project" : "none",
      inputIds: project ? [project.id] : [],
      outputSummary,
      success,
      error,
      executedAt: new Date().toISOString(),
    };
    onWorkspace((current) => ({
      ...current,
      skillExecutionLogs: [log, ...current.skillExecutionLogs],
    }));
    onToast(
      success
        ? `${skill.name}已执行：${outputSummary}`
        : `${skill.name}未执行：${error}`,
    );
  };
  return (
    <div className="v2-stack">
      <PageHead
        eyebrow="CONTROLLED CAPABILITIES"
        title="Skill 中心"
        text="Skill 是受控工作流模块；每次执行都记录输入对象、输出摘要和失败原因。"
        actions={
          <button
            className="v2-btn subtle"
            onClick={() => setShowLogs(!showLogs)}
          >
            <History size={16} />
            {showLogs
              ? "返回Skill"
              : `执行日志 ${workspace.skillExecutionLogs.length}`}
          </button>
        }
      />
      {showLogs ? (
        <section className="execution-log">
          {workspace.skillExecutionLogs.map((log) => (
            <article
              key={log.id}
              className={log.success ? "success" : "failed"}
            >
              <span>
                {log.success ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <AlertTriangle size={15} />
                )}
              </span>
              <div>
                <strong>{log.skillName}</strong>
                <small>
                  {dateTime(log.executedAt)} · {log.inputType} ·{" "}
                  {log.inputIds.join("、") || "无输入"}
                </small>
                <p>{log.success ? log.outputSummary : log.error}</p>
              </div>
            </article>
          ))}
          {!workspace.skillExecutionLogs.length && (
            <Empty
              title="还没有执行记录"
              text="选择一个已实现并启用的Skill运行后，结果会保存在这里。"
            />
          )}
        </section>
      ) : (
        <div className="skill-layout">
          <aside>
            {skills.map((item) => (
              <button
                key={item.id}
                className={item.id === skill?.id ? "active" : ""}
                onClick={() => setActiveId(item.id)}
              >
                <span className={item.enabled ? "enabled" : ""}>
                  {item.enabled ? <Check size={13} /> : <Circle size={13} />}
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.category} · v{item.version}
                  </small>
                </div>
              </button>
            ))}
          </aside>
          {skill && (
            <section className="skill-detail">
              <header>
                <div>
                  <span>BUILT-IN SKILL</span>
                  <h1>{skill.name}</h1>
                  <p>{skill.description}</p>
                </div>
                <button
                  className={skill.enabled ? "skill-toggle on" : "skill-toggle"}
                  onClick={() =>
                    onWorkspace((current) => ({
                      ...current,
                      skills: current.skills.map((item) =>
                        item.id === skill.id
                          ? { ...item, enabled: !item.enabled }
                          : item,
                      ),
                    }))
                  }
                >
                  <i />
                  {skill.enabled ? "已启用" : "已停用"}
                </button>
              </header>
              <div className="skill-meta">
                <div>
                  <span>作者与来源</span>
                  <strong>译学工作台内置</strong>
                </div>
                <div>
                  <span>版本</span>
                  <strong>{skill.version}</strong>
                </div>
                <div>
                  <span>更新时间</span>
                  <strong>{dateTime(skill.updatedAt)}</strong>
                </div>
                <div>
                  <span>执行类型</span>
                  <strong>{skill.entryType}</strong>
                </div>
              </div>
              <h3>权限声明</h3>
              <div className="permission-list">
                {skill.permissions.map((permission) => (
                  <span key={permission}>
                    <ShieldCheck size={14} />
                    {permission}
                  </span>
                ))}
              </div>
              <div className="io-grid">
                <div>
                  <span>接受输入</span>
                  {skill.acceptedInput.map((item) => (
                    <strong key={item}>{item}</strong>
                  ))}
                </div>
                <ArrowRight size={18} />
                <div>
                  <span>产生输出</span>
                  {skill.producedOutput.map((item) => (
                    <strong key={item}>{item}</strong>
                  ))}
                </div>
              </div>
              <div className="boundary-box">
                <ShieldCheck size={18} />
                <p>
                  {skill.enabled
                    ? "执行结果只写入对应候选区或问题列表，不会直接修改译文。"
                    : "此Skill当前停用；尚未实现的能力保持停用并明确说明依赖。"}
                </p>
              </div>
              <button
                className="v2-btn primary skill-run"
                disabled={!skill.enabled}
                onClick={runSkill}
              >
                <Play size={15} />
                运行当前Skill
              </button>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsPage({
  workspace,
  onWorkspace,
  onToast,
}: {
  workspace: Workspace;
  onWorkspace: (fn: (current: Workspace) => Workspace) => void;
  onToast: (message: string) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [restoreArmed, setRestoreArmed] = useState(false);
  const settings = workspace.settings;
  const patch = (next: Partial<typeof settings>) =>
    onWorkspace((current) => ({
      ...current,
      settings: { ...current.settings, ...next },
    }));
  const test = async () => {
    if (settings.provider === "demo") {
      onToast("演示模式正常：不会向外部服务发送文本");
      return;
    }
    if (!settings.endpoint) {
      onToast("请先填写安全代理端点");
      return;
    }
    setTesting(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      settings.requestTimeoutMs,
    );
    try {
      const response = await fetch(settings.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "test", model: settings.model }),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        model?: string;
        error?: string;
      };
      onToast(response.ok && payload.ok ? `代理连接成功：${payload.model || settings.model}` : `连接失败：${payload.error || `服务返回 ${response.status}`}`);
    } catch (error) {
      onToast(
        error instanceof DOMException && error.name === "AbortError"
          ? "连接超时，请检查代理状态"
          : "连接失败，请检查端点、网络和跨域设置",
      );
    } finally {
      window.clearTimeout(timeout);
      setTesting(false);
    }
  };
  const importWorkspaceFile = async (file: File) => {
    try {
      const imported = parseWorkspaceImport(await file.text());
      onWorkspace(() => imported);
      onToast("V2工作区已导入并完成兼容迁移");
    } catch (error) {
      onToast(
        error instanceof Error
          ? `导入失败：${error.message}`
          : "导入失败：文件格式无效",
      );
    }
  };
  return (
    <div className="v2-stack">
      <PageHead
        eyebrow="WORKSPACE SETTINGS"
        title="设置"
        text="模型、外观与本地数据由你控制；API密钥只保存在安全代理服务器。"
      />
      <div className="settings-layout">
        <section>
          <header>
            <Bot size={20} />
            <div>
              <h2>DeepSeek 连接</h2>
              <p>正式调用通过安全代理；演示模式不会发送翻译文本。</p>
            </div>
          </header>
          <div className="setting-modes">
            <button
              className={settings.provider === "demo" ? "active" : ""}
              onClick={() => patch({ provider: "demo" })}
            >
              <ShieldCheck size={18} />
              <strong>演示模式</strong>
              <small>本地规则与固定示例</small>
            </button>
            <button
              className={settings.provider === "deepseek-proxy" ? "active" : ""}
              onClick={() => patch({ provider: "deepseek-proxy" })}
            >
              <Wifi size={18} />
              <strong>安全代理</strong>
              <small>连接自有后端</small>
            </button>
          </div>
          {settings.provider === "deepseek-proxy" && (
            <div className="setting-fields">
              <label>
                代理端点
                <input
                  value={settings.endpoint}
                  onChange={(event) => patch({ endpoint: event.target.value })}
                  placeholder="https://your-service.example/api/deepseek"
                />
              </label>
              <label>
                模型
                <select
                  value={settings.model}
                  onChange={(event) => patch({ model: event.target.value })}
                >
                  <option>deepseek-v4-flash</option>
                  <option>deepseek-v4-pro</option>
                </select>
              </label>
              <button
                className="v2-btn primary"
                disabled={testing}
                onClick={() => void test()}
              >
                {testing ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Wifi size={16} />
                )}
                测试连接
              </button>
            </div>
          )}
          <div className="security-callout">
            <AlertTriangle size={17} />
            <p>
              GitHub
              Pages不会接收或保存DeepSeek密钥；模型密钥只能配置在安全代理服务器。
            </p>
          </div>
        </section>
        <section>
          <header>
            <SlidersHorizontal size={20} />
            <div>
              <h2>请求参数</h2>
              <p>控制单次长度和批量大小，避免大文本一次发送。</p>
            </div>
          </header>
          <div className="setting-fields">
            <label>
              温度：{settings.temperature}
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.temperature}
                onChange={(event) =>
                  patch({ temperature: Number(event.target.value) })
                }
              />
            </label>
            <label>
              单次字符上限
              <input
                type="number"
                value={settings.requestLimit}
                onChange={(event) =>
                  patch({ requestLimit: Number(event.target.value) })
                }
              />
            </label>
            <label>
              批量片段数
              <input
                type="number"
                value={settings.batchSize}
                onChange={(event) =>
                  patch({ batchSize: Number(event.target.value) })
                }
              />
            </label>
            <label>
              请求超时（毫秒）
              <input
                type="number"
                min="3000"
                step="1000"
                value={settings.requestTimeoutMs}
                onChange={(event) =>
                  patch({ requestTimeoutMs: Number(event.target.value) })
                }
              />
            </label>
            <label>
              失败重试次数
              <input
                type="number"
                min="0"
                max="5"
                value={settings.retryCount}
                onChange={(event) =>
                  patch({ retryCount: Number(event.target.value) })
                }
              />
            </label>
            <label>
              内容同步代理
              <input
                value={settings.contentProxyEndpoint}
                onChange={(event) =>
                  patch({ contentProxyEndpoint: event.target.value })
                }
                placeholder="https://your-service.example/api/content"
              />
            </label>
          </div>
        </section>
        <section>
          <header>
            <Moon size={20} />
            <div>
              <h2>外观与保存</h2>
              <p>为长时间翻译保持清晰、稳定的阅读环境。</p>
            </div>
          </header>
          <div className="setting-modes three">
            {(["light", "dark", "system"] as const).map((theme) => (
              <button
                key={theme}
                className={settings.theme === theme ? "active" : ""}
                onClick={() => patch({ theme })}
              >
                {theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
                <strong>
                  {theme === "light"
                    ? "浅色"
                    : theme === "dark"
                      ? "深色"
                      : "跟随系统"}
                </strong>
              </button>
            ))}
          </div>
          <button
            className={
              settings.autoSave ? "setting-toggle on" : "setting-toggle"
            }
            onClick={() => patch({ autoSave: !settings.autoSave })}
          >
            <span>
              <strong>自动保存</strong>
              <small>修改后约450毫秒写入IndexedDB</small>
            </span>
            <i>{settings.autoSave ? "开启" : "关闭"}</i>
          </button>
        </section>
        <section>
          <header>
            <Database size={20} />
            <div>
              <h2>数据与备份</h2>
              <p>V2项目主体存放在浏览器IndexedDB中。</p>
            </div>
          </header>
          <div className="data-buttons">
            <button
              className="v2-btn subtle"
              onClick={() => exportWorkspace(workspace)}
            >
              <Download size={16} />
              导出V2工作区
            </button>
            <label className="v2-btn subtle import-button">
              <Upload size={16} />
              导入V2工作区
              <input
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importWorkspaceFile(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button
              className="v2-btn danger"
              onClick={() => {
                if (!restoreArmed) {
                  setRestoreArmed(true);
                  onToast("再次点击确认恢复；建议先导出当前工作区");
                  return;
                }
                const next = cloneSeed();
                onWorkspace(() => next);
                setRestoreArmed(false);
                onToast("已恢复V2演示数据");
              }}
            >
              <RotateCcw size={16} />
              {restoreArmed ? "再次点击确认恢复" : "恢复演示数据"}
            </button>
          </div>
          <p className="data-boundary">
            清除浏览器站点数据会删除本地项目。正式学生试用前还需确定身份、匿名化、保留期限和伦理路径。
          </p>
        </section>
      </div>
    </div>
  );
}

function FeedbackCard({
  item,
  onDecision,
}: {
  item: Feedback;
  onDecision: (decision: Feedback["decision"]) => void;
}) {
  return (
    <article className={`feedback-note ${item.severity}`}>
      <header>
        <span>{item.dimension}</span>
        <i>{item.severity}</i>
      </header>
      <p>{item.observation}</p>
      <div>
        <strong>建议</strong>
        <p>{item.suggestion}</p>
      </div>
      <small>{item.reason}</small>
      {item.alternative && <blockquote>{item.alternative}</blockquote>}
      <footer>
        <button
          className={item.decision === "accepted" ? "active" : ""}
          onClick={() => onDecision("accepted")}
        >
          <Check size={13} />
          采纳
        </button>
        <button
          className={item.decision === "rejected" ? "active reject" : ""}
          onClick={() => onDecision("rejected")}
        >
          <X size={13} />
          不采纳
        </button>
      </footer>
    </article>
  );
}

function ProofNode({
  index,
  label,
  text,
  ai,
  editable,
  children,
}: {
  index: string;
  label: string;
  text?: string;
  ai?: boolean;
  editable?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`proof-node ${ai ? "ai" : ""} ${editable ? "editable" : ""}`}
    >
      <i>{index}</i>
      <header>
        <span>{label}</span>
        {ai && <b>AI生成</b>}
      </header>
      {children ?? <p>{text}</p>}
    </div>
  );
}

function TMMatches({
  source,
  units,
  onApply,
}: {
  source: string;
  units: TranslationUnit[];
  onApply: (unit: TranslationUnit) => void;
}) {
  const matches = useMemo(
    () =>
      units
        .map((unit) => ({ unit, score: similarity(source, unit.source) }))
        .filter((item) => item.score > 0.18)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    [source, units],
  );
  return matches.length ? (
    <>
      {matches.map(({ unit, score }) => (
        <div className="tm-match" key={unit.id}>
          <header>
            <strong>{Math.round(score * 100)}%</strong>
            <span>{unit.quality}</span>
          </header>
          <p>{unit.source}</p>
          <blockquote>{unit.target}</blockquote>
          <button onClick={() => onApply(unit)}>应用候选</button>
        </div>
      ))}
    </>
  ) : (
    <Empty
      title="没有匹配的翻译记忆"
      text="确认片段后可以选择写入个人记忆库。"
    />
  );
}

function ContextView({ file, active }: { file: ProjectFile; active: Segment }) {
  const index = file.segments.findIndex((item) => item.id === active.id);
  return (
    <div className="context-list">
      {file.segments.slice(Math.max(0, index - 2), index + 3).map((segment) => (
        <div
          className={segment.id === active.id ? "current" : ""}
          key={segment.id}
        >
          <span>#{String(segment.order).padStart(3, "0")}</span>
          <p>{segment.source}</p>
          {segment.target && <small>{segment.target}</small>}
        </div>
      ))}
    </div>
  );
}

function BlockHead({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <header className="block-head">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action && (
        <button onClick={onAction}>
          {action}
          <ArrowRight size={14} />
        </button>
      )}
    </header>
  );
}
function PageHead({
  eyebrow,
  title,
  text,
  actions,
}: {
  eyebrow: string;
  title: string;
  text: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {actions && <div>{actions}</div>}
    </header>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="v2-empty">
      <span>
        <FileText size={22} />
      </span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

const assetFieldLabel = (key: string) =>
  ({
    source: "源文／来源",
    target: "译文",
    domain: "领域",
    definition: "定义",
    partOfSpeech: "词性",
    allowed: "允许译法（逗号分隔）",
    forbidden: "禁用译法（逗号分隔）",
    example: "例句",
    sourceRef: "来源说明",
    name: "名称",
    audience: "目标读者",
    formality: "正式程度",
    punctuation: "标点规范",
    dates: "日期与数字规范",
    names: "人名地名处理",
    preferred: "推荐表达（逗号分隔）",
    title: "标题",
    url: "链接",
    summary: "摘要",
    tags: "标签（逗号分隔）",
  })[key] ?? key;

const buildProject = (
  name: string,
  files: ProjectFile[],
  workspace: Workspace,
  overrides?: Partial<Project>,
): Project => ({
  id: createId("project"),
  name,
  description: "",
  sourceLanguage: "英语（en）",
  targetLanguage: "简体中文（zh-CN）",
  domain: "通用",
  textType: "长文本",
  audience: "普通读者",
  style: "自然",
  deadline: "",
  status: "active",
  mode: "student-first",
  memoryId: "tm-personal",
  termbaseId: "tb-personal",
  styleGuideId: workspace.styleGuides[0]?.id ?? "",
  enabledSkills: workspace.skills
    .filter((item) => item.enabled)
    .map((item) => item.id),
  aiPretranslate: false,
  termLookup: true,
  culturalRecognition: true,
  mtToneCheck: true,
  strictTerminology: true,
  batchSize: workspace.settings.batchSize,
  activeBatchJobId: "",
  files,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});
const originLabel = (origin: Segment["origin"]) =>
  ({
    human: "人工翻译",
    "tm-exact": "TM完全匹配",
    "tm-fuzzy": "TM模糊匹配",
    deepseek: "DeepSeek预翻译",
    "ai-edited": "已修改AI译文",
    imported: "导入译文",
  })[origin];
const similarity = (a: string, b: string) => {
  const one = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const two = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const common = [...one].filter((item) => two.has(item)).length;
  return one.size + two.size ? (2 * common) / (one.size + two.size) : 0;
};
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char,
  );
