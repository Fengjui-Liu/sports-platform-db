async function initHome() {
  try {
    const [boards, posts] = await Promise.all([API.get('/boards'), API.get('/posts')]);
    const currentUser = getCurrentUser();

    renderBoardSidebar(boards, null);
    renderWelcomeBanner(currentUser);

    if (boards.length) {
      el('#hero-board-link').href = `/board.html?id=${boards[0].board_id}`;
    }

    el('#hero-profile-link').href = currentUser ? `/profile.html?id=${currentUser.user_id}` : '/auth.html?mode=login';
    el('#hero-profile-link').textContent = currentUser ? '我的頁面' : '登入 / 註冊';

    const latestPosts = el('#latest-posts');
    latestPosts.innerHTML = posts.length
      ? posts
          .map(
            (post) => `
              <a class="list-card" href="/post.html?id=${post.post_id}">
                <div class="action-row">
                  <div>
                    <div class="chip-row">
                      <span class="chip">${getBoardEmoji(post.board_name)} ${escapeHtml(post.board_name)}</span>
                      ${renderPostTypeChip(post.post_type)}
                    </div>
                    <h3 style="margin-top:12px;">${escapeHtml(post.username)}</h3>
                  </div>
                  <span class="meta-line">${formatDate(post.created_at)}</span>
                </div>
                <p class="page-description">${escapeHtml(truncateText(post.content, 180))}</p>
                <div class="chip-row">
                  <span class="chip muted-chip">❤️ ${post.like_count}</span>
                  <span class="chip muted-chip">💬 ${post.comment_count}</span>
                </div>
              </a>
            `
          )
          .join('')
      : createEmptyState('目前沒有任何貼文');
  } catch (err) {
    showMessage(el('#latest-posts'), err.message, true);
  }
}

function renderWelcomeBanner(currentUser) {
  const banner = el('#welcome-banner');
  if (!banner) {
    return;
  }

  banner.innerHTML = currentUser
    ? `
      <div>
        <h2>🏃 歡迎來到 SportBoard</h2>
        <p>歡迎回來，${escapeHtml(currentUser.username)}！</p>
      </div>
    `
    : `
      <div>
        <h2>🏃 歡迎來到 SportBoard</h2>
        <p>加入討論、分享訓練、找到你的運動社群。</p>
      </div>
    `;
}

function renderPostTypeChip(postType) {
  if (!postType || String(postType).toLowerCase() === 'text') {
    return '';
  }
  return `<span class="chip muted-chip">${escapeHtml(postType)}</span>`;
}

initHome();
