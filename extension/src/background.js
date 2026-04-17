// Background service worker for Note Taker Plus extension

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-notetaker',
    title: 'Save to Note Taker+',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'save-as-flashcard',
    title: 'Create Flashcard from Selection',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'create-card-dialog',
    title: 'Create Card...',
    contexts: ['selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.selectionText) return;

  // Dialog flow: send to content script immediately, settings checked there
  if (info.menuItemId === 'create-card-dialog') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_CARD_DIALOG',
      text: info.selectionText,
      url: tab.url,
      title: tab.title
    });
    return;
  }

  const settings = await chrome.storage.sync.get(['apiUrl', 'apiKey']);

  if (!settings.apiUrl || !settings.apiKey) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    chrome.tabs.sendMessage(tab.id, {
      type: 'SAVE_ERROR',
      error: 'Please configure Note Taker+ settings (click the extension icon)'
    });
    return;
  }

  const sourceData = {
    text: info.selectionText,
    source_type: 'chrome_extension',
    source_url: tab.url,
    source_title: tab.title,
    tags: []
  };

  try {
    const response = await fetch(`${settings.apiUrl}/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': settings.apiKey
      },
      body: JSON.stringify(sourceData)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const source = await response.json();

    // If "Create Flashcard" was clicked, also generate cards
    if (info.menuItemId === 'save-as-flashcard') {
      const genResponse = await fetch(`${settings.apiUrl}/sources/${source.id}/generate-cards`, {
        method: 'POST',
        headers: {
          'X-API-Key': settings.apiKey
        }
      });
      if (!genResponse.ok) {
        const hint = genResponse.status === 503 ? ' — is Ollama running?' : '';
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
        chrome.tabs.sendMessage(tab.id, {
          type: 'SAVE_ERROR',
          error: `Card generation failed: ${genResponse.status}${hint}`
        });
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
        return;
      }
    }

    // Show success notification
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });

    // Send success message to content script
    chrome.tabs.sendMessage(tab.id, {
      type: 'SAVE_SUCCESS',
      text: info.selectionText.substring(0, 50) + '...'
    });

    // Clear badge after 2 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 2000);

  } catch (error) {
    console.error('Failed to save highlight:', error);
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

    chrome.tabs.sendMessage(tab.id, {
      type: 'SAVE_ERROR',
      error: error.message
    });
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(['apiUrl', 'apiKey']).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.sync.set({
      apiUrl: message.apiUrl,
      apiKey: message.apiKey
    }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'TEST_CONNECTION') {
    testConnection(message.apiUrl, message.apiKey).then(sendResponse);
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
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': settings.apiKey
          },
          body: JSON.stringify({ front: message.front, back: message.back, hint: message.hint, tags: [] })
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    });
    return true; // keep channel open for async response
  }
});

async function testConnection(apiUrl, apiKey) {
  try {
    const response = await fetch(`${apiUrl}/health`, {
      headers: {
        'X-API-Key': apiKey
      }
    });

    if (response.ok) {
      return { success: true, message: 'Connected successfully' };
    } else {
      return { success: false, message: `Server returned ${response.status}` };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}
