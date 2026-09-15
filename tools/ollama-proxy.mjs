// Intermediário local do OcTabs: recebe os pedidos do Tailscale Serve e repassa ao Ollama
// com Host local, porque o Ollama recusa (403) nomes de servidor que não são locais.
// Escuta só em 127.0.0.1: nada da rede chega aqui, só o próprio PC e o Tailscale Serve.
//
// Instalação no PC (cópia em uso: %LOCALAPPDATA%\OcTabs\ollama-proxy.mjs):
//   - inicia escondido com o Windows por "Startup\OcTabs proxy do Ollama.vbs"
//   - tailscale serve --bg 11435   →   https://<pc>.<tailnet>.ts.net
//   - no app (celular): IA local → Conexão com o Ollama → https://<pc>.<tailnet>.ts.net
import http from 'node:http'

const TARGET_PORT = 11434
const PORT = Number(process.env.OCTABS_PROXY_PORT ?? 11435)

http
  .createServer((req, res) => {
    const headers = { ...req.headers, host: `127.0.0.1:${TARGET_PORT}` }
    const upstream = http.request(
      { host: '127.0.0.1', port: TARGET_PORT, method: req.method, path: req.url, headers },
      (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers)
        r.pipe(res)
      },
    )
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('Ollama indisponível no PC')
    })
    // Se o celular cancelar, avisa o Ollama para parar de gerar.
    res.on('close', () => {
      if (!res.writableEnded) upstream.destroy()
    })
    req.pipe(upstream)
  })
  .listen(PORT, '127.0.0.1', () => console.log(`proxy em 127.0.0.1:${PORT} -> Ollama ${TARGET_PORT}`))
