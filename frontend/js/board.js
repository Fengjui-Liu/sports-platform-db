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
    renderBoardPosts(posts);
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

function renderBoardPosts(posts) {
  const target = el('#board-posts');

  if (!target) {
    return;
  }

  target.innerHTML = posts.length
    ? posts
        .map(
          (post) => `
            <a class="list-card" href="/post.html?id=${post.post_id}">
              <div class="action-row">
                <div>
                  <strong>${escapeHtml(post.username || '未知使用者')}</strong>
                  <div class="chip-row" style="margin-top:8px;">
                    ${renderPostTypeChip(post.post_type)}
                  </div>
                </div>

                <span class="meta-line">${formatDate(post.created_at)}</span>
              </div>

              <h3>${escapeHtml(post.title || '未命名貼文')}</h3>

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
    : createEmptyState('這個專欄還沒有貼文，成為第一個發文的人吧！');
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