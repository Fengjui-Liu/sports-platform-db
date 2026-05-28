async function initBoardPage() {
  fillUserIdInputs();
  setupTabs();

  const currentUser = getCurrentUser();
  const params = getParams();
  const boardId = params.get('id') || params.get('board_id');
  const activeTab = params.get('tab');

  try {
    const boards = await API.get('/boards');

    renderBoardSidebar(boards, boardId);

    if (!boardId) {
      el('#board-hero').innerHTML = createEmptyState('請先選擇一個專欄');

      renderBoardPosts([]);
      renderBoardPlans([]);
      renderBoardInvitations([], currentUser, boardId);

      if (activeTab) {
        activateTab(activeTab);
      }

      return;
    }

    const board = boards.find((item) => String(item.board_id) === String(boardId));

    if (!board) {
      el('#board-hero').innerHTML = createEmptyState('找不到專欄');

      renderBoardPosts([]);
      renderBoardPlans([]);
      renderBoardInvitations([], currentUser, boardId);

      return;
    }

    const [posts, plans, invitations] = await Promise.all([
      API.get(`/boards/${boardId}/posts`).catch((err) => {
        console.error('載入貼文失敗：', err);
        return [];
      }),
      API.get('/workoutplans').catch((err) => {
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
    renderBoardPosts(posts, board);
    renderBoardPlans(boardPlans);
    renderBoardInvitations(invitations, currentUser, boardId);

    if (activeTab) {
      activateTab(activeTab);
    }
  } catch (err) {
    el('#board-hero').innerHTML = createEmptyState(err.message);

    renderBoardPosts([]);
    renderBoardPlans([]);
    renderBoardInvitations([], getCurrentUser(), boardId);
  }
}

function activateTab(tabName) {
  const button = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);

  if (button) {
    button.click();
  }
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

  el('#board-hero').innerHTML = `
    <div class="action-row" style="align-items:flex-start;">
      <div>
        <p class="eyebrow">${escapeHtml(board.sport_type)}</p>
        <h1>${getBoardEmoji(board.sport_type)} ${escapeHtml(board.sport_type)} 專欄</h1>
        <p class="page-description">
          ${escapeHtml(board.description || '這裡是該運動專欄的交流空間。')}
        </p>
      </div>

      <div 
        class="chip-row" 
        style="
          margin-left:auto; 
          justify-content:flex-end;
          gap:12px;
          flex-wrap:wrap;
        "
      >
        <span class="chip">${postCount} 篇貼文</span>
        <span class="chip">${planCount} 個計畫</span>
        <span class="chip">${invitationCount} 個揪團</span>
      </div>
    </div>
  `;
}

function renderBoardPosts(posts, board = {}) {
  const target = el('#board-posts');

  if (!target) {
    return;
  }

  target.innerHTML = posts.length
    ? posts
        .map((post) => renderPostCard(post, board.sport_type || post.board_name || '未分類'))
        .join('')
    : createEmptyState('這個專欄還沒有貼文，成為第一個發文的人吧！');
}

function renderPostCard(post, boardName) {
  const username = post.username || '未知使用者';

  return `
    <a class="list-card post-feed-card" href="/post.html?id=${post.post_id}">
      ${renderAuthorAvatar(username, post.profile_image)}

      <div class="post-card-body">
        <div class="post-card-meta">
          <strong class="post-author">${escapeHtml(username)}</strong>
          <span class="meta-dot">•</span>
          <span class="post-board-tag">${renderBoardTagText(boardName)}</span>
          <span class="meta-dot">•</span>
          <span class="post-time">${formatPostTime(post.created_at)}</span>
        </div>

        <p class="post-card-content">${escapeHtml(post.content || '')}</p>

        <div class="post-card-actions" aria-label="貼文互動資訊">
          <span>❤️ ${post.like_count || 0}</span>
          <span>💬 ${post.comment_count || 0}</span>
          <span>🔖</span>
        </div>
      </div>
    </a>
  `;
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
  const emoji = getSportEmoji(boardName);
  const label = escapeHtml(boardName || '未分類');
  return emoji ? `${emoji} ${label}` : label;
}

function getSportEmoji(boardName) {
  const emojiMap = {
    籃球: '🏀',
    跑步: '🏃',
    健身: '💪',
    羽球: '🏸',
    足球: '⚽',
    棒球: '⚾',
    網球: '🎾',
    游泳: '🏊',
    瑜伽: '🧘',
    basketball: '🏀',
    running: '🏃',
    fitness: '💪',
    badminton: '🏸',
    soccer: '⚽',
    baseball: '⚾',
    tennis: '🎾',
    swimming: '🏊',
    yoga: '🧘',
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

function renderBoardPlans(boardPlans) {
  const target = el('#board-plans');

  if (!target) {
    return;
  }

  target.innerHTML = boardPlans.length
    ? boardPlans
        .map(
          (plan) => `
            <div class="mini-card plan-card">
              <div class="action-row">
                <div class="chip-row">
                  <span class="chip">${escapeHtml(plan.difficulty_level || '未設定難度')}</span>
                  <span class="chip muted-chip">
                    ${escapeHtml(plan.sport_type || plan.exercise_name || '未設定項目')}
                  </span>
                </div>

                <button 
                  class="action-btn save-plan-btn" 
                  type="button" 
                  data-id="${plan.plan_id}" 
                  data-saved="${Number(plan.saved_by_viewer) ? 'true' : 'false'}"
                >
                  ${Number(plan.saved_by_viewer) ? '已收藏' : '🔖 收藏'}
                </button>
              </div>

              <a href="/workoutplan.html?id=${plan.plan_id}">
                <h3>${escapeHtml(plan.title)}</h3>

                <p class="page-description">
                  ${escapeHtml(plan.exercise_name || '未設定項目')} · 
                  ${plan.sets || 0} sets · 
                  ${plan.reps || 0} reps
                </p>

                <div class="meta-line">
                  收藏數 ${plan.save_count || 0} · by ${escapeHtml(plan.username || '未知使用者')}
                </div>
              </a>
            </div>
          `
        )
        .join('')
    : createEmptyState('這個專欄還沒有公開訓練計畫');

  document.querySelectorAll('.save-plan-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const user = requireCurrentUser('請先登入再收藏計畫');

      if (!user) {
        return;
      }

      try {
        if (button.dataset.saved === 'true') {
          await API.delete(`/workoutplans/${button.dataset.id}/save`, {
            user_id: user.user_id,
          });
        } else {
          await API.post(`/workoutplans/${button.dataset.id}/save`, {
            user_id: user.user_id,
          });
        }

        const currentBoardId = getParams().get('id') || getParams().get('board_id');
        goToBoardTab(currentBoardId, 'plans');
      } catch (err) {
        window.alert(err.message);
      }
    });
  });
}

function getInvitationActionState(item, currentUser) {
  if (!currentUser) {
    return {
      label: '登入後加入',
      action: 'login',
      disabled: true,
      danger: false,
    };
  }

  if (Number(item.is_owner)) {
    return {
      label: '取消揪團',
      action: 'cancel',
      disabled: false,
      danger: true,
    };
  }

  if (Number(item.joined_by_viewer)) {
    return {
      label: '退出揪團',
      action: 'leave',
      disabled: false,
      danger: false,
    };
  }

  if (Number(item.participant_count || 0) >= Number(item.max_participants || 0)) {
    return {
      label: '名額已滿',
      action: 'full',
      disabled: true,
      danger: false,
    };
  }

  return {
    label: '加入揪團',
    action: 'join',
    disabled: false,
    danger: false,
  };
}

function renderParticipantList(participantUsernames) {
  if (!participantUsernames) {
    return '<div class="meta-line">目前參與者：尚無資料</div>';
  }

  const names = String(participantUsernames)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  if (!names.length) {
    return '<div class="meta-line">目前參與者：尚無資料</div>';
  }

  return `
    <div class="participant-list">
      <div class="meta-line">目前參與者</div>
      <div class="chip-row">
        ${names
          .map((name) => `<span class="chip muted-chip">${escapeHtml(name)}</span>`)
          .join('')}
      </div>
    </div>
  `;
}

function renderBoardInvitations(items, currentUser, activeBoardId) {
  const target = el('#board-invitations');

  if (!target) {
    return;
  }

  target.innerHTML = items.length
    ? items
        .map((item) => {
          const actionState = getInvitationActionState(item, currentUser);
          const disabled = actionState.disabled ? 'disabled' : '';
          const dangerClass = actionState.danger ? ' danger-btn' : '';

          return `
            <div class="list-card">
              <div class="action-row">
                <div>
                  <h3>${escapeHtml(item.title)}</h3>
                  <p class="page-description">${escapeHtml(item.location)}</p>
                </div>

                <button 
                  class="action-btn invitation-action-btn${dangerClass}" 
                  data-action="${actionState.action}" 
                  data-board-id="${item.board_id}" 
                  data-id="${item.invitation_id}" 
                  ${disabled}
                >
                  ${actionState.label}
                </button>
              </div>

              <div class="chip-row">
                <span class="chip muted-chip">
                  ${item.participant_count || 0} / 上限${item.max_participants}人
                </span>
                <span class="chip muted-chip">${formatDate(item.event_time)}</span>
              </div>

              <div class="meta-line">
                發起人 ${escapeHtml(item.username || '未知使用者')}
              </div>

              ${renderParticipantList(item.participant_usernames)}
            </div>
          `;
        })
        .join('')
    : createEmptyState('目前沒有揪團');

  document.querySelectorAll('.invitation-action-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      if (button.dataset.action === 'full') {
        return;
      }

      const user = requireCurrentUser(
        button.dataset.action === 'join'
          ? '請先登入再加入揪團'
          : '請先登入再操作揪團'
      );

      if (!user) {
        return;
      }

      try {
        if (button.dataset.action === 'join') {
          await API.post(`/invitations/${button.dataset.id}/join`, {
            user_id: user.user_id,
          });
        } else if (button.dataset.action === 'leave') {
          await API.delete(`/invitations/${button.dataset.id}/join`, {
            user_id: user.user_id,
          });
        } else if (button.dataset.action === 'cancel') {
          const confirmed = window.confirm(
            '確定要取消這個揪團嗎？取消後所有參與紀錄也會刪除。'
          );

          if (!confirmed) {
            return;
          }

          await API.delete(`/invitations/${button.dataset.id}`, {
            user_id: user.user_id,
          });
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
  if (!postType || String(postType).toLowerCase() === 'text') {
    return '';
  }

  return `<span class="chip muted-chip">${escapeHtml(postType)}</span>`;
}

initBoardPage();
