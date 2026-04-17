/* Aura Gallery — collections.js
   Pure vanilla JS, zero dependencies */

'use strict';

/* ─────────────────────────────────────────
   ENDPOINT CONFIG
───────────────────────────────────────── */
var API = {
  shareCollection: ''   /* POST — generate shareable URL for a collection.
                           e.g. 'https://api.auragallery.com/collections/:id/share'
                           Expected response: { url: 'https://...' }            */
};

/* ─────────────────────────────────────────
   PLAN CONFIG (mirrors library)
───────────────────────────────────────── */
var PLANS = {
  basic:   { label: 'Basic Plan',   limit: 10  },
  premium: { label: 'Premium Plan', limit: 50  },
  diamond: { label: 'Diamond Plan', limit: 100 }
};

/* ─────────────────────────────────────────
   STATE
   collection = {
     id, name, visibility ('private'|'shared'),
     photoIds[], createdAt, modifiedAt
   }
───────────────────────────────────────── */
var currentPlan  = 'basic';
var photos       = [];          /* from library localStorage */
var collections  = [];
var currentFilter = 'all';
var currentSort   = 'modified';
var activeColId   = null;       /* id of collection whose context menu is open */
var editingColId  = null;       /* null = creating, string = renaming */
var selectedPhotoIds = [];      /* photo ids selected in the picker */
var currentVisibility = 'private';
var toastTimer = null;

/* ─────────────────────────────────────────
   DOM REFS
───────────────────────────────────────── */
var colGrid        = document.getElementById('colGrid');
var emptyState     = document.getElementById('emptyState');
var sortSelect     = document.getElementById('sortSelect');
var filterTabs     = document.querySelectorAll('.filter-tab');
var createBtn      = document.getElementById('createBtn');
var createBtnMob   = document.getElementById('createBtnMob');
var mobFab         = document.getElementById('mobFab');

var createModal      = document.getElementById('createModal');
var createModalClose = document.getElementById('createModalClose');
var createModalTitle = document.getElementById('createModalTitle');
var colNameInput     = document.getElementById('colNameInput');
var photoPicker      = document.getElementById('photoPicker');
var photoPickerWrap  = document.getElementById('photoPickerWrap');
var saveColBtn       = document.getElementById('saveColBtn');
var visBtns          = document.querySelectorAll('.vis-btn');

var colCtxMenu    = document.getElementById('colCtxMenu');
var ctxRename     = document.getElementById('ctxRename');
var ctxShare      = document.getElementById('ctxShare');
var ctxDelete     = document.getElementById('ctxDelete');

var modalBackdrop = document.getElementById('modalBackdrop');
var modalClose    = document.getElementById('modalClose');
var planCards     = document.querySelectorAll('.plan-card');

var sidebar       = document.getElementById('sidebar');
var sidebarOverlay= document.getElementById('sidebarOverlay');
var hamburger     = document.getElementById('hamburger');
var sidebarClose  = document.getElementById('sidebarClose');
var toast         = document.getElementById('toast');

var sidebarFill   = document.getElementById('sidebarStorageFill');
var sidebarText   = document.getElementById('sidebarStorageText');
var swPct         = document.getElementById('swPct');
var swFill        = document.getElementById('swFill');
var swCaption     = document.getElementById('swCaption');
var mobStorageCount = document.getElementById('mobStorageCount');
var mobStoragePct   = document.getElementById('mobStoragePct');
var mobBarFill      = document.getElementById('mobBarFill');

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
function init() {
  loadState();
  bindEvents();
  render();
}

/* ─────────────────────────────────────────
   PERSIST
───────────────────────────────────────── */
function saveState() {
  try {
    localStorage.setItem('ag_collections', JSON.stringify(collections));
  } catch (e) { /* quota exceeded */ }
}

function loadState() {
  /* Load plan + photos from library storage */
  var savedPlan = localStorage.getItem('ag_plan');
  if (savedPlan && PLANS[savedPlan]) currentPlan = savedPlan;

  try {
    var rawPhotos = JSON.parse(localStorage.getItem('ag_photos') || '[]');
    photos = rawPhotos.map(function(p) {
      return { id: p.id, name: p.name, src: p.src, uploadedAt: new Date(p.uploadedAt) };
    });
  } catch (e) { photos = []; }

  /* Load collections */
  try {
    var rawCols = JSON.parse(localStorage.getItem('ag_collections') || '[]');
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

/* ─────────────────────────────────────────
   BIND EVENTS
───────────────────────────────────────── */
function bindEvents() {
  /* Sidebar */
  hamburger.addEventListener('click',     openSidebar);
  sidebarClose.addEventListener('click',  closeSidebar);
  sidebarOverlay.addEventListener('click',closeSidebar);

  /* Create collection */
  createBtn.addEventListener('click',    function() { openCreateModal(); });
  createBtnMob.addEventListener('click', function() { openCreateModal(); });
  mobFab.addEventListener('click',       function() { openCreateModal(); });

  /* Create modal controls */
  createModalClose.addEventListener('click', closeCreateModal);
  createModal.addEventListener('click', function(e) { if (e.target === createModal) closeCreateModal(); });
  saveColBtn.addEventListener('click', saveCollection);

  /* Visibility toggle */
  visBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      visBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentVisibility = btn.getAttribute('data-vis');
    });
  });

  /* Sort */
  sortSelect.addEventListener('change', function() {
    currentSort = sortSelect.value;
    renderGrid();
  });

  /* Filter tabs */
  filterTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      filterTabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentFilter = tab.getAttribute('data-filter');
      renderGrid();
    });
  });

  /* Collection context menu actions */
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

  /* Close ctx menu on outside click */
  document.addEventListener('click', function(e) {
    if (colCtxMenu.classList.contains('open') && !colCtxMenu.contains(e.target)) closeCtxMenu();
  });

  /* Upgrade modal */
  modalClose.addEventListener('click', closePlanModal);
  modalBackdrop.addEventListener('click', function(e) { if (e.target === modalBackdrop) closePlanModal(); });
  planCards.forEach(function(card) {
    card.addEventListener('click', function() { selectPlan(card.getAttribute('data-plan')); });
  });

  /* Keyboard */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closeCreateModal(); closePlanModal(); closeCtxMenu(); closeSidebar(); }
    if (e.key === 'Enter' && createModal.classList.contains('open')) saveCollection();
  });
}

/* ─────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────── */
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

/* ─────────────────────────────────────────
   CREATE / RENAME MODAL
───────────────────────────────────────── */
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
  var col = findCollection(id);
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
  var name = colNameInput.value.trim();
  if (!name) { showToast('Please enter a collection name.', 'error'); colNameInput.focus(); return; }

  var now = new Date();

  if (editingColId) {
    /* Update existing */
    var col = findCollection(editingColId);
    if (col) {
      col.name       = name;
      col.visibility = currentVisibility;
      col.photoIds   = selectedPhotoIds.slice();
      col.modifiedAt = now;
    }
    showToast('Collection updated.', 'success');
  } else {
    /* Create new */
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

/* ─────────────────────────────────────────
   PHOTO PICKER (inside create/edit modal)
───────────────────────────────────────── */
function renderPhotoPicker() {
  if (photos.length === 0) {
    photoPicker.innerHTML = '<p class="picker-empty">No photos in your library yet. <a href="library.html">Upload some first.</a></p>';
    return;
  }

  var html = '';
  photos.forEach(function(p) {
    var sel = selectedPhotoIds.indexOf(p.id) !== -1;
    html += '<div class="picker-thumb' + (sel ? ' selected' : '') + '" data-pick="' + escapeHtml(p.id) + '">';
    html += '<img src="' + p.src + '" alt="' + escapeHtml(p.name) + '" loading="lazy" />';
    html += '</div>';
  });
  photoPicker.innerHTML = html;

  photoPicker.addEventListener('click', function(e) {
    var thumb = e.target.closest('[data-pick]');
    if (!thumb) return;
    var pid = thumb.getAttribute('data-pick');
    var idx = selectedPhotoIds.indexOf(pid);
    if (idx === -1) selectedPhotoIds.push(pid);
    else            selectedPhotoIds.splice(idx, 1);
    thumb.classList.toggle('selected', idx === -1);
    /* Update checkmark */
    renderPhotoPicker();
  });
}

/* ─────────────────────────────────────────
   DELETE COLLECTION
───────────────────────────────────────── */
function deleteCollection(id) {
  collections = collections.filter(function(c) { return c.id !== id; });
  saveState();
  renderGrid();
  showToast('Collection deleted.', '');
}

/* ─────────────────────────────────────────
   SHARE COLLECTION
───────────────────────────────────────── */
function shareCollection(id) {
  var col = findCollection(id);
  if (!col) return;

  /* ── CLOUD SHARE ──────────────────────────────────────────
     When API.shareCollection is set, POST to your backend:

     fetch(API.shareCollection.replace(':id', col.id), { method: 'POST' })
       .then(function(r) { return r.json(); })
       .then(function(data) {
         copyToClipboard(data.url);
         showToast('Share link copied!', 'success');
       })
       .catch(function() { showToast('Could not generate share link.', 'error'); });
     return;
  ─────────────────────────────────────────────────────────── */

  var fallbackUrl = window.location.href.replace('collections.html', '') + 'collection.html?id=' + col.id;
  copyToClipboard(fallbackUrl);
  showToast('Share link copied to clipboard!', 'success');
}

/* ─────────────────────────────────────────
   CONTEXT MENU
───────────────────────────────────────── */
function openCtxMenu(id, x, y) {
  activeColId = id;
  colCtxMenu.style.left = x + 'px';
  colCtxMenu.style.top  = y + 'px';
  colCtxMenu.classList.add('open');
  var rect = colCtxMenu.getBoundingClientRect();
  if (rect.right  > window.innerWidth)  colCtxMenu.style.left = (x - rect.width)  + 'px';
  if (rect.bottom > window.innerHeight) colCtxMenu.style.top  = (y - rect.height) + 'px';
}
function closeCtxMenu() { colCtxMenu.classList.remove('open'); activeColId = null; }

/* ─────────────────────────────────────────
   PLAN MODAL
───────────────────────────────────────── */
function closePlanModal() { modalBackdrop.classList.remove('open'); }
function selectPlan(plan) {
  if (!PLANS[plan]) return;
  currentPlan = plan;
  localStorage.setItem('ag_plan', currentPlan);
  renderStorageBars();
  closePlanModal();
  showToast('Switched to ' + PLANS[plan].label + '.', 'success');
}

/* ─────────────────────────────────────────
   RENDER
───────────────────────────────────────── */
function render() {
  renderStorageBars();
  renderGrid();
}

function renderStorageBars() {
  var limit = PLANS[currentPlan].limit;
  var used  = photos.length;
  var pct   = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

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
  var list = collections.slice();

  /* Filter */
  if (currentFilter !== 'all') {
    list = list.filter(function(c) { return c.visibility === currentFilter; });
  }

  /* Sort */
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
  /* default: modified */
  return col.photoIds.length + ' item' + (col.photoIds.length !== 1 ? 's' : '') +
         ' \u00b7 Last updated ' + relativeDate(col.modifiedAt);
}

function relativeDate(date) {
  var now  = new Date();
  var diff = Math.floor((now - new Date(date)) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400)  return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderGrid() {
  var list = getSortedFiltered();

  if (list.length === 0 && collections.length === 0) {
    emptyState.style.display = 'block';
    colGrid.innerHTML = '';
    return;
  }
  emptyState.style.display = 'none';

  var html = '';
  list.forEach(function(col, i) {
    /* Get up to 4 photos for mosaic */
    var thumbPhotos = col.photoIds.slice(0, 4).map(function(pid) {
      return photos.find(function(p) { return p.id === pid; }) || null;
    }).filter(Boolean);

    html += '<div class="col-card" style="animation-delay:' + (i * 0.05) + 's" data-col-id="' + escapeHtml(col.id) + '">';

    /* Mosaic */
    html += '<div class="col-mosaic">';
    for (var m = 0; m < 4; m++) {
      if (thumbPhotos[m]) {
        html += '<img class="col-mosaic-img" src="' + thumbPhotos[m].src + '" alt="" loading="lazy" />';
      } else {
        html += '<div class="col-mosaic-placeholder">&#128247;</div>';
      }
    }
    html += '</div>';

    /* Body */
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

  /* "New Collection" placeholder card */
  html += '<button class="col-card-new" id="newColCard">';
  html += '<div class="col-card-new-icon">+</div>';
  html += '<span class="col-card-new-label">New Collection</span>';
  html += '</button>';

  colGrid.removeEventListener('click', gridClickHandler);
  colGrid.innerHTML = html;
  colGrid.addEventListener('click', gridClickHandler);
}

function gridClickHandler(e) {
  /* Three-dot menu */
  var menuBtn = e.target.closest('[data-menu-col]');
  if (menuBtn) {
    e.stopPropagation();
    var id   = menuBtn.getAttribute('data-menu-col');
    var rect = menuBtn.getBoundingClientRect();
    openCtxMenu(id, rect.left, rect.bottom + 4);
    return;
  }

  /* New collection placeholder */
  var newCard = e.target.closest('#newColCard');
  if (newCard) { openCreateModal(); return; }

  /* Collection card click (if ctx menu not open) */
  if (!colCtxMenu.classList.contains('open')) {
    var card = e.target.closest('.col-card');
    if (card) {
      /* Future: navigate into collection view */
    }
  }
}

/* ─────────────────────────────────────────
   UTILS
───────────────────────────────────────── */
function findCollection(id) {
  for (var i = 0; i < collections.length; i++) { if (collections[i].id === id) return collections[i]; }
  return null;
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    var el = document.createElement('textarea');
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

/* ─────────────────────────────────────────
   BOOT
───────────────────────────────────────── */
init();
