export class NotificationService {
  constructor(store, bus) {
    this.store = store;
    this.bus = bus;
  }

  async send(userId, { kind, title, body }) {
    const n = await this.store.insert('notifications', {
      id: crypto.randomUUID(),
      user_id: userId,
      kind,
      title,
      body: body ?? null,
      read: false,
      ts: Date.now(),
    });
    this.bus?.pushUser(userId, { type: 'notification', data: n });
    return n;
  }

  async list(userId, { limit = 30, unreadOnly = false } = {}) {
    const opts = { order: 'ts', dir: 'desc', limit };
    const eq = { user_id: userId };
    if (unreadOnly) eq.read = false;
    opts.eq = eq;
    return this.store.all('notifications', opts);
  }

  async unreadCount(userId) {
    return this.store.count('notifications', { eq: { user_id: userId, read: false } });
  }

  async markRead(userId, id) {
    return this.store.update('notifications', id, { read: true });
  }
}
