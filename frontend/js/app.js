const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : '';
const API_BASE_URL = `${API_BASE}/api`;

const API = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path, body) => request(path, { method: 'DELETE', body }),
};

const DEFAULT_SPORT_ICON = '🏅';

const sportColumns = [
  {
    id: 'badminton',
    name: '羽球',
    icon: '🏸',
    description: '羽球交流、訓練心得、比賽討論專欄',
  },
  {
    id: 'basketball',
    name: '籃球',
    icon: '🏀',
    description: '籃球交流、訓練心得、比賽討論專欄',
  },
  {
    id: 'volleyball',
    name: '排球',
    icon: '🏐',
    description: '排球交流、訓練心得、比賽討論專欄',
  },
  {
    id: 'baseball',
    name: '棒球',
    icon: '⚾',
    description: '棒球交流、訓練心得、比賽討論專欄',
  },
  {
    id: 'soccer',
    name: '足球',
    icon: '⚽',
    description: '足球交流、訓練心得、比賽討論專欄',
  },
  {
    id: 'table-tennis',
    name: '桌球',
    icon: '🏓',
    description: '桌球交流、訓練心得、比賽討論專欄',
  },
  {
    id: 'tennis',
    name: '網球',
    icon: '🎾',
    description: '網球交流、訓練心得、比賽討論專欄',
  },
  {
    id: 'swimming',
    name: '游泳',
    icon: '🏊',
    description: '游泳交流、訓練心得、比賽討論專欄',
  },
  {
    id: 'running',
    name: '跑步',
    icon: '🏃',
    description: '跑步交流、訓練心得、比賽討論專欄',
  },
  {
    id: 'fitness',
    name: '健身',
    icon: '🏋️',
    description: '健身交流、訓練心得、比賽討論專欄',
  },
  {
    id: 'cycling',
    name: '自行車',
    icon: '🚴',
    description: '自行車交流、訓練心得、比賽討論專欄',
  },
];

const BOARD_EMOJI_MAP = sportColumns.reduce((map, sport) => {
  map[sport.name] = sport.icon;
  return map;
}, {
  健身重訓: '🏋️',
  default: DEFAULT_SPORT_ICON,
});

const SPORT_CATEGORIES = {
  '自行車': 'cardio', '游泳': 'cardio', '跑步': 'cardio',
  '排球': 'sport', '棒球': 'sport', '足球': 'sport',
  '桌球': 'sport', '網球': 'sport', '羽球': 'sport', '籃球': 'sport',
  '健身': 'strength',
  '騎車': 'cardio', '游泳': 'cardio', '跑步': 'cardio',
  '極限運動': 'cardio_no_distance',
  '格鬥': 'combat',
  '網球': 'sport', '足球': 'sport', '羽球': 'sport', '籃球': 'sport',
  '健身重訓': 'strength',
};

// Strips leading emoji/symbol characters from a sport_type string (e.g. "🏀 籃球" → "籃球")
function getSportName(text) {
  return String(text || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

function getSportIcon(name) {
  const text = String(name || '').trim();
  const cleanName = getSportName(text);
  // If text already starts with emoji, extract the first one; otherwise look up from map
  const icon = cleanName.length < text.length
    ? [...text.slice(0, text.length - cleanName.length).trimEnd()][0] || getBoardEmoji(cleanName)
    : getBoardEmoji(text);
  return icon ? `<span class="sport-emoji" aria-hidden="true">${escapeHtml(icon)}</span>` : '';
}

function getPostId(post) {
  return post?.id ?? post?.post_id ?? post?.postId ?? post?.item_id ?? '';
}

function getPostDetailUrl(postOrId, hash = '') {
  const postId = typeof postOrId === 'object' ? getPostId(postOrId) : postOrId;
  if (!postId) return '';
  return `/post.html?id=${encodeURIComponent(postId)}${hash}`;
}

function goToPostDetail(postOrId, hash = '') {
  const url = getPostDetailUrl(postOrId, hash);
  if (url) window.location.href = url;
}

function getSportCategory(sportType) {
  return SPORT_CATEGORIES[String(sportType || '').trim()] || 'strength';
}

async function request(path, options = {}) {
  const currentUser = getCurrentUser();
  const config = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
  };

  if (currentUser?.user_id) {
    config.headers['X-User-Id'] = String(currentUser.user_id);
  }

  if (options.body !== undefined) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}

function el(selector) {
  return document.querySelector(selector);
}

function getParams() {
  return new URLSearchParams(window.location.search);
}

function formatDate(value) {
  if (!value) return '未提供';

  return new Date(value).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getCurrentUser() {
  try {
    const stored = localStorage.getItem('sports-platform-user');
    const user = JSON.parse(stored || 'null');
    if (!user || !user.user_id) return null;
    return user;
  } catch (_err) {
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem('sports-platform-user', JSON.stringify(user));
  localStorage.setItem('user_id', String(user.user_id));
  localStorage.setItem('username', user.username);
}

function clearCurrentUser() {
  localStorage.removeItem('sports-platform-user');
  localStorage.removeItem('user_id');
  localStorage.removeItem('username');
}

function showMessage(target, text, isError = false) {
  if (!target) {
    if (text) window.alert(text);
    return;
  }
  target.textContent = text;
  target.classList.toggle('danger-text', Boolean(isError));
}

function createEmptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function currentUserIdOrBlank() {
  const user = getCurrentUser();
  return user ? user.user_id : '';
}

function requireCurrentUser(message = '請先登入') {
  const user = getCurrentUser();
  if (!user?.user_id) {
    window.alert(message);
    window.location.href = '/auth.html?mode=login';
    return null;
  }
  return user;
}

function toApiDateTime(value) {
  if (!value) return value;
  return value.length === 16 ? `${value.replace('T', ' ')}:00` : value.replace('T', ' ');
}

function fillUserIdInputs(root = document) {
  const userId = currentUserIdOrBlank();
  root.querySelectorAll('input[name="user_id"]').forEach((input) => {
    if (!input.value && userId) input.value = userId;
  });
}

function serializeForm(form) {
  if (!(form instanceof HTMLFormElement)) {
    console.error('[serializeForm] received non-HTMLFormElement:', form);
    return {};
  }

  const data = Object.fromEntries(new FormData(form).entries());

  Object.keys(data).forEach((key) => {
    if (data[key] === '') delete data[key];
  });

  return data;
}

function setupTabs(container = document) {
  const buttons = container.querySelectorAll('.tab-btn[data-tab]');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;

      container.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
        btn.classList.remove('active');
        btn.classList.add('muted');
      });

      button.classList.add('active');
      button.classList.remove('muted');

      container.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.classList.remove('active');
      });

      const target =
        container.querySelector(`#tab-${tab}`) ||
        container.querySelector(`#${tab}-form`) ||
        container.querySelector(`#${tab}`);

      if (target) target.classList.add('active');
    });
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDifficultyLevel(value) {
  const difficultyMap = {
    easy: '初級',
    medium: '中級',
    hard: '高級',
    beginner: '初級',
    intermediate: '中級',
    advanced: '高級',
    '初級': '初級',
    '中級': '中級',
    '高級': '高級',
  };

  const key = String(value || '').trim();
  return difficultyMap[key.toLowerCase()] || key;
}

function getUserInitials(name) {
  const text = String(name || 'SP').trim();
  return text.slice(0, 2).toUpperCase();
}

function normalizeBoardName(name) {
  return String(name || '').trim().replace(/\s+/g, '');
}

function getBoardEmoji(name) {
  const boardName = normalizeBoardName(name);
  if (BOARD_EMOJI_MAP[boardName]) return BOARD_EMOJI_MAP[boardName];
  const matchedKey = Object.keys(BOARD_EMOJI_MAP).find(
    (key) => key !== 'default' && boardName.includes(key)
  );
  return matchedKey ? BOARD_EMOJI_MAP[matchedKey] : BOARD_EMOJI_MAP.default;
}

function truncateText(value, limit = 120) {
  const text = String(value || '');
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function goHome() {
  window.location.href = '/';
}

function isIndividualBoardPage(activeBoardId) {
  return Boolean(activeBoardId);
}

function renderTopNav() {
  const container = el('#site-header');
  if (!container) return;

  const user = getCurrentUser();
  const profileUrl = user ? `/profile.html?id=${user.user_id}` : '/auth.html?mode=login';

  container.innerHTML = `
    <a class="brand-link" href="/">
      <span class="brand-logo">SB</span>
      <span class="brand-copy">
        <span class="brand-title">SportBoard</span>
      </span>
    </a>

    <form id="header-search-form" class="header-search-form" action="/search.html" method="GET">
      <input
        type="search"
        name="q"
        class="header-search-input"
        placeholder="搜尋..."
        autocomplete="off"
      >
      <button type="submit" class="header-search-btn">搜尋</button>
    </form>

    <div class="header-actions">
      <a
        id="header-auth-btn"
        class="ghost-btn"
        href="${profileUrl}"
        style="display:inline-flex;align-items:center;justify-content:center;min-height:44px;line-height:1;text-decoration:none;white-space:nowrap;"
      >
        ${user ? escapeHtml(user.username) : '登入 / 註冊'}
      </a>

      <button
        id="logout-btn-top"
        class="ghost-btn"
        type="button"
        ${user ? '' : 'hidden'}
        style="display:inline-flex;align-items:center;justify-content:center;min-height:44px;line-height:1;white-space:nowrap;"
      >
        登出
      </button>
    </div>
  `;

  el('#logout-btn-top')?.addEventListener('click', () => {
    clearCurrentUser();
    window.location.href = '/auth.html?mode=login';
  });
}

function renderBottomNav() {
  const nav = el('#bottom-nav');
  if (!nav) return;

  const user = getCurrentUser();
  const page = document.body.dataset.page;

  const links = [
    { href: '/', label: '首頁', key: 'home' },
    { href: '/board.html', label: '專欄', key: 'boards' },
    { href: '/search.html', label: '搜尋', key: 'search' },
    { href: '/create.html', label: '發文', key: 'compose' },
    {
      href: user ? `/profile.html?id=${user.user_id}` : '/auth.html?mode=login',
      label: '我的',
      key: 'profile',
    },
  ];

  nav.innerHTML = links
    .map((link) => {
      const active =
        page === link.key ||
        (page === 'post' && link.key === 'boards') ||
        (page === 'plans' && link.key === 'boards') ||
        (page === 'user' && link.key === 'profile');

      return `<a class="bottom-link ${active ? 'active' : ''}" href="${link.href}">${link.label}</a>`;
    })
    .join('');
}

function renderBoardSidebar(boards, activeBoardId) {
  const sidebar = el('#board-sidebar');
  const mobileBar = el('#mobile-board-bar');
  const shouldShowHomeButton = isIndividualBoardPage(activeBoardId);

  if (!sidebar && !mobileBar) return;

  const links = boards.length
    ? boards
        .map((board) => {
          const active = String(board.board_id) === String(activeBoardId);
          return `
            <a class="board-nav-link ${active ? 'active' : ''}" href="/board.html?id=${board.board_id}">
              ${getSportIcon(board.sport_type)}
              <span>${escapeHtml(getSportName(board.sport_type))}</span>
            </a>
          `;
        })
        .join('')
    : createEmptyState('目前沒有任何專欄');

  if (sidebar) {
    sidebar.innerHTML = `
      <div class="sidebar-card">
        ${
          shouldShowHomeButton
            ? `<button id="sidebar-home-btn" class="ghost-btn" type="button" style="width:100%;justify-content:center;margin-bottom:18px;padding:12px 16px;border-radius:16px;font-weight:800;">
                ← 返回首頁
              </button>`
            : ''
        }
        <div class="sidebar-title-row">
          <div class="sidebar-title">運動專欄</div>
          <button
            id="sidebar-add-board-btn"
            class="sidebar-add-board-btn"
            type="button"
            aria-label="新增運動專欄"
            title="新增運動專欄"
          >
            +
          </button>
        </div>
        <div class="board-nav">${links}</div>
      </div>
    `;
    el('#sidebar-home-btn')?.addEventListener('click', goHome);
    el('#sidebar-add-board-btn')?.addEventListener('click', () => {
      openCreateBoardModal(boards, activeBoardId);
    });
  }

  if (mobileBar) {
    mobileBar.innerHTML = boards.length
      ? `
        ${
          shouldShowHomeButton
            ? `<div style="margin-bottom:12px;">
                <button id="mobile-board-home-btn" class="ghost-btn" type="button" style="padding:10px 14px;border-radius:14px;font-weight:800;">
                  ← 返回首頁
                </button>
              </div>`
            : ''
        }
        <div class="mobile-board-list">
          ${boards
            .map((board) => {
              const active = String(board.board_id) === String(activeBoardId);
              return `<a class="mobile-board-link ${active ? 'active' : ''}" href="/board.html?id=${board.board_id}">${getSportIcon(board.sport_type)}${escapeHtml(getSportName(board.sport_type))}</a>`;
            })
            .join('')}
        </div>
      `
      : '';
    el('#mobile-board-home-btn')?.addEventListener('click', goHome);
  }
}

function getDefaultBoardDescription(name) {
  return `${String(name || '').trim()}交流、訓練心得、比賽討論專欄`;
}

function triggerLikeAnimation(likeBtn, countEl) {
  const iconEl = likeBtn?.querySelector('.like-icon');

  if (iconEl) {
    iconEl.classList.remove('like-pop');
    void iconEl.offsetWidth;
    iconEl.classList.add('like-pop');
    iconEl.addEventListener('animationend', () => {
      iconEl.classList.remove('like-pop');
    }, { once: true });
  }

  if (countEl) {
    countEl.classList.remove('count-pop');
    void countEl.offsetWidth;
    countEl.classList.add('count-pop');
    window.setTimeout(() => {
      countEl.classList.remove('count-pop');
    }, 200);
  }
}

function ensureCreateBoardModal() {
  let modal = el('#create-board-modal');
  if (modal) return modal;

  document.body.insertAdjacentHTML(
    'beforeend',
    `
      <div id="create-board-modal" class="modal-backdrop" hidden>
        <form id="create-board-form" class="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-board-title">
          <div class="modal-head">
            <h2 id="create-board-title">新增運動專欄</h2>
            <button id="create-board-close" class="ghost-btn modal-close-icon" type="button" aria-label="關閉">x</button>
          </div>

          <label class="form-field">
            <span>專欄名稱</span>
            <input id="create-board-name" name="name" type="text" maxlength="50" placeholder="例如：排球" required>
          </label>

          <label class="form-field">
            <span>專欄描述</span>
            <textarea id="create-board-description" name="description" maxlength="255" placeholder="例如：排球交流、訓練心得、比賽討論專欄"></textarea>
          </label>

          <div id="create-board-status" class="form-status" aria-live="polite"></div>

          <div class="modal-actions">
            <button id="create-board-cancel" class="gray-btn" type="button">取消</button>
            <button class="primary-btn" type="submit">建立專欄</button>
          </div>
        </form>
      </div>
    `
  );

  modal = el('#create-board-modal');
  el('#create-board-close')?.addEventListener('click', closeCreateBoardModal);
  el('#create-board-cancel')?.addEventListener('click', closeCreateBoardModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeCreateBoardModal();
  });

  return modal;
}

function openCreateBoardModal(boards = [], activeBoardId = null) {
  const modal = ensureCreateBoardModal();
  const form = el('#create-board-form');
  const nameInput = el('#create-board-name');
  const descriptionInput = el('#create-board-description');
  const status = el('#create-board-status');

  if (!modal || !form || !nameInput || !descriptionInput || !status) return;

  form.reset();
  showMessage(status, '');
  modal.hidden = false;
  nameInput.focus();

  form.onsubmit = async (event) => {
    event.preventDefault();

    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim() || getDefaultBoardDescription(name);
    const submitButton = form.querySelector('button[type="submit"]');

    showMessage(status, '');

    if (!name) {
      showMessage(status, '請輸入專欄名稱', true);
      nameInput.focus();
      return;
    }

    const duplicated = boards.some((board) => normalizeBoardName(board.sport_type) === normalizeBoardName(name));
    if (duplicated) {
      showMessage(status, '此專欄已存在', true);
      nameInput.focus();
      return;
    }

    submitButton.disabled = true;

    try {
      await API.post('/boards', { name, description });
      const updatedBoards = await API.get('/boards');
      renderBoardSidebar(updatedBoards, activeBoardId);
      closeCreateBoardModal();
    } catch (err) {
      showMessage(status, err.message || '新增專欄失敗', true);
    } finally {
      submitButton.disabled = false;
    }
  };
}

function closeCreateBoardModal() {
  const modal = el('#create-board-modal');
  if (modal) modal.hidden = true;
}

function disableFormWithMessage(form, message, statusTarget, isError = false) {
  if (!form) return;

  form.querySelectorAll('input, textarea, button, select').forEach((field) => {
    if (field.name !== 'user_id') field.disabled = true;
  });

  if (statusTarget) {
    showMessage(statusTarget, message, isError);
  } else if (!form.previousElementSibling?.classList?.contains('empty-state')) {
    form.insertAdjacentHTML('beforebegin', createEmptyState(message));
  }
}

renderTopNav();
renderBottomNav();

// Re-render nav when localStorage changes in another tab
window.addEventListener('storage', (e) => {
  if (e.key === 'sports-platform-user' || e.key === null) {
    renderTopNav();
    renderBottomNav();
  }
});

// Global ESC key handler — closes any visible modal-backdrop
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const openModal = document.querySelector('.modal-backdrop:not([hidden])');
  if (!openModal) return;
  // Trigger close button if present, otherwise just hide
  const closeBtn = openModal.querySelector('.modal-close-icon, button[id$="-close"]');
  if (closeBtn) {
    closeBtn.click();
  } else {
    openModal.hidden = true;
  }
});
