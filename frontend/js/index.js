async function initHome() {
  try {
    const currentUser = getCurrentUser();
    const viewerId = currentUser?.user_id || '';

    const [boards, posts] = await Promise.all([
      API.get('/boards'),
      API.get(`/posts?viewer_id=${viewerId}`),
    ]);

    renderBoardSidebar(boards, null);
    renderWelcomeBanner(currentUser);
    renderHeroLinks(currentUser, boards);
    renderLatestPosts(posts);
    setupFeedInteractions();
    setupCreateDropdown();
  } catch (err) {
    showMessage(el('#latest-posts'), err.message, true);
  }
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

function renderWelcomeBanner(currentUser) {
  const banner = el('#welcome-banner');

  if (!banner) {
    return;
  }

  banner.classList.add('home-welcome-banner');

  banner.style.background = 'linear-gradient(135deg, #123f91 0%, #2457b8 55%, #2f80ed 100%)';
  banner.style.color = '#ffffff';
  banner.style.border = 'none';
  banner.style.boxShadow = '0 20px 48px rgba(18, 63, 145, 0.24)';

  banner.innerHTML = currentUser
    ? `
      <div>
        <p 
          class='eyebrow' 
          style='
            color:#dbeafe;
            letter-spacing:0.14em;
            font-weight:900;
          '
        >
          WELCOME BACK
        </p>

        <h1 style='color:#ffffff;'>
          歡迎回來，${escapeHtml(currentUser.username)}
        </h1>

        <p 
          class='page-description'
          style='
            color:#eaf2ff;
            max-width:760px;
          '
        >
          繼續查看運動專欄、參與討論，或管理你的訓練紀錄。
        </p>
      </div>
    `
    : `
      <div>
        <p 
          class='eyebrow' 
          style='
            color:#dbeafe;
            letter-spacing:0.14em;
            font-weight:900;
          '
        >
          WELCOME
        </p>

        <h1 style='color:#ffffff;'>
          歡迎來到 SportBoard
        </h1>

        <p 
          class='page-description'
          style='
            color:#eaf2ff;
            max-width:760px;
          '
        >
          加入討論、分享訓練、找到你的運動社群。
        </p>
      </div>
    `;
}

function renderHeroLinks(currentUser, boards) {
  const firstBoard = boards[0];
  const heroBoardLink = el('#hero-board-link');
  const heroProfileLink = el('#hero-profile-link');

  if (heroBoardLink) {
    heroBoardLink.href = firstBoard
      ? `/board.html?id=${firstBoard.board_id}`
      : '/board.html';
  }

  if (heroProfileLink) {
    heroProfileLink.href = currentUser
      ? `/profile.html?id=${currentUser.user_id}`
      : '/auth.html?mode=login';

    heroProfileLink.textContent = currentUser ? '我的頁面' : '登入 / 註冊';
  }
}

function renderLatestPosts(posts) {
  const latestPosts = el('#latest-posts');

  if (!latestPosts) {
    return;
  }

  latestPosts.innerHTML = posts.length
    ? posts
        .map((post) => renderPostCard(post, post.board_name || '未分類'))
        .join('')
    : createEmptyState('目前沒有任何貼文');
}

function renderPostCard(post, boardName) {
  const username = post.username || '未知使用者';
  const isLiked = post.liked_by_viewer === 1;

  return `
    <div class='list-card post-feed-card' data-post-id='${post.post_id}'>
      ${renderAuthorAvatar(username, post.profile_image)}

      <div class='post-card-body'>
        <a class='post-card-link-overlay' href='/post.html?id=${post.post_id}'>
          <div class='post-card-meta'>
            <strong class='post-author'>${escapeHtml(username)}</strong>
            <span class='meta-dot'>•</span>
            <span class='post-board-tag'>${renderBoardTagText(boardName)}</span>
            <span class='meta-dot'>•</span>
            <span class='post-time'>${formatPostTime(post.created_at)}</span>
          </div>

          <h3 class='post-card-title'>${escapeHtml(post.title || '未命名貼文')}</h3>
          <p class='post-card-content'>${escapeHtml(post.content || '')}</p>
        </a>

        <div class='post-card-actions' aria-label='貼文互動資訊'>
          <button 
            class='like-btn ${isLiked ? 'is-liked' : ''}' 
            data-action='like' 
            data-post-id='${post.post_id}'
            data-liked='${isLiked}'
          >
            <span class='like-icon'>${isLiked ? '❤️' : '🤍'}</span>
            <span class='like-count'>${post.like_count || 0}</span>
          </button>
          
          <a class='meta-line' href='/post.html?id=${post.post_id}#comments' style='text-decoration:none; font-weight:700;'>
            留言 ${post.comment_count || 0}
          </a>
          
          <span class='meta-line' style='font-weight:700;'>收藏</span>
        </div>
      </div>
    </div>
  `;
}

function setupFeedInteractions() {
  const feed = el('#latest-posts');
  if (!feed) return;

  feed.addEventListener('click', async (event) => {
    const likeBtn = event.target.closest('[data-action="like"]');
    if (!likeBtn) return;

    event.preventDefault();

    const currentUser = getCurrentUser();
    if (!currentUser) {
      window.alert('請先登入才能按讚');
      window.location.href = '/auth.html?mode=login';
      return;
    }

    const postId = likeBtn.dataset.postId;
    const isLiked = likeBtn.dataset.liked === 'true';
    const countEl = likeBtn.querySelector('.like-count');
    const iconEl = likeBtn.querySelector('.like-icon');
    let currentCount = parseInt(countEl.textContent);

    // Optimistic UI Update
    const newLiked = !isLiked;
    const newCount = newLiked ? currentCount + 1 : Math.max(0, currentCount - 1);

    likeBtn.dataset.liked = String(newLiked);
    likeBtn.classList.toggle('is-liked', newLiked);
    countEl.textContent = newCount;
    iconEl.textContent = newLiked ? '❤️' : '🤍';

    try {
      if (newLiked) {
        await API.post(`/posts/${postId}/like`, { user_id: currentUser.user_id });
      } else {
        await API.delete(`/posts/${postId}/like`, { user_id: currentUser.user_id });
      }
    } catch (err) {
      // Revert on failure
      window.alert('操作失敗: ' + err.message);
      likeBtn.dataset.liked = String(isLiked);
      likeBtn.classList.toggle('is-liked', isLiked);
      countEl.textContent = currentCount;
      iconEl.textContent = isLiked ? '❤️' : '🤍';
    }
  });
}

function renderAuthorAvatar(username, profileImage) {
  const initial = getUserInitial(username);
  const background = getAvatarGradient(username);

  if (profileImage) {
    return `
      <span class='post-avatar' style='--avatar-bg:${background};'>
        <img src='${escapeHtml(profileImage)}' alt='${escapeHtml(username)}'>
      </span>
    `;
  }

  return `
    <span class='post-avatar' style='--avatar-bg:${background};'>
      ${escapeHtml(initial)}
    </span>
  `;
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

function renderBoardTagText(boardName) {
  const emoji = getSportEmoji(boardName);
  const label = escapeHtml(boardName || '未分類');
  return emoji ? `${emoji} ${label}` : label;
}

function getSportEmoji(boardName) {
  const emojiMap = {
  };

  return emojiMap[String(boardName || '').toLowerCase()] || '';
}

function formatPostTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${Math.max(1, diffMinutes)} 分鐘前`;
  }

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  return date.toLocaleDateString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
  });
}

function renderPostTypeChip(postType) {
  if (!postType || String(postType).toLowerCase() === 'text') {
    return '';
  }

  return `<span class='chip muted-chip'>${escapeHtml(postType)}</span>`;
}

initHome();
