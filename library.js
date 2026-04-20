'use strict';

const API = {
  upload:   'https://127.0.0:8081/photos/upload',
  delete:   'https://127.0.0:8081/photos/{photos_id}',
  share:    'https://127.0.0:8081/share/{collection_id}'
};

const PLANS = {
  basic:   { label: 'Basic Plan',   limit: 10  },
  premium: { label: 'Premium Plan', limit: 50  },
  diamond: { label: 'Diamond Plan', limit: 100 }
};

let currentPlan    = 'basic';
let photos         = [];
let toastTimer     = null;
let activeMenuId   = null;

const uploadBtn       = document.getElementById('uploadBtn');
const fileInput       = document.getElementById('fileInput');
const photoFeed       = document.getElementById('photoFeed');
const emptyState      = document.getElementById('emptyState');
const planPillText    = document.getElementById('planPillText');
const upgradeBtn      = document.getElementById('upgradeBtn');
const modalBackdrop   = document.getElementById('modalBackdrop');
const modalClose      = document.getElementById('modalClose');
const lightbox        = document.getElementById('lightbox');
const lbClose         = document.getElementById('lbClose');
const lbImg           = document.getElementById('lbImg');
const lbMeta          = document.getElementById('lbMeta');
const toast           = document.getElementById('toast');
const sidebarFill     = document.getElementById('sidebarStorageFill');
const sidebarText     = document.getElementById('sidebarStorageText');
const swPct           = document.getElementById('swPct');
const swFill          = document.getElementById('swFill');
const swCaption       = document.getElementById('swCaption');
const planCards       = document.querySelectorAll('.plan-card');
const photoCtxMenu    = document.getElementById('photoCtxMenu');
const ctxShare        = document.getElementById('ctxShare');
const ctxDelete       = document.getElementById('ctxDelete');

const mobFab          = document.getElementById('mobFab');
const mobStorageCount = document.getElementById('mobStorageCount');
const mobStoragePct   = document.getElementById('mobStoragePct');
const mobBarFill      = document.getElementById('mobBarFill');

const sidebar         = document.getElementById('sidebar');
const sidebarOverlay  = document.getElementById('sidebarOverlay');
const hamburger       = document.getElementById('hamburger');
const sidebarClose    = document.getElementById('sidebarClose');

function init() {
  loadState();
  bindEvents();
  render();
}

function saveState() {
  try {
    localStorage.setItem('ag_plan',   currentPlan);
    localStorage.setItem('ag_photos', JSON.stringify(photos));
  } catch (e) { }
}

function loadState() {
  const savedPlan = localStorage.getItem('ag_plan');
  if (savedPlan && PLANS[savedPlan]) currentPlan = savedPlan;
  try {
    const raw = JSON.parse(localStorage.getItem('ag_photos') || '[]');
    photos = raw.map(function(p) {
      return { id: p.id, name: p.name, src: p.src, uploadedAt: new Date(p.uploadedAt), cloudId: p.cloudId || null };
    });
  } catch (e) { photos = []; }
}

function bindEvents() {
  uploadBtn.addEventListener('click', function() { fileInput.click(); });
  if (mobFab) mobFab.addEventListener('click', function() { fileInput.click(); });
  fileInput.addEventListener('change', function(e) {
    handleUpload(e.target.files);
    e.target.value = '';
  });

  hamburger.addEventListener('click', openSidebar);
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  upgradeBtn.addEventListener('click', openPlanModal);
  modalClose.addEventListener('click', closePlanModal);
  modalBackdrop.addEventListener('click', function(e) {
    if (e.target === modalBackdrop) closePlanModal();
  });

  planCards.forEach(function(card) {
    card.addEventListener('click', function() { selectPlan(card.getAttribute('data-plan')); });
  });

  lbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function(e) { if (e.target === lightbox) closeLightbox(); });


  ctxShare.addEventListener('click', function() {
    if (activeMenuId) sharePhoto(activeMenuId);
    closeCtxMenu();
  });
  ctxDelete.addEventListener('click', function() {
    if (activeMenuId) deletePhoto(activeMenuId);
    closeCtxMenu();
  });

  document.addEventListener('click', function(e) {
    if (photoCtxMenu.classList.contains('open') && !photoCtxMenu.contains(e.target)) {
      closeCtxMenu();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closeLightbox(); closePlanModal(); closeCtxMenu(); closeSidebar(); }
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

function handleUpload(files) {
  if (!files || files.length === 0) return;
  const limit   = PLANS[currentPlan].limit;
  const slots   = limit - photos.length;
  if (slots <= 0) { showToast('Storage full. Please upgrade your plan.', 'error'); return; }

  const fileArray = Array.prototype.slice.call(files);
  const allowed   = fileArray.slice(0, slots);
  const skipped   = fileArray.length - allowed.length;
  let loaded    = 0;
  let added     = 0;

  allowed.forEach(function(file) {
    if (!file.type.startsWith('image/')) { loaded++; checkDone(); return; }

    const reader = new FileReader();
    reader.onload = function(e) {
      const photo = {
        id:         Date.now() + '_' + Math.floor(Math.random() * 100000),
        name:       file.name,
        src:        e.target.result,
        uploadedAt: new Date(),
        cloudId:    null
      };
      photos.push(photo);
      added++;
      loaded++;

      checkDone();
    };
    reader.onerror = function() { loaded++; checkDone(); };
    reader.readAsDataURL(file);
  });

  function checkDone() {
    if (loaded < allowed.length) return;
    saveState(); render();
    if (skipped > 0) showToast(added + ' added. ' + skipped + ' skipped — limit reached.', 'error');
    else             showToast(added + ' photo(s) uploaded.', 'success');
  }
}

function deletePhoto(id) {
  const photo = findPhoto(id);

  photos = photos.filter(function(p) { return p.id !== id; });
  saveState(); render();
  showToast('Photo removed.', '');
}

function sharePhoto(id) {
  const photo = findPhoto(id);
  if (!photo) return;

  const fallbackUrl = window.location.href + '#photo-' + photo.id;
  copyToClipboard(fallbackUrl);
  showToast('Share link copied to clipboard!', 'success');
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

function openCtxMenu(id, x, y) {
  activeMenuId = id;
  photoCtxMenu.style.left = x + 'px';
  photoCtxMenu.style.top  = y + 'px';

  photoCtxMenu.classList.add('open');
  const rect = photoCtxMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth)  photoCtxMenu.style.left = (x - rect.width) + 'px';
  if (rect.bottom > window.innerHeight) photoCtxMenu.style.top = (y - rect.height) + 'px';
}

function closeCtxMenu() {
  photoCtxMenu.classList.remove('open');
  activeMenuId = null;
}

function openPlanModal() {
  planCards.forEach(function(card) {
    card.classList.toggle('current', card.getAttribute('data-plan') === currentPlan);
  });
  modalBackdrop.classList.add('open');
}
function closePlanModal() { modalBackdrop.classList.remove('open'); }

function selectPlan(plan) {
  if (!PLANS[plan]) return;
  const newLimit = PLANS[plan].limit;
  currentPlan  = plan;
  if (photos.length > newLimit) {
    const removed = photos.length - newLimit;
    photos = photos.slice(0, newLimit);
    showToast('Plan changed. ' + removed + ' photo(s) removed.', 'error');
  } else {
    showToast('Switched to ' + PLANS[plan].label + '. Limit: ' + newLimit + ' photos.', 'success');
  }
  saveState(); render(); closePlanModal();
}

function openLightbox(id) {
  const photo = findPhoto(id);
  if (!photo) return;
  lbImg.src = photo.src; lbImg.alt = photo.name;
  lbMeta.textContent = photo.name + '  ·  ' + new Date(photo.uploadedAt).toLocaleString('en-GB');
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightbox.classList.remove('open');
  lbImg.src = ''; document.body.style.overflow = '';
}

function getDateLabel(date) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d     = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff  = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupPhotosByDate(list) {
  const sorted = list.slice().sort(function(a, b) { return new Date(b.uploadedAt) - new Date(a.uploadedAt); });
  const groups = {}; 
  const order = [];
  sorted.forEach(function(p) {
    const label = getDateLabel(new Date(p.uploadedAt));
    if (!groups[label]) { groups[label] = []; order.push(label); }
    groups[label].push(p);
  });
  return { groups: groups, order: order };
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function render() {
  renderPlanPill();
  renderStorageBars();
  renderFeed();
}

function renderPlanPill() {
  const plan = PLANS[currentPlan];
  planPillText.textContent = plan.label + ' \u00b7 ' + plan.limit + ' photos';
}

function renderStorageBars() {
  const limit = PLANS[currentPlan].limit;
  const used  = photos.length;
  const pct   = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  sidebarFill.style.width = pct + '%';
  sidebarText.textContent = used + ' / ' + limit + ' photos';

  swPct.innerHTML     = pct + '<sup>%</sup>';
  swFill.style.width  = pct + '%';
  swCaption.textContent = used + ' of ' + limit + ' photos used.' + (pct >= 80 ? ' Consider upgrading.' : '');

  if (mobStorageCount) mobStorageCount.innerHTML = used + '<span>/ ' + limit + ' photos used</span>';
  if (mobStoragePct)   mobStoragePct.textContent  = pct + '%';
  if (mobBarFill)      mobBarFill.style.width      = pct + '%';
}

function renderFeed() {
  if (photos.length === 0) {
    emptyState.style.display = 'block';
    photoFeed.innerHTML = '';
    return;
  }
  emptyState.style.display = 'none';

  const result = groupPhotosByDate(photos);
  let html   = '';

  result.order.forEach(function(label) {
    const group = result.groups[label];
    html += '<div class="date-group">';
    html += '<div class="date-label">' + escapeHtml(label);
    html += '<span class="date-count">' + group.length + (group.length === 1 ? ' photo' : ' photos') + '</span>';
    html += '</div>';
    html += '<div class="photo-grid">';

    group.forEach(function(photo, i) {
      html += '<div class="photo-item" style="animation-delay:' + (i * 0.04) + 's" data-id="' + escapeHtml(photo.id) + '">';
      html += '<img src="' + photo.src + '" alt="' + escapeHtml(photo.name) + '" loading="lazy" />';
      html += '<div class="photo-overlay"><span class="photo-time">' + formatTime(photo.uploadedAt) + '</span></div>';
      html += '<button class="photo-menu-btn" data-menu="' + escapeHtml(photo.id) + '" title="Options">&#8942;</button>';
      html += '</div>';
    });

    html += '</div></div>';
  });

  /* Remove old listener before re-adding */
  photoFeed.removeEventListener('click', feedClickHandler);
  photoFeed.innerHTML = html;
  photoFeed.addEventListener('click', feedClickHandler);
}

function feedClickHandler(e) {
  const menuBtn = e.target.closest('[data-menu]');
  if (menuBtn) {
    e.stopPropagation();
    const id   = menuBtn.getAttribute('data-menu');
    const rect = menuBtn.getBoundingClientRect();
    openCtxMenu(id, rect.left, rect.bottom + 4);
    return;
  }
  if (!photoCtxMenu.classList.contains('open')) {
    const item = e.target.closest('.photo-item');
    if (item) openLightbox(item.getAttribute('data-id'));
  }
}

function findPhoto(id) {
  for (let i = 0; i < photos.length; i++) { if (photos[i].id === id) return photos[i]; }
  return null;
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
