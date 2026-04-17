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

  if (message.type === 'SHOW_CARD_DIALOG') {
    showCardDialog(message.text || '', message.url || '', message.title || '');
  }
});

// --- Card creation dialog ---

function showCardDialog(text, url, title) {
  if (document.getElementById('notetaker-dialog-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'notetaker-dialog-overlay';

  const dialog = document.createElement('div');
  dialog.id = 'notetaker-dialog';

  const heading = document.createElement('h3');
  heading.className = 'notetaker-dialog-title';
  heading.textContent = 'Create Flashcard';
  dialog.appendChild(heading);

  if (title || url) {
    const source = document.createElement('p');
    source.className = 'notetaker-dialog-source';
    source.textContent = title || url;
    dialog.appendChild(source);
  }

  dialog.appendChild(buildField('Question', 'notetaker-q', 'textarea'));
  dialog.appendChild(buildField('Answer', 'notetaker-a', 'textarea', true));
  dialog.appendChild(buildField('Hint (optional)', 'notetaker-hint', 'input'));
  dialog.appendChild(buildField('Tags (optional, comma-separated)', 'notetaker-tags', 'input'));

  const errorEl = document.createElement('div');
  errorEl.id = 'notetaker-error';
  errorEl.className = 'notetaker-error';
  dialog.appendChild(errorEl);

  const actions = document.createElement('div');
  actions.className = 'notetaker-dialog-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'notetaker-btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', closeDialog);

  const submitBtn = document.createElement('button');
  submitBtn.id = 'notetaker-submit';
  submitBtn.className = 'notetaker-btn-primary';
  submitBtn.textContent = 'Create Card';
  submitBtn.addEventListener('click', submitCard);

  actions.appendChild(cancelBtn);
  actions.appendChild(submitBtn);
  dialog.appendChild(actions);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Pre-fill Q, focus A if text provided, otherwise focus Q
  const qEl = document.getElementById('notetaker-q');
  qEl.value = text;
  setTimeout(() => {
    (text ? document.getElementById('notetaker-a') : qEl).focus();
  }, 50);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDialog(); });
  document.addEventListener('keydown', handleDialogKey);
}

function buildField(labelText, inputId, tag, required = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'notetaker-dialog-field';

  const label = document.createElement('label');
  label.textContent = labelText;
  label.htmlFor = inputId;

  const input = document.createElement(tag);
  input.id = inputId;
  if (tag === 'textarea') input.rows = 3;

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  return wrapper;
}

function handleDialogKey(e) {
  if (e.key === 'Escape') closeDialog();
}

function closeDialog() {
  const overlay = document.getElementById('notetaker-dialog-overlay');
  if (overlay) overlay.remove();
  document.removeEventListener('keydown', handleDialogKey);
}

function setDialogError(msg) {
  const el = document.getElementById('notetaker-error');
  if (el) el.textContent = msg;
}

function submitCard() {
  const q = document.getElementById('notetaker-q').value.trim();
  const a = document.getElementById('notetaker-a').value.trim();
  const hint = document.getElementById('notetaker-hint').value.trim();
  const tags = (document.getElementById('notetaker-tags')?.value || '')
    .split(',').map(t => t.trim()).filter(Boolean);

  if (!q) { setDialogError('Question is required'); return; }
  if (!a) { setDialogError('Answer is required'); return; }

  const submitBtn = document.getElementById('notetaker-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';

  // Delegate fetch to background script to avoid content-script CORS restrictions
  chrome.runtime.sendMessage(
    { type: 'CREATE_CARD', front: q, back: a, hint: hint || null, tags },
    (response) => {
      if (response.success) {
        closeDialog();
        showToast('Card created!', 'success');
      } else {
        setDialogError(response.error);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Card';
      }
    }
  );
}

// Cmd/Ctrl+Shift+S — Save to Note Taker+ (source only)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
    const selection = window.getSelection().toString().trim();
    if (!selection) return;
    e.preventDefault();
    chrome.runtime.sendMessage(
      { type: 'SAVE_SOURCE', text: selection, url: window.location.href, title: document.title },
      (response) => {
        if (response.success) showToast('Saved to Note Taker+', 'success');
        else showToast(`Error: ${response.error}`, 'error');
      }
    );
  }
});

// Cmd/Ctrl+Shift+F — Create Flashcard from Selection (source + generate cards)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
    const selection = window.getSelection().toString().trim();
    if (!selection) return;
    e.preventDefault();
    chrome.runtime.sendMessage(
      { type: 'SAVE_SOURCE', text: selection, url: window.location.href, title: document.title, generateCards: true },
      (response) => {
        if (response.success) showToast('Saved! Card generation started.', 'success');
        else showToast(`Error: ${response.error}`, 'error');
      }
    );
  }
});

// Cmd/Ctrl+Shift+K — Open Create Card dialog
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'k') {
    if (document.getElementById('notetaker-dialog-overlay')) return;
    e.preventDefault();
    const selection = window.getSelection().toString().trim();
    showCardDialog(selection, window.location.href, document.title);
  }
});
