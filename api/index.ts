// @ts-ignore
import serverModule from '../dist/server.cjs';
const app: any = (serverModule as any).default || serverModule;

export default function handler(req: any, res: any) {
  if (req.url && !req.url.startsWith('/api/') && !req.url.startsWith('/api?')) {
    if (req.url === '/api' || req.url === '') {
      req.url = '/api/';
    } else {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
  }
  return app(req, res);
}
