const API_BASE_URL = 'http://localhost:3000/api';

const API = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path, body) => request(path, { method: 'DELETE', body }),
};

async function request(path, options = {}) {
  const config = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
  };

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
  if (!value) {
    return '未提供';
  }
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
    return JSON.parse(localStorage.getItem('sports-platform-user') || 'null');
  } catch (_err) {
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem('sports-platform-user', JSON.stringify(user));
}

function clearCurrentUser() {
  localStorage.removeItem('sports-platform-user');
}

function renderBottomNav() {
  const nav = el('#bottom-nav');
  if (!nav) {
    return;
  }

  const user = getCurrentUser();
  const page = document.body.dataset.page;
  const links = [
    { href: '/', label: '首頁', icon: '🏠', key: 'home' },
    { href: '/board.html', label: '專欄', icon: '📋', key: 'boards' },
    { href: '/board.html?compose=1', label: '發文', icon: '➕', key: 'compose' },
    { href: user ? `/profile.html?id=${user.user_id}` : '/profile.html', label: '我的', icon: '👤', key: 'profile' },
  ];

  nav.innerHTML = links
    .map((link) => {
      const active = page === link.key || (page === 'post' && link.key === 'boards') || (page === 'plans' && link.key === 'boards');
      return `<a class="bottom-link ${active ? 'active' : ''}" href="${link.href}"><span class="icon">${link.icon}</span><span>${link.label}</span></a>`;
    })
    .join('');
}

function showMessage(target, text, isError = false) {
  if (!target) {
    if (text) {
      window.alert(text);
    }
    return;
  }

  target.textContent = text;
  target.style.color = isError ? '#c62828' : '';
}

function createEmptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}

function currentUserIdOrBlank() {
  const user = getCurrentUser();
  return user ? user.user_id : '';
}

function fillUserIdInputs(root = document) {
  const userId = currentUserIdOrBlank();
  root.querySelectorAll('input[name="user_id"]').forEach((input) => {
    if (!input.value && userId) {
      input.value = userId;
    }
  });
}

function serializeForm(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  Object.keys(data).forEach((key) => {
    if (data[key] === '') {
      delete data[key];
    }
  });
  return data;
}

function setupTabs(container = document) {
  const buttons = container.querySelectorAll('.tab-btn[data-tab]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      container.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.classList.remove('active');
        btn.classList.add('muted');
      });
      button.classList.add('active');
      button.classList.remove('muted');
      container.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));
      const target = container.querySelector(`#tab-${tab}`) || container.querySelector(`#${tab}-form`) || container.querySelector(`#${tab}`);
      if (target) {
        target.classList.add('active');
      }
    });
  });
}

function bindGlobalActions() {
  const headerAuthBtn = el('#header-auth-btn');
  if (headerAuthBtn) {
    const user = getCurrentUser();
    headerAuthBtn.textContent = user ? user.username : '登入';
    headerAuthBtn.addEventListener('click', () => {
      window.location.href = user ? `/profile.html?id=${user.user_id}` : '/auth.html';
    });
  }

  const logoutBtn = el('#logout-btn-top');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearCurrentUser();
      window.location.href = '/auth.html';
    });
  }
}

renderBottomNav();
bindGlobalActions();
