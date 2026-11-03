import { Request, Response } from 'express';
import { handlePrivateCheckoutRequest } from '../server/private-checkout';

export default function handler(req: Request, res: Response) {
  return handlePrivateCheckoutRequest(req, res, () => {
    res.status(404).send('Not found');
  });
}
