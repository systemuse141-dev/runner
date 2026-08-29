import { Router } from 'express';

export function aiRoutes(ctx) {
  const { ai } = ctx;
  const r = Router();

  r.post('/chat', async (req, res, next) => {
    try {
      const out = await ai.chat(req.user, req.body?.message, req.body?.context ?? {});
      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  r.get('/suggestions', (req, res) => {
    res.json({ suggestions: ai.suggestions(req.user) });
  });

  r.get('/proposals/:id', (req, res) => {
    try {
      res.json({ proposal: ai.getProposal(req.params.id) });
    } catch (e) {
      res.status(e.code === 'NOT_FOUND' ? 404 : 400).json({ error: { code: e.code, message: e.message } });
    }
  });

  r.post('/proposals/:id/authorize', async (req, res, next) => {
    try {
      const out = await ai.authorize(req.user, req.params.id);
      res.json(out);
    } catch (e) {
      res.status(e.code === 'FORBIDDEN' ? 403 : 400).json({ error: { code: e.code, message: e.message } });
    }
  });

  r.post('/proposals/:id/cancel', async (req, res, next) => {
    try {
      const p = await ai.cancelProposal(req.user, req.params.id);
      res.json({ proposal: p });
    } catch (e) {
      res.status(400).json({ error: { code: e.code, message: e.message } });
    }
  });

  return r;
}
