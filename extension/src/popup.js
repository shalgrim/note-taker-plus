// Popup script for Note Taker Plus extension

document.addEventListener('DOMContentLoaded', async () => {
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const testBtn = document.getElementById('testBtn');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  const settings = await chrome.storage.sync.get(['apiUrl', 'apiKey']);
  if (settings.apiUrl) apiUrlInput.value = settings.apiUrl;
  if (settings.apiKey) apiKeyInput.value = settings.apiKey;

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
  }

  // Test connection
  testBtn.addEventListener('click', async () => {
    const apiUrl = apiUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!apiUrl || !apiKey) {
      showStatus('Please enter both URL and API key', 'error');
      return;
    }

    showStatus('Testing connection...', 'info');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_CONNECTION',
        apiUrl,
        apiKey
      });

      if (response.success) {
        showStatus('Connection successful!', 'success');
      } else {
        showStatus(`Connection failed: ${response.message}`, 'error');
      }
    } catch (error) {
      showStatus(`Error: ${error.message}`, 'error');
    }
  });

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const apiUrl = apiUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!apiUrl || !apiKey) {
      showStatus('Please enter both URL and API key', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ apiUrl, apiKey });
      showStatus('Settings saved!', 'success');

      // Clear any error badge
      chrome.action.setBadgeText({ text: '' });
    } catch (error) {
      showStatus(`Error: ${error.message}`, 'error');
    }
  });
});
