/**
 * Persistent call session store (localStorage).
 * Allows the app to detect and reconnect to an active call
 * after Android WebView is destroyed and recreated on app resume.
 */
const KEY = 'govchat:activeCall';

export const CallSessionStore = {
    /**
     * @param {{ callId: string, chatId: string, callType: string, roomId?: string, token?: string, startedAt: number, isGroup: boolean }} data
     */
    save(data) {
        try {
            localStorage.setItem(KEY, JSON.stringify(data));
        } catch (_) {
            // quota exceeded or private mode – ignore
        }
    },

    /** @returns {{ callId: string, chatId: string, callType: string, roomId?: string, token?: string, startedAt: number, isGroup: boolean } | null} */
    load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            // Sanity check: discard sessions older than 2 hours
            if (parsed.startedAt && Date.now() - parsed.startedAt > 2 * 60 * 60 * 1000) {
                localStorage.removeItem(KEY);
                return null;
            }
            return parsed;
        } catch (_) {
            return null;
        }
    },

    clear() {
        try {
            localStorage.removeItem(KEY);
        } catch (_) {
            // ignore
        }
    }
};
