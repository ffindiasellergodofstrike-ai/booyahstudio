import { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getSEOPageData, injectSEOMetadata, POLICY_REDIRECTS } from '../src/seo/seoMetadata';

let cachedIndexHtml: string | null = null;

function getIndexHtmlShell(): string {
  if (cachedIndexHtml) return cachedIndexHtml;

  const distIndexPath = path.join(process.cwd(), 'dist', 'index.html');
  const rootIndexPath = path.join(process.cwd(), 'index.html');

  if (fs.existsSync(distIndexPath)) {
    cachedIndexHtml = fs.readFileSync(distIndexPath, 'utf8');
  } else if (fs.existsSync(rootIndexPath)) {
    cachedIndexHtml = fs.readFileSync(rootIndexPath, 'utf8');
  } else {
    cachedIndexHtml = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>BOOYAH STUDIO</title></head><body><div id="root"></div></body></html>`;
  }

  return cachedIndexHtml;
}

export function seoMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only process GET / HEAD requests for non-API, non-asset paths
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api/') || req.path.startsWith('/demos/') || req.path.startsWith('/product-images/') || req.path.includes('.')) {
    return next();
  }

  const cleanPath = req.path.split('?')[0].replace(/\/$/, '') || '/';
  const queryObj: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query)) {
    if (typeof v === 'string') queryObj[k] = v;
  }

  // Check for retired policy redirects
  const rootSlug = cleanPath.startsWith('/') ? cleanPath.slice(1) : '';
  const redirectTarget = POLICY_REDIRECTS[rootSlug];
  if (redirectTarget) {
    return res.redirect(301, `/policies/${redirectTarget}`);
  }

  // If request accepts HTML (direct browser/crawler visit)
  const acceptHeader = req.headers.accept || '';
  const isHtmlRequest = acceptHeader.includes('text/html') || acceptHeader.includes('*/*');

  if (!isHtmlRequest) {
    return next();
  }

  const pageSEOData = getSEOPageData(cleanPath, queryObj);
  const shell = getIndexHtmlShell();
  const renderedHtml = injectSEOMetadata(shell, pageSEOData);

  const status = pageSEOData.statusCode || (pageSEOData.noindex ? 200 : 200);

  res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8').send(renderedHtml);
}
