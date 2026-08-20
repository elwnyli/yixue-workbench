import http from 'node:http'
import { handleAction } from './core.mjs'

const port = Number(process.env.PORT || 8787)
const origins = new Set((process.env.ALLOWED_ORIGINS || 'https://elwnyli.github.io,https://raw.githack.com,http://127.0.0.1:5173,http://localhost:5173').split(',').map((item) => item.trim()).filter(Boolean))
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 900000)
const rateLimit = Number(process.env.RATE_LIMIT_PER_MINUTE || 30)
const requestsByClient = new Map()

const corsHeaders = (origin) => ({
  ...(origin && origins.has(origin) ? { 'access-control-allow-origin': origin } : {}),
  'access-control-allow-methods': 'POST,GET,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
  vary: 'Origin',
})

const send = (response, status, payload, origin) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders(origin) })
  response.end(JSON.stringify(payload))
}

const readJson = (request) => new Promise((resolve, reject) => {
  let size = 0; const chunks = []
  request.on('data', (chunk) => { size += chunk.length; if (size > maxBodyBytes) { reject(new Error('请求正文过大')); request.destroy(); return } chunks.push(chunk) })
  request.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) } catch { reject(new Error('请求JSON格式无效')) } })
  request.on('error', reject)
})

const allowRequest = (request) => {
  const key = String(request.headers['x-forwarded-for'] || request.socket.remoteAddress || 'unknown').split(',')[0].trim()
  const minute = Math.floor(Date.now() / 60000); const record = requestsByClient.get(key)
  if (!record || record.minute !== minute) { requestsByClient.set(key, { minute, count: 1 }); return true }
  record.count += 1
  return record.count <= rateLimit
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin || ''
  if (origin && !origins.has(origin)) { send(response, 403, { error: '此网页来源未获代理授权' }, ''); return }
  if (request.method === 'OPTIONS') { response.writeHead(204, corsHeaders(origin)); response.end(); return }
  if (request.method === 'GET' && request.url === '/health') { send(response, 200, { ok: true, service: 'yixue-deepseek-proxy', keyConfigured: Boolean(process.env.DEEPSEEK_API_KEY) }, origin); return }
  if (request.method !== 'POST' || !['/', '/api/deepseek'].includes(request.url || '')) { send(response, 404, { error: '接口不存在' }, origin); return }
  if (!allowRequest(request)) { send(response, 429, { error: '请求过于频繁，请稍后再试' }, origin); return }
  try { send(response, 200, await handleAction(await readJson(request)), origin) }
  catch (error) {
    const message = error instanceof Error ? error.message : '代理请求失败'
    const status = message.includes('API_KEY') ? 503 : message.includes('不支持') || message.includes('为空') || message.includes('JSON') || message.includes('过大') ? 400 : 502
    send(response, status, { error: message }, origin)
  }
})

server.listen(port, '0.0.0.0', () => console.log(`yixue-deepseek-proxy listening on ${port}`))
