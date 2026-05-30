async function initUserPage() {
  const currentUser = getCurrentUser();
  const params = getParams();
  const userId = params.get('id');

  if (!userId) {
    el('#user-profile-card').innerHTML = createEmptyState('缺少用戶 ID');
    return;
  }

  if (currentUser && String(currentUser.user_id) === String(userId)) {
    window.location.href = `/profile.html?id=${userId}`;
    return;
  }

  try {
    const viewerQuery = currentUser ? `?viewer_id=${currentUser.user_id}` : '';

    const [user, posts] = await Promise.all([
      API.get(`/users/${userId}${viewerQuery}`),
      API.get(`/users/${userId}/posts`),
    ]);

    document.title = `${user.username} | SportBoard`;
    renderUserProfile(user, currentUser);
    renderUserPosts(posts);
  } catch (err) {
    el('#user-profile-card').innerHTML = createEmptyState(err.message || '找不到用戶');
  }
}

function renderUserProfile(user, currentUser) {
  const target = el('#user-profile-card');
  if (!target) return;

  const isFollowing = Number(user.is_followed_by_viewer) === 1;
  const canFollow = currentUser && String(currentUser.user_id) !== String(user.user_id);
  const avatarBg = getAvatarGradientByUsername(user.username);

  const avatar = user.profile_image
    ? `<img class="avatar" src="${escapeHtml(user.profile_image)}" alt="avatar" style="width:88px;height:88px;border-radius:50%;object-fit:cover;">`
    : `<span class="avatar-circle" style="width:88px;height:88px;font-size:32px;background:${avatarBg};">${escapeHtml(getUserInitials(user.username))}</span>`;

  target.innerHTML = `
    <div style="width:100%;">
      <div class="profile-summary" style="align-items:flex-start;">
        ${avatar}

        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <h1 style="margin:0;">${escapeHtml(user.username)}</h1>

            ${
              canFollow
                ? `<button id="follow-btn" class="${isFollowing ? 'ghost-btn' : 'primary-btn'}" data-following="${isFollowing}" style="min-width:90px;">
                    ${isFollowing ? '已追蹤' : '追蹤'}
                   </button>`
                : ''
            }

            ${
              !currentUser
                ? `<a href="/auth.html?mode=login" class="primary-btn" style="text-decoration:none;min-width:90px;display:inline-flex;align-items:center;justify-content:center;">登入後追蹤</a>`
                : ''
            }
          </div>

          <p class="page-description" style="margin-top:8px;">
            ${escapeHtml(user.bio || '')}
          </p>

          <div class="chip-row" style="margin-top:12px;">
            <span class="chip">貼文 ${user.post_count || 0}</span>
            <span class="chip">追蹤者 <strong id="follower-count">${user.follower_count || 0}</strong></span>
            <span class="chip">追蹤中 ${user.following_count || 0}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  bindFollowButton(user, currentUser);
}

function bindFollowButton(user, currentUser) {
  const followBtn = el('#follow-btn');
  if (!followBtn || !currentUser) return;

  followBtn.addEventListener('click', async () => {
    const isFollowing = followBtn.dataset.following === 'true';
    const newFollowing = !isFollowing;

    followBtn.disabled = true;
    followBtn.textContent = newFollowing ? '已追蹤' : '追蹤';
    followBtn.className = newFollowing ? 'ghost-btn' : 'primary-btn';
    followBtn.dataset.following = String(newFollowing);

    const followerCount = el('#follower-count');
    if (followerCount) {
      const current = parseInt(followerCount.textContent) || 0;
      followerCount.textContent = newFollowing ? current + 1 : Math.max(0, current - 1);
    }

    try {
      if (newFollowing) {
        await API.post(`/users/${user.user_id}/follow`, { follower_id: currentUser.user_id });
      } else {
        await API.delete(`/users/${user.user_id}/follow`, { follower_id: currentUser.user_id });
      }
    } catch (err) {
      followBtn.dataset.following = String(isFollowing);
      followBtn.className = isFollowing ? 'ghost-btn' : 'primary-btn';
      followBtn.textContent = isFollowing ? '已追蹤' : '追蹤';
      if (followerCount) {
        const current = parseInt(followerCount.textContent) || 0;
        followerCount.textContent = isFollowing ? current + 1 : Math.max(0, current - 1);
      }
      window.alert('操作失敗：' + err.message);
    } finally {
      followBtn.disabled = false;
    }
  });
}

function renderUserPosts(posts) {
  const target = el('#user-posts');
  if (!target) return;

  const titleEl = el('#user-posts-title');
  if (titleEl) titleEl.textContent = `貼文（${posts.length}）`;

  if (!posts.length) {
    target.innerHTML = createEmptyState('此用戶尚未發佈貼文');
    return;
  }

  target.innerHTML = posts.map((post) => `
    <a class="list-card" href="/post.html?id=${post.post_id}" style="display:block;text-decoration:none;color:inherit;">
      <div class="action-row">
        <div>
          <div class="chip-row" style="margin-bottom:8px;">
            <span class="chip">${getSportIcon(post.board_name)}${escapeHtml(getSportName(post.board_name) || '未分類')}</span>
          </div>
          <h3 style="margin:0;">${escapeHtml(post.title || '未命名貼文')}</h3>
          <p class="page-description" style="-webkit-line-clamp:2;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;">
            ${escapeHtml(post.content || '')}
          </p>
        </div>
        <div class="meta-line" style="white-space:nowrap;flex-shrink:0;">${formatDate(post.created_at)}</div>
      </div>
      <div class="chip-row" style="margin-top:8px;">
        <span class="chip muted-chip">讚 ${post.like_count || 0}</span>
        <span class="chip muted-chip">留言 ${post.comment_count || 0}</span>
      </div>
    </a>
  `).join('');
}

function getAvatarGradientByUsername(username) {
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

initUserPage();
