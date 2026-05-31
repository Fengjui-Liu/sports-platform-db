async function initBoardPage() {
  fillUserIdInputs();
  setupTabs();

  const currentUser = getCurrentUser();
  const params = getParams();
  const boardId = params.get('id') || params.get('board_id');
  const activeTab = params.get('tab');

  updateBoardCreateLinks(boardId);

  try {
    const boards = await API.get('/boards');

    renderBoardSidebar(boards, boardId);

    if (!boardId) {
      el('#board-hero').innerHTML = createEmptyState('請先選擇一個專欄');
      renderBoardPosts([], null, currentUser);
      renderBoardPlans([]);
      renderBoardInvitations([], currentUser, boardId);
      if (activeTab) activateTab(activeTab);
      return;
    }

    const board = boards.find((item) => String(item.board_id) === String(boardId));

    if (!board) {
      el('#board-hero').innerHTML = createEmptyState('找不到專欄');
      renderBoardPosts([], null, currentUser);
      renderBoardPlans([]);
      renderBoardInvitations([], currentUser, boardId);
      return;
    }

    const viewerQuery = currentUser ? `?viewer_id=${currentUser.user_id}` : '';

    const [posts, plans, invitations] = await Promise.all([
      API.get(`/boards/${boardId}/posts${viewerQuery}`).catch((err) => {
        console.error('載入貼文失敗：', err);
        return [];
      }),
      API.get(
        currentUser ? `/workoutplans?viewer_id=${currentUser.user_id}` : '/workoutplans'
      ).catch((err) => {
        console.error('載入訓練計畫失敗：', err);
        return [];
      }),
      API.get(
        currentUser
          ? `/invitations?board_id=${boardId}&user_id=${currentUser.user_id}`
          : `/invitations?board_id=${boardId}`
      ).catch((err) => {
        console.error('載入揪團失敗：', err);
        return [];
      }),
    ]);

    const boardPlans = plans.filter((plan) => {
      return (
        String(plan.board_id) === String(boardId) ||
        String(plan.sport_type) === String(board.sport_type)
      );
    });

    renderBoardHero(board, posts.length, boardPlans, invitations);
    renderBoardPosts(posts, board, currentUser);
    renderBoardPlans(boardPlans, currentUser);
    renderBoardInvitations(invitations, currentUser, boardId);

    if (activeTab) activateTab(activeTab);
  } catch (err) {
    el('#board-hero').innerHTML = createEmptyState(err.message);
    renderBoardPosts([], null, getCurrentUser());
    renderBoardPlans([]);
    renderBoardInvitations([], getCurrentUser(), boardId);
  }
}

let boardPostInteractionsCurrentUser = null;

function updateBoardCreateLinks(boardId) {
  if (!boardId) return;

  document.querySelectorAll('a[href^="/create.html?tab="]').forEach((link) => {
    const url = new URL(link.getAttribute('href'), window.location.origin);
    url.searchParams.set('board_id', boardId);
    link.setAttribute('href', `${url.pathname}${url.search}`);
  });
}

function activateTab(tabName) {
  const button = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (button) button.click();
}

function goToBoardTab(boardId, tabName) {
  if (!boardId) {
    window.location.href = `/board.html?tab=${tabName}`;
    return;
  }
  window.location.href = `/board.html?id=${boardId}&tab=${tabName}`;
}

function renderBoardHero(board, fallbackPostCount = 0, plans = [], invitations = []) {
  const postCount = Number(board.post_count ?? fallbackPostCount ?? 0);
  const planCount = Number(board.plan_count ?? plans.length ?? 0);
  const invitationCount = Number(board.invitation_count ?? invitations.length ?? 0);
  const boardIcon = getSportIcon(board.sport_type);

  el('#board-hero').innerHTML = `
    <div class="action-row" style="align-items:flex-start;">
      <div>
        <p class="eyebrow" aria-label="${escapeHtml(getSportName(board.sport_type))}">${boardIcon}</p>
        <h1>${escapeHtml(getSportName(board.sport_type))}</h1>
        <p class="page-description">
          ${escapeHtml(board.description || '\u5206\u4eab\u4ea4\u6d41\u3001\u8a13\u7df4\u5fc3\u5f97\u3001\u6bd4\u8cfd\u8a0e\u8ad6\u5c08\u6b04')}
        </p>
      </div>

      <div class="chip-row" style="margin-left:auto;justify-content:flex-end;gap:12px;flex-wrap:wrap;">
        <span class="chip">${postCount} \u7bc7\u8cbc\u6587</span>
        <span class="chip">${planCount} \u500b\u8a08\u756b</span>
        <span class="chip">${invitationCount} \u500b\u63ea\u5718</span>
      </div>
    </div>
  `;
}

function renderBoardPosts(posts, board, currentUser) {
  const target = el('#board-posts');
  if (!target) return;

  if (!posts.length) {
    target.innerHTML = createEmptyState('這個專欄還沒有貼文，成為第一個發文的人吧！');
    return;
  }

  target.innerHTML = posts
    .map((post) => renderPostCard(post, board?.sport_type || post.board_name || '未分類'))
    .join('');

  setupBoardPostInteractions(target, currentUser);
}

function renderPostCard(post, boardName) {
  const postId = getPostId(post);
  const postUrl = getPostDetailUrl(postId);
  const commentsUrl = getPostDetailUrl(postId, '#comments');
  const username = post.username || '\u672a\u77e5\u4f7f\u7528\u8005';
  const isLiked = Number(post.liked_by_viewer) === 1;
  const isBookmarked = Number(post.bookmarked_by_viewer) === 1;

  return `
    <article class="list-card post-feed-card post-clickable-card" data-post-id="${escapeHtml(postId)}" role="link" tabindex="0">
      <a href="/user.html?id=${post.user_id}" class="post-avatar-link" data-card-ignore style="text-decoration:none;">
        ${renderAuthorAvatar(username, post.profile_image)}
      </a>

      <div class="post-card-body">
        <div class="post-card-meta">
          <strong class="post-author">
            <a href="/user.html?id=${post.user_id}" data-card-ignore style="color:var(--primary);text-decoration:none;">${escapeHtml(username)}</a>
          </strong>
          <span class="meta-dot">&middot;</span>
          <span class="post-board-tag">${getSportIcon(boardName)}${escapeHtml(getSportName(boardName) || '\u904b\u52d5\u5c08\u6b04')}</span>
          <span class="meta-dot">&middot;</span>
          <span class="post-time">${formatPostMetaTime(post)}</span>
        </div>

        <a class="post-title-link" href="${postUrl}" style="text-decoration:none;color:inherit;display:block;">
          <h3 class="post-card-title">${escapeHtml(post.title || '\u672a\u547d\u540d\u8cbc\u6587')}</h3>
        </a>
        <p class="post-card-content" data-open-post>${escapeHtml(post.content || '')}</p>

        <div class="post-card-actions" aria-label="\u8cbc\u6587\u4e92\u52d5">
          <button
            class="like-btn ${isLiked ? 'is-liked' : ''}"
            data-action="like"
            data-post-id="${escapeHtml(postId)}"
            data-liked="${isLiked}"
            type="button"
          >
            <span class="like-icon">${isLiked ? '&hearts;' : '&#9825;'}</span>
            <span class="like-count">${post.like_count || 0}</span>
          </button>

          <a class="meta-line" href="${commentsUrl}" style="text-decoration:none;font-weight:700;">
            \u7559\u8a00 ${post.comment_count || 0}
          </a>

          <button
            class="bookmark-btn ${isBookmarked ? 'is-bookmarked' : ''}"
            data-action="bookmark"
            data-post-id="${escapeHtml(postId)}"
            data-bookmarked="${isBookmarked}"
            type="button"
          >
            <span class="bookmark-icon">${isBookmarked ? '&#9733;' : '&#9734;'}</span>
          </button>
        </div>
      </div>
    </article>
  `;
}

function setupBoardPostInteractions(container, currentUser) {
  boardPostInteractionsCurrentUser = currentUser;

  if (container.dataset.interactionsBound === 'true') {
    return;
  }
  container.dataset.interactionsBound = 'true';

  container.addEventListener('click', async (event) => {
    const likeBtn = event.target.closest('[data-action="like"]');
    const bookmarkBtn = event.target.closest('[data-action="bookmark"]');

    if (likeBtn) {
      event.preventDefault();
      event.stopPropagation();
      await handleLikeClick(likeBtn, boardPostInteractionsCurrentUser);
      return;
    }

    if (bookmarkBtn) {
      event.preventDefault();
      event.stopPropagation();
      await handleBookmarkClick(bookmarkBtn, boardPostInteractionsCurrentUser);
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

async function handleLikeClick(likeBtn, currentUser) {
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

async function handleBookmarkClick(bookmarkBtn, currentUser) {
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

function renderAuthorAvatar(username, profileImage) {
  const initial = getUserInitial(username);
  const background = getAvatarGradient(username);

  if (profileImage) {
    return `
      <span class="post-avatar" style="--avatar-bg:${background};">
        <img src="${escapeHtml(profileImage)}" alt="${escapeHtml(username)}">
      </span>
    `;
  }

  return `
    <span class="post-avatar" style="--avatar-bg:${background};">
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
  return escapeHtml(boardName || '未分類');
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

function renderBoardPlans(boardPlans, currentUser) {
  const target = el('#board-plans');
  if (!target) return;

  if (!boardPlans.length) {
    target.innerHTML = createEmptyState('這個專欄還沒有公開訓練計畫');
    return;
  }

  target.innerHTML = boardPlans
    .map(
      (plan) => `
        <div class="mini-card plan-card">
          <div class="action-row">
            <div class="chip-row">
              <span class="chip">${escapeHtml(formatDifficultyLevel(plan.difficulty_level) || '未設定難度')}</span>
              <span class="chip muted-chip">
                ${plan.sport_type ? getSportIcon(plan.sport_type) : ''}${escapeHtml(getSportName(plan.sport_type) || plan.exercise_name || '未設定項目')}
              </span>
            </div>

            <button
              class="action-btn save-plan-btn"
              type="button"
              data-id="${plan.plan_id}"
              data-saved="${Number(plan.saved_by_viewer) ? 'true' : 'false'}"
            >
              ${Number(plan.saved_by_viewer) ? '取消收藏' : '收藏'}
            </button>
          </div>

          <a href="/workoutplan.html?id=${plan.plan_id}" style="text-decoration:none;color:inherit;">
            <h3>${escapeHtml(plan.title)}</h3>
            <p class="page-description">
              ${escapeHtml(plan.exercise_name || '未設定項目')} ·
              ${plan.sets || 0} sets ·
              ${plan.reps || 0} reps
            </p>
            <div class="meta-line plan-save-count" data-plan-id="${plan.plan_id}" data-author="${escapeHtml(plan.username || '未知使用者')}">
              收藏數 ${plan.save_count || 0} · by ${escapeHtml(plan.username || '未知使用者')}
            </div>
          </a>
        </div>
      `
    )
    .join('');

  document.querySelectorAll('.save-plan-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const user = requireCurrentUser('請先登入再收藏計畫');
      if (!user) return;

      try {
        const wasSaved = button.dataset.saved === 'true';
        const result = wasSaved
          ? await API.delete(`/workoutplans/${button.dataset.id}/save`, { user_id: user.user_id })
          : await API.post(`/workoutplans/${button.dataset.id}/save`, { user_id: user.user_id });

        updatePlanSaveButton(button, result);
      } catch (err) {
        window.alert(err.message);
      }
    });
  });
}

function updatePlanSaveButton(button, result) {
  const isSaved = Boolean(Number(result.saved_by_viewer));
  const saveCount = Math.max(0, Number(result.save_count || 0));
  const saveCountEl = document.querySelector(`.plan-save-count[data-plan-id="${button.dataset.id}"]`);

  button.dataset.saved = isSaved ? 'true' : 'false';
  button.textContent = isSaved ? '取消收藏' : '收藏';

  if (saveCountEl) {
    const author = saveCountEl.dataset.author || '';
    saveCountEl.textContent = `收藏數 ${saveCount}${author ? ` · by ${author}` : ''}`;
  }
}

function getInvitationActionState(item, currentUser) {
  if (isInvitationEnded(item)) {
    return { label: '已結束', action: 'ended', disabled: true, danger: false, hidden: true };
  }

  if (!currentUser) {
    return { label: '登入後加入', action: 'login', disabled: true, danger: false };
  }

  if (Number(item.user_id) === Number(currentUser.user_id)) {
    return { label: '取消揪團', action: 'cancel', disabled: false, danger: true };
  }

  if (Number(item.joined_by_viewer)) {
    return {
      label: item.viewer_status === 'waitlisted' ? '退出候補' : '退出揪團',
      action: 'leave',
      disabled: false,
      danger: false,
    };
  }

  if (Number(item.participant_count || 0) >= Number(item.max_participants || 0)) {
    return { label: '加入候補', action: 'join', disabled: false, danger: false };
  }

  return { label: '加入揪團', action: 'join', disabled: false, danger: false };
}

function isInvitationEnded(item) {
  return item.event_time && new Date(item.event_time).getTime() <= Date.now();
}

function renderInvitationStatusBadge(item) {
  if (isInvitationEnded(item)) {
    return '<span class="invitation-badge invitation-badge-ended">已結束</span>';
  }

  if (Number(item.waitlist_count || 0) > 0) {
    return `<span class="invitation-badge invitation-badge-waitlist">候補 ${item.waitlist_count}</span>`;
  }

  return '';
}

function renderParticipantList(participantUsernames) {
  if (!participantUsernames) {
    return '<div class="meta-line">目前參與者：尚無資料</div>';
  }

  const names = String(participantUsernames).split(',').map((n) => n.trim()).filter(Boolean);

  if (!names.length) {
    return '<div class="meta-line">目前參與者：尚無資料</div>';
  }

  return `
    <div class="participant-list">
      <div class="meta-line">目前參與者</div>
      <div class="chip-row">
        ${names.map((name) => `<span class="chip muted-chip">${escapeHtml(name)}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderBoardInvitations(items, currentUser, activeBoardId) {
  const target = el('#board-invitations');
  if (!target) return;

  if (!items.length) {
    target.innerHTML = createEmptyState('目前沒有揪團');
    return;
  }

  target.innerHTML = items
    .map((item) => {
      const actionState = getInvitationActionState(item, currentUser);
      const disabled = actionState.disabled ? 'disabled' : '';
      const dangerStyle = actionState.danger
        ? 'background:#fee2e2;color:#c53b3b;border-color:#fca5a5;'
        : '';
      const actionButton = actionState.hidden
        ? ''
        : `
            <button
              class="action-btn invitation-action-btn"
              data-action="${actionState.action}"
              data-board-id="${item.board_id}"
              data-id="${item.invitation_id}"
              style="${dangerStyle}"
              ${disabled}
            >
              ${actionState.label}
            </button>
          `;

      return `
        <div class="list-card">
          <div class="action-row">
            <div>
              <h3>${escapeHtml(item.title)}</h3>
              <p class="page-description">${escapeHtml(item.location)}</p>
            </div>

            ${actionButton}
          </div>

          <div class="chip-row">
            <span class="chip muted-chip">
              ${item.participant_count || 0} / 上限${item.max_participants}人
            </span>
            ${Number(item.waitlist_count || 0) > 0 ? `<span class="chip muted-chip">候補 ${item.waitlist_count} 人</span>` : ''}
            <span class="chip muted-chip">${formatDate(item.event_time)}</span>
            ${renderInvitationStatusBadge(item)}
          </div>

          <div class="meta-line">
            發起人
            <a href="/user.html?id=${item.user_id}" style="color:var(--primary);text-decoration:none;">
              ${escapeHtml(item.username || '未知使用者')}
            </a>
          </div>

          ${renderParticipantList(item.participant_usernames)}
        </div>
      `;
    })
    .join('');

  document.querySelectorAll('.invitation-action-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      if (button.dataset.action === 'full' || button.dataset.action === 'ended') return;

      const user = requireCurrentUser(
        button.dataset.action === 'join' ? '請先登入再加入揪團' : '請先登入再操作揪團'
      );

      if (!user) return;

      try {
        if (button.dataset.action === 'join') {
          await API.post(`/invitations/${button.dataset.id}/join`, { user_id: user.user_id });
        } else if (button.dataset.action === 'leave') {
          await API.delete(`/invitations/${button.dataset.id}/join`, { user_id: user.user_id });
        } else if (button.dataset.action === 'cancel') {
          if (!window.confirm('確定要取消這個揪團嗎？取消後所有參與紀錄也會刪除。')) return;
          await API.delete(`/invitations/${button.dataset.id}`, { user_id: user.user_id });
        }

        const boardIdToReturn = activeBoardId || button.dataset.boardId;
        goToBoardTab(boardIdToReturn, 'invitations');
      } catch (err) {
        window.alert(err.message);
      }
    });
  });
}

function renderPostTypeChip(postType) {
  if (!postType || String(postType).toLowerCase() === 'text') return '';
  return `<span class="chip muted-chip">${escapeHtml(postType)}</span>`;
}

initBoardPage();
