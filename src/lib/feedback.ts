import type { FeedbackItem, TranslationTask } from '../types'
import { createId } from './storage'

const demoFeedback = (task: TranslationTask): FeedbackItem[] => {
  const draft = task.initialTranslation.trim()
  const hasAgency = /能动性|主体性|主体作用|自主/.test(draft)
  const hasAccountability = /问责|责任/.test(draft)

  return [
    {
      id: createId('feedback'),
      role: '任务分析',
      title: '先固定读者和语体',
      observation: `当前任务面向“${task.audience}”。译文需要保持政策语篇的审慎语气，并让三个并列价值保持同一语法层级。`,
      suggestion: '检查“人的能动性、透明度与问责性”是否采用并列结构，避免一项写成动作、另两项写成名词。',
      evidence: `任务简报：${task.brief}`,
      status: 'pending',
      reason: '',
    },
    {
      id: createId('feedback'),
      role: '术语核验',
      title: hasAgency ? '“human agency”已有明确对应' : '核验 human agency 的语境义',
      observation: hasAgency
        ? '初译已经体现人的主动判断和行动能力，下一步需要确认“能动性”还是“主体性”更适合目标读者。'
        : '初译尚未明确呈现 human agency。该词在教育技术语境中不只是“人类代理”，而是人的判断、选择与行动能力。',
      suggestion: '可比较“增强人的能动性”与“强化人的主体作用”，并记录最终选择及理由。',
      evidence: '来源主题页强调以人为本、透明度和责任原则；正式引用时仍需回到原始文件核验。',
      status: 'pending',
      reason: '',
      expression: 'strengthen human agency',
      meaning: '增强人的能动性／强化人的主体作用',
    },
    {
      id: createId('feedback'),
      role: '译文审校',
      title: hasAccountability ? '并列价值基本完整' : '不要弱化 accountability',
      observation: hasAccountability
        ? '初译已经保留责任维度，可继续检查“问责性”对高校教师读者是否过于制度化。'
        : '如果只译为“透明、可靠”，会丢失 accountability 所包含的责任承担和可追责含义。',
      suggestion: '可用“透明度与问责机制”或“透明、可问责”，并根据整句的名词化程度作统一。',
      evidence: '术语判断需结合目标语体；演示反馈不替代权威术语来源。',
      status: 'pending',
      reason: '',
      expression: 'transparency and accountability',
      meaning: '透明度与问责性／透明与责任落实',
    },
    {
      id: createId('feedback'),
      role: '学习反思',
      title: '记录你保留“人工监督”的理由',
      observation: '这段材料的论证中心不是 AI 能做什么，而是哪些决定仍然必须由人承担。',
      suggestion: '完成修订后，用一句话说明：你的译文如何避免把 AI 写成最终决策者？',
      evidence: '该问题用于生成翻译决策日志，不直接改写译文。',
      status: 'pending',
      reason: '',
    },
  ]
}

export const generateFeedback = async (task: TranslationTask, endpoint?: string): Promise<FeedbackItem[]> => {
  if (!endpoint) return demoFeedback(task)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: {
          sourceText: task.sourceText,
          brief: task.brief,
          audience: task.audience,
          initialTranslation: task.initialTranslation,
        },
      }),
    })
    if (!response.ok) throw new Error(`Endpoint returned ${response.status}`)
    const payload = (await response.json()) as { feedback?: FeedbackItem[] }
    if (!payload.feedback?.length) throw new Error('Endpoint returned no feedback')
    return payload.feedback.map((item) => ({
      ...item,
      id: item.id || createId('feedback'),
      status: 'pending',
      reason: '',
    }))
  } catch {
    return demoFeedback(task)
  }
}
