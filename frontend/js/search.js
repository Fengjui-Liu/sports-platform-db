async function initSearchPage() {
  const params = getParams();
  const q = params.get('q') || '';

  const searchInput = el('#search-input');
  if (searchInput && q) searchInput.value = q;

  if (!q.trim()) return;

  const resultsEl = el('#search-results');
  resultsEl.innerHTML = `<div class="empty-state">搜尋「${escapeHtml(q)}」中...</div>`;

  try {
    const data = await API.get(`/search?q=${encodeURIComponent(q)}`);
    renderSearchResults(data, q);
  } catch (err) {
    resultsEl.innerHTML = createEmptyState('搜尋失敗：' + err.message);
  }
}

function renderSearchResults(data, q) {
  const resultsEl = el('#search-results');
  const { posts = [], users = [], plans = [] } = data;
  const totalCount = posts.length + users.length + plans.length;

  if (totalCount === 0) {
    resultsEl.innerHTML = createEmptyState(`找不到「${escapeHtml(q)}」相關的結果`);
    return;
  }

  resultsEl.innerHTML = `
    ${users.length > 0 ? renderUserResults(users) : ''}
    ${posts.length > 0 ? renderPostResults(posts) : ''}
    ${plans.length > 0 ? renderPlanResults(plans) : ''}
    <p class="meta-line" style="text-align:center;">共找到 ${totalCount} 筆結果</p>
  `;
}

function renderUserResults(users) {
  return `
    <section class="panel-card">
      <div class="section-head">
        <h2>用戶（${users.length}）</h2>
      </div>
      <div class="stack-list">
        ${users.map((user) => `
          <a class="list-card" href="/user.html?id=${user.user_id}" style="display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;">
            ${renderSearchAvatar(user.username, user.profile_image)}
            <div style="flex:1;min-width:0;">
              <strong style="color:var(--primary);">${escapeHtml(user.username)}</strong>
              <p class="meta-line" style="margin:2px 0;">${escapeHtml(user.bio || '')}</p>
            </div>
            <span class="chip muted-chip">追蹤者 ${user.follower_count || 0}</span>
          </a>
        `).join('')}
      </div>
    </section>
  `;
}

function renderPostResults(posts) {
  return `
    <section class="panel-card">
      <div class="section-head">
        <h2>貼文（${posts.length}）</h2>
      </div>
      <div class="stack-list post-feed-list">
        ${posts.map((post) => `
          <a class="list-card post-feed-card" href="/post.html?id=${post.post_id}" style="text-decoration:none;color:inherit;display:grid;grid-template-columns:40px minmax(0,1fr);gap:12px;padding:16px;">
            ${renderSearchAvatar(post.username, post.profile_image)}
            <div>
              <div class="post-card-meta">
                <strong class="post-author">${escapeHtml(post.username)}</strong>
                <span class="meta-dot">·</span>
                <span class="post-board-tag">${getSportIcon(post.board_name)}${escapeHtml(getSportName(post.board_name) || '未分類')}</span>
                <span class="meta-dot">·</span>
                <span class="post-time">${formatPostMetaTime(post)}</span>
              </div>
              <h3 class="post-card-title">${escapeHtml(post.title || '未命名貼文')}</h3>
              <p class="post-card-content">${escapeHtml(post.content || '')}</p>
              <div class="post-card-actions" style="margin-top:6px;">
                <span>讚 ${post.like_count || 0}</span>
                <span>留言 ${post.comment_count || 0}</span>
              </div>
            </div>
          </a>
        `).join('')}
      </div>
    </section>
  `;
}

function renderPlanResults(plans) {
  return `
    <section class="panel-card">
      <div class="section-head">
        <h2>訓練計畫（${plans.length}）</h2>
      </div>
      <div class="card-grid">
        ${plans.map((plan) => `
          <a class="mini-card" href="/workoutplan.html?id=${plan.plan_id}" style="text-decoration:none;color:inherit;display:block;">
            <div class="chip-row" style="margin-bottom:8px;">
              <span class="chip">${escapeHtml(formatDifficultyLevel(plan.difficulty_level) || '未設定')}</span>
              <span class="chip muted-chip">${getSportIcon(plan.sport_type)}${escapeHtml(getSportName(plan.sport_type) || '未分類')}</span>
            </div>
            <h3 style="margin:0 0 4px;">${escapeHtml(plan.title)}</h3>
            <p class="page-description">${escapeHtml(plan.exercise_name || '')} · ${plan.sets || 0} sets · ${plan.reps || 0} reps</p>
            <div class="meta-line">by ${escapeHtml(plan.username)}</div>
          </a>
        `).join('')}
      </div>
    </section>
  `;
}

function renderSearchAvatar(username, profileImage) {
  const gradients = [
    'linear-gradient(135deg, #1f4396, #2d9ce0)',
    'linear-gradient(135deg, #ff6b35, #ffb86c)',
    'linear-gradient(135deg, #2ecc71, #16a085)',
    'linear-gradient(135deg, #9b59b6, #6c5ce7)',
    'linear-gradient(135deg, #34495e, #95a5a6)',
  ];
  const seed = String(username || 'U').charCodeAt(0) || 0;
  const bg = gradients[seed % gradients.length];
  const initial = String(username || 'U').trim().slice(0, 1).toUpperCase();

  if (profileImage) {
    return `<span class="post-avatar" style="--avatar-bg:${bg};flex:0 0 40px;"><img src="${escapeHtml(profileImage)}" alt="${escapeHtml(username)}"></span>`;
  }
  return `<span class="post-avatar" style="--avatar-bg:${bg};flex:0 0 40px;">${escapeHtml(initial)}</span>`;
}

initSearchPage();
