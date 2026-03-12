import { getAuthUrl, exchangeCodeForToken, uploadSave, downloadSave, isAuthenticated, logout } from '@/utils/dropbox';

// Auto-save is only enabled after the user manually saves or loads at least once.
// This prevents overwriting cloud data when opening the game on a new browser
// with empty/fresh localStorage.
let autoSaveEnabled = false;

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: { type: string; data?: string }, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep channel open for async
  });
});

async function handleMessage(message: { type: string; data?: string }) {
  switch (message.type) {
    case 'DROPBOX_AUTH': {
      const { url, codeVerifier } = await getAuthUrl();

      const responseUrl = await browser.identity.launchWebAuthFlow({
        url,
        interactive: true,
      });

      if (!responseUrl) throw new Error('No response from auth flow');
      const code = new URL(responseUrl).searchParams.get('code');
      if (!code) throw new Error('No authorization code received');

      const tokens = await exchangeCodeForToken(code, codeVerifier);
      await browser.storage.local.set({
        dropbox_access_token: tokens.access_token,
        dropbox_refresh_token: tokens.refresh_token,
      });

      return { success: true };
    }

    case 'DROPBOX_SAVE': {
      if (!message.data) throw new Error('No game data to save');
      await uploadSave(message.data);
      autoSaveEnabled = true;
      const now = Date.now();
      await browser.storage.local.set({ last_sync: now });
      return { success: true, lastSync: now };
    }

    case 'DROPBOX_LOAD': {
      const data = await downloadSave();
      autoSaveEnabled = true;
      return { success: true, data };
    }

    case 'DROPBOX_STATUS': {
      const authenticated = await isAuthenticated();
      const { last_sync } = await browser.storage.local.get('last_sync');
      return { success: true, authenticated, lastSync: last_sync || null };
    }

    case 'DROPBOX_LOGOUT': {
      await logout();
      return { success: true };
    }

    case 'AUTO_SAVE': {
      const authenticated = await isAuthenticated();
      if (!authenticated || !message.data || !autoSaveEnabled) return { success: false };
      await uploadSave(message.data);
      const autoNow = Date.now();
      await browser.storage.local.set({ last_sync: autoNow });
      return { success: true };
    }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}
