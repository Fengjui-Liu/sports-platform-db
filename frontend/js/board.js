async function initBoardPage() {
  fillUserIdInputs();
  setupTabs();

  const currentUser = getCurrentUser();
  const params = getParams();
  const boardId = params.get('id') || params.get('board_id');
  if (!boardId) {
    el('#board-hero').innerHTML = createEmptyState('缺少 board id');
    return;
  }

  try {
    const [boards, posts, plans, invitations] = await Promise.all([
      API.get('/boards'),
      API.get(`/boards/${boardId}/posts`),
      API.get('/workoutplans'),
      API.get(currentUser ? `/invitations?user_id=${currentUser.user_id}` : '/invitations'),
    ]);

    const board = boards.find((item) => String(item.board_id) === String(boardId));
    if (!board) {
      el('#board-hero').innerHTML = createEmptyState('找不到專欄');
      return;
    }

    renderBoardSidebar(boards, boardId);
    renderBoardHero(board, posts.length);
    renderBoardPosts(posts);
    renderBoardPlans(plans.filter((plan) => plan.sport_type === board.sport_type));
    renderBoardInvitations(invitations.filter((item) => String(item.board_id) === String(boardId)), currentUser);
    bindBoardForms(boardId, currentUser);

    if (params.get('compose')) {
      document.querySelector('.tab-btn[data-tab="posts"]')?.click();
    }
  } catch (err) {
    el('#board-hero').innerHTML = createEmptyState(err.message);
  }
}

function renderBoardHero(board, postCount) {
  el('#board-hero').innerHTML = `
    <div>
      <p class="eyebrow">${escapeHtml(board.sport_type)}</p>
      <h1>${getBoardEmoji(board.sport_type)} ${escapeHtml(board.sport_type)} 專欄</h1>
      <p class="page-description">${escapeHtml(board.description || '這裡是該運動專欄的交流空間。')}</p>
    </div>
    <div class="chip-row">
      <span class="chip">${postCount} 篇貼文</span>
      <span class="chip muted-chip">${formatDate(board.created_at)}</span>
    </div>
  `;
}

function renderBoardPosts(posts) {
  el('#board-posts').innerHTML = posts.length
    ? posts
        .map(
          (post) => `
            <a class="list-card" href="/post.html?id=${post.post_id}">
              <div class="action-row">
                <div>
                  <strong>${escapeHtml(post.username)}</strong>
                  <div class="chip-row" style="margin-top:8px;">
                    ${renderPostTypeChip(post.post_type)}
                  </div>
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
    : createEmptyState('這個專欄還沒有貼文');
}

function renderBoardPlans(boardPlans) {
  el('#board-plans').innerHTML = boardPlans.length
    ? boardPlans
        .map(
          (plan) => `
            <div class="mini-card plan-card">
              <div class="action-row">
                <div class="chip-row">
                  <span class="chip">${escapeHtml(plan.difficulty_level)}</span>
                  <span class="chip muted-chip">${escapeHtml(plan.sport_type || plan.exercise_name)}</span>
                </div>
                <button class="action-btn save-plan-btn" type="button" data-id="${plan.plan_id}" data-saved="${Number(plan.saved_by_viewer) ? 'true' : 'false'}">
                  ${Number(plan.saved_by_viewer) ? '已收藏' : '🔖 收藏'}
                </button>
              </div>
              <a href="/workoutplan.html?id=${plan.plan_id}">
                <h3>${escapeHtml(plan.title)}</h3>
                <p class="page-description">${escapeHtml(plan.exercise_name)} · ${plan.sets} sets · ${plan.reps} reps</p>
                <div class="meta-line">收藏數 ${plan.save_count || 0} · by ${escapeHtml(plan.username)}</div>
              </a>
            </div>
          `
        )
        .join('')
    : createEmptyState('這個運動類型還沒有公開計畫');

  document.querySelectorAll('.save-plan-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const user = requireCurrentUser('請先登入再收藏計畫');
      if (!user) {
        return;
      }

      try {
        if (button.dataset.saved === 'true') {
          await API.delete(`/workoutplans/${button.dataset.id}/save`, { user_id: user.user_id });
        } else {
          await API.post(`/workoutplans/${button.dataset.id}/save`, { user_id: user.user_id });
        }
        window.location.reload();
      } catch (err) {
        window.alert(err.message);
      }
    });
  });
}

function renderBoardInvitations(items, currentUser) {
  el('#board-invitations').innerHTML = items.length
    ? items
        .map((item) => {
          const actionLabel = Number(item.joined_by_viewer) ? '退出揪團' : '加入揪團';
          const actionType = Number(item.joined_by_viewer) ? 'leave' : 'join';
          const disabled = currentUser ? '' : 'disabled';
          return `
            <div class="list-card">
              <div class="action-row">
                <div>
                  <h3>${escapeHtml(item.title)}</h3>
                  <p class="page-description">${escapeHtml(item.location)}</p>
                </div>
                <button class="action-btn invitation-action-btn" data-action="${actionType}" data-id="${item.invitation_id}" ${disabled}>${actionLabel}</button>
              </div>
              <div class="chip-row">
                <span class="chip muted-chip">${item.participant_count} / 上限${item.max_participants}人</span>
                <span class="chip muted-chip">${formatDate(item.event_time)}</span>
              </div>
              <div class="meta-line">發起人 ${escapeHtml(item.username)}</div>
            </div>
          `;
        })
        .join('')
    : createEmptyState('目前沒有揪團');

  document.querySelectorAll('.invitation-action-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const user = requireCurrentUser(button.dataset.action === 'join' ? '請先登入再加入揪團' : '請先登入再退出揪團');
      if (!user) {
        return;
      }

      try {
        if (button.dataset.action === 'join') {
          await API.post(`/invitations/${button.dataset.id}/join`, { user_id: user.user_id });
        } else {
          await API.delete(`/invitations/${button.dataset.id}/join`, { user_id: user.user_id });
        }
        window.location.reload();
      } catch (err) {
        window.alert(err.message);
      }
    });
  });
}

function bindBoardForms(boardId, currentUser) {
  const postForm = el('#post-form');
  const invitationForm = el('#invitation-form');

  if (!currentUser) {
    disableFormWithMessage(postForm, '請先登入後再發文');
    disableFormWithMessage(invitationForm, '請先登入後再建立揪團');
  }

  postForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = requireCurrentUser('請先登入再發文');
    if (!user) {
      return;
    }

    const payload = serializeForm(event.currentTarget);
    payload.board_id = Number(boardId);
    payload.user_id = Number(user.user_id);

    try {
      await API.post('/posts', payload);
      window.location.reload();
    } catch (err) {
      window.alert(err.message);
    }
  });

  invitationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = requireCurrentUser('請先登入再建立揪團');
    if (!user) {
      return;
    }

    const payload = serializeForm(event.currentTarget);
    payload.board_id = Number(boardId);
    payload.user_id = Number(user.user_id);
    payload.event_time = toApiDateTime(payload.event_time);

    try {
      await API.post('/invitations', payload);
      window.location.reload();
    } catch (err) {
      window.alert(err.message);
    }
  });
}

function renderPostTypeChip(postType) {
  if (!postType || String(postType).toLowerCase() === 'text') {
    return '';
  }
  return `<span class="chip muted-chip">${escapeHtml(postType)}</span>`;
}

initBoardPage();
