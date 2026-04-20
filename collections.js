'use strict';

const API = {
  shareCollection: ''
};

const PLANS = {
  basic:   { label: 'Basic Plan',   limit: 10  },
  premium: { label: 'Premium Plan', limit: 50  },
  diamond: { label: 'Diamond Plan', limit: 100 }
};

let currentPlan  = 'basic';
let photos       = [];
let collections  = [];
let currentFilter = 'all';
let currentSort   = 'modified';
let activeColId   = null;
let editingColId  = null;
let selectedPhotoIds = [];
let currentVisibility = 'private';
let toastTimer = null;

const colGrid        = document.getElementById('colGrid');
const emptyState     = document.getElementById('emptyState');
const sortSelect     = document.getElementById('sortSelect');
const filterTabs     = document.querySelectorAll('.filter-tab');
const createBtn      = document.getElementById('createBtn');
const createBtnMob   = document.getElementById('createBtnMob');
const mobFab         = document.getElementById('mobFab');

const createModal      = document.getElementById('createModal');
const createModalClose = document.getElementById('createModalClose');
const createModalTitle = document.getElementById('createModalTitle');
const colNameInput     = document.getElementById('colNameInput');
const photoPicker      = document.getElementById('photoPicker');
const photoPickerWrap  = document.getElementById('photoPickerWrap');
const saveColBtn       = document.getElementById('saveColBtn');
const visBtns          = document.querySelectorAll('.vis-btn');

const colCtxMenu    = document.getElementById('colCtxMenu');
const ctxRename     = document.getElementById('ctxRename');
const ctxShare      = document.getElementById('ctxShare');
const ctxDelete     = document.getElementById('ctxDelete');

const modalBackdrop = document.getElementById('modalBackdrop');
const modalClose    = document.getElementById('modalClose');
const planCards     = document.querySelectorAll('.plan-card');

const sidebar       = document.getElementById('sidebar');
const sidebarOverlay= document.getElementById('sidebarOverlay');
const hamburger     = document.getElementById('hamburger');
const sidebarClose  = document.getElementById('sidebarClose');
const toast         = document.getElementById('toast');
const sidebarFill   = document.getElementById('sidebarStorageFill');
const sidebarText   = document.getElementById('sidebarStorageText');
const swPct         = document.getElementById('swPct');
const swFill        = document.getElementById('swFill');
const swCaption     = document.getElementById('swCaption');
const mobStorageCount = document.getElementById('mobStorageCount');
const mobStoragePct   = document.getElementById('mobStoragePct');
const mobBarFill      = document.getElementById('mobBarFill');

function init() {
  loadState();
  bindEvents();
  render();
}

function saveState() {
  try {
    localStorage.setItem('ag_collections', JSON.stringify(collections));
  } catch (e) { }
}

function loadState() {
  const savedPlan = localStorage.getItem('ag_plan');
  if (savedPlan && PLANS[savedPlan]) currentPlan = savedPlan;

  try {
    const rawPhotos = JSON.parse(localStorage.getItem('ag_photos') || '[]');
    photos = rawPhotos.map(function(p) {
      return { id: p.id, name: p.name, src: p.src, uploadedAt: new Date(p.uploadedAt) };
    });
  } catch (e) { photos = []; }

  try {
    const rawCols = JSON.parse(localStorage.getItem('ag_collections') || '[]');
    collections = rawCols.map(function(c) {
      return {
        id:         c.id,
        name:       c.name,
        visibility: c.visibility || 'private',
        photoIds:   c.photoIds   || [],
        createdAt:  new Date(c.createdAt),
        modifiedAt: new Date(c.modifiedAt)
      };
    });
  } catch (e) { collections = []; }
}

function bindEvents() {
  hamburger.addEventListener('click',     openSidebar);
  sidebarClose.addEventListener('click',  closeSidebar);
  sidebarOverlay.addEventListener('click',closeSidebar);

  createBtn.addEventListener('click',    function() { openCreateModal(); });
  createBtnMob.addEventListener('click', function() { openCreateModal(); });
  mobFab.addEventListener('click',       function() { openCreateModal(); });

  createModalClose.addEventListener('click', closeCreateModal);
  createModal.addEventListener('click', function(e) { if (e.target === createModal) closeCreateModal(); });
  saveColBtn.addEventListener('click', saveCollection);

  visBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      visBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentVisibility = btn.getAttribute('data-vis');
    });
  });

  sortSelect.addEventListener('change', function() {
    currentSort = sortSelect.value;
    renderGrid();
  });

  filterTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      filterTabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentFilter = tab.getAttribute('data-filter');
      renderGrid();
    });
  });

  ctxRename.addEventListener('click', function() {
    if (activeColId) openRenameModal(activeColId);
    closeCtxMenu();
  });
  ctxShare.addEventListener('click', function() {
    if (activeColId) shareCollection(activeColId);
    closeCtxMenu();
  });
  ctxDelete.addEventListener('click', function() {
    if (activeColId) deleteCollection(activeColId);
    closeCtxMenu();
  });

  document.addEventListener('click', function(e) {
    if (colCtxMenu.classList.contains('open') && !colCtxMenu.contains(e.target)) closeCtxMenu();
  });

  modalClose.addEventListener('click', closePlanModal);
  modalBackdrop.addEventListener('click', function(e) { if (e.target === modalBackdrop) closePlanModal(); });
  planCards.forEach(function(card) {
    card.addEventListener('click', function() { selectPlan(card.getAttribute('data-plan')); });
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closeCreateModal(); closePlanModal(); closeCtxMenu(); closeSidebar(); }
    if (e.key === 'Enter' && createModal.classList.contains('open')) saveCollection();
  });
}

function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

function openCreateModal() {
  editingColId   = null;
  selectedPhotoIds = [];
  currentVisibility = 'private';

  createModalTitle.textContent = 'New Collection';
  colNameInput.value = '';
  saveColBtn.textContent = 'Save Collection';

  visBtns.forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-vis') === 'private');
  });

  renderPhotoPicker();
  createModal.classList.add('open');
  setTimeout(function() { colNameInput.focus(); }, 100);
}

function openRenameModal(id) {
  const col = findCollection(id);
  if (!col) return;
  editingColId  = id;
  selectedPhotoIds = col.photoIds.slice();
  currentVisibility = col.visibility;

  createModalTitle.textContent = 'Edit Collection';
  colNameInput.value = col.name;
  saveColBtn.textContent = 'Update Collection';

  visBtns.forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-vis') === col.visibility);
  });

  renderPhotoPicker();
  createModal.classList.add('open');
  setTimeout(function() { colNameInput.focus(); }, 100);
}

function closeCreateModal() {
  createModal.classList.remove('open');
  editingColId = null;
  selectedPhotoIds = [];
}

function saveCollection() {
  const name = colNameInput.value.trim();
  if (!name) { showToast('Please enter a collection name.', 'error'); colNameInput.focus(); return; }

  const now = new Date();

  if (editingColId) {
    const col = findCollection(editingColId);
    if (col) {
      col.name       = name;
      col.visibility = currentVisibility;
      col.photoIds   = selectedPhotoIds.slice();
      col.modifiedAt = now;
    }
    showToast('Collection updated.', 'success');
  } else {
    collections.push({
      id:         'col_' + Date.now(),
      name:       name,
      visibility: currentVisibility,
      photoIds:   selectedPhotoIds.slice(),
      createdAt:  now,
      modifiedAt: now
    });
    showToast('Collection "' + name + '" created!', 'success');
  }

  saveState();
  closeCreateModal();
  renderGrid();
}

function renderPhotoPicker() {
  if (photos.length === 0) {
    photoPicker.innerHTML = '<p class="picker-empty">No photos in your library yet. <a href="library.html">Upload some first.</a></p>';
    return;
  }

  let html = '';
  photos.forEach(function(p) {
    const sel = selectedPhotoIds.indexOf(p.id) !== -1;
    html += '<div class="picker-thumb' + (sel ? ' selected' : '') + '" data-pick="' + escapeHtml(p.id) + '">';
    html += '<img src="' + p.src + '" alt="' + escapeHtml(p.name) + '" loading="lazy" />';
    html += '</div>';
  });
  photoPicker.innerHTML = html;

  photoPicker.addEventListener('click', function(e) {
    const thumb = e.target.closest('[data-pick]');
    if (!thumb) return;
    const pid = thumb.getAttribute('data-pick');
    let idx = selectedPhotoIds.indexOf(pid);
    if (idx === -1) selectedPhotoIds.push(pid);
    else            selectedPhotoIds.splice(idx, 1);
    thumb.classList.toggle('selected', idx === -1);
    renderPhotoPicker();
  });
}

function deleteCollection(id) {
  collections = collections.filter(function(c) { return c.id !== id; });
  saveState();
  renderGrid();
  showToast('Collection deleted.', '');
}

function shareCollection(id) {
  const col = findCollection(id);
  if (!col) return;

  const fallbackUrl = window.location.href.replace('collections.html', '') + 'collection.html?id=' + col.id;
  copyToClipboard(fallbackUrl);
  showToast('Share link copied to clipboard!', 'success');
}

function openCtxMenu(id, x, y) {
  activeColId = id;
  colCtxMenu.style.left = x + 'px';
  colCtxMenu.style.top  = y + 'px';
  colCtxMenu.classList.add('open');
  const rect = colCtxMenu.getBoundingClientRect();
  if (rect.right  > window.innerWidth)  colCtxMenu.style.left = (x - rect.width)  + 'px';
  if (rect.bottom > window.innerHeight) colCtxMenu.style.top  = (y - rect.height) + 'px';
}
function closeCtxMenu() { colCtxMenu.classList.remove('open'); activeColId = null; }

function closePlanModal() { modalBackdrop.classList.remove('open'); }
function selectPlan(plan) {
  if (!PLANS[plan]) return;
  currentPlan = plan;
  localStorage.setItem('ag_plan', currentPlan);
  renderStorageBars();
  closePlanModal();
  showToast('Switched to ' + PLANS[plan].label + '.', 'success');
}

function render() {
  renderStorageBars();
  renderGrid();
}

function renderStorageBars() {
  const limit = PLANS[currentPlan].limit;
  const used  = photos.length;
  const pct   = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  sidebarFill.style.width = pct + '%';
  sidebarText.textContent = used + ' / ' + limit + ' photos';
  swPct.innerHTML    = pct + '<sup>%</sup>';
  swFill.style.width = pct + '%';
  swCaption.textContent = used + ' of ' + limit + ' photos used.' + (pct >= 80 ? ' Consider upgrading.' : '');
  if (mobStorageCount) mobStorageCount.innerHTML = used + '<span>/ ' + limit + ' photos used</span>';
  if (mobStoragePct)   mobStoragePct.textContent  = pct + '%';
  if (mobBarFill)      mobBarFill.style.width      = pct + '%';
}

function getSortedFiltered() {
  let list = collections.slice();

  if (currentFilter !== 'all') {
    list = list.filter(function(c) { return c.visibility === currentFilter; });
  }

  list.sort(function(a, b) {
    if (currentSort === 'created')  return new Date(b.createdAt)  - new Date(a.createdAt);
    if (currentSort === 'modified') return new Date(b.modifiedAt) - new Date(a.modifiedAt);
    if (currentSort === 'alpha')    return a.name.localeCompare(b.name);
    return 0;
  });

  return list;
}

function formatDateMeta(col) {
  if (currentSort === 'created') {
    return 'Created ' + relativeDate(col.createdAt);
  }
  if (currentSort === 'alpha') {
    return col.photoIds.length + ' item' + (col.photoIds.length !== 1 ? 's' : '');
  }
  return col.photoIds.length + ' item' + (col.photoIds.length !== 1 ? 's' : '') +
         ' \u00b7 Last updated ' + relativeDate(col.modifiedAt);
}

function relativeDate(date) {
  const now  = new Date();
  const diff = Math.floor((now - new Date(date)) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400)  return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderGrid() {
  const list = getSortedFiltered();

  if (list.length === 0 && collections.length === 0) {
    emptyState.style.display = 'block';
    colGrid.innerHTML = '';
    return;
  }
  emptyState.style.display = 'none';

  let html = '';
  list.forEach(function(col, i) {
    const thumbPhotos = col.photoIds.slice(0, 4).map(function(pid) {
      return photos.find(function(p) { return p.id === pid; }) || null;
    }).filter(Boolean);

    html += '<div class="col-card" style="animation-delay:' + (i * 0.05) + 's" data-col-id="' + escapeHtml(col.id) + '">';

    html += '<div class="col-mosaic">';
    for (let m = 0; m < 4; m++) {
      if (thumbPhotos[m]) {
        html += '<img class="col-mosaic-img" src="' + thumbPhotos[m].src + '" alt="" loading="lazy" />';
      } else {
        html += '<div class="col-mosaic-placeholder">&#128247;</div>';
      }
    }
    html += '</div>';

    html += '<div class="col-card-body">';
    html += '<div class="col-card-header">';
    html += '<div class="col-card-name">' + escapeHtml(col.name) + '</div>';
    html += '<button class="col-card-menu" data-menu-col="' + escapeHtml(col.id) + '" title="Options">&#8942;</button>';
    html += '</div>';
    html += '<div class="col-card-meta">' + escapeHtml(formatDateMeta(col)) + '</div>';
    html += '<span class="col-vis-badge ' + col.visibility + '">' +
            (col.visibility === 'shared' ? '&#128279; Shared' : '&#128274; Private') + '</span>';
    html += '</div>';

    html += '</div>';
  });

  html += '<button class="col-card-new" id="newColCard">';
  html += '<div class="col-card-new-icon">+</div>';
  html += '<span class="col-card-new-label">New Collection</span>';
  html += '</button>';

  colGrid.removeEventListener('click', gridClickHandler);
  colGrid.innerHTML = html;
  colGrid.addEventListener('click', gridClickHandler);
}

function gridClickHandler(e) {
  const menuBtn = e.target.closest('[data-menu-col]');
  if (menuBtn) {
    e.stopPropagation();
    const id   = menuBtn.getAttribute('data-menu-col');
    const rect = menuBtn.getBoundingClientRect();
    openCtxMenu(id, rect.left, rect.bottom + 4);
    return;
  }

  const newCard = e.target.closest('#newColCard');
  if (newCard) { openCreateModal(); return; }

  if (!colCtxMenu.classList.contains('open')) {
    const card = e.target.closest('.col-card');
    if (card) {
  }
}

function findCollection(id) {
  for (let i = 0; i < collections.length; i++) { if (collections[i].id === id) return collections[i]; }
  return null;
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    const el = document.createElement('textarea');
    el.value = text; document.body.appendChild(el);
    el.select(); document.execCommand('copy');
    document.body.removeChild(el);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showToast(msg, type) {
  toast.textContent = msg;
  toast.className   = 'toast ' + (type || '') + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 3000);
}

init();
