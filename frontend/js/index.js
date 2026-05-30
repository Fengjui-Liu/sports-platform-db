let currentFeedMode = 'hot';

async function initHome() {
  try {
    const currentUser = getCurrentUser();
    const viewerId = currentUser?.user_id || '';

    const [boards, items] = await Promise.all([
      API.get('/boards'),
      API.get(`/feed?mode=hot&viewer_id=${viewerId}`),
    ]);

    renderBoardSidebar(boards, null);
    setupFeedModeTabs(currentUser);
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

function setupFeedModeTabs(currentUser) {
  const tabsContainer = el('#feed-tabs');
  if (!tabsContainer) return;

  tabsContainer.style.display = 'flex';

  tabsContainer.querySelectorAll('.feed-tab-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.feedMode || btn.dataset.feedTab;
      if (mode === currentFeedMode) return;

      if (mode === 'following' && !currentUser) {
        window.alert('\u8acb\u5148\u767b\u5165\u624d\u80fd\u67e5\u770b\u8ffd\u8e64\u4e2d\u7684\u8cbc\u6587');
        window.location.href = '/auth.html?mode=login';
        return;
      }

      tabsContainer.querySelectorAll('.feed-tab-btn').forEach((tabBtn) => {
        tabBtn.classList.remove('active');
      });
      btn.classList.add('active');
      currentFeedMode = mode;

      const feedEl = el('#latest-posts');
      feedEl.innerHTML = `<div class="empty-state">\u8f09\u5165\u4e2d...</div>`;

      try {
        const viewerId = currentUser?.user_id || '';
        const query = mode === 'following'
          ? `/feed?mode=following&user_id=${currentUser.user_id}&viewer_id=${currentUser.user_id}`
          : `/feed?mode=${mode}&viewer_id=${viewerId}`;
        const items = await API.get(query);

        if (mode === 'following' && !items.length) {
          feedEl.innerHTML = createEmptyState('\u4f60\u9084\u6c92\u6709\u8ffd\u8e64\u4efb\u4f55\u4eba\uff0c\u6216\u8ffd\u8e64\u7684\u4eba\u9084\u6c92\u6709\u767c\u6587\u3002');
          return;
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

  animateFeedCards(feedEl);
  setupFeedInteractions(feedEl, currentUser);
}

function animateFeedCards(feedEl) {
  feedEl.querySelectorAll('.post-feed-card').forEach((card, index) => {
    card.style.animationDelay = `${index * 60}ms`;
    card.classList.add('card-animate');
    card.addEventListener('animationend', () => {
      card.classList.remove('card-animate');
      card.style.animationDelay = '';
    }, { once: true });
  });
}

// ── 揪團卡片 ─────────────────────────────────────────────────────────────────
function renderInvitationCard(item) {
  const username = item.username || '未知使用者';
  const initial = getUserInitial(username);
  const avatarBg = getAvatarGradient(username);
  const ended = isInvitationEnded(item);

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
          <span class="post-board-tag">${getSportIcon(item.board_name)}${escapeHtml(getSportName(item.board_name) || '未分類')}</span>
          <span class="meta-dot">·</span>
          <span class="post-time">${formatPostTime(item.created_at)}</span>
          <span class="invitation-badge ${ended ? 'invitation-badge-ended' : ''}">${ended ? '已結束' : '揪團'}</span>
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

function isInvitationEnded(item) {
  return item.event_time && new Date(item.event_time).getTime() <= Date.now();
}

// ── 貼文卡片 ─────────────────────────────────────────────────────────────────
function renderPostCard(post, boardName) {
  const postId = getPostId(post);
  const postUrl = getPostDetailUrl(postId);
  const commentsUrl = getPostDetailUrl(postId, '#comments');
  const username = post.username || '\u672a\u77e5\u4f7f\u7528\u8005';
  const isLiked = Number(post.liked_by_viewer) === 1;
  const isBookmarked = Number(post.bookmarked_by_viewer) === 1;

  return `
    <article class='list-card post-feed-card post-clickable-card' data-post-id='${escapeHtml(postId)}' role='link' tabindex='0'>
      <a href='/user.html?id=${post.user_id}' class='post-avatar-link' data-card-ignore style='text-decoration:none;'>
        ${renderAuthorAvatar(username, post.profile_image)}
      </a>

      <div class='post-card-body'>
        <div class='post-card-meta'>
          <strong class='post-author'>
            <a href='/user.html?id=${post.user_id}' data-card-ignore style='color:var(--primary);text-decoration:none;'>${escapeHtml(username)}</a>
          </strong>
          <span class='meta-dot'>&middot;</span>
          <span class='post-board-tag'>${getSportIcon(boardName)}${escapeHtml(getSportName(boardName) || '\u904b\u52d5\u5c08\u6b04')}</span>
          <span class='meta-dot'>&middot;</span>
          <span class='post-time'>${formatPostTime(post.created_at)}</span>
        </div>

        <a class='post-title-link' href='${postUrl}' style='text-decoration:none;color:inherit;display:block;'>
          <h3 class='post-card-title'>${escapeHtml(post.title || '\u672a\u547d\u540d\u8cbc\u6587')}</h3>
        </a>
        <p class='post-card-content' data-open-post>${escapeHtml(post.content || '')}</p>

        <div class='post-card-actions'>
          <button
            class='like-btn ${isLiked ? 'is-liked' : ''}'
            data-action='like'
            data-post-id='${escapeHtml(postId)}'
            data-liked='${isLiked}'
            type='button'
          >
            <span class='like-icon'>${isLiked ? '&hearts;' : '&#9825;'}</span>
            <span class='like-count'>${post.like_count || 0}</span>
          </button>

          <a class='meta-line' href='${commentsUrl}' style='text-decoration:none;font-weight:700;'>
            \u7559\u8a00 ${post.comment_count || 0}
          </a>

          <button
            class='bookmark-btn ${isBookmarked ? 'is-bookmarked' : ''}'
            data-action='bookmark'
            data-post-id='${escapeHtml(postId)}'
            data-bookmarked='${isBookmarked}'
            type='button'
          >
            <span class='bookmark-icon'>${isBookmarked ? '&#9733;' : '&#9734;'}</span>
          </button>
        </div>
      </div>
    </article>
  `;
}

function setupFeedInteractions(container, currentUser) {
  container.addEventListener('click', async (event) => {
    const likeBtn = event.target.closest('[data-action="like"]');
    const bookmarkBtn = event.target.closest('[data-action="bookmark"]');

    if (likeBtn) {
      event.preventDefault();
      event.stopPropagation();
      await handleFeedLike(likeBtn, currentUser);
      return;
    }

    if (bookmarkBtn) {
      event.preventDefault();
      event.stopPropagation();
      await handleFeedBookmark(bookmarkBtn, currentUser);
      return;
    }

    if (event.target.closest('a, button, input, textarea, select, [data-card-ignore]')) {
      return;
    }

    const card = event.target.closest('.post-clickable-card[data-post-id]');
    if (card && container.contains(card)) {
      goToPostDetail(card.dataset.postId);
    }
  });

  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.post-clickable-card[data-post-id]');
    if (!card || !container.contains(card)) return;

    event.preventDefault();
    goToPostDetail(card.dataset.postId);
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
  triggerLikeAnimation(likeBtn, countEl);

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
