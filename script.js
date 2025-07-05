const elements = {
  markdownEditor: document.getElementById('markdownEditor'),
  preview: document.getElementById('preview'),
  themeToggle: document.getElementById('themeToggle'),
  themeMenu: document.getElementById('themeMenu'),
  boldBtn: document.getElementById('boldBtn'),
  italicBtn: document.getElementById('italicBtn'),
  strikeBtn: document.getElementById('strikeBtn'),
  headingBtn: document.getElementById('headingBtn'),
  orderedListBtn: document.getElementById('orderedListBtn'),
  unorderedListBtn: document.getElementById('unorderedListBtn'),
  checklistBtn: document.getElementById('checklistBtn'),
  linkBtn: document.getElementById('linkBtn'),
  imageBtn: document.getElementById('imageBtn'),
  tableBtn: document.getElementById('tableBtn'),
  codeBlockBtn: document.getElementById('codeBlockBtn'),
  htmlViewBtn: document.getElementById('htmlViewBtn'),
  syncScrollBtn: document.getElementById('syncScrollBtn'),
  saveBtn: document.getElementById('saveBtn'),
  exportBtn: document.getElementById('exportBtn'),
  exportModal: document.getElementById('exportModal'),
  exportMarkdownBtn: document.getElementById('exportMarkdownBtn'),
  exportHtmlBtn: document.getElementById('exportHtmlBtn'),
  exportPdfBtn: document.getElementById('exportPdfBtn'),
  closeExportModal: document.getElementById('closeExportModal'),
  closeExportModalBtn: document.getElementById('closeExportModalBtn'),
  importBtn: document.getElementById('importBtn'),
  helpButton: document.getElementById('helpButton'),
  helpModal: document.getElementById('helpModal'),
  closeHelpModal: document.getElementById('closeHelpModal'),
  closeHelpModalBtn: document.getElementById('closeHelpModalBtn'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toastMessage'),
  lastSaved: document.getElementById('lastSaved'),
  wordCount: document.getElementById('wordCount')
};

const state = {
  isHtmlView: false,
  syncScroll: false,
  debounceTimeout: null,
  history: [],
  historyIndex: -1
};

const translations = {
  tr: {
    save: 'İçerik kaydedildi',
    exportMarkdown: 'Markdown dosyası dışa aktarıldı',
    exportHtml: 'HTML dosyası dışa aktarıldı',
    exportPdf: 'PDF dosyası dışa aktarıldı',
    importSuccess: 'Dosya içe aktarıldı',
    importFileSizeError: 'Hata: Dosya boyutu 1MB\'dan büyük.',
    importContentError: 'Hata: Dosya içeriği çok büyük.',
    importFileTypeError: 'Hata: Yalnızca .md, .markdown veya .txt dosyaları desteklenir.',
    syncScrollOn: 'Senkronize kaydırma etkinleştirildi',
    syncScrollOff: 'Senkronize kaydırma devre dışı bırakıldı',
    libraryError: 'Hata: Gerekli kütüphane (marked veya html2pdf) yüklenemedi. Lütfen sayfayı yenileyin veya internet bağlantınızı kontrol edin.',
    undo: 'Geri alma işlemi yapıldı',
    redo: 'Yineleme işlemi yapıldı'
  }
};

// Web Worker for Markdown parsing
const markdownWorker = new Worker(URL.createObjectURL(new Blob([`
  importScripts('https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js');
  self.onmessage = function(e) {
    const html = marked.parse(e.data);
    self.postMessage(html);
  };
`], { type: 'text/javascript' })));

const editor = {
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  updatePreview(content = elements.markdownEditor.value) {
    if (state.isHtmlView) {
      markdownWorker.onmessage = (e) => {
        const htmlContent = e.data;
        elements.preview.innerHTML = `<pre style="margin: 0; white-space: pre-wrap;"><code class="language-html">${this.escapeHtml(htmlContent)}</code></pre>`;
        Prism.highlightElement(elements.preview.querySelector('code'));
      };
      markdownWorker.postMessage(content);
    } else {
      markdownWorker.onmessage = (e) => {
        elements.preview.innerHTML = e.data;
        Prism.highlightAllUnder(elements.preview);
      };
      markdownWorker.postMessage(content);
    }
  },

  showToast(messageKey, lang = 'tr') {
    elements.toastMessage.textContent = translations[lang][messageKey];
    elements.toast.classList.remove('hidden');
    elements.toast.setAttribute('role', 'alert');
    setTimeout(() => {
      elements.toast.classList.add('hidden');
      elements.toast.removeAttribute('role');
    }, 3000);
  },

  saveContent() {
    localStorage.setItem('markdownContent', elements.markdownEditor.value);
    const now = new Date().toLocaleString('tr-TR');
    localStorage.setItem('lastSaved', now);
    elements.lastSaved.textContent = `Son kayıt: ${now}`;
    this.showToast('save');
  },

  applyTheme(theme) {
    if (theme === 'dark') {
      document.body.classList.add('dark');
      document.body.style.backgroundColor = '#111827';
      elements.preview.style.backgroundColor = '#111827';
      elements.preview.style.color = '#ffffff';
      elements.markdownEditor.style.backgroundColor = '#111827';
      elements.markdownEditor.style.color = '#ffffff';
    } else {
      document.body.classList.remove('dark');
      document.body.style.backgroundColor = '#ffffff';
      elements.preview.style.backgroundColor = '#ffffff';
      elements.preview.style.color = '#111827';
      elements.markdownEditor.style.backgroundColor = '#ffffff';
      elements.markdownEditor.style.color = '#111827';
    }
    localStorage.setItem('theme', theme);
  },

  insertFormatting(before, after, placeholder = '') {
    const start = elements.markdownEditor.selectionStart;
    const end = elements.markdownEditor.selectionEnd;
    const selectedText = elements.markdownEditor.value.substring(start, end) || placeholder;
    const newText = `${before}${selectedText}${after}`;
    elements.markdownEditor.setRangeText(newText, start, end, 'end');
    elements.markdownEditor.focus();
    this.saveToHistory();
    this.updatePreview();
    this.saveContent();
    this.updateWordCount();
  },

  saveToHistory() {
    const content = elements.markdownEditor.value;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(content);
    state.historyIndex++;
    if (state.history.length > 50) {
      state.history.shift();
      state.historyIndex--;
    }
  },

  undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      elements.markdownEditor.value = state.history[state.historyIndex];
      this.updatePreview();
      this.saveContent();
      this.showToast('undo');
      this.updateWordCount();
    }
  },

  redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      elements.markdownEditor.value = state.history[state.historyIndex];
      this.updatePreview();
      this.saveContent();
      this.showToast('redo');
      this.updateWordCount();
    }
  },

  
  syncScrollHandler(source, target) {
    if (!state.syncScroll) return;
    const scrollPercentage = source.scrollTop / (source.scrollHeight - source.clientHeight);
    target.scrollTop = scrollPercentage * (target.scrollHeight - target.clientHeight);
  },

  exportFile(format) {
    if (!window.html2pdf && format === 'pdf') {
      this.showToast('libraryError');
      return;
    }
    if (format === 'markdown') {
      const blob = new Blob([elements.markdownEditor.value], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.md';
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('exportMarkdown');
    } else if (format === 'html') {
      markdownWorker.onmessage = (e) => {
        const blob = new Blob([e.data], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document.html';
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('exportHtml');
      };
      markdownWorker.postMessage(elements.markdownEditor.value);
    } else if (format === 'pdf') {
      elements.preview.classList.add('pdf-export');
      const opt = {
        margin: 0.5,
        filename: 'document.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, scrollX: 0, scrollY: 0 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      window.html2pdf().from(elements.preview).set(opt).save().then(() => {
        elements.preview.classList.remove('pdf-export');
        this.showToast('exportPdf');
      }).catch(() => {
        this.showToast('libraryError');
      });
    }
    elements.exportModal.classList.add('hidden');
  },

  updateWordCount() {
    const text = elements.markdownEditor.value;
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    const characters = text.length;
    elements.wordCount.textContent = `Kelime: ${words} | Karakter: ${characters}`;
  },

  loadInitialState() {
    const savedContent = localStorage.getItem('markdownContent');
    if (savedContent) {
      elements.markdownEditor.value = savedContent;
      state.history.push(savedContent);
      state.historyIndex = 0;
      this.updatePreview();
      this.updateWordCount();
    }
    const savedLastSaved = localStorage.getItem('lastSaved');
    if (savedLastSaved) {
      elements.lastSaved.textContent = `Son kayıt: ${savedLastSaved}`;
    }
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.applyTheme('dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.applyTheme('dark');
    } else {
      this.applyTheme('light');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (!window.marked || !window.html2pdf || !window.Prism) {
    editor.showToast('libraryError');
    return;
  }

  // Add tabindex and improve accessibility for toolbar buttons
  [elements.boldBtn, elements.italicBtn, elements.strikeBtn, elements.headingBtn,
   elements.orderedListBtn, elements.unorderedListBtn, elements.checklistBtn,
   elements.linkBtn, elements.imageBtn, elements.tableBtn, elements.codeBlockBtn,
   elements.htmlViewBtn, elements.syncScrollBtn, elements.saveBtn, elements.exportBtn,
   elements.importBtn].forEach(btn => {
    btn.setAttribute('tabindex', '0');
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });

  editor.loadInitialState();

  elements.markdownEditor.addEventListener('input', () => {
    clearTimeout(state.debounceTimeout);
    state.debounceTimeout = setTimeout(() => {
      editor.saveToHistory();
      editor.updatePreview();
      editor.updateWordCount();
    }, 300);
  });

  elements.boldBtn.addEventListener('click', () => editor.insertFormatting('**', '**', 'Kalın metin'));
  elements.italicBtn.addEventListener('click', () => editor.insertFormatting('*', '*', 'İtalik metin'));
  elements.strikeBtn.addEventListener('click', () => editor.insertFormatting('~~', '~~', 'Üstü çizili metin'));
  elements.headingBtn.addEventListener('click', () => editor.insertFormatting('### ', '', 'Başlık'));
  elements.orderedListBtn.addEventListener('click', () => editor.insertFormatting('1. ', '', 'Numaralı öğe'));
  elements.unorderedListBtn.addEventListener('click', () => editor.insertFormatting('- ', '', 'Liste öğesi'));
  elements.checklistBtn.addEventListener('click', () => editor.insertFormatting('- [ ] ', '', 'Checklist öğesi'));
  elements.linkBtn.addEventListener('click', () => editor.insertFormatting('[', '](https://example.com)', 'Bağlantı metni'));
  elements.imageBtn.addEventListener('click', () => editor.insertFormatting('![', '](https://example.com/image.jpg)', 'Resim alt metni'));
  elements.tableBtn.addEventListener('click', () => editor.insertFormatting('| Başlık | Başlık |\n|-------|-------|\n| Hücre | Hücre |\n', '', ''));
  elements.codeBlockBtn.addEventListener('click', () => editor.insertFormatting('```javascript\n', '\n```', 'Kod buraya'));

  elements.htmlViewBtn.addEventListener('click', () => {
    state.isHtmlView = !state.isHtmlView;
    elements.htmlViewBtn.classList.toggle('active');
    editor.updatePreview();
  });

  elements.syncScrollBtn.addEventListener('click', () => {
    state.syncScroll = !state.syncScroll;
    elements.syncScrollBtn.classList.toggle('active');
    editor.showToast(state.syncScroll ? 'syncScrollOn' : 'syncScrollOff');
  });

  elements.markdownEditor.addEventListener('scroll', () => editor.syncScrollHandler(elements.markdownEditor, elements.preview));
  elements.preview.addEventListener('scroll', () => editor.syncScrollHandler(elements.preview, elements.markdownEditor));

  elements.saveBtn.addEventListener('click', () => editor.saveContent());

  elements.exportBtn.addEventListener('click', () => {
    elements.exportModal.classList.remove('hidden');
    elements.exportMarkdownBtn.focus();
  });

  elements.exportMarkdownBtn.addEventListener('click', () => editor.exportFile('markdown'));
  elements.exportHtmlBtn.addEventListener('click', () => editor.exportFile('html'));
  elements.exportPdfBtn.addEventListener('click', () => editor.exportFile('pdf'));
  elements.closeExportModal.addEventListener('click', () => {
    elements.exportModal.classList.add('hidden');
    elements.markdownEditor.focus();
  });
  elements.closeExportModalBtn.addEventListener('click', () => {
    elements.exportModal.classList.add('hidden');
    elements.markdownEditor.focus();
  });


  elements.importBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file && file.size < 1_000_000) {
        if (!['.md', '.markdown', '.txt'].includes(file.name.slice(file.name.lastIndexOf('.')))) {
          editor.showToast('importFileTypeError');
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target.result;
          if (content.length < 100_000) {
            elements.markdownEditor.value = content;
            editor.saveToHistory();
            editor.updatePreview();
            editor.saveContent();
            editor.showToast('importSuccess');
          } else {
            editor.showToast('importContentError');
          }
        };
        reader.readAsText(file);
      } else {
        editor.showToast('importFileSizeError');
      }
    };
    input.click();
  });
elements.importBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.onchange = (e) => editor.handleFileImport(e.target.files[0]);
    input.click();
  });

  

  elements.themeToggle.addEventListener('click', () => {
    elements.themeMenu.classList.toggle('hidden');
    elements.themeMenu.querySelector('button').focus();
  });

  elements.themeMenu.querySelectorAll('button').forEach((btn, index) => {
    btn.setAttribute('data-theme', index === 0 ? 'light' : 'dark');
    btn.addEventListener('click', (e) => {
      const theme = e.target.dataset.theme;
      editor.applyTheme(theme);
      elements.themeMenu.classList.add('hidden');
      elements.markdownEditor.focus();
    });
  });

  elements.helpButton.addEventListener('click', () => {
    elements.helpModal.classList.remove('hidden');
    elements.closeHelpModalBtn.focus();
  });

  elements.closeHelpModal.addEventListener('click', () => {
    elements.helpModal.classList.add('hidden');
    elements.markdownEditor.focus();
  });
  elements.closeHelpModalBtn.addEventListener('click', () => {
    elements.helpModal.classList.add('hidden');
    elements.markdownEditor.focus();
  });

  elements.markdownEditor.addEventListener('keydown', (e) => {
    if (e.ctrlKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          editor.insertFormatting('**', '**', 'Kalın metin');
          break;
        case 'i':
          e.preventDefault();
          editor.insertFormatting('*', '*', 'İtalik metin');
          break;
        case 't':
          e.preventDefault();
          editor.insertFormatting('~~', '~~', 'Üstü çizili metin');
          break;
        case 'h':
          e.preventDefault();
          editor.insertFormatting('### ', '', 'Başlık');
          break;
        case 'k':
          e.preventDefault();
          editor.insertFormatting('[', '](https://example.com)', 'Bağlantı metni');
          break;
        case 's':
          e.preventDefault();
          editor.saveContent();
          break;
        case 'z':
          e.preventDefault();
          editor.undo();
          break;
        case 'y':
          e.preventDefault();
          editor.redo();
          break;
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      elements.helpModal.classList.add('hidden');
      elements.exportModal.classList.add('hidden');
      elements.themeMenu.classList.add('hidden');
      elements.markdownEditor.focus();
    }
  });
});