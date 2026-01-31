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
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.selectionText) return;

  const settings = await chrome.storage.sync.get(['apiUrl', 'apiKey']);

  if (!settings.apiUrl || !settings.apiKey) {
    // Notify user to configure settings
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
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
      await fetch(`${settings.apiUrl}/sources/${source.id}/generate-cards`, {
        method: 'POST',
        headers: {
          'X-API-Key': settings.apiKey
        }
      });
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
