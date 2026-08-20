import { createId } from '../data'
import type { Feedback, QuickSession, WorkspaceSettings } from '../types'

export interface AIResult { reference: string; feedback: Feedback[]; provider: 'demo' | 'deepseek-proxy' }

export const getDemoReference = (source: string) => {
  const known: Array<[RegExp, string]> = [
    [/Human oversight remains essential/i, '当自动化系统影响与人相关的决策时，人工监督仍然不可或缺。'],
    [/Educational uses of AI should strengthen human agency/i, '人工智能在教育中的应用应增强人的能动性，并促进透明度与问责。'],
    [/Technology should support judgement rather than replace it/i, '技术应当支持人的判断，而不是取而代之。'],
  ]
  const match = known.find(([pattern]) => pattern.test(source))
  return match?.[1] ?? '演示模式不为任意文本生成完整译文。请先完成学生初译，或在设置中接入安全的 DeepSeek 代理端点。'
}

const demoFeedback = (session: QuickSession): Feedback[] => {
  const draft = session.studentDraft || session.finalTranslation
  return [
    { id: createId('feedback'), dimension: '准确性', severity: draft ? 'info' : 'warning', observation: draft ? '已检测到学生初译，可以围绕责任主体和谓语关系继续核验。' : '尚未提交学生初译。', suggestion: '先标出原文主语、情态和限定语，再核对译文是否完整保留。', reason: '准确性判断需要以学生实际译文为对象。', alternative: '', decision: 'pending' },
    { id: createId('feedback'), dimension: '术语', severity: /agency/i.test(session.source) ? 'warning' : 'info', observation: /agency/i.test(session.source) ? '原文包含 agency，需要结合治理或教育语境确定译名。' : '未触发内置术语示例。', suggestion: '核对项目术语库和权威来源，避免仅按常见词义选择。', reason: '术语选择取决于领域、读者和机构惯例。', alternative: /human agency/i.test(session.source) ? '人的能动性／人的主体作用' : '', decision: 'pending' },
    { id: createId('feedback'), dimension: '自然度', severity: draft && /的的|进行.*的/g.test(draft) ? 'warning' : 'info', observation: '检查是否存在层层“的”结构、空泛动词或机械对应。', suggestion: '在不改变信息的前提下优先使用明确动词。', reason: '自然度修改不能牺牲原文信息和责任关系。', alternative: '', decision: 'pending' },
  ]
}

export const runAI = async (session: QuickSession, settings: WorkspaceSettings): Promise<AIResult> => {
  if (settings.provider === 'deepseek-proxy' && settings.endpoint) {
    try {
      const response = await fetch(settings.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: session.mode === 'analysis-only' ? 'review' : 'translate-and-review', model: settings.model, temperature: settings.temperature, session: { ...session, feedback: undefined } }) })
      if (!response.ok) throw new Error(`服务返回 ${response.status}`)
      const payload = await response.json() as { reference?: string; feedback?: Feedback[] }
      return { reference: payload.reference ?? '', feedback: payload.feedback ?? [], provider: 'deepseek-proxy' }
    } catch {
      return { reference: getDemoReference(session.source), feedback: demoFeedback(session), provider: 'demo' }
    }
  }
  return { reference: getDemoReference(session.source), feedback: demoFeedback(session), provider: 'demo' }
}

export const detectLanguage = (text: string) => /[\u4e00-\u9fff]/.test(text) ? '中文' : /[A-Za-z]/.test(text) ? '英语' : '待确认'
