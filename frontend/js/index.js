let currentFeedTab = 'all';

async function initHome() {
  try {
    const currentUser = getCurrentUser();
    const viewerId = currentUser?.user_id || '';

    const [boards, items] = await Promise.all([
      API.get('/boards'),
      API.get(`/feed?viewer_id=${viewerId}`),
    ]);

    renderBoardSidebar(boards, null);
    setupFeedTabs(currentUser);
    renderFeedItems(items, currentUser);
    setupCreateDropdown();
  } catch (err) {
    showMessage(el('#latest-posts'), err.message, true);
  }
}

function setupFeedTabs(currentUser) {
  const tabsContainer = el('#feed-tabs');
  if (!tabsContainer) return;

  if (!currentUser) {
    tabsContainer.style.display = 'none';
    return;
  }

  tabsContainer.style.display = 'flex';

  tabsContainer.querySelectorAll('.feed-tab-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tab = btn.dataset.feedTab;
      if (tab === currentFeedTab) return;

      tabsContainer.querySelectorAll('.feed-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFeedTab = tab;

      const feedEl = el('#latest-posts');
      feedEl.innerHTML = `<div class="empty-state">載入中...</div>`;

      try {
        let items;
        if (tab === 'following') {
          items = await API.get(`/feed?following=1&user_id=${currentUser.user_id}&viewer_id=${currentUser.user_id}`);
          if (!items.length) {
            feedEl.innerHTML = createEmptyState('你還沒有追蹤任何人，或追蹤的人還沒有發文。');
            return;
          }
        } else {
          items = await API.get(`/feed?viewer_id=${currentUser.user_id}`);
        }
        renderFeedItems(items, currentUser);
      } catch (err) {
        showMessage(el('#latest-posts'), err.message, true);
      }
    });
  });
}

function setupCreateDropdown() {
  const createMenuBtn = el('#btn-create-menu');
  const createMenuContainer = document.querySelector('.create-dropdown-container');

  if (createMenuBtn && createMenuContainer) {
    createMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      createMenuContainer.classList.toggle('is-active');
    });

    document.addEventListener('click', (e) => {
      if (!createMenuContainer.contains(e.target)) {
        createMenuContainer.classList.remove('is-active');
      }
    });
  }
}

function renderFeedItems(items, currentUser) {
  const feedEl = el('#latest-posts');
  if (!feedEl) return;

  if (!items.length) {
    feedEl.innerHTML = createEmptyState('目前沒有任何動態');
    return;
  }

  feedEl.innerHTML = items
    .map((item) =>
      item.type === 'invitation'
        ? renderInvitationCard(item)
        : renderPostCard(item, item.board_name || '未分類')
    )
    .join('');

  setupFeedInteractions(feedEl, currentUser);
}

// ── 揪團卡片 ─────────────────────────────────────────────────────────────────
function renderInvitationCard(item) {
  const username = item.username || '未知使用者';
  const initial = getUserInitial(username);
  const avatarBg = getAvatarGradient(username);

  const avatar = item.profile_image
    ? `<img src="${escapeHtml(item.profile_image)}" alt="${escapeHtml(username)}">`
    : escapeHtml(initial);

  return `
    <div class="list-card post-feed-card" data-type="invitation">
      <a href="/user.html?id=${item.user_id}" class="post-avatar-link" style="text-decoration:none;">
        <span class="post-avatar" style="--avatar-bg:${avatarBg};">${avatar}</span>
      </a>

      <div class="post-card-body">
        <div class="post-card-meta">
          <strong class="post-author">
            <a href="/user.html?id=${item.user_id}" style="color:var(--primary);text-decoration:none;">${escapeHtml(username)}</a>
          </strong>
          <span class="meta-dot">·</span>
          <span class="post-board-tag">${escapeHtml(item.board_name || '未分類')}</span>
          <span class="meta-dot">·</span>
          <span class="post-time">${formatPostTime(item.created_at)}</span>
          <span class="invitation-badge">揪團</span>
        </div>

        <a href="/board.html?id=${item.board_id}&tab=invitations" style="text-decoration:none;color:inherit;display:block;">
          <h3 class="post-card-title">${escapeHtml(item.title || '揪團活動')}</h3>

          <div class="chip-row" style="margin-top:6px;">
            ${item.location ? `<span class="chip muted-chip">${escapeHtml(item.location)}</span>` : ''}
            ${item.event_time ? `<span class="chip muted-chip">${formatDate(item.event_time)}</span>` : ''}
            <span class="chip muted-chip">
              ${item.participant_count || 0} / ${item.max_participants || '?'} 人
            </span>
          </div>
        </a>
      </div>
    </div>
  `;
}

// ── 貼文卡片 ─────────────────────────────────────────────────────────────────
function renderPostCard(post, boardName) {
  const username = post.username || '未知使用者';
  const isLiked = Number(post.liked_by_viewer) === 1;
  const isBookmarked = Number(post.bookmarked_by_viewer) === 1;

  return `
    <div class='list-card post-feed-card' data-post-id='${post.post_id}'>
      <a href='/user.html?id=${post.user_id}' class='post-avatar-link' style='text-decoration:none;'>
        ${renderAuthorAvatar(username, post.profile_image)}
      </a>

      <div class='post-card-body'>
        <a class='post-card-link-overlay' href='/post.html?id=${post.post_id}' style='text-decoration:none;color:inherit;display:block;'>
          <div class='post-card-meta'>
            <strong class='post-author'>
              <a href='/user.html?id=${post.user_id}' style='color:var(--primary);text-decoration:none;'>${escapeHtml(username)}</a>
            </strong>
            <span class='meta-dot'>·</span>
            <span class='post-board-tag'>${escapeHtml(boardName || '未分類')}</span>
            <span class='meta-dot'>·</span>
            <span class='post-time'>${formatPostTime(post.created_at)}</span>
          </div>

          <h3 class='post-card-title'>${escapeHtml(post.title || '未命名貼文')}</h3>
          <p class='post-card-content'>${escapeHtml(post.content || '')}</p>
        </a>

        <div class='post-card-actions'>
          <button
            class='like-btn ${isLiked ? 'is-liked' : ''}'
            data-action='like'
            data-post-id='${post.post_id}'
            data-liked='${isLiked}'
          >
            <span class='like-icon'>${isLiked ? '♥' : '♡'}</span>
            <span class='like-count'>${post.like_count || 0}</span>
          </button>

          <a class='meta-line' href='/post.html?id=${post.post_id}#comments' style='text-decoration:none;font-weight:700;'>
            留言 ${post.comment_count || 0}
          </a>

          <button
            class='bookmark-btn ${isBookmarked ? 'is-bookmarked' : ''}'
            data-action='bookmark'
            data-post-id='${post.post_id}'
            data-bookmarked='${isBookmarked}'
          >
            <span class='bookmark-icon'>${isBookmarked ? '★' : '☆'}</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// ── 互動事件委派 ─────────────────────────────────────────────────────────────
function setupFeedInteractions(container, currentUser) {
  container.addEventListener('click', async (event) => {
    const likeBtn = event.target.closest('[data-action="like"]');
    const bookmarkBtn = event.target.closest('[data-action="bookmark"]');

    if (likeBtn) {
      event.preventDefault();
      await handleFeedLike(likeBtn, currentUser);
    }

    if (bookmarkBtn) {
      event.preventDefault();
      await handleFeedBookmark(bookmarkBtn, currentUser);
    }
  });
}

async function handleFeedLike(likeBtn, currentUser) {
  if (!currentUser) {
    window.alert('請先登入才能按讚');
    window.location.href = '/auth.html?mode=login';
    return;
  }

  const postId = likeBtn.dataset.postId;
  const isLiked = likeBtn.dataset.liked === 'true';
  const countEl = likeBtn.querySelector('.like-count');
  const iconEl = likeBtn.querySelector('.like-icon');
  const currentCount = parseInt(countEl.textContent) || 0;
  const newLiked = !isLiked;
  const newCount = newLiked ? currentCount + 1 : Math.max(0, currentCount - 1);

  likeBtn.dataset.liked = String(newLiked);
  likeBtn.classList.toggle('is-liked', newLiked);
  countEl.textContent = newCount;
  iconEl.textContent = newLiked ? '♥' : '♡';

  try {
    if (newLiked) {
      await API.post(`/posts/${postId}/like`, { user_id: currentUser.user_id });
    } else {
      await API.delete(`/posts/${postId}/like`, { user_id: currentUser.user_id });
    }
  } catch (err) {
    likeBtn.dataset.liked = String(isLiked);
    likeBtn.classList.toggle('is-liked', isLiked);
    countEl.textContent = currentCount;
    iconEl.textContent = isLiked ? '♥' : '♡';
    window.alert('操作失敗：' + err.message);
  }
}

async function handleFeedBookmark(bookmarkBtn, currentUser) {
  if (!currentUser) {
    window.alert('請先登入才能收藏');
    window.location.href = '/auth.html?mode=login';
    return;
  }

  const postId = bookmarkBtn.dataset.postId;
  const isBookmarked = bookmarkBtn.dataset.bookmarked === 'true';
  const iconEl = bookmarkBtn.querySelector('.bookmark-icon');
  const newBookmarked = !isBookmarked;

  bookmarkBtn.dataset.bookmarked = String(newBookmarked);
  bookmarkBtn.classList.toggle('is-bookmarked', newBookmarked);
  iconEl.textContent = newBookmarked ? '★' : '☆';

  try {
    if (newBookmarked) {
      await API.post(`/posts/${postId}/bookmark`, { user_id: currentUser.user_id });
    } else {
      await API.delete(`/posts/${postId}/bookmark`, { user_id: currentUser.user_id });
    }
  } catch (err) {
    bookmarkBtn.dataset.bookmarked = String(isBookmarked);
    bookmarkBtn.classList.toggle('is-bookmarked', isBookmarked);
    iconEl.textContent = isBookmarked ? '★' : '☆';
    window.alert('操作失敗：' + err.message);
  }
}

// ── 共用工具 ─────────────────────────────────────────────────────────────────
function renderAuthorAvatar(username, profileImage) {
  const initial = getUserInitial(username);
  const background = getAvatarGradient(username);

  if (profileImage) {
    return `<span class='post-avatar' style='--avatar-bg:${background};'><img src='${escapeHtml(profileImage)}' alt='${escapeHtml(username)}'></span>`;
  }
  return `<span class='post-avatar' style='--avatar-bg:${background};'>${escapeHtml(initial)}</span>`;
}

function getUserInitial(username) {
  return String(username || 'U').trim().slice(0, 1).toUpperCase() || 'U';
}

function getAvatarGradient(username) {
  const gradients = [
    'linear-gradient(135deg, #1f4396, #2d9ce0)',
    'linear-gradient(135deg, #ff6b35, #ffb86c)',
    'linear-gradient(135deg, #2ecc71, #16a085)',
    'linear-gradient(135deg, #9b59b6, #6c5ce7)',
    'linear-gradient(135deg, #34495e, #95a5a6)',
  ];
  const seed = String(username || 'U').charCodeAt(0) || 0;
  return gradients[seed % gradients.length];
}

function formatPostTime(value) {
  if (!value) return '';

  const date = new Date(value);
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `${Math.max(1, diffMinutes)} 分鐘前`;

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  return date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
}

initHome();
