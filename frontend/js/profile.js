async function getFollowStats(userId) {
  return API.get(`/users/me/follow-stats?user_id=${encodeURIComponent(userId)}`);
}

async function getMyFollowing(userId) {
  return API.get(`/users/me/following?user_id=${encodeURIComponent(userId)}`);
}

async function getMyFollowers(userId) {
  return API.get(`/users/me/followers?user_id=${encodeURIComponent(userId)}`);
}

let bodyRecordState = {
  records: [],
  chartRange: '3m',
  chartRangeStart: '',
  chartRangeEnd: '',
  historyMonth: '',
  chartPoints: [],
  userId: '',
  canEdit: false,
};

let sessionState = {
  userId: '',
  viewerId: '',
  canEdit: false,
  sessions: [],
};

let profileLayoutResizeBound = false;
let isBodyHistoryModalOpen = false;
let isLoadingBodyRecord = false;
let _syncRafId = null;

const CHART_RANGE_PRESETS = [
  { value: '1m', label: '近 1 個月' },
  { value: '3m', label: '近 3 個月' },
  { value: '6m', label: '近 6 個月' },
  { value: '1y', label: '近 1 年' },
  { value: 'all', label: '全部' },
  { value: 'custom', label: '自訂' },
];

const AVATAR_MAX_FILE_SIZE = 5 * 1024 * 1024;
const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function toISODateString(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRangeDates(range, customStart = '', customEnd = '') {
  if (range === 'all') {
    return { startDate: null, endDate: null };
  }
  if (range === 'custom') {
    return { startDate: customStart || null, endDate: customEnd || null };
  }
  const today = new Date();
  const start = new Date(today);
  if (range === '1m') start.setMonth(start.getMonth() - 1);
  else if (range === '3m') start.setMonth(start.getMonth() - 3);
  else if (range === '6m') start.setMonth(start.getMonth() - 6);
  else if (range === '1y') start.setFullYear(start.getFullYear() - 1);
  return { startDate: toISODateString(start), endDate: null };
}

function buildBodyRecordUrl(userId, range, customStart = '', customEnd = '') {
  const { startDate, endDate } = getRangeDates(range, customStart, customEnd);
  const params = [];
  if (startDate) params.push(`start_date=${encodeURIComponent(startDate)}`);
  if (endDate) params.push(`end_date=${encodeURIComponent(endDate)}`);
  return `/users/${userId}/bodyrecord${params.length ? `?${params.join('&')}` : ''}`;
}

function buildBodyRecordHistoryUrl(userId, monthKey) {
  return `/users/${userId}/bodyrecord?month=${encodeURIComponent(monthKey)}`;
}

function drawCanvasMessage(canvas, message) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cssWidth = Math.max(canvas.clientWidth, 320);
  const cssHeight = Math.max(canvas.clientHeight, 300);
  const dpr = window.devicePixelRatio || 1;
  const targetW = Math.round(cssWidth * dpr);
  const targetH = Math.round(cssHeight * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#f8faff';
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = '#6f7d97';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, cssWidth / 2, cssHeight / 2);
}

async function initProfilePage() {
  const params = getParams();
  const currentUser = getCurrentUser();
  const userId = params.get('id') || (currentUser && currentUser.user_id);

  if (!userId) {
    el('#profile-card').innerHTML = createEmptyState('請先登入，或提供 ?id= 使用者 ID');
    return;
  }

  fillUserIdInputs();

  try {
    const viewerId = currentUser?.user_id || userId;
    const planViewerId = currentUser?.user_id || '';
    const canEditOwnContent = currentUser && Number(currentUser.user_id) === Number(userId);

    const [
      user,
      followStats,
      bodyRecords,
      posts,
      sessions,
      savedPlans,
      createdPlans,
      createdInvitations,
      joinedInvitations,
    ] = await Promise.all([
      API.get(`/users/${userId}?viewer_id=${viewerId}`),
      getFollowStats(userId),
      API.get(buildBodyRecordUrl(userId, '3m')),
      API.get(`/users/${userId}/posts`),
      API.get(`/users/${userId}/sessions?viewer_id=${planViewerId}`),
      API.get(`/users/${userId}/saved-plans?viewer_id=${planViewerId}`),
      API.get(`/workoutplans?user_id=${userId}&viewer_id=${planViewerId}`),
      API.get(`/invitations?owner_id=${userId}&user_id=${viewerId}`),
      API.get(`/invitations?participant_user_id=${userId}&user_id=${viewerId}`),
    ]);

    renderProfile(user, followStats, userId);
    renderStats({ ...user, ...followStats });
    renderBodyRecords(bodyRecords, {
      userId,
      canEdit: currentUser && Number(currentUser.user_id) === Number(userId),
    });

    renderSimpleList(
      '#profile-posts',
      posts,
      (post) => `
        <a class="list-card" href="/post.html?id=${post.post_id}">
          <div class="action-row">
            <div>
              <div class="chip-row">
                <span class="chip">${getSportIcon(post.board_name)}${escapeHtml(getSportName(post.board_name))}</span>
              </div>
              <h3 style="margin-top:12px;">${escapeHtml(post.title || '未命名貼文')}</h3>
            </div>
            <div class="chip-row" style="justify-content:flex-end;">
              <span class="meta-line">${formatPostMetaTime(post)}</span>
              ${canEditOwnContent ? `<span class="ghost-btn" style="min-height:36px;" onclick="event.preventDefault();event.stopPropagation();window.location.href='/edit-post.html?id=${post.post_id}';">編輯</span>` : ''}
            </div>
          </div>
          <div class="chip-row">
            <span class="chip muted-chip">讚 ${post.like_count}</span>
            <span class="chip muted-chip">留言 ${post.comment_count || 0}</span>
          </div>
        </a>
      `,
      '目前尚無貼文'
    );

    renderSimpleList(
      '#profile-created-plans',
      createdPlans,
      (plan) => `
        <a class="mini-card" href="/workoutplan.html?id=${plan.plan_id}">
          <div class="action-row">
            <strong>${escapeHtml(plan.title)}</strong>
            <div class="chip-row" style="justify-content:flex-end;">
              <span class="visibility-badge ${Number(plan.is_public) ? 'public' : 'private'}">
                ${Number(plan.is_public) ? '公開' : '私人'}
              </span>
              ${canEditOwnContent ? `<span class="ghost-btn" style="min-height:36px;" onclick="event.preventDefault();event.stopPropagation();window.location.href='/edit-plan.html?id=${plan.plan_id}';">編輯</span>` : ''}
            </div>
          </div>
          <p class="page-description">${escapeHtml(plan.exercise_name)} / ${plan.reps} reps / ${plan.sets} sets</p>
        </a>
      `,
      '目前尚未建立訓練計畫'
    );

    renderSimpleList(
      '#profile-created-invitations',
      createdInvitations,
      (inv) => `
        <a class="mini-card" href="/board.html?id=${inv.board_id}">
          <strong>${escapeHtml(inv.title)}</strong>
          <div class="meta-line">${escapeHtml(inv.location)} / ${formatDate(inv.event_time)}</div>
        </a>
      `,
      '目前尚未建立揪團'
    );

    renderSimpleList(
      '#profile-joined-invitations',
      joinedInvitations,
      (inv) => `
        <a class="mini-card" href="/board.html?id=${inv.board_id}">
          <strong>${escapeHtml(inv.title)}</strong>
          <div class="meta-line">${escapeHtml(inv.location)} / ${formatDate(inv.event_time)}</div>
        </a>
      `,
      '目前尚未參加揪團'
    );

    sessionState = {
      userId,
      viewerId: currentUser?.user_id || '',
      canEdit: canEditOwnContent,
      sessions,
    };
    renderSessionList(sessions, canEditOwnContent);

    renderSimpleList(
      '#profile-saved-plans',
      savedPlans,
      (plan) => `
        <a class="mini-card" href="/workoutplan.html?id=${plan.plan_id}">
          <strong>${escapeHtml(plan.title)}</strong>
          <p class="page-description">${escapeHtml(plan.exercise_name)} / ${plan.reps} reps / ${plan.sets} sets</p>
          <div class="meta-line">${escapeHtml(plan.username)}</div>
        </a>
      `,
      '目前尚無收藏計畫'
    );

    bindProfileForms(userId, currentUser, createdPlans);
    bindFollowStatBadges(userId);
    bindProfileLayoutResize();
    scheduleProfileLayoutSync();
  } catch (err) {
    const card = el('#profile-card');
    if (card) {
      showMessage(card, err.message, true);
    }
  }
}

function bindProfileLayoutResize() {
  if (profileLayoutResizeBound) {
    return;
  }

  profileLayoutResizeBound = true;
  window.addEventListener('resize', scheduleProfileLayoutSync);
}

function scheduleProfileLayoutSync() {
  if (_syncRafId !== null) {
    cancelAnimationFrame(_syncRafId);
  }
  _syncRafId = window.requestAnimationFrame(() => {
    _syncRafId = window.requestAnimationFrame(() => {
      _syncRafId = null;
      syncProfileTopLayout();
    });
  });
}

function syncProfileTopLayout() {
  const layout = el('.profile-main-layout');
  const leftColumn = el('.profile-left-column');
  const editCard = leftColumn?.querySelector('.panel-card:not(.profile-posts-card)');
  const postsCard = el('.profile-posts-card');
  const postsList = el('.my-posts-list');
  const bodyCard = el('.body-data-card');

  if (!layout || !leftColumn || !editCard || !postsCard || !postsList || !bodyCard) {
    return;
  }

  leftColumn.style.height = '';
  postsCard.style.height = '';
  postsList.style.maxHeight = '';

  if (window.matchMedia('(max-width: 1080px)').matches) {
    postsList.style.maxHeight = '340px';
    return;
  }

  const bodyHeight = bodyCard.getBoundingClientRect().height;
  const editHeight = editCard.getBoundingClientRect().height;
  const leftStyle = window.getComputedStyle(leftColumn);
  const gap = Number.parseFloat(leftStyle.rowGap || leftStyle.gap) || 16;
  const postsHeight = Math.max(260, bodyHeight - editHeight - gap);
  const postsHeader = postsCard.querySelector('.section-head');
  const postsStyle = window.getComputedStyle(postsCard);
  const verticalPadding =
    (Number.parseFloat(postsStyle.paddingTop) || 0) +
    (Number.parseFloat(postsStyle.paddingBottom) || 0);
  const headerHeight = postsHeader ? postsHeader.getBoundingClientRect().height : 0;
  const listHeight = Math.max(160, postsHeight - headerHeight - verticalPadding);

  leftColumn.style.height = `${bodyHeight}px`;
  postsCard.style.height = `${postsHeight}px`;
  postsList.style.maxHeight = `${listHeight}px`;
}

function renderProfile(user, followStats, userId) {
  const target = el('#profile-card');
  if (!target) {
    return;
  }

  const followingCount = Number(followStats?.followingCount ?? user.following_count ?? 0);
  const followersCount = Number(followStats?.followersCount ?? user.follower_count ?? 0);
  const avatarSrc = getAvatarSrc(user.profile_image);
  const avatar = avatarSrc
    ? `<img class="avatar" src="${escapeHtml(avatarSrc)}" alt="avatar">`
    : `<span class="avatar-circle" style="width:88px;height:88px;font-size:32px;">${escapeHtml(getUserInitials(user.username))}</span>`;

  target.innerHTML = `
    <div class="profile-head">
      <div class="profile-summary">
        ${avatar}
        <div class="profile-info-block">
          <div class="profile-title-row">
            <div>
              <h1>${escapeHtml(user.username)}</h1>
              <div class="meta-line">${escapeHtml(user.email)}</div>
            </div>
            <div class="profile-follow-stats" aria-label="追蹤統計">
              <button class="chip follow-stat-chip" type="button" data-follow-list="following" data-user-id="${escapeHtml(userId)}">
                追蹤中 <strong>${followingCount}</strong>
              </button>
              <button class="chip follow-stat-chip" type="button" data-follow-list="followers" data-user-id="${escapeHtml(userId)}">
                粉絲 <strong>${followersCount}</strong>
              </button>
            </div>
          </div>
          <p class="page-description">${escapeHtml(user.bio || '這位使用者尚未填寫自我介紹')}</p>
          <div class="chip-row" style="margin-top:12px;">
            <span class="chip">貼文數 ${user.post_count || 0}</span>
            <span class="chip">訓練次數 ${user.session_count || 0}</span>
            <span class="chip">收藏計畫數 ${user.saved_plan_count || 0}</span>
          </div>
        </div>
      </div>
    </div>
    <div id="follow-list-modal" class="modal-backdrop" hidden>
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="follow-list-title">
        <div class="modal-head">
          <h2 id="follow-list-title">追蹤中</h2>
          <button id="follow-list-close-icon" class="ghost-btn modal-close-icon" type="button" aria-label="關閉">x</button>
        </div>
        <div id="follow-list-content" class="follow-list-content"></div>
        <div class="modal-actions">
          <button id="follow-list-close" class="primary-btn" type="button">關閉</button>
        </div>
      </div>
    </div>
  `;

  const profileForm = el('#profile-form');

  if (profileForm) {
    profileForm.bio.value = user.bio || '';
    syncProfileAvatarUI(user.profile_image, user.username);
  }
}

function renderStats(user) {
  const target = el('#profile-stats');
  if (!target) {
    return;
  }

  target.innerHTML = `
    <div class="stat-card">
      <div class="meta-line">貼文數</div>
      <div class="stat-value">${user.post_count || 0}</div>
    </div>
    <div class="stat-card">
      <div class="meta-line">訓練次數</div>
      <div class="stat-value">${user.session_count || 0}</div>
    </div>
    <div class="stat-card">
      <div class="meta-line">收藏計畫數</div>
      <div class="stat-value">${user.saved_plan_count || 0}</div>
    </div>
    <div class="stat-card">
      <div class="meta-line">追蹤中</div>
      <div class="stat-value">${user.followingCount || 0}</div>
    </div>
    <div class="stat-card">
      <div class="meta-line">粉絲</div>
      <div class="stat-value">${user.followersCount || 0}</div>
    </div>
  `;
}

function updateAvatarPreview(avatarUrl) {
  const preview = el('#avatar-preview');
  if (!preview) return;

  const src = getAvatarSrc(avatarUrl);
  if (!src) {
    preview.hidden = true;
    preview.removeAttribute('src');
    return;
  }

  preview.src = src;
  preview.hidden = false;
}

function setRemoveAvatarButtonState(avatarUrl) {
  const button = el('#remove-avatar-btn');
  if (!button) return;

  const hasAvatar = Boolean(getAvatarSrc(avatarUrl));
  button.hidden = !hasAvatar;
  button.disabled = !hasAvatar;
}

function updateProfileAvatarDisplay(avatarUrl, username) {
  const summary = el('#profile-card .profile-summary');
  if (!summary) return;

  const currentAvatar = summary.querySelector('.avatar, .avatar-circle');
  const src = getAvatarSrc(avatarUrl);
  const initials = getUserInitials(username || '');

  if (src) {
    if (currentAvatar?.tagName === 'IMG') {
      currentAvatar.src = src;
      currentAvatar.alt = 'avatar';
      return;
    }

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.src = src;
    avatar.alt = 'avatar';
    if (currentAvatar) {
      currentAvatar.replaceWith(avatar);
    } else {
      summary.prepend(avatar);
    }
    return;
  }

  if (currentAvatar?.classList?.contains('avatar-circle')) {
    currentAvatar.textContent = initials;
    return;
  }

  const avatar = document.createElement('span');
  avatar.className = 'avatar-circle';
  avatar.style.width = '88px';
  avatar.style.height = '88px';
  avatar.style.fontSize = '32px';
  avatar.textContent = initials;
  if (currentAvatar) {
    currentAvatar.replaceWith(avatar);
  } else {
    summary.prepend(avatar);
  }
}

function syncProfileAvatarUI(avatarUrl, username) {
  updateProfileAvatarDisplay(avatarUrl, username);
  updateAvatarPreview(avatarUrl);
  setRemoveAvatarButtonState(avatarUrl);
}

function validateAvatarFile(file) {
  if (!file) return '';

  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    return '請選擇 JPG、PNG 或 WEBP 圖片檔案';
  }

  if (file.size > AVATAR_MAX_FILE_SIZE) {
    return '頭像檔案不可超過 5MB';
  }

  return '';
}

function bindAvatarPreview() {
  const input = el('#avatar-file');
  const status = el('#profile-form-status');
  if (!input) return;

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const error = validateAvatarFile(file);
    if (error) {
      input.value = '';
      showMessage(status, error, true);
      window.alert(error);
      return;
    }

    const preview = el('#avatar-preview');
    if (preview) {
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    }
    showMessage(status, '');
  });
}

function bindFollowStatBadges(userId) {
  document.querySelectorAll('[data-follow-list]').forEach((button) => {
    button.addEventListener('click', () => {
      openFollowListModal(userId, button.dataset.followList);
    });
  });

  el('#follow-list-close')?.addEventListener('click', closeFollowListModal);
  el('#follow-list-close-icon')?.addEventListener('click', closeFollowListModal);
  el('#follow-list-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'follow-list-modal') {
      closeFollowListModal();
    }
  });
}

async function openFollowListModal(userId, type) {
  const modal = el('#follow-list-modal');
  const title = el('#follow-list-title');
  const content = el('#follow-list-content');

  if (!modal || !title || !content) {
    return;
  }

  const isFollowing = type === 'following';
  title.textContent = isFollowing ? '追蹤中' : '粉絲';
  content.innerHTML = createEmptyState('載入中...');
  modal.hidden = false;

  try {
    const data = isFollowing ? await getMyFollowing(userId) : await getMyFollowers(userId);
    const users = isFollowing ? data.following || [] : data.followers || [];
    renderFollowList(content, users, isFollowing ? '目前尚未追蹤任何人' : '目前尚無粉絲');
  } catch (err) {
    content.innerHTML = createEmptyState(err.message || '無法載入清單');
  }
}

function closeFollowListModal() {
  const modal = el('#follow-list-modal');
  if (modal) {
    modal.hidden = true;
  }
}

function renderFollowList(target, users, emptyText) {
  if (!users.length) {
    target.innerHTML = createEmptyState(emptyText);
    return;
  }

  target.innerHTML = `
    <div class="follow-user-list">
      ${users
        .map((user) => {
          const displayName = user.username || user.name || user.email || '未知使用者';
          return `
            <a class="follow-user-row" href="/user.html?id=${user.id || user.user_id}">
              <span class="avatar-circle follow-user-avatar">${escapeHtml(getUserInitials(displayName))}</span>
              <span>
                <strong>${escapeHtml(displayName)}</strong>
                ${user.email ? `<span class="meta-line">${escapeHtml(user.email)}</span>` : ''}
              </span>
            </a>
          `;
        })
        .join('')}
    </div>
  `;
}

function normalizeBodyRecord(record) {
  const recordedAt = normalizeLocalDateTimeValue(
    record.recordedAt || record.recorded_at || record.created_at || record.createdAt || ''
  );

  return {
    id: record.id || record.record_id || record.recordId,
    weight: toNullableNumber(record.weight),
    height: toNullableNumber(record.height),
    bodyFat: toNullableNumber(record.bodyFat ?? record.body_fat),
    recordedAt,
  };
}

function normalizeLocalDateTimeValue(value) {
  if (!value) {
    return '';
  }

  const text = String(value).trim().replace('T', ' ').replace(/Z$/, '');
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!match) {
    return text;
  }

  const hour = String(match[2] || '00').padStart(2, '0');
  const minute = String(match[3] || '00').padStart(2, '0');
  const second = String(match[4] || '00').padStart(2, '0');
  return `${match[1]} ${hour}:${minute}:${second}`;
}

function getLocalDatePart(value) {
  const normalized = normalizeLocalDateTimeValue(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : '';
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getRecordTime(record) {
  return normalizeLocalDateTimeValue(record.recordedAt);
}

function formatMonthKey(value) {
  const datePart = getLocalDatePart(value);
  if (datePart) {
    return datePart.slice(0, 7);
  }

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatRecordMonth(record) {
  return formatMonthKey(record.recordedAt);
}

function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey).split('-');
  return `${year} 年 ${month} 月`;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getSelectableMonths(records, extraMonths = []) {
  const months = new Set();
  const currentMonthDate = new Date();

  for (let i = 0; i < 12; i += 1) {
    months.add(formatMonthKey(addMonths(currentMonthDate, -i)));
  }

  records.forEach((record) => {
    const month = formatRecordMonth(record);
    if (month) {
      months.add(month);
    }
  });

  extraMonths.forEach((month) => {
    if (month) {
      months.add(month);
    }
  });

  return [...months].sort((a, b) => b.localeCompare(a));
}

function sortRecordsByNewest(records) {
  return [...records].sort((a, b) => {
    const dateCompare = getRecordTime(b).localeCompare(getRecordTime(a));
    if (dateCompare !== 0) return dateCompare;
    return Number(b.id || 0) - Number(a.id || 0);
  });
}

function sortRecordsByOldest(records) {
  return [...records].sort((a, b) => {
    const dateCompare = getRecordTime(a).localeCompare(getRecordTime(b));
    if (dateCompare !== 0) return dateCompare;
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

function getLatestRecord(records) {
  return sortRecordsByNewest(records)[0] || null;
}

function getRecordsForMonth(records, monthKey) {
  return records.filter((record) => formatRecordMonth(record) === monthKey);
}

function mergeBodyRecords(existingRecords, incomingRecords) {
  const recordsById = new Map();
  existingRecords.forEach((record) => {
    recordsById.set(String(record.id), record);
  });
  incomingRecords.forEach((record) => {
    recordsById.set(String(record.id), record);
  });
  return [...recordsById.values()];
}

function renderMonthOptions(months, selectedMonth) {
  return months
    .map(
      (month) => `
        <option value="${escapeHtml(month)}" ${month === selectedMonth ? 'selected' : ''}>
          ${escapeHtml(formatMonthLabel(month))}
        </option>
      `
    )
    .join('');
}

function formatMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '-';
}

function formatNullableMetric(value, unit) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)} ${unit}` : '尚未紀錄';
}

function formatLocalDateTimeZh(value) {
  const normalized = normalizeLocalDateTimeValue(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (!match) {
    return normalized || '';
  }

  const hour = Number(match[4]);
  const period = hour < 12 ? '上午' : '下午';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${match[1]}/${match[2]}/${match[3]} ${period}${String(hour12).padStart(2, '0')}:${match[5]}`;
}

function formatDay(value) {
  const datePart = getLocalDatePart(value);
  if (!datePart) {
    return '';
  }

  const [, month, day] = datePart.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function buildBodyChartData(records) {
  return sortRecordsByOldest(records).map((record) => ({
    id: record.id,
    date: formatDay(record.recordedAt),
    fullDate: formatLocalDateTimeZh(record.recordedAt),
    weight: record.weight,
    height: record.height,
    bodyFat: record.bodyFat,
    recordedAt: record.recordedAt,
  }));
}

function renderBodyRecordSummary(record) {
  if (!record) {
    return createEmptyState('尚未建立身體數據');
  }

  return `
    <div class="mini-card body-latest-card no-hover">
      <strong>最新紀錄</strong>
      <div class="meta-line">${formatLocalDateTimeZh(record.recordedAt)}</div>
      <div class="meta-line">
        體重 ${formatMetric(record.weight)} kg / 身高 ${formatMetric(record.height)} cm / 體脂 ${formatMetric(record.bodyFat)} %
      </div>
    </div>
  `;
}

function renderBodyHistoryList(records, selectedMonth) {
  const list = el('#body-history-list');
  if (!list) {
    return;
  }

  const monthRecords = sortRecordsByNewest(getRecordsForMonth(records, selectedMonth));

  if (!monthRecords.length) {
    list.innerHTML = createEmptyState('此月份尚無歷史紀錄');
    return;
  }

  list.innerHTML = monthRecords
    .map(
      (record) => `
        <div class="mini-card no-hover">
          <div class="action-row body-history-row">
            <div>
              <strong>${formatLocalDateTimeZh(record.recordedAt)}</strong>
              <div class="meta-line">
                體重 ${formatMetric(record.weight)} kg / 身高 ${formatMetric(record.height)} cm / 體脂 ${formatMetric(record.bodyFat)} %
              </div>
            </div>
            ${bodyRecordState.canEdit ? `
              <div class="body-history-actions">
                <button class="ghost-btn body-record-edit" type="button" data-record-id="${escapeHtml(record.id)}">編輯</button>
                <button class="danger-btn body-record-delete" type="button" data-record-id="${escapeHtml(record.id)}">刪除</button>
              </div>
            ` : ''}
          </div>
        </div>
      `
    )
    .join('');

  bindBodyHistoryRecordActions();
}

function openBodyHistoryModal() {
  const modal = el('#body-history-modal');
  const monthSelect = el('#body-history-month-select');

  if (!modal) {
    isBodyHistoryModalOpen = false;
    return;
  }

  if (isBodyHistoryModalOpen && !modal.hidden) {
    return;
  }

  if (monthSelect) {
    monthSelect.value = bodyRecordState.historyMonth;
  }

  renderBodyHistoryList(bodyRecordState.records, bodyRecordState.historyMonth);
  modal.hidden = false;
  isBodyHistoryModalOpen = true;
  document.body.classList.add('modal-open');
  loadBodyHistoryMonth(bodyRecordState.historyMonth);
}

function closeBodyHistoryModal() {
  const modal = el('#body-history-modal');
  if (!modal) {
    isBodyHistoryModalOpen = false;
    document.body.classList.remove('modal-open');
    return;
  }

  if (!isBodyHistoryModalOpen && modal.hidden) {
    return;
  }

  modal.hidden = true;
  isBodyHistoryModalOpen = false;
  document.body.classList.remove('modal-open');
}

function resetBodyHistoryModalState() {
  isBodyHistoryModalOpen = false;
  document.body.classList.remove('modal-open');
}

function closeBodyHistoryModalFromOverlay(event) {
  if (event.target === event.currentTarget) {
    closeBodyHistoryModal();
  }
}

function stopBodyHistoryModalClick(event) {
  event.stopPropagation();
}

async function loadBodyHistoryMonth(monthKey) {
  if (!bodyRecordState.userId || !monthKey) {
    return;
  }

  const selectedMonth = monthKey;
  const list = el('#body-history-list');
  if (list) {
    list.innerHTML = createEmptyState('載入中...');
  }

  try {
    const records = await API.get(buildBodyRecordHistoryUrl(bodyRecordState.userId, selectedMonth));
    const normalizedRecords = records.map(normalizeBodyRecord);
    bodyRecordState.records = mergeBodyRecords(bodyRecordState.records, normalizedRecords);

    if (bodyRecordState.historyMonth === selectedMonth) {
      renderBodyHistoryList(normalizedRecords, selectedMonth);
    }
  } catch (err) {
    if (list) {
      list.innerHTML = createEmptyState(err.message || '載入歷史紀錄失敗');
    }
  }
}

async function handleBodyHistoryMonthChange(event) {
  const selectedMonth = event.currentTarget.value;
  bodyRecordState.historyMonth = selectedMonth;
  await loadBodyHistoryMonth(selectedMonth);
}

function bindBodyHistoryModalControls() {
  const openButton = el('#body-history-open');
  const closeButton = el('#body-history-close');
  const closeIcon = el('#body-history-close-icon');
  const modal = el('#body-history-modal');
  const modalCard = modal?.querySelector('.modal-card');
  const monthSelect = el('#body-history-month-select');

  [openButton, closeButton, closeIcon, modal].forEach((target) => {
    if (!target) return;
    target.onmouseover = null;
    target.onmouseenter = null;
    target.onmouseleave = null;
    target.onmouseout = null;
  });

  if (openButton) {
    openButton.onclick = openBodyHistoryModal;
  }

  if (closeButton) {
    closeButton.onclick = closeBodyHistoryModal;
  }

  if (closeIcon) {
    closeIcon.onclick = closeBodyHistoryModal;
  }

  if (modal) {
    modal.onclick = (event) => {
      if (event.target === modal) {
        closeBodyHistoryModal();
      }
    };
  }

  if (modalCard) {
    modalCard.onclick = stopBodyHistoryModalClick;
  }

  if (monthSelect) {
    monthSelect.onchange = handleBodyHistoryMonthChange;
  }
}

async function loadAndUpdateChart(range, rangeStart, rangeEnd) {
  if (!bodyRecordState.userId) return;
  if (isLoadingBodyRecord) return;

  isLoadingBodyRecord = true;
  drawCanvasMessage(el('#body-chart'), '載入中...');
  hideBodyChartTooltip();

  try {
    const url = buildBodyRecordUrl(bodyRecordState.userId, range, rangeStart, rangeEnd);
    const records = await API.get(url);
    const normalizedRecords = records.map(normalizeBodyRecord);

    bodyRecordState.records = normalizedRecords;
    bodyRecordState.chartRange = range;
    bodyRecordState.chartRangeStart = rangeStart;
    bodyRecordState.chartRangeEnd = rangeEnd;

    const latestRecord = getLatestRecord(normalizedRecords);
    const defaultMonth = latestRecord ? formatRecordMonth(latestRecord) : formatMonthKey(new Date());
    const nextHistoryMonth = bodyRecordState.historyMonth || defaultMonth;
    const months = getSelectableMonths(normalizedRecords, [nextHistoryMonth]);

    const historySelect = el('#body-history-month-select');
    if (historySelect) {
      historySelect.innerHTML = renderMonthOptions(months, nextHistoryMonth);
      bodyRecordState.historyMonth = historySelect.value || nextHistoryMonth;
    }

    drawBodyChart(buildBodyChartData(normalizedRecords));
  } catch (err) {
    drawCanvasMessage(el('#body-chart'), '載入失敗，請稍後再試');
  } finally {
    isLoadingBodyRecord = false;
  }
}

function bindBodyRecordControls() {
  document.querySelectorAll('.chart-range-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const range = btn.dataset.range;
      const customPanel = el('#chart-range-custom');

      document.querySelectorAll('.chart-range-btn').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });

      if (range === 'custom') {
        bodyRecordState.chartRange = 'custom';
        if (customPanel) customPanel.hidden = false;
        return;
      }

      if (customPanel) customPanel.hidden = true;
      await loadAndUpdateChart(range, '', '');
    });
  });

  el('#chart-range-apply')?.addEventListener('click', async () => {
    const start = el('#chart-range-start')?.value || '';
    const end = el('#chart-range-end')?.value || '';
    await loadAndUpdateChart('custom', start, end);
  });

  bindBodyHistoryModalControls();

  bindBodyEditModalControls();
}

function bindBodyHistoryRecordActions() {
  document.querySelectorAll('.body-record-edit').forEach((button) => {
    button.addEventListener('click', () => openBodyEditModal(button.dataset.recordId));
  });

  document.querySelectorAll('.body-record-delete').forEach((button) => {
    button.addEventListener('click', () => deleteBodyRecord(button.dataset.recordId));
  });
}

function bindBodyEditModalControls() {
  el('#body-edit-close-icon')?.addEventListener('click', closeBodyEditModal);
  el('#body-edit-cancel')?.addEventListener('click', closeBodyEditModal);
  el('#body-edit-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'body-edit-modal') {
      closeBodyEditModal();
    }
  });

  el('#body-edit-form')?.addEventListener('submit', saveBodyRecordEdit);
}

function toDateTimeLocalValue(value) {
  const normalized = normalizeLocalDateTimeValue(value);
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})/);
  if (!match) {
    return '';
  }

  return `${match[1]}T${match[2]}:${match[3]}`;
}

function openBodyEditModal(recordId) {
  const record = bodyRecordState.records.find((item) => String(item.id) === String(recordId));
  const modal = el('#body-edit-modal');
  const form = el('#body-edit-form');
  const status = el('#body-edit-status');

  if (!record || !modal || !form) {
    return;
  }

  form.record_id.value = record.id;
  form.weight.value = record.weight ?? '';
  form.height.value = record.height ?? '';
  form.body_fat.value = record.bodyFat ?? '';
  form.recorded_at.value = toDateTimeLocalValue(record.recordedAt);
  showMessage(status, '');
  modal.hidden = false;
  form.weight.focus();
}

function closeBodyEditModal() {
  const modal = el('#body-edit-modal');
  if (modal) {
    modal.hidden = true;
  }
}

async function refreshBodyRecords(options = {}) {
  if (!bodyRecordState.userId) {
    return;
  }

  const url = buildBodyRecordUrl(
    bodyRecordState.userId,
    bodyRecordState.chartRange,
    bodyRecordState.chartRangeStart,
    bodyRecordState.chartRangeEnd
  );
  const records = await API.get(url);
  renderBodyRecords(records, {
    userId: bodyRecordState.userId,
    canEdit: bodyRecordState.canEdit,
    chartRange: bodyRecordState.chartRange,
    chartRangeStart: bodyRecordState.chartRangeStart,
    chartRangeEnd: bodyRecordState.chartRangeEnd,
    historyMonth: options.historyMonth || bodyRecordState.historyMonth,
  });

  if (options.keepHistoryOpen) {
    openBodyHistoryModal();
  }
}

async function saveBodyRecordEdit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const status = el('#body-edit-status');
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const recordId = form.record_id.value;
  const payload = serializeForm(form);
  delete payload.record_id;

  if (payload.recorded_at) {
    payload.recorded_at = toApiDateTime(payload.recorded_at);
  }

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = '儲存中...';
  }
  showMessage(status, '');

  try {
    await API.put(`/users/${bodyRecordState.userId}/bodyrecord/${recordId}`, payload);
    const editedMonth = formatMonthKey(payload.recorded_at);
    closeBodyEditModal();
    await refreshBodyRecords({
      historyMonth: editedMonth,
      keepHistoryOpen: true,
    });
  } catch (err) {
    showMessage(status, err.message || '更新身體數據失敗', true);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = '儲存修改';
    }
  }
}

async function deleteBodyRecord(recordId) {
  if (!recordId) {
    return;
  }

  const confirmed = window.confirm('確定要刪除這筆身體數據紀錄嗎？此操作無法復原。');
  if (!confirmed) {
    return;
  }

  try {
    await API.delete(`/users/${bodyRecordState.userId}/bodyrecord/${recordId}`);
    await refreshBodyRecords({ keepHistoryOpen: true });
  } catch (err) {
    window.alert(err.message || '刪除身體數據失敗');
  }
}

function renderBodyRecords(records, options = {}) {
  const chartShell = el('#bodyrecord-chart');
  if (!chartShell) {
    return;
  }

  const normalizedRecords = records.map(normalizeBodyRecord);
  const latestRecord = getLatestRecord(normalizedRecords);
  const defaultMonth = latestRecord ? formatRecordMonth(latestRecord) : formatMonthKey(new Date());
  const nextHistoryMonth = options.historyMonth || bodyRecordState.historyMonth || defaultMonth;
  const months = getSelectableMonths(normalizedRecords, [nextHistoryMonth]);
  const chartData = buildBodyChartData(normalizedRecords);
  const nextUserId = options.userId || bodyRecordState.userId;
  const nextCanEdit = options.canEdit ?? bodyRecordState.canEdit;
  const nextRange = options.chartRange !== undefined ? options.chartRange : (bodyRecordState.chartRange || '3m');
  const nextRangeStart = options.chartRangeStart !== undefined ? options.chartRangeStart : bodyRecordState.chartRangeStart;
  const nextRangeEnd = options.chartRangeEnd !== undefined ? options.chartRangeEnd : bodyRecordState.chartRangeEnd;
  const todayStr = toISODateString(new Date());

  resetBodyHistoryModalState();

  bodyRecordState = {
    records: normalizedRecords,
    chartRange: nextRange,
    chartRangeStart: nextRangeStart,
    chartRangeEnd: nextRangeEnd,
    historyMonth: nextHistoryMonth,
    chartPoints: [],
    userId: nextUserId,
    canEdit: nextCanEdit,
  };

  chartShell.innerHTML = `
    <div class="bodyrecord-range-toolbar">
      <div class="chart-range-btns" role="group" aria-label="時間範圍">
        ${CHART_RANGE_PRESETS.map((preset) => `
          <button
            class="chart-range-btn${nextRange === preset.value ? ' active' : ''}"
            type="button"
            data-range="${escapeHtml(preset.value)}"
          >${escapeHtml(preset.label)}</button>
        `).join('')}
      </div>
      <div id="chart-range-custom" class="chart-range-custom"${nextRange !== 'custom' ? ' hidden' : ''}>
        <input type="date" id="chart-range-start" value="${escapeHtml(nextRangeStart)}" max="${escapeHtml(todayStr)}">
        <span class="chart-range-sep">～</span>
        <input type="date" id="chart-range-end" value="${escapeHtml(nextRangeEnd || todayStr)}" max="${escapeHtml(todayStr)}">
        <button id="chart-range-apply" class="chart-range-apply-btn" type="button">套用</button>
      </div>
    </div>
    <div class="chart-shell">
      <canvas id="body-chart" class="chart-canvas"></canvas>
      <div id="body-chart-tooltip" class="body-chart-tooltip" hidden></div>
      <div class="legend">
        <span><span class="legend-dot" style="background:#1f4396;"></span>體重</span>
        <span><span class="legend-dot" style="background:#2d9ce0;"></span>體脂</span>
      </div>
    </div>
    <div class="bodyrecord-summary">
      ${renderBodyRecordSummary(latestRecord)}
      <button id="body-history-open" class="ghost-btn" type="button">查看歷史紀錄</button>
    </div>
    <div id="body-history-modal" class="modal-backdrop" hidden>
      <div class="modal-card body-history-modal-card" role="dialog" aria-modal="true" aria-labelledby="body-history-title">
        <div class="modal-head">
          <h2 id="body-history-title">歷史紀錄</h2>
          <button id="body-history-close-icon" class="ghost-btn modal-close-icon" type="button" aria-label="關閉">x</button>
        </div>
        <div class="bodyrecord-toolbar">
          <label for="body-history-month-select">月份：</label>
          <select id="body-history-month-select">
            ${renderMonthOptions(months, nextHistoryMonth)}
          </select>
        </div>
        <div id="body-history-list" class="body-history-list"></div>
        <div class="modal-actions">
          <button id="body-history-close" class="primary-btn" type="button">關閉</button>
        </div>
      </div>
    </div>
    <div id="body-edit-modal" class="modal-backdrop" hidden>
      <form id="body-edit-form" class="modal-card body-edit-modal-card" role="dialog" aria-modal="true" aria-labelledby="body-edit-title">
        <div class="modal-head">
          <h2 id="body-edit-title">編輯身體數據</h2>
          <button id="body-edit-close-icon" class="ghost-btn modal-close-icon" type="button" aria-label="關閉">x</button>
        </div>
        <input type="hidden" name="record_id">
        <label class="form-field">
          <span>體重 kg</span>
          <input type="number" name="weight" step="0.1" required>
        </label>
        <label class="form-field">
          <span>身高 cm</span>
          <input type="number" name="height" step="0.1" required>
        </label>
        <label class="form-field">
          <span>體脂 %</span>
          <input type="number" name="body_fat" step="0.1" required>
        </label>
        <label class="form-field">
          <span>紀錄日期時間</span>
          <input type="datetime-local" name="recorded_at" required>
        </label>
        <div id="body-edit-status" class="form-status" aria-live="polite"></div>
        <div class="modal-actions">
          <button id="body-edit-cancel" class="gray-btn" type="button">取消</button>
          <button class="primary-btn" type="submit">儲存修改</button>
        </div>
      </form>
    </div>
  `;

  drawBodyChart(chartData);
  bindBodyRecordControls();
  scheduleProfileLayoutSync();
}

function drawBodyChart(chartData) {
  const canvas = el('#body-chart');
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext('2d');
  const cssWidth = Math.max(canvas.clientWidth, 320);
  const cssHeight = Math.max(canvas.clientHeight, 300);
  const dpr = window.devicePixelRatio || 1;
  const targetW = Math.round(cssWidth * dpr);
  const targetH = Math.round(cssHeight * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = cssWidth;
  const height = cssHeight;
  const padding = {
    top: 24,
    right: 24,
    bottom: 44,
    left: 46,
  };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const allValues = chartData
    .flatMap((item) => [item.weight, item.bodyFat])
    .filter((value) => Number.isFinite(value));

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f8faff';
  ctx.fillRect(0, 0, width, height);
  bodyRecordState.chartPoints = [];
  hideBodyChartTooltip();

  if (!chartData.length || !allValues.length) {
    ctx.fillStyle = '#6f7d97';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('此區間尚無身體數據紀錄', width / 2, height / 2);
    return;
  }

  const maxValue = Math.max(...allValues);
  const minValue = Math.min(...allValues);
  const valuePadding = Math.max((maxValue - minValue) * 0.12, maxValue === minValue ? Math.max(Math.abs(maxValue) * 0.08, 1) : 0);
  const domainMin = minValue - valuePadding;
  const domainMax = maxValue + valuePadding;
  const range = domainMax - domainMin || 1;

  ctx.strokeStyle = '#dbe3f1';
  ctx.lineWidth = 1;

  for (let i = 0; i < 4; i += 1) {
    const y = padding.top + (plotHeight / 3) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    const value = domainMax - (range / 3) * i;
    ctx.fillStyle = '#6f7d97';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(value.toFixed(0), padding.left - 8, y);
  }

  const toPoint = (value, index, total) => {
    const x = total === 1
      ? padding.left + plotWidth / 2
      : padding.left + (plotWidth / Math.max(total - 1, 1)) * index;
    const y = padding.top + plotHeight - ((value - domainMin) / range) * plotHeight;
    return { x, y };
  };
  const hitPoints = [];

  const drawLine = (key, color) => {
    const points = chartData
      .map((item, index) => {
        const value = item[key];
        return Number.isFinite(value) ? { ...toPoint(value, index, chartData.length), value, data: item } : null;
      })
      .filter(Boolean);

    if (!points.length) {
      return;
    }

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    points.forEach((point) => {
      ctx.beginPath();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.fillStyle = color;
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      hitPoints.push(point);
    });
  };

  drawLine('weight', '#1f4396');
  drawLine('bodyFat', '#2d9ce0');

  ctx.fillStyle = '#6f7d97';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  chartData.forEach((record, index) => {
    const point = toPoint(domainMin, index, chartData.length);
    ctx.fillText(record.date, point.x, height - padding.bottom + 14);
  });

  bodyRecordState.chartPoints = hitPoints;

  bindBodyChartTooltip();
}

function hideBodyChartTooltip() {
  const tooltip = el('#body-chart-tooltip');
  if (tooltip) {
    tooltip.hidden = true;
  }
}

function bindBodyChartTooltip() {
  const canvas = el('#body-chart');
  const tooltip = el('#body-chart-tooltip');
  if (!canvas || !tooltip) {
    return;
  }

  canvas.onmouseleave = hideBodyChartTooltip;
  canvas.onmousemove = (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const nearest = bodyRecordState.chartPoints
      .map((point) => ({
        point,
        distance: Math.hypot(point.x - mouseX, point.y - mouseY),
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (!nearest || nearest.distance > 18) {
      hideBodyChartTooltip();
      return;
    }

    const data = nearest.point.data;
    tooltip.innerHTML = `
      <div><strong>${escapeHtml(data.fullDate)}</strong></div>
      <div>體重：${escapeHtml(formatNullableMetric(data.weight, 'kg'))}</div>
      <div>身高：${escapeHtml(formatNullableMetric(data.height, 'cm'))}</div>
      <div>體脂：${escapeHtml(formatNullableMetric(data.bodyFat, '%'))}</div>
    `;
    tooltip.style.left = `${Math.max(8, Math.min(nearest.point.x + 12, rect.width - 190))}px`;
    tooltip.style.top = `${Math.max(nearest.point.y - 76, 8)}px`;
    tooltip.hidden = false;
  };
}

function renderSessionList(sessions, canEdit) {
  const target = el('#profile-sessions');
  if (!target) return;

  if (!sessions.length) {
    target.innerHTML = createEmptyState('尚無訓練紀錄');
    return;
  }

  target.innerHTML = sessions.map((session) => `
    <div class="mini-card">
      <div class="action-row">
        <div>
          ${session.title
            ? `<strong>${escapeHtml(session.title)}</strong>`
            : '<span class="meta-line">未連結訓練計畫</span>'}
          <p class="page-description">${escapeHtml(session.notes || '無備註')}</p>
          <div class="meta-line">開始：${formatDate(session.start_time)}</div>
          <div class="meta-line">結束：${formatDate(session.end_time)}</div>
        </div>
        ${canEdit ? `<button class="danger-btn session-delete-btn" type="button" data-session-id="${escapeHtml(String(session.session_id))}">刪除</button>` : ''}
      </div>
    </div>
  `).join('');

  if (canEdit) {
    target.querySelectorAll('.session-delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => deleteSession(btn.dataset.sessionId));
    });
  }
}

async function deleteSession(sessionId) {
  if (!sessionId) return;

  const currentUser = getCurrentUser();
  if (!currentUser) return;

  if (!window.confirm('確定要刪除這筆訓練紀錄嗎？此操作無法復原。')) return;

  try {
    await API.delete(`/sessions/${sessionId}`, { user_id: currentUser.user_id });
    const updatedSessions = await API.get(`/users/${sessionState.userId}/sessions?viewer_id=${currentUser.user_id}`);
    sessionState.sessions = updatedSessions;
    renderSessionList(updatedSessions, sessionState.canEdit);
  } catch (err) {
    window.alert(err.message || '刪除訓練紀錄失敗');
  }
}

function renderSimpleList(selector, items, renderer, emptyText) {
  const target = el(selector);

  if (!target) {
    return;
  }

  target.innerHTML = items.length
    ? items.map(renderer).join('')
    : createEmptyState(emptyText);

  if (selector === '#profile-posts') {
    scheduleProfileLayoutSync();
  }
}

function setBodyRecordFormSubmitting(form, isSubmitting) {
  if (!form) {
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = isSubmitting || !form.checkValidity();
    submitButton.textContent = isSubmitting ? '新增中...' : '新增數據';
  }
}

function updateBodyRecordSubmitState(form) {
  if (!form) {
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = !form.checkValidity();
  }
}

function bindProfileForms(userId, currentUser, userPlans = []) {
  const canEdit = currentUser && Number(currentUser.user_id) === Number(userId);
  const bodyRecordForm = el('#bodyrecord-form');
  const bodyRecordStatus = el('#bodyrecord-status');

  // Populate session plan select with user's own plans
  const sessionPlanSelect = el('#session-plan-select');
  if (sessionPlanSelect && userPlans.length) {
    sessionPlanSelect.insertAdjacentHTML(
      'beforeend',
      userPlans.map((plan) => `<option value="${escapeHtml(String(plan.plan_id))}">${escapeHtml(plan.title)}</option>`).join('')
    );
  }

  const sessionForm = el('#session-form');
  const sessionStatus = el('#session-status');

  if (!canEdit) {
    disableFormWithMessage(el('#profile-form'), '只能編輯自己的個人資料');
    disableFormWithMessage(bodyRecordForm, '只能新增自己的身體紀錄', bodyRecordStatus);
    disableFormWithMessage(sessionForm, '只能新增自己的訓練紀錄', sessionStatus);
  }

  bindAvatarPreview();

  const removeAvatarBtn = el('#remove-avatar-btn');
  if (removeAvatarBtn) {
    const currentAvatarUrl = currentUser?.profile_image || '';
    removeAvatarBtn.hidden = !canEdit || !getAvatarSrc(currentAvatarUrl);
    removeAvatarBtn.disabled = !canEdit || !getAvatarSrc(currentAvatarUrl);
    removeAvatarBtn.onclick = async () => {
      if (!canEdit) {
        return;
      }

      const latestUser = getCurrentUser() || currentUser;
      if (!latestUser?.profile_image) {
        setRemoveAvatarButtonState(null);
        return;
      }

      const confirmed = window.confirm('確定要移除目前的頭像嗎？');
      if (!confirmed) {
        return;
      }

      const status = el('#profile-form-status');
      const avatarInput = el('#avatar-file');
      removeAvatarBtn.disabled = true;
      showMessage(status, '');

      try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}/avatar`, {
          method: 'DELETE',
          headers: {
            'X-User-Id': String(latestUser.user_id || currentUser.user_id),
          },
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.error || result.message || '移除頭像失敗');
        }

        const nextUser = result.user ? { ...latestUser, ...result.user } : { ...latestUser, profile_image: null };
        setCurrentUser(nextUser);
        syncProfileAvatarUI(nextUser.profile_image, nextUser.username);

        if (avatarInput) {
          avatarInput.value = '';
        }

        showMessage(status, '頭像已移除');
        window.setTimeout(() => window.location.reload(), 350);
      } catch (err) {
        showMessage(status, err.message || '移除頭像失敗', true);
        window.alert(err.message || '移除頭像失敗');
      } finally {
        const latestAvatar = (getCurrentUser() || currentUser)?.profile_image || null;
        setRemoveAvatarButtonState(latestAvatar);
      }
    };
  }

  sessionForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canEdit) return;

    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    showMessage(sessionStatus, '');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = '新增中...';
    }

    try {
      const payload = serializeForm(form);
      if (payload.start_time) payload.start_time = toApiDateTime(payload.start_time);
      if (payload.end_time) payload.end_time = toApiDateTime(payload.end_time);

      await API.post('/sessions', payload);

      form?.reset();
      showMessage(sessionStatus, '新增訓練紀錄成功');

      const updatedSessions = await API.get(`/users/${userId}/sessions?viewer_id=${currentUser.user_id}`);
      sessionState.sessions = updatedSessions;
      renderSessionList(updatedSessions, sessionState.canEdit);
    } catch (err) {
      showMessage(sessionStatus, err.message || '新增訓練紀錄失敗', true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = '新增訓練紀錄';
      }
    }
  });

  el('#profile-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canEdit) {
      return;
    }

    const form = event.currentTarget;
    const status = el('#profile-form-status');
    const avatarInput = el('#avatar-file');
    const avatarFile = avatarInput?.files?.[0];
    const error = validateAvatarFile(avatarFile);

    if (error) {
      showMessage(status, error, true);
      window.alert(error);
      return;
    }

    const formData = new FormData();
    formData.append('user_id', String(currentUser.user_id));
    formData.append('bio', form.bio?.value || '');
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = '更新中...';
    }
    showMessage(status, '');

    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'X-User-Id': String(currentUser.user_id),
        },
        body: formData,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || '更新資料失敗');
      }

      if (result.user) {
        const nextUser = { ...currentUser, ...result.user };
        setCurrentUser(nextUser);
        syncProfileAvatarUI(nextUser.profile_image, nextUser.username);
      }
      if (avatarInput) {
        avatarInput.value = '';
      }
      showMessage(status, '資料更新成功');
      window.setTimeout(() => window.location.reload(), 350);
    } catch (err) {
      showMessage(status, err.message || '更新資料失敗', true);
      window.alert(err.message || '更新資料失敗');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = '更新資料';
      }
    }
  });

  if (bodyRecordForm) {
    bodyRecordForm.addEventListener('input', () => updateBodyRecordSubmitState(bodyRecordForm));
    updateBodyRecordSubmitState(bodyRecordForm);
  }

  bodyRecordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canEdit) {
      return;
    }

    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      updateBodyRecordSubmitState(form);
      return;
    }

    const payload = serializeForm(form);

    if (payload.recorded_at) {
      payload.recorded_at = toApiDateTime(payload.recorded_at);
    }

    showMessage(bodyRecordStatus, '');
    setBodyRecordFormSubmitting(form, true);

    try {
      const created = await API.post(`/users/${userId}/bodyrecord`, payload);

      const createdMonth = formatMonthKey(created.recordedAt || created.recorded_at || payload.recorded_at || new Date());
      const nextRecords = await API.get(buildBodyRecordUrl(
        userId,
        bodyRecordState.chartRange,
        bodyRecordState.chartRangeStart,
        bodyRecordState.chartRangeEnd
      ));
      renderBodyRecords(nextRecords, {
        userId,
        canEdit,
        chartRange: bodyRecordState.chartRange,
        chartRangeStart: bodyRecordState.chartRangeStart,
        chartRangeEnd: bodyRecordState.chartRangeEnd,
        historyMonth: bodyRecordState.historyMonth || createdMonth,
      });
      form.reset();
      updateBodyRecordSubmitState(form);
      showMessage(bodyRecordStatus, '新增身體數據成功');
    } catch (err) {
      showMessage(bodyRecordStatus, err.message || '新增身體數據失敗', true);
    } finally {
      setBodyRecordFormSubmitting(form, false);
    }
  });
}

initProfilePage();
