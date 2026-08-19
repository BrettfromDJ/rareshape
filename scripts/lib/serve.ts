/** A static file server for `out/`, used by the headless scripts. */
import { createServer, type Server } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
}

export interface StaticServer {
  origin: string
  close(): Promise<void>
}

export async function serveStatic(root: string, port = 4310): Promise<StaticServer> {
  const server: Server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://localhost')
      let path = join(root, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''))
      try {
        if ((await stat(path)).isDirectory()) {
          const index = join(path, 'index.html')
          try {
            await stat(index)
            path = index
          } catch {
            path += '.html'
          }
        }
      } catch {
        if (!extname(path)) path += '.html'
      }
      try {
        const body = await readFile(path)
        response.writeHead(200, {
          'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
          'cache-control': 'no-store',
        })
        response.end(body)
      } catch {
        response.writeHead(404, { 'content-type': 'text/plain' })
        response.end('not found')
      }
    })()
  })

  await new Promise<void>((resolve) => server.listen(port, resolve))
  return {
    origin: `http://localhost:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
