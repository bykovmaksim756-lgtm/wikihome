const STORAGE_KEY = 'wikihome_notes';
const THEME_KEY = 'wikihome_theme';
const VIEW_KEY = 'wikihome_view';
const MAX_VERSIONS = 5;

let notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let activeId = null;
let activeTag = null;
let activeFolder = null;
let filterFav = false;
let filterPinned = false;
let searchQuery = '';
let viewMode = 'edit';
let homeView = localStorage.getItem(VIEW_KEY) || 'grid';
let matchIndex = 0;

const COLORS = ['none','gray','blue','green','yellow','orange','red','purple','pink'];

notes = notes.map(n => ({
  id: n.id,
  title: n.title || '',
  content: n.content || '',
  cover: n.cover || '',
  color: n.color || 'none',
  folder: n.folder || '',
  pinned: !!n.pinned,
  favorite: !!n.favorite,
  createdAt: n.createdAt || Date.now(),
  updatedAt: n.updatedAt || Date.now(),
  versions: n.versions || []
}));

const $ = (id) => document.getElementById(id);
const notesList = $('notesList');
const tagsBox = $('tagsBox');
const foldersBox = $('foldersBox');
const newBtn = $('newBtn');
const homeBtn = $('homeBtn');
const searchInput = $('search');
const searchInfo = $('searchInfo');
const home = $('home');
const editorView = $('editorView');
const grid = $('grid');
const listView = $('listView');
const noNotes = $('noNotes');
const homeTitle = $('homeTitle');
const gridBtn = $('gridBtn');
const listBtn = $('listBtn');
const titleInput = $('title');
const contentInput = $('content');
const preview = $('preview');
const editBtn = $('editBtn');
const viewBtn = $('viewBtn');
const deleteBtn = $('deleteBtn');
const backBtn = $('backBtn');
const saveStatus = $('saveStatus');
const statsBar = $('statsBar');
const themeBtn = $('themeBtn');
const exportBtn = $('exportBtn');
const importBtn = $('importBtn');
const importFile = $('importFile');
const coverPreview = $('coverPreview');
const uploadCoverBtn = $('uploadCoverBtn');
const urlCoverBtn = $('urlCoverBtn');
const removeCoverBtn = $('removeCoverBtn');
const coverFile = $('coverFile');
const pinBtn = $('pinBtn');
const favBtn = $('favBtn');
const dupBtn = $('dupBtn');
const histBtn = $('histBtn');
const createdAt = $('createdAt');
const updatedAt = $('updatedAt');
const folderSelect = $('folderSelect');
const colorPicker = $('colorPicker');
const favFilter = $('favFilter');
const pinnedFilter = $('pinnedFilter');
const searchNav = $('searchNav');
const searchCount = $('searchCount');
const prevMatch = $('prevMatch');
const nextMatch = $('nextMatch');
const menuToggle = $('menuToggle');
const sidebarEl = $('sidebar');
const sidebarOverlay = $('sidebarOverlay');

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  flashSaved();
}
let saveTimer = null;
function flashSaved() {
  saveStatus.classList.add('show');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveStatus.classList.remove('show'), 1000);
}
function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return pad(d.getDate()) + '.' + pad(d.getMonth()+1) + '.' + d.getFullYear() +
         ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
function extractTags(text) {
  const matches = text.match(/#[\wа-яёА-ЯЁ]+/g) || [];
  return matches.map(t => t.slice(1).toLowerCase());
}
function getAllTags() {
  const set = new Set();
  notes.forEach(n => extractTags(n.title + ' ' + n.content).forEach(t => set.add(t)));
  return Array.from(set).sort();
}
function getAllFolders() {
  const set = new Set();
  notes.forEach(n => { if (n.folder) set.add(n.folder); });
  return Array.from(set).sort();
}

/* ===== МОБИЛЬНОЕ МЕНЮ ===== */
function openSidebar() {
  if (sidebarEl) sidebarEl.classList.add('open');
  if (sidebarOverlay) sidebarOverlay.classList.add('show');
}
function closeSidebar() {
  if (sidebarEl) sidebarEl.classList.remove('open');
  if (sidebarOverlay) sidebarOverlay.classList.remove('show');
}
function isMobile() {
  return window.innerWidth <= 768;
}

if (menuToggle) {
  menuToggle.onclick = () => {
    if (sidebarEl.classList.contains('open')) closeSidebar();
    else openSidebar();
  };
}
if (sidebarOverlay) {
  sidebarOverlay.onclick = closeSidebar;
}

function renderTags() {
  tagsBox.innerHTML = '';
  getAllTags().forEach(tag => {
    const el = document.createElement('span');
    el.className = 'tag' + (tag === activeTag ? ' active' : '');
    el.textContent = '#' + tag;
    el.onclick = () => {
      activeTag = (activeTag === tag) ? null : tag;
      renderTags(); renderList(); renderHome();
    };
    tagsBox.appendChild(el);
  });
}
function renderFolders() {
  foldersBox.innerHTML = '';
  getAllFolders().forEach(f => {
    const el = document.createElement('span');
    el.className = 'folder' + (f === activeFolder ? ' active' : '');
    el.textContent = '📁 ' + f;
    el.onclick = () => {
      activeFolder = (activeFolder === f) ? null : f;
      renderFolders(); renderList(); renderHome();
    };
    foldersBox.appendChild(el);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function highlight(text, query) {
  if (!query) return escapeHtml(text);
  const re = new RegExp('(' + escapeRegex(query) + ')', 'gi');
  return escapeHtml(text).replace(re, '<mark>$1</mark>');
}
function makeSnippet(text, query, radius) {
  radius = radius || 40;
  if (!query) return escapeHtml(text.slice(0, 100));
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return escapeHtml(text.slice(0, 100));
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';
  return highlight(snippet, query);
}
function countMatches(text, query) {
  if (!query) return 0;
  const re = new RegExp(escapeRegex(query), 'gi');
  return (text.match(re) || []).length;
}

function getFilteredNotes() {
  const q = searchQuery.toLowerCase();
  let list = notes.filter(note => {
    if (filterFav && !note.favorite) return false;
    if (filterPinned && !note.pinned) return false;
    if (q) {
      const hay = (note.title + ' ' + note.content).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (activeTag) {
      const tags = extractTags(note.title + ' ' + note.content);
      if (!tags.includes(activeTag)) return false;
    }
    if (activeFolder && note.folder !== activeFolder) return false;
    return true;
  });
  list.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  return list;
}

function renderList() {
  notesList.innerHTML = '';
  const filtered = getFilteredNotes();
  if (filtered.length === 0) {
    const div = document.createElement('div');
    div.style.cssText = 'color:#888;font-size:13px;padding:8px;';
    div.textContent = searchQuery ? 'Ничего не найдено' : 'Пусто';
    notesList.appendChild(div);
    return;
  }
  filtered.forEach(note => {
    const div = document.createElement('div');
    div.className = 'note-item' + (note.id === activeId ? ' active' : '');
    const row = document.createElement('div');
    row.className = 'note-title-row';
    if (note.pinned) {
      const pin = document.createElement('span');
      pin.textContent = '📌';
      row.appendChild(pin);
    }
    if (note.favorite) {
      const fav = document.createElement('span');
      fav.textContent = '⭐';
      row.appendChild(fav);
    }
    const title = document.createElement('span');
    title.className = 'note-title';
    title.textContent = note.title || 'Без названия';
    row.appendChild(title);
    div.appendChild(row);
    if (searchQuery) {
      const snip = document.createElement('div');
      snip.className = 'snippet';
      const src = note.title + ' ' + note.content;
      snip.innerHTML = makeSnippet(src, searchQuery);
      div.appendChild(snip);
    }
    div.onclick = () => openNote(note.id);
    notesList.appendChild(div);
  });
}

function renderHome() {
  const filtered = getFilteredNotes();
  grid.innerHTML = '';
  listView.innerHTML = '';
  if (filtered.length === 0) {
    grid.classList.add('hidden');
    listView.classList.add('hidden');
    noNotes.classList.remove('hidden');
    noNotes.textContent = notes.length === 0
      ? 'Пока нет заметок. Нажми «+ Новая заметка» слева.'
      : 'Ничего не найдено по фильтрам.';
    homeTitle.textContent = 'Все заметки';
    return;
  }
  noNotes.classList.add('hidden');
  if (searchQuery) homeTitle.textContent = 'Найдено: ' + filtered.length;
  else homeTitle.textContent = 'Все заметки (' + filtered.length + ')';

  filtered.forEach(note => {
    const card = document.createElement('div');
    card.className = 'card' + (note.color && note.color !== 'none' ? ' color-' + note.color : '');
    const img = document.createElement('div');
    img.className = 'card-img';
    if (note.cover) {
      img.style.backgroundImage = 'url("' + note.cover + '")';
      img.textContent = '';
    } else {
      img.style.backgroundImage = 'linear-gradient(135deg, #4a9eff, #8a5eff)';
      img.textContent = (note.title || '?').charAt(0).toUpperCase();
    }
    if (note.pinned || note.favorite) {
      const badges = document.createElement('div');
      badges.className = 'card-badges';
      if (note.pinned) {
        const b = document.createElement('div');
        b.className = 'badge'; b.textContent = '📌';
        badges.appendChild(b);
      }
      if (note.favorite) {
        const b = document.createElement('div');
        b.className = 'badge'; b.textContent = '⭐';
        badges.appendChild(b);
      }
      img.appendChild(badges);
    }
    const body = document.createElement('div');
    body.className = 'card-body';
    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = note.title || 'Без названия';
    body.appendChild(title);
    if (searchQuery) {
      const snip = document.createElement('div');
      snip.className = 'card-snippet';
      const src = note.title + ' ' + note.content;
      snip.innerHTML = makeSnippet(src, searchQuery, 60);
      body.appendChild(snip);
    }
    const tags = document.createElement('div');
    tags.className = 'card-tags';
    extractTags(note.title + ' ' + note.content).slice(0, 4).forEach(t => {
      const s = document.createElement('span');
      s.textContent = '#' + t;
      tags.appendChild(s);
    });
    body.appendChild(tags);
    const dates = document.createElement('div');
    dates.className = 'card-dates';
    dates.textContent = fmtDate(note.updatedAt);
    body.appendChild(dates);
    card.appendChild(img);
    card.appendChild(body);
    card.onclick = () => openNote(note.id);
    grid.appendChild(card);

    const row = document.createElement('div');
    row.className = 'list-row' + (note.color && note.color !== 'none' ? ' color-' + note.color : '');
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (note.cover) thumb.style.backgroundImage = 'url("' + note.cover + '")';
    else thumb.style.backgroundImage = 'linear-gradient(135deg, #4a9eff, #8a5eff)';
    const info = document.createElement('div');
    info.className = 'info';
    const infoTitle = document.createElement('div');
    infoTitle.className = 'info-title';
    infoTitle.textContent = note.title || 'Без названия';
    const infoPrev = document.createElement('div');
    infoPrev.className = 'info-preview';
    if (searchQuery) {
      const src = note.title + ' ' + note.content;
      infoPrev.innerHTML = makeSnippet(src, searchQuery, 40);
    } else {
      infoPrev.textContent = (note.content || '').replace(/[#*`\[\]]/g, '').slice(0, 80) || 'Пусто';
    }
    info.appendChild(infoTitle);
    info.appendChild(infoPrev);
    row.appendChild(thumb);
    row.appendChild(info);
    if (note.pinned || note.favorite) {
      const rowBadges = document.createElement('div');
      rowBadges.className = 'row-badges';
      if (note.pinned) {
        const b = document.createElement('span');
        b.textContent = '📌';
        rowBadges.appendChild(b);
      }
      if (note.favorite) {
        const b = document.createElement('span');
        b.textContent = '⭐';
        rowBadges.appendChild(b);
      }
      row.appendChild(rowBadges);
    }
    row.onclick = () => openNote(note.id);
    listView.appendChild(row);
  });

  if (homeView === 'grid') {
    grid.classList.remove('hidden');
    listView.classList.add('hidden');
    gridBtn.classList.add('active');
    listBtn.classList.remove('active');
  } else {
    grid.classList.add('hidden');
    listView.classList.remove('hidden');
    gridBtn.classList.remove('active');
    listBtn.classList.add('active');
  }
}

function openNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;
  activeId = id;
  titleInput.value = note.title;
  contentInput.value = note.content;
  updateCoverPreview(note.cover);
  updateMeta(note);
  updatePinFavButtons(note);
  updateColorPicker(note.color);
  updateFolderSelect(note.folder);
  home.classList.add('hidden');
  editorView.classList.remove('hidden');
  setViewMode('edit');
  renderList(); renderTags(); renderFolders();
  updateStats();
  updateSearchNav();
  if (isMobile()) closeSidebar();
}
function updateMeta(note) {
  createdAt.textContent = 'Создано: ' + fmtDate(note.createdAt);
  updatedAt.textContent = 'Изменено: ' + fmtDate(note.updatedAt);
}
function updatePinFavButtons(note) {
  pinBtn.classList.toggle('active', note.pinned);
  favBtn.classList.toggle('active', note.favorite);
  favBtn.textContent = note.favorite ? '⭐' : '☆';
}
function updateColorPicker(color) {
  colorPicker.innerHTML = '';
  COLORS.forEach(c => {
    const dot = document.createElement('div');
    dot.className = 'colorDot c-' + c + (c === color ? ' selected' : '');
    dot.title = c;
    dot.onclick = () => {
      const note = notes.find(n => n.id === activeId);
      if (!note) return;
      note.color = c;
      note.updatedAt = Date.now();
      save();
      updateColorPicker(c);
      renderHome(); renderList();
    };
    colorPicker.appendChild(dot);
  });
}
function updateFolderSelect(folder) {
  const folders = getAllFolders();
  folderSelect.innerHTML = '<option value="">— без папки —</option>';
  folders.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    if (f === folder) opt.selected = true;
    folderSelect.appendChild(opt);
  });
  const addOpt = document.createElement('option');
  addOpt.value = '__new__';
  addOpt.textContent = '+ новая папка...';
  folderSelect.appendChild(addOpt);
}
function goHome() {
  activeId = null;
  home.classList.remove('hidden');
  editorView.classList.add('hidden');
  renderList();
  renderHome();
  if (isMobile()) closeSidebar();
}
function createNote(initialTitle) {
  const now = Date.now();
  const note = {
    id: now.toString(),
    title: initialTitle || '',
    content: '',
    cover: '', color: 'none', folder: '',
    pinned: false, favorite: false,
    createdAt: now, updatedAt: now, versions: []
  };
  notes.push(note);
  save();
  openNote(note.id);
  titleInput.focus();
}
function updateActive() {
  if (!activeId) return;
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  note.title = titleInput.value;
  note.content = contentInput.value;
  note.updatedAt = Date.now();
  save();
  renderList(); renderTags(); updateStats(); updateMeta(note);
  updateSearchNav();
  if (viewMode === 'view') renderPreview();
}
function deleteActive() {
  if (!activeId) return;
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  if (!confirm('Удалить заметку «' + (note.title || 'Без названия') + '»?')) return;
  notes = notes.filter(n => n.id !== activeId);
  save();
  goHome();
}
function updateCoverPreview(cover) {
  if (cover) coverPreview.style.backgroundImage = 'url("' + cover + '")';
  else coverPreview.style.backgroundImage = 'linear-gradient(135deg, #4a9eff, #8a5eff)';
}

uploadCoverBtn.onclick = () => coverFile.click();
coverFile.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 1024 * 1024) {
    alert('Файл слишком большой (макс. 1 МБ).');
    coverFile.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    const note = notes.find(n => n.id === activeId);
    if (!note) return;
    note.cover = ev.target.result;
    note.updatedAt = Date.now();
    save();
    updateCoverPreview(note.cover);
    renderHome();
  };
  reader.readAsDataURL(file);
  coverFile.value = '';
};
urlCoverBtn.onclick = () => {
  const url = prompt('URL картинки (https://...)');
  if (!url) return;
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  note.cover = url.trim();
  note.updatedAt = Date.now();
  save();
  updateCoverPreview(note.cover);
  renderHome();
};
removeCoverBtn.onclick = () => {
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  note.cover = '';
  note.updatedAt = Date.now();
  save();
  updateCoverPreview('');
  renderHome();
};

pinBtn.onclick = () => {
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  note.pinned = !note.pinned;
  note.updatedAt = Date.now();
  save();
  updatePinFavButtons(note);
  renderList(); renderHome();
};
favBtn.onclick = () => {
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  note.favorite = !note.favorite;
  note.updatedAt = Date.now();
  save();
  updatePinFavButtons(note);
  renderList(); renderHome();
};
dupBtn.onclick = () => {
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  const now = Date.now();
  const copy = JSON.parse(JSON.stringify(note));
  copy.id = now.toString();
  copy.title = (note.title || 'Без названия') + ' (копия)';
  copy.createdAt = now;
  copy.updatedAt = now;
  copy.versions = [];
  notes.push(copy);
  save();
  openNote(copy.id);
};
histBtn.onclick = () => {
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  showHistory(note);
};
function showHistory(note) {
  const versions = note.versions || [];
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  const box = document.createElement('div');
  box.className = 'modal-box';
  const h = document.createElement('h3');
  h.textContent = 'История версий (' + versions.length + ')';
  box.appendChild(h);
  if (versions.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'Пока нет сохранённых версий. Они появляются автоматически каждые 30 секунд редактирования.';
    p.style.color = 'var(--text-soft)';
    box.appendChild(p);
  } else {
    versions.slice().reverse().forEach(v => {
      const item = document.createElement('div');
      item.className = 'version-item';
      const d = document.createElement('div');
      d.className = 'v-date';
      d.textContent = fmtDate(v.timestamp);
      const p = document.createElement('div');
      p.className = 'v-preview';
      p.textContent = (v.content || '').slice(0, 150) || '(пусто)';
      item.appendChild(d);
      item.appendChild(p);
      item.onclick = () => {
        if (!confirm('Восстановить эту версию?')) return;
        pushVersion(note);
        note.title = v.title || note.title;
        note.content = v.content || '';
        note.updatedAt = Date.now();
        save();
        titleInput.value = note.title;
        contentInput.value = note.content;
        updateMeta(note);
        renderList(); renderHome();
        modal.remove();
      };
      box.appendChild(item);
    });
  }
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn';
  closeBtn.textContent = 'Закрыть';
  closeBtn.style.marginTop = '12px';
  closeBtn.onclick = () => modal.remove();
  box.appendChild(closeBtn);
  modal.appendChild(box);
  document.body.appendChild(modal);
}
function pushVersion(note) {
  if (!note.versions) note.versions = [];
  note.versions.push({
    title: note.title,
    content: note.content,
    timestamp: Date.now()
  });
  while (note.versions.length > MAX_VERSIONS) note.versions.shift();
}
let versionTimer = null;
function scheduleVersion() {
  if (versionTimer) return;
  versionTimer = setTimeout(() => {
    versionTimer = null;
    if (!activeId) return;
    const note = notes.find(n => n.id === activeId);
    if (!note) return;
    pushVersion(note);
    save();
  }, 30000);
}
function setViewMode(mode) {
  viewMode = mode;
  if (mode === 'edit') {
    contentInput.classList.remove('hidden');
    preview.classList.add('hidden');
    editBtn.classList.add('active');
    viewBtn.classList.remove('active');
  } else {
    contentInput.classList.add('hidden');
    preview.classList.remove('hidden');
    editBtn.classList.remove('active');
    viewBtn.classList.add('active');
    renderPreview();
  }
  updateSearchNav();
}
function renderPreview() {
  let raw = contentInput.value || '*Пусто...*';
  const wikiLinks = [];
  raw = raw.replace(/\[\[([^\]]+)\]\]/g, (_, name) => {
    const i = wikiLinks.length;
    wikiLinks.push(name.trim());
    return '@@WIKI' + i + '@@';
  });
  let html = marked.parse(raw);
  html = html.replace(/@@WIKI(\d+)@@/g, (_, i) => {
    const name = wikiLinks[parseInt(i)];
    const exists = notes.some(n => n.title.toLowerCase() === name.toLowerCase());
    const cls = exists ? 'wiki-link' : 'wiki-link missing';
    return '<span class="' + cls + '" data-wiki="' + name + '">' + name + '</span>';
  });
  if (searchQuery) {
    const re = new RegExp('(' + escapeRegex(searchQuery) + ')', 'gi');
    html = html.replace(re, '<mark>$1</mark>');
  }
  preview.innerHTML = html;
  preview.querySelectorAll('.wiki-link').forEach(el => {
    el.onclick = () => {
      const name = el.dataset.wiki;
      const target = notes.find(n => n.title.toLowerCase() === name.toLowerCase());
      if (target) openNote(target.id);
      else if (confirm('Заметки «' + name + '» нет. Создать?')) createNote(name);
    };
  });
}
function updateStats() {
  const text = contentInput.value || '';
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  statsBar.textContent = 'Слов: ' + words + ' · Символов: ' + chars;
}
function updateSearchNav() {
  if (!searchQuery || viewMode !== 'view') {
    searchNav.classList.remove('show');
    return;
  }
  const total = countMatches(contentInput.value, searchQuery);
  if (total === 0) {
    searchNav.classList.remove('show');
    return;
  }
  searchNav.classList.add('show');
  searchCount.textContent = (matchIndex + 1) + ' / ' + total;
  const marks = preview.querySelectorAll('mark');
  marks.forEach(m => m.style.outline = 'none');
  if (marks[matchIndex]) {
    marks[matchIndex].style.outline = '2px solid var(--accent)';
    marks[matchIndex].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}
prevMatch.onclick = () => {
  const total = countMatches(contentInput.value, searchQuery);
  if (total === 0) return;
  matchIndex = (matchIndex - 1 + total) % total;
  updateSearchNav();
};
nextMatch.onclick = () => {
  const total = countMatches(contentInput.value, searchQuery);
  if (total === 0) return;
  matchIndex = (matchIndex + 1) % total;
  updateSearchNav();
};
function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark');
    themeBtn.textContent = '☀️';
  } else {
    document.body.classList.remove('dark');
    themeBtn.textContent = '🌙';
  }
  localStorage.setItem(THEME_KEY, theme);
}
themeBtn.onclick = () => {
  applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark');
};
exportBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wikihome-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
};
importBtn.onclick = () => importFile.click();
importFile.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) throw new Error('Не массив');
      const add = confirm('ОК — добавить к текущим. Отмена — заменить всё.');
      if (add) {
        const ids = new Set(notes.map(n => n.id));
        imported.forEach(n => { if (!ids.has(n.id)) notes.push(n); });
      } else {
        notes = imported.map(n => ({
          id: n.id || Date.now().toString() + Math.random(),
          title: n.title || '',
          content: n.content || '',
          cover: n.cover || '',
          color: n.color || 'none',
          folder: n.folder || '',
          pinned: !!n.pinned, favorite: !!n.favorite,
          createdAt: n.createdAt || Date.now(),
          updatedAt: n.updatedAt || Date.now(),
          versions: n.versions || []
        }));
      }
      save();
      renderList(); renderTags(); renderFolders(); renderHome();
      alert('Импорт готов. Заметок: ' + notes.length);
    } catch (err) {
      alert('Ошибка импорта: ' + err.message);
    }
  };
  reader.readAsText(file);
  importFile.value = '';
};

newBtn.onclick = () => {
  createNote();
  if (isMobile()) closeSidebar();
};
homeBtn.onclick = () => {
  goHome();
};
backBtn.onclick = goHome;
titleInput.oninput = () => { updateActive(); scheduleVersion(); };
contentInput.oninput = () => { updateActive(); scheduleVersion(); };
deleteBtn.onclick = deleteActive;
editBtn.onclick = () => setViewMode('edit');
viewBtn.onclick = () => setViewMode('view');

searchInput.oninput = () => {
  searchQuery = searchInput.value.trim();
  matchIndex = 0;
  renderList(); renderHome();
  if (searchQuery) {
    const total = countMatches(notes.map(n => n.title + ' ' + n.content).join(' '), searchQuery);
    searchInfo.textContent = 'Найдено совпадений: ' + total;
  } else {
    searchInfo.textContent = '';
  }
  if (viewMode === 'view') renderPreview();
  updateSearchNav();
};
favFilter.onclick = () => {
  filterFav = !filterFav;
  favFilter.classList.toggle('active', filterFav);
  renderList(); renderHome();
};
pinnedFilter.onclick = () => {
  filterPinned = !filterPinned;
  pinnedFilter.classList.toggle('active', filterPinned);
  renderList(); renderHome();
};
folderSelect.onchange = () => {
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  if (folderSelect.value === '__new__') {
    const name = prompt('Название папки:');
    if (name && name.trim()) {
      note.folder = name.trim();
      note.updatedAt = Date.now();
      save();
      updateFolderSelect(note.folder);
      renderFolders(); renderHome();
    } else {
      folderSelect.value = note.folder || '';
    }
  } else {
    note.folder = folderSelect.value;
    note.updatedAt = Date.now();
    save();
    renderFolders(); renderHome();
  }
};
gridBtn.onclick = () => {
  homeView = 'grid';
  localStorage.setItem(VIEW_KEY, 'grid');
  renderHome();
};
listBtn.onclick = () => {
  homeView = 'list';
  localStorage.setItem(VIEW_KEY, 'list');
  renderHome();
};
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
    e.preventDefault();
    if (!editorView.classList.contains('hidden')) {
      setViewMode(viewMode === 'edit' ? 'view' : 'edit');
    }
  }
  if (e.key === 'Escape' && !editorView.classList.contains('hidden')) {
    goHome();
  }
});

applyTheme(localStorage.getItem(THEME_KEY) || 'light');
renderTags(); renderFolders(); renderList(); renderHome();