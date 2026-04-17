// Background service worker for Note Taker Plus extension

chrome.runtime.onInstalled.addListener(() => {
  const isMac = /Mac|iPhone|iPod|iPad/.test(navigator.userAgent);
  const mod = isMac ? '⌘⇧' : 'Ctrl+Shift+';

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-to-notetaker',
      title: `Save to Note Taker+ (${mod}S)`,
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'save-as-flashcard',
      title: `Create Flashcard from Selection (${mod}F)`,
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'create-card-dialog',
      title: `Create Card... (${mod}K)`,
      contexts: ['selection']
    });
  });
});

// Save selection as a source, optionally triggering card generation
async function saveAsSource(text, url, title, generateCards = false) {
  const settings = await chrome.storage.sync.get(['apiUrl', 'apiKey']);
  if (!settings.apiUrl || !settings.apiKey) {
    return { success: false, error: 'Please configure Note Taker+ settings (click the extension icon)' };
  }
  try {
    const response = await fetch(`${settings.apiUrl}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': settings.apiKey },
      body: JSON.stringify({ text, source_type: 'chrome_extension', source_url: url, source_title: title, tags: [] })
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const source = await response.json();

    if (generateCards) {
      const genResponse = await fetch(`${settings.apiUrl}/sources/${source.id}/generate-cards`, {
        method: 'POST',
        headers: { 'X-API-Key': settings.apiKey }
      });
      if (!genResponse.ok) {
        const hint = genResponse.status === 503 ? ' — is Ollama running?' : '';
        return { success: false, error: `Card generation failed: ${genResponse.status}${hint}` };
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.selectionText) return;

  if (info.menuItemId === 'create-card-dialog') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_CARD_DIALOG',
      text: info.selectionText,
      url: tab.url,
      title: tab.title
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('SHOW_CARD_DIALOG failed:', chrome.runtime.lastError.message);
      }
    });
    return;
  }

  const generateCards = info.menuItemId === 'save-as-flashcard';
  const result = await saveAsSource(info.selectionText, tab.url, tab.title, generateCards);

  if (result.success) {
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    chrome.tabs.sendMessage(tab.id, { type: 'SAVE_SUCCESS' });
  } else {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    chrome.tabs.sendMessage(tab.id, { type: 'SAVE_ERROR', error: result.error });
  }
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(['apiUrl', 'apiKey']).then(sendResponse);
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.sync.set({ apiUrl: message.apiUrl, apiKey: message.apiKey }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'TEST_CONNECTION') {
    testConnection(message.apiUrl, message.apiKey).then(sendResponse);
    return true;
  }

  if (message.type === 'SAVE_SOURCE') {
    saveAsSource(message.text, message.url, message.title, message.generateCards || false)
      .then(sendResponse);
    return true;
  }

  if (message.type === 'CREATE_CARD') {
    chrome.storage.sync.get(['apiUrl', 'apiKey']).then(async (settings) => {
      if (!settings.apiUrl || !settings.apiKey) {
        sendResponse({ success: false, error: 'Please configure Note Taker+ settings (click the extension icon)' });
        return;
      }
      try {
        const response = await fetch(`${settings.apiUrl}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': settings.apiKey },
          body: JSON.stringify({ front: message.front, back: message.back, hint: message.hint, tags: message.tags || [] })
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    });
    return true;
  }
});

async function testConnection(apiUrl, apiKey) {
  try {
    const response = await fetch(`${apiUrl}/health`, { headers: { 'X-API-Key': apiKey } });
    if (response.ok) return { success: true, message: 'Connected successfully' };
    return { success: false, message: `Server returned ${response.status}` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
