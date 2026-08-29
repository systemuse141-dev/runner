import { Router } from 'express';
import { requirePerm } from '../../middleware/index.js';

export function approvalsRoutes(ctx) {
  const { approvals } = ctx;
  const r = Router();
  r.use(requirePerm('approvals:read'));

  r.get('/', (req, res) => res.json({ approvals: approvals.list(req.query) }));

  r.post('/:id/approve', requirePerm('approvals:act'), async (req, res, next) => {
    try {
      const out = await approvals.approve(req.user, req.params.id, { reason: req.body?.reason ?? null });
      res.json({ approval: out });
    } catch (e) {
      const status = e.code === 'FORBIDDEN' ? 403 : e.code === 'NOT_FOUND' ? 404 : e.code === 'SELF_APPROVAL' ? 409 : 400;
      res.status(status).json({ error: { code: e.code, message: e.message } });
    }
  });

  r.post('/:id/reject', requirePerm('approvals:act'), async (req, res, next) => {
    try {
      const out = await approvals.reject(req.user, req.params.id, { reason: req.body?.reason ?? null });
      res.json({ approval: out });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: { code: e.code, message: e.message } });
    }
  });

  return r;
}

export function auditRoutes(ctx) {
  const { audit } = ctx;
  const r = Router();
  r.use(requirePerm('audit:read'));
  r.get('/', (req, res) => res.json({ events: audit.query(req.query) }));
  return r;
}
