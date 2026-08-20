import { createId } from '../data'
import type { ProjectFile, Segment } from '../types'

const splitText = (text: string): Segment[] => {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}|(?<=[.!?。！？])\s+(?=[A-Z\u4e00-\u9fff])/)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return blocks.map((source, index) => ({
    id: createId('segment'), order: index + 1, source, target: '', initialTarget: '', status: 'untranslated', origin: 'human', note: '', revisions: [],
  }))
}

export const parseFile = async (file: File): Promise<ProjectFile> => {
  const extension = file.name.split('.').pop()?.toLowerCase()
  let text = ''
  let type: ProjectFile['type'] = 'txt'
  let structure: ProjectFile['structure'] = 'plain'

  if (extension === 'docx') {
    const { default: mammoth } = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    text = result.value
    type = 'docx'
    structure = 'document'
  } else {
    text = await file.text()
    if (extension === 'md' || extension === 'markdown') { type = 'markdown'; structure = 'headings' }
  }
  const segments = splitText(text)
  if (!segments.length) throw new Error('文件中没有可识别的正文。')
  return { id: createId('file'), name: file.name, type, structure, segments, createdAt: new Date().toISOString() }
}

export const parsePastedText = (name: string, text: string): ProjectFile => ({
  id: createId('file'), name: name || '粘贴文本', type: 'pasted', structure: 'plain', segments: splitText(text), createdAt: new Date().toISOString(),
})
