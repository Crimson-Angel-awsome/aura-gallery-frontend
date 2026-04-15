/* 
   Aura Gallery — library.js
   Pure vanilla JavaScript, zero dependencies
   */

'use strict';

/* PLAN CONFIG */
const PLANS = {
  basic:   { label: 'Basic Plan',   limit: 10  },
  premium: { label: 'Premium Plan', limit: 50  },
  diamond: { label: 'Diamond Plan', limit: 100 }
};

/* STATE
   photos = [{ id, name, src, uploadedAt }] */
let currentPlan = 'basic';
let photos      = [];
let toastTimer  = null;

/* DOM REFS */
const uploadBtn         = document.getElementById('uploadBtn');
const fileInput         = document.getElementById('fileInput');
const photoFeed         = document.getElementById('photoFeed');
const emptyState        = document.getElementById('emptyState');
const planPillText      = document.getElementById('planPillText');
const upgradeBtn        = document.getElementById('upgradeBtn');
const modalBackdrop     = document.getElementById('modalBackdrop');
const modalClose        = document.getElementById('modalClose');
const lightbox          = document.getElementById('lightbox');
const lbClose           = document.getElementById('lbClose');
const lbImg             = document.getElementById('lbImg');
const lbMeta            = document.getElementById('lbMeta');
const toast             = document.getElementById('toast');
const sidebarFill       = document.getElementById('sidebarStorageFill');
const sidebarText       = document.getElementById('sidebarStorageText');
const swPct             = document.getElementById('swPct');
const swFill            = document.getElementById('swFill');
const swCaption         = document.getElementById('swCaption');
const planCards         = document.querySelectorAll('.plan-card');

/* INIT */
function init() {
  loadState();
  bindEvents();
  render();
}

/* PERSIST — localStorage */
function saveState() {
  try {
    localStorage.setItem('ag_plan', currentPlan);
    localStorage.setItem('ag_photos', JSON.stringify(photos));
  } catch (e) {
    /* quota exceeded — skip */
  }
}

function loadState() {
  const savedPlan = localStorage.getItem('ag_plan');
  if (savedPlan && PLANS[savedPlan]) currentPlan = savedPlan;

  try {
    const raw = JSON.parse(localStorage.getItem('ag_photos') || '[]');
    photos = raw.map(function(p) {
      return {
        id:         p.id,
        name:       p.name,
        src:        p.src,
        uploadedAt: new Date(p.uploadedAt)
      };
    });
  } catch (e) {
    photos = [];
  }
}

/* BIND EVENTS */
function bindEvents() {
  /* Upload button opens file picker */
  uploadBtn.addEventListener('click', function() {
    fileInput.click();
  });

  /* File picker change */
  fileInput.addEventListener('change', function(e) {
    handleUpload(e.target.files);
    e.target.value = ''; /* reset so same file can be re-chosen */
  });

  /* Upgrade modal open */
  upgradeBtn.addEventListener('click', function() {
    openModal();
  });

  /* Modal close — button */
  modalClose.addEventListener('click', function() {
    closeModal();
  });

  /* Modal close — backdrop click */
  modalBackdrop.addEventListener('click', function(e) {
    if (e.target === modalBackdrop) closeModal();
  });

  /* Plan card selection */
  planCards.forEach(function(card) {
    card.addEventListener('click', function() {
      const plan = card.getAttribute('data-plan');
      selectPlan(plan);
    });
  });

  /* Lightbox close — button */
  lbClose.addEventListener('click', function() {
    closeLightbox();
  });

  /* Lightbox close — click outside image */
  lightbox.addEventListener('click', function(e) {
    if (e.target === lightbox) closeLightbox();
  });

  /* Keyboard — Escape */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeLightbox();
      closeModal();
    }
  });
}

/* UPLOAD HANDLER */
function handleUpload(files) {
  if (!files || files.length === 0) return;

  const limit   = PLANS[currentPlan].limit;
  const slots   = limit - photos.length;

  if (slots <= 0) {
    showToast('Storage full. Please upgrade your plan.', 'error');
    return;
  }

  const fileArray = Array.prototype.slice.call(files);
  const allowed   = fileArray.slice(0, slots);
  const skipped   = fileArray.length - allowed.length;
  let loaded    = 0;
  let added     = 0;

  allowed.forEach(function(file) {
    if (!file.type.startsWith('image/')) {
      loaded++;
      checkDone();
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      photos.push({
        id:         Date.now() + '_' + Math.floor(Math.random() * 100000),
        name:       file.name,
        src:        e.target.result,
        uploadedAt: new Date()
      });
      added++;
      loaded++;
      checkDone();
    };
    reader.onerror = function() {
      loaded++;
      checkDone();
    };
    reader.readAsDataURL(file);
  });

  function checkDone() {
    if (loaded < allowed.length) return;
    saveState();
    render();

    if (skipped > 0) {
      showToast(added + ' photo(s) added. ' + skipped + ' skipped — limit reached.', 'error');
    } else {
      showToast(added + ' photo(s) uploaded.', 'success');
    }
  }
}

/* DELETE PHOTO */
function deletePhoto(id) {
  photos = photos.filter(function(p) { return p.id !== id; });
  saveState();
  render();
  showToast('Photo removed.', '');
}

/* SELECT PLAN */
function selectPlan(plan) {
  if (!PLANS[plan]) return;

  const newLimit = PLANS[plan].limit;
  currentPlan  = plan;

  if (photos.length > newLimit) {
    const removed = photos.length - newLimit;
    photos = photos.slice(0, newLimit);
    showToast('Plan changed. ' + removed + ' photo(s) removed to fit new limit.', 'error');
  } else {
    showToast('Switched to ' + PLANS[plan].label + '. Limit: ' + newLimit + ' photos.', 'success');
  }

  saveState();
  render();
  closeModal();
}

/* DATE GROUPING */
function getDateLabel(date) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d     = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff  = Math.round((today.getTime() - d.getTime()) / 86400000);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';

  return date.toLocaleDateString('en-GB', {
    day:   'numeric',
    month: 'long',
    year:  'numeric'
  });
}

function groupPhotosByDate(list) {
  /* Sort newest first */
  const sorted = list.slice().sort(function(a, b) {
    return new Date(b.uploadedAt) - new Date(a.uploadedAt);
  });

  const groups = {};
  const order  = [];

  sorted.forEach(function(photo) {
    const label = getDateLabel(new Date(photo.uploadedAt));
    if (!groups[label]) {
      groups[label] = [];
      order.push(label);
    }
    groups[label].push(photo);
  });

  return { groups: groups, order: order };
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-GB', {
    hour:   '2-digit',
    minute: '2-digit'
  });
}

/* LIGHTBOX */
function openLightbox(id) {
  let photo = null;
  for (let i = 0; i < photos.length; i++) {
    if (photos[i].id === id) { photo = photos[i]; break; }
  }
  if (!photo) return;

  lbImg.src        = photo.src;
  lbImg.alt        = photo.name;
  lbMeta.textContent =
    photo.name + '  ·  ' + new Date(photo.uploadedAt).toLocaleString('en-GB');
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  lbImg.src = '';
  document.body.style.overflow = '';
}

/* MODAL */
function openModal() {
  /* Highlight current plan */
  planCards.forEach(function(card) {
    const p = card.getAttribute('data-plan');
    card.classList.toggle('current', p === currentPlan);
  });
  modalBackdrop.classList.add('open');
}

function closeModal() {
  modalBackdrop.classList.remove('open');
}

/* RENDER */
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

  /* Sidebar */
  sidebarFill.style.width  = pct + '%';
  sidebarText.textContent  = used + ' / ' + limit + ' photos';

  /* Bottom widget */
  swPct.innerHTML          = pct + '<sup>%</sup>';
  swFill.style.width       = pct + '%';
  swCaption.textContent    = used + ' of ' + limit + ' photos used.' +
    (pct >= 80 ? ' Consider upgrading.' : '');
}

function renderFeed() {
  if (photos.length === 0) {
    emptyState.style.display = 'block';
    photoFeed.innerHTML      = '';
    return;
  }

  emptyState.style.display = 'none';

  const result = groupPhotosByDate(photos);
  let html   = '';

  result.order.forEach(function(label) {
    var group = result.groups[label];
    html += '<div class="date-group">';
    html += '<div class="date-label">';
    html += escapeHtml(label);
    html += '<span class="date-count">' + group.length +
            (group.length === 1 ? ' photo' : ' photos') + '</span>';
    html += '</div>';
    html += '<div class="photo-grid">';

    group.forEach(function(photo, i) {
      html += '<div class="photo-item" style="animation-delay:' + (i * 0.04) + 's"' +
              ' data-id="' + escapeHtml(photo.id) + '">';
      html += '<img src="' + photo.src + '" alt="' + escapeHtml(photo.name) +
              '" loading="lazy" />';
      html += '<div class="photo-overlay">';
      html += '<span class="photo-time">' + formatTime(photo.uploadedAt) + '</span>';
      html += '</div>';
      html += '<button class="photo-del" data-del="' + escapeHtml(photo.id) +
              '" title="Remove">&#10005;</button>';
      html += '</div>';
    });

    html += '</div></div>';
  });

  photoFeed.innerHTML = html;

  /* Attach events after rendering — event delegation on photoFeed */
  photoFeed.addEventListener('click', feedClickHandler);
}

/* Single delegated click handler for the feed */
function feedClickHandler(e) {
  /* Delete button */
  var delBtn = e.target.closest('[data-del]');
  if (delBtn) {
    e.stopPropagation();
    deletePhoto(delBtn.getAttribute('data-del'));
    return;
  }

  /* Photo click → lightbox */
  var item = e.target.closest('.photo-item');
  if (item) {
    openLightbox(item.getAttribute('data-id'));
  }
}

/* TOAST */
function showToast(msg, type) {
  toast.textContent = msg;
  toast.className   = 'toast ' + (type || '') + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() {
    toast.classList.remove('show');
  }, 3000);
}

/* UTILS */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/* BOOT */
init();
