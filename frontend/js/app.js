const API_BASE_URL = 'http://localhost:3000/api';

const API = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path, body) => request(path, { method: 'DELETE', body }),
};

const BOARD_EMOJI_MAP = {};

const SPORT_ICON_MAP = {
  '極限運動': 'bi-lightning-charge',
  '格鬥':     'bi-shield-fill',
  '騎車':     'bi-bicycle',
  '游泳':     'bi-water',
  '網球':     'bi-dribbble',
  '足球':     'bi-dribbble',
  '跑步':     'bi-person-walking',
  '健身重訓': 'bi-activity',
  '羽球':     'bi-feather',
  '籃球':     'bi-dribbble',
};

const SPORT_CATEGORIES = {
  '騎車': 'cardio', '游泳': 'cardio', '跑步': 'cardio',
  '極限運動': 'cardio_no_distance',
  '格鬥': 'combat',
  '網球': 'sport', '足球': 'sport', '羽球': 'sport', '籃球': 'sport',
  '健身重訓': 'strength',
};

function getSportIcon(name) {
  const key = String(name || '').trim();
  const cls = SPORT_ICON_MAP[key];
  if (!cls) return '';
  return `<i class="bi ${cls}" style="flex-shrink:0;font-size:15px;"></i>`;
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
  return matchedKey ? BOARD_EMOJI_MAP[matchedKey] : '';
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
              <span>${escapeHtml(board.sport_type)}</span>
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
        <div class="sidebar-title">運動專欄</div>
        <div class="board-nav">${links}</div>
      </div>
    `;
    el('#sidebar-home-btn')?.addEventListener('click', goHome);
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
              return `<a class="mobile-board-link ${active ? 'active' : ''}" href="/board.html?id=${board.board_id}">${getSportIcon(board.sport_type)} ${escapeHtml(board.sport_type)}</a>`;
            })
            .join('')}
        </div>
      `
      : '';
    el('#mobile-board-home-btn')?.addEventListener('click', goHome);
  }
}

function disableFormWithMessage(form, message, statusTarget) {
  if (!form) return;

  form.querySelectorAll('input, textarea, button, select').forEach((field) => {
    if (field.name !== 'user_id') field.disabled = true;
  });

  if (statusTarget) {
    showMessage(statusTarget, message, true);
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
