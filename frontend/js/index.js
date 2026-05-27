async function initHome() {
  try {
    const [boards, posts] = await Promise.all([
      API.get('/boards'),
      API.get('/posts'),
    ]);

    const currentUser = getCurrentUser();

    renderBoardSidebar(boards, null);
    renderWelcomeBanner(currentUser);
    renderHeroLinks(currentUser, boards);
    renderLatestPosts(posts);
  } catch (err) {
    showMessage(el('#latest-posts'), err.message, true);
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
          class="eyebrow" 
          style="
            color:#dbeafe;
            letter-spacing:0.14em;
            font-weight:900;
          "
        >
          WELCOME BACK
        </p>

        <h1 style="color:#ffffff;">
          🏃 歡迎回來，${escapeHtml(currentUser.username)}
        </h1>

        <p 
          class="page-description"
          style="
            color:#eaf2ff;
            max-width:760px;
          "
        >
          繼續查看運動專欄、參與討論，或管理你的訓練紀錄。
        </p>
      </div>
    `
    : `
      <div>
        <p 
          class="eyebrow" 
          style="
            color:#dbeafe;
            letter-spacing:0.14em;
            font-weight:900;
          "
        >
          WELCOME
        </p>

        <h1 style="color:#ffffff;">
          🏃 歡迎來到 SportBoard
        </h1>

        <p 
          class="page-description"
          style="
            color:#eaf2ff;
            max-width:760px;
          "
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
        .map(
          (post) => `
            <a class="list-card" href="/post.html?id=${post.post_id}">
              <div class="action-row">
                <div>
                  <div class="chip-row">
                    <span class="chip">
                      ${getBoardEmoji(post.board_name)} ${escapeHtml(post.board_name || '未分類')}
                    </span>
                    ${renderPostTypeChip(post.post_type)}
                  </div>

                  <h3 style="margin-top:12px;">
                    ${escapeHtml(post.title || '未命名貼文')}
                  </h3>

                  <div class="meta-line">
                    by ${escapeHtml(post.username || '未知使用者')}
                  </div>
                </div>

                <span class="meta-line">${formatDate(post.created_at)}</span>
              </div>

              <p class="page-description">
                ${escapeHtml(truncateText(post.content || '', 180))}
              </p>

              <div class="chip-row">
                <span class="chip muted-chip">❤️ ${post.like_count || 0}</span>
                <span class="chip muted-chip">💬 ${post.comment_count || 0}</span>
              </div>
            </a>
          `
        )
        .join('')
    : createEmptyState('目前沒有任何貼文');
}

function renderPostTypeChip(postType) {
  if (!postType || String(postType).toLowerCase() === 'text') {
    return '';
  }

  return `<span class="chip muted-chip">${escapeHtml(postType)}</span>`;
}

initHome();