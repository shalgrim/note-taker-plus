// Content script for Note Taker Plus extension
// Runs on all pages to show feedback when highlights are saved

// Create toast notification element
function createToast() {
  const toast = document.createElement('div');
  toast.id = 'notetaker-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 999999;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s, transform 0.3s;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;
  document.body.appendChild(toast);
  return toast;
}

function showToast(message, type = 'success') {
  let toast = document.getElementById('notetaker-toast');
  if (!toast) {
    toast = createToast();
  }

  const colors = {
    success: { bg: '#22c55e', text: '#fff' },
    error: { bg: '#ef4444', text: '#fff' },
    info: { bg: '#3b82f6', text: '#fff' }
  };

  const color = colors[type] || colors.info;
  toast.style.backgroundColor = color.bg;
  toast.style.color = color.text;
  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
  }, 3000);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_SUCCESS') {
    showToast('Saved to Note Taker+', 'success');
  }

  if (message.type === 'SAVE_ERROR') {
    showToast(`Error: ${message.error}`, 'error');
  }
});

// Optional: Add keyboard shortcut for quick save
document.addEventListener('keydown', async (e) => {
  // Ctrl/Cmd + Shift + S to save selection
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
    const selection = window.getSelection().toString().trim();
    if (selection) {
      e.preventDefault();

      const settings = await chrome.storage.sync.get(['apiUrl', 'apiKey']);
      if (!settings.apiUrl || !settings.apiKey) {
        showToast('Please configure Note Taker+ extension', 'error');
        return;
      }

      try {
        const response = await fetch(`${settings.apiUrl}/sources`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': settings.apiKey
          },
          body: JSON.stringify({
            text: selection,
            source_type: 'chrome_extension',
            source_url: window.location.href,
            source_title: document.title,
            tags: []
          })
        });

        if (response.ok) {
          showToast('Saved to Note Taker+', 'success');
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
      }
    }
  }
});
