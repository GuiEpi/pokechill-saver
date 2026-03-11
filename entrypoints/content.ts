export default defineContentScript({
  matches: ['https://play-pokechill.github.io/*'],
  main() {
    // Listen for messages from the popup/background
    browser.runtime.onMessage.addListener(
      (message: { type: string; data?: string }, _sender, sendResponse) => {
        if (message.type === 'GET_GAME_DATA') {
          const gameData = localStorage.getItem('gameData');
          sendResponse({ success: true, data: gameData });
        } else if (message.type === 'SET_GAME_DATA') {
          if (message.data) {
            localStorage.setItem('gameData', message.data);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'No data provided' });
          }
        }
        return true;
      },
    );

    // Auto-save when user leaves the page
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        const gameData = localStorage.getItem('gameData');
        if (gameData) {
          browser.runtime.sendMessage({
            type: 'AUTO_SAVE',
            data: gameData,
          });
        }
      }
    });
  },
});
