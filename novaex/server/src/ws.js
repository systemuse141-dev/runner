// WebSocket hub: topic subscriptions per authenticated session.
// Topics: mkt (market data), user:{uid} (account events), ops (operator stream).

import { WebSocketServer } from 'ws';
import { WS_TOPICS } from '../../shared/contracts.js';

export class Hub {
  constructor(authSvc, store) {
    this.wss = null;
    this.authSvc = authSvc;
    this.store = store;
    this.clients = new Set();
    this.marketBatch = [];
    this.marketFlushTimer = null;
  }

  attach(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (ws, req) => {
      const sid = this._cookie(req, 'nx_sid');
      const session = sid ? this.authSvc.sessionForCookie(sid) : null;
      if (!session) {
        ws.close(4401, 'unauthorized');
        return;
      }
      const user = this.store.get('users', session.user_id);
      if (!user) {
        ws.close(4401, 'unauthorized');
        return;
      }
      const client = { ws, user, subs: new Set(['mkt']), alive: true };
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'sub' && typeof msg.topic === 'string') {
            if (msg.topic === WS_TOPICS.MARKETS || msg.topic.startsWith('user:')) {
              client.subs.add(msg.topic);
            } else if (msg.topic === WS_TOPICS.OPS && (user.role === 'operator' || user.role === 'admin')) {
              client.subs.add(msg.topic);
            }
          }
        } catch { /* ignore malformed */ }
      });
      ws.on('close', () => this.clients.delete(client));
      ws.on('error', () => this.clients.delete(client));
      this.clients.add(client);
      this.send(client, { topic: 'hello', data: { user: user.id, ts: Date.now() } });
    });

    // heartbeat
    this.heartbeat = setInterval(() => {
      for (const c of this.clients) {
        if (!c.ws.isAlive) {
          c.ws.terminate();
          this.clients.delete(c);
          continue;
        }
        c.ws.isAlive = false;
        c.ws.ping();
      }
    }, 25_000);
    this.heartbeat.unref?.();
  }

  _cookie(req, name) {
    const header = req.headers.cookie ?? '';
    for (const part of header.split(';')) {
      const i = part.indexOf('=');
      if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
    }
    return null;
  }

  send(client, payload) {
    if (client.ws.readyState === 1) client.ws.send(JSON.stringify(payload));
  }

  /** Market data updates (batched to ~2/s). */
  pushMarkets(updates) {
    if (!updates?.length) return;
    this.marketBatch.push(...updates);
    if (this.marketFlushTimer) return;
    this.marketFlushTimer = setTimeout(() => {
      this.marketFlushTimer = null;
      const data = { updated: this.marketBatch, ts: Date.now() };
      this.marketBatch = [];
      for (const c of this.clients) {
        if (c.subs.has(WS_TOPICS.MARKETS)) this.send(c, { topic: WS_TOPICS.MARKETS, type: 'tick', data });
      }
    }, 500);
    this.marketFlushTimer.unref?.();
  }

  pushUser(userId, payload) {
    const topic = WS_TOPICS.USER(userId);
    for (const c of this.clients) {
      if (c.user.id === userId && (c.subs.has(topic) || c.subs.has('user'))) this.send(c, { topic, ...payload });
    }
  }

  pushOps(payload) {
    for (const c of this.clients) {
      if (c.subs.has(WS_TOPICS.OPS) && (c.user.role === 'operator' || c.user.role === 'admin')) {
        this.send(c, { topic: WS_TOPICS.OPS, ...payload });
      }
    }
  }

  close() {
    this.heartbeat?.unref?.();
    clearInterval(this.heartbeat);
    for (const c of this.clients) c.ws.close(1001);
  }
}
