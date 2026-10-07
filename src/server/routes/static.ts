import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Ctx } from '../lib/context.ts';

const INDEXABLE = new Set(['/']);

/** Serves the built SPA. The landing page is server-rendered for SEO; every other route is noindex. */
export async function serveClient(app: FastifyInstance, ctx: Ctx): Promise<void> {
  const root = resolve('dist/client');
  const template = readFileSync(resolve(root, 'index.html'), 'utf8');
  const appUrl = ctx.env.APP_URL.replace(/\/$/, '');
  const base = template.replaceAll('%APP_URL%', appUrl);

  let render: ((url: string) => string) | null = null;
  const ssrFile = resolve('dist/ssr/entry-server.js');
  if (existsSync(ssrFile)) render = (await import(pathToFileURL(ssrFile).href)).render;

  await app.register(fastifyStatic, { root, index: false, wildcard: false, setHeaders: (res: any, path: string) => { if (/\/assets\//.test(path)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } });

  app.get('/robots.txt', async (_req, reply) =>
    reply.type('text/plain').send(`User-agent: *\nAllow: /$\nDisallow: /assessment\nDisallow: /a/\nDisallow: /resume\nDisallow: /admin\nDisallow: /api/\nSitemap: ${appUrl}/sitemap.xml\n`));
  app.get('/sitemap.xml', async (_req, reply) =>
    reply.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${appUrl}/</loc></url></urlset>`));

  app.setNotFoundHandler(async (req, reply) => {
    const path = req.url.split('?')[0];
    if (req.method !== 'GET' || path.startsWith('/api/') || /\.[a-z0-9]{2,5}$/i.test(path)) return reply.code(404).send({ error: { code: 'not_found', message: 'Not found.' } });
    const indexable = INDEXABLE.has(path);
    let html = base;
    if (indexable && render) html = html.replace('<!--ssr-outlet-->', render(path));
    else html = html.replace('<meta name="robots" content="index,follow">', '<meta name="robots" content="noindex,nofollow">');
    return reply.header('X-Robots-Tag', indexable ? 'index, follow' : 'noindex, nofollow').header('Cache-Control', 'no-cache').type('text/html').send(html);
  });
}
