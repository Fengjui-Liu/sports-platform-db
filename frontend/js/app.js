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

  const response = await fetch(`/api${path}`, config);
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

function renderNav() {
  const nav = el('#site-nav');
  if (!nav) {
    return;
  }

  const user = getCurrentUser();
  const page = document.body.dataset.page;
  const links = [
    { href: '/', label: '首頁', key: 'home' },
    { href: '/board.html', label: '專欄', key: 'boards' },
    { href: user ? `/profile.html?id=${user.user_id}` : '/profile.html', label: '個人頁', key: 'profile' },
    { href: '/auth.html', label: user ? '切換帳號' : '登入 / 註冊', key: 'auth' },
  ];

  nav.innerHTML = links
    .map((link) => `<a class="nav-link ${page === link.key ? 'active' : ''}" href="${link.href}">${link.label}</a>`)
    .join('');

  if (user) {
    nav.insertAdjacentHTML(
      'beforeend',
      `<button id="logout-btn" class="action-btn">登出 ${user.username}</button>`
    );
    el('#logout-btn').addEventListener('click', () => {
      clearCurrentUser();
      window.location.href = '/auth.html';
    });
  }
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
      container.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      container.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));
      const target = container.querySelector(`#tab-${tab}`) || container.querySelector(`#${tab}-form`) || container.querySelector(`#${tab}`);
      if (target) {
        target.classList.add('active');
      }
    });
  });
}

renderNav();
