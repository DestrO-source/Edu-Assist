const PREFIX = 'eduassist.v1.';
let scope = 'guest';
export const storage = {
  setScope(userId) { scope = userId ? `user-${String(userId).replace(/[^a-zA-Z0-9_-]/g, '')}` : 'guest'; },
  get(key, fallback) { try { const value = localStorage.getItem(`${PREFIX}${scope}.${key}`); if (value) return JSON.parse(value); if (scope === 'guest') { const legacy=localStorage.getItem(PREFIX+key); if(legacy)return JSON.parse(legacy); } return fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`${PREFIX}${scope}.${key}`, JSON.stringify(value)); return true; } catch { return false; } },
  remove(key) { localStorage.removeItem(`${PREFIX}${scope}.${key}`); }
};
