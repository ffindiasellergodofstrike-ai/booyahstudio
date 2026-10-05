import type { Request, Response } from 'express';
import app from '../server/app';
/** Server-render product metadata from the current catalog, including admin additions. */
export default function productPage(req: Request, res: Response) {
  const slug = req.query.slug;
  if (typeof slug !== 'string' || !/^[A-Za-z0-9_-]{1,121}$/.test(slug)) {
    res.set('X-Robots-Tag', 'noindex').status(404).send('Product not found.');
    return;
  }
  req.url = `/product/${encodeURIComponent(slug)}`;
  app(req, res);
}
