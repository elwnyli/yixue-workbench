import { createId } from '../data'
import type { QualityIssue, Segment, TermEntry } from '../types'

export const inspectSegment = (segment: Segment, terms: TermEntry[]): QualityIssue[] => {
  const sourceNumbers = segment.source.match(/\d+(?:[.,]\d+)*/g) ?? []
  const targetNumbers = segment.target.match(/\d+(?:[.,]\d+)*/g) ?? []
  const issues: QualityIssue[] = []
  const add = (type: string, severity: QualityIssue['severity'], message: string, suggestion: string, evidence: string) => issues.push({ id: createId('issue'), segmentId: segment.id, type, severity, message, suggestion, evidence, resolved: false })

  if (!segment.target.trim()) add('漏译', 'error', '目标片段为空。', '完成译文后重新检查。', '目标字段长度为0')
  if (sourceNumbers.join('|') !== targetNumbers.join('|')) add('数字不一致', 'error', '源文和译文中的数字序列不一致。', '逐项核对数字、小数点和千位分隔符。', `${sourceNumbers.join(', ') || '无'} → ${targetNumbers.join(', ') || '无'}`)
  const english = segment.target.match(/\b[A-Za-z]{5,}\b/g) ?? []
  if (english.length) add('原文残留', 'warning', `译文中发现可能的源语言残留：${english.slice(0, 5).join('、')}`, '确认这些词是否为应保留的专名或标签。', english.join(', '))
  if (segment.target && segment.target.length < segment.source.length * 0.22) add('长度异常', 'warning', '译文相对源文明显偏短。', '检查是否遗漏限定语、并列成分或从句。', `源文${segment.source.length}字符，译文${segment.target.length}字符`)
  terms.filter((term) => term.status === 'approved' && segment.source.toLowerCase().includes(term.source.toLowerCase())).forEach((term) => {
    if (!segment.target.includes(term.target)) add('术语不一致', 'warning', `已批准术语“${term.source}”未使用首选译名“${term.target}”。`, '核对语境；如需例外，请记录理由。', term.sourceRef)
  })
  if (/\{\{[^}]+\}\}|%\w|<[^>]+>/.test(segment.source)) {
    const tokens = segment.source.match(/\{\{[^}]+\}\}|%\w|<[^>]+>/g) ?? []
    const missing = tokens.filter((token) => !segment.target.includes(token))
    if (missing.length) add('占位符缺失', 'error', `译文缺少占位符：${missing.join('、')}`, '原样恢复占位符后再确认。', missing.join(', '))
  }
  return issues
}

export const inspectProject = (segments: Segment[], terms: TermEntry[]) => segments.flatMap((segment) => inspectSegment(segment, terms))
