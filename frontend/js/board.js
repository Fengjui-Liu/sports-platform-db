async function initBoardPage() {
  fillUserIdInputs();
  setupTabs();
  bindBoardCreateForm();

  const currentUser = getCurrentUser();
  const params = getParams();
  const boardId = params.get('id') || params.get('board_id');
  const composeMode = params.get('compose');

  try {
    const boards = await API.get('/boards');

    renderBoardSelector(boards, boardId);
    fillBoardSelects(boards, boardId);

    if (!boardId) {
      el('#board-subtitle').textContent = '選擇你今天的主題';
      el('#board-hero').innerHTML = createEmptyState(
        composeMode ? '請選擇要發佈的專欄後送出內容' : '請先選擇一個專欄'
      );

      clearBoardContent();

      if (composeMode) {
        document.querySelector('.tab-btn[data-tab="posts"]')?.click();
      }

      bindBoardForms(null, currentUser, boards);
      return;
    }

    const [posts, plans, invitations] = await Promise.all([
      API.get(`/boards/${boardId}/posts`),
      API.get('/workoutplans'),
      API.get(currentUser ? `/invitations?user_id=${currentUser.user_id}` : '/invitations'),
    ]);

    const board = boards.find((item) => String(item.board_id) === String(boardId));

    if (!board) {
      el('#board-hero').innerHTML = createEmptyState('找不到專欄');
      clearBoardContent();
      bindBoardForms(null, currentUser, boards);
      return;
    }

    renderBoardHero(board, posts.length);
    renderBoardPosts(posts);
    renderBoardPlans(plans.filter((plan) => plan.sport_type === board.sport_type));
    renderBoardInvitations(
      invitations.filter((invitation) => String(invitation.board_id) === String(boardId)),
      currentUser
    );

    bindBoardForms(boardId, currentUser, boards);

    if (composeMode) {
      document.querySelector('.tab-btn[data-tab="posts"]')?.click();
      el('#post-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch (err) {
    el('#board-hero').innerHTML = createEmptyState(err.message);
    clearBoardContent();
  }
}

function clearBoardContent() {
  const boardPosts = el('#board-posts');
  const boardPlans = el('#board-plans');
  const boardInvitations = el('#board-invitations');

  if (boardPosts) {
    boardPosts.innerHTML = createEmptyState('請選擇要發佈的專欄後送出貼文');
  }

  if (boardPlans) {
    boardPlans.innerHTML = createEmptyState('請先選擇專欄後查看計畫');
  }

  if (boardInvitations) {
    boardInvitations.innerHTML = createEmptyState('請先選擇專欄後查看揪團');
  }
}

function bindBoardCreateForm() {
  const boardForm = el('#board-form');

  if (!boardForm) {
    return;
  }

  boardForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = serializeForm(event.currentTarget);

    try {
      const result = await API.post('/boards', payload);
      window.location.href = `/board.html?id=${result.board_id}`;
    } catch (err) {
      window.alert(err.message);
    }
  });
}

function fillBoardSelects(boards, activeBoardId) {
  fillSingleBoardSelect('#post-board-select', boards, activeBoardId);
  fillSingleBoardSelect('#plan-board-select', boards, activeBoardId);
  fillSingleBoardSelect('#invitation-board-select', boards, activeBoardId);

  syncPlanSportType(boards);
}

function fillSingleBoardSelect(selector, boards, activeBoardId) {
  const select = el(selector);

  if (!select) {
    return;
  }

  select.innerHTML = `
    <option value="">請選擇要發佈的專欄</option>
    ${boards
      .map(
        (board) => `
          <option value="${board.board_id}">
            ${board.sport_type}（${board.post_count || 0} 篇）
          </option>
        `
      )
      .join('')}
  `;

  if (activeBoardId) {
    select.value = String(activeBoardId);
  }
}

function syncPlanSportType(boards) {
  const planBoardSelect = el('#plan-board-select');
  const planSportTypeInput = el('#plan-sport-type');

  if (!planBoardSelect || !planSportTypeInput) {
    return;
  }

  const updateSportType = () => {
    const selectedBoard = boards.find(
      (board) => String(board.board_id) === String(planBoardSelect.value)
    );

    planSportTypeInput.value = selectedBoard ? selectedBoard.sport_type : '';
  };

  planBoardSelect.addEventListener('change', updateSportType);
  updateSportType();
}

function findBoardById(boards, boardId) {
  return boards.find((board) => String(board.board_id) === String(boardId));
}

function renderBoardSelector(boards, activeBoardId) {
  const selector = el('#board-selector');

  if (!selector) {
    return;
  }

  selector.innerHTML = boards.length
    ? boards
        .map(
          (board) => `
            <a class="mini-card" href="/board.html?id=${board.board_id}">
              <div class="action-row">
                <strong>${board.sport_type}</strong>
                ${
                  String(board.board_id) === String(activeBoardId)
                    ? '<span class="chip active">目前專欄</span>'
                    : ''
                }
              </div>
              <p>${board.description || '尚未提供描述'}</p>
              <div class="meta-line">累積貼文數：${board.post_count || 0} 篇</div>
            </a>
          `
        )
        .join('')
    : createEmptyState('目前沒有任何專欄');
}

function renderBoardHero(board, postCount) {
  el('#board-subtitle').textContent = board.description || '選擇你今天的主題';

  el('#board-hero').innerHTML = `
    <div>
      <p class="eyebrow">${board.sport_type}</p>
      <h1>${board.sport_type} 專欄</h1>
      <p class="hero-copy">${board.description || '尚未提供描述'}</p>
    </div>
    <div class="chip-row">
      <span class="chip">${board.post_count || postCount || 0} 篇貼文</span>
      <span class="chip">${formatDate(board.created_at)}</span>
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
                <strong>${post.username}</strong>
                <span class="chip">${post.post_type}</span>
              </div>
              <p>${post.content}</p>
              <div class="meta-line">❤️ ${post.like_count} · 💬 ${post.comment_count} · ${formatDate(post.created_at)}</div>
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
            <a class="mini-card" href="/workoutplan.html?id=${plan.plan_id}">
              <strong>${plan.title}</strong>
              <div class="chip-row">
                <span class="chip">${plan.difficulty_level || '未設定難度'}</span>
                <span class="chip">${plan.exercise_name || '未設定項目'}</span>
              </div>
              <span>${plan.reps || 0} reps · ${plan.sets || 0} sets</span>
              <span class="muted">by ${plan.username || '未知使用者'}</span>
            </a>
          `
        )
        .join('')
    : createEmptyState('這個運動類型還沒有公開計畫');
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
                <strong>${item.title}</strong>
                <button class="action-btn invitation-action-btn" data-action="${actionType}" data-id="${item.invitation_id}" ${disabled}>${actionLabel}</button>
              </div>
              <p>${item.location}</p>
              <div class="meta-line">
                ${item.participant_count} / ${item.max_participants} 人 · ${formatDate(item.event_time)} · by ${item.username}
              </div>
            </div>
          `;
        })
        .join('')
    : createEmptyState('目前沒有揪團');

  document.querySelectorAll('.invitation-action-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const user = requireCurrentUser(
        button.dataset.action === 'join'
          ? '請先登入再加入揪團'
          : '請先登入再退出揪團'
      );

      if (!user) {
        return;
      }

      try {
        if (button.dataset.action === 'join') {
          await API.post(`/invitations/${button.dataset.id}/join`, {
            user_id: user.user_id,
          });
        } else {
          await API.delete(`/invitations/${button.dataset.id}/join`, {
            user_id: user.user_id,
          });
        }

        window.location.reload();
      } catch (err) {
        window.alert(err.message);
      }
    });
  });
}

function bindBoardForms(boardId, currentUser, boards) {
  const postForm = el('#post-form');
  const planForm = el('#plan-form');
  const invitationForm = el('#invitation-form');

  if (!postForm || !planForm || !invitationForm) {
    return;
  }

  if (!currentUser) {
    postForm.querySelectorAll('input, select, textarea, button').forEach((field) => {
      if (field.name !== 'user_id') {
        field.disabled = true;
      }
    });

    planForm.querySelectorAll('input, select, button').forEach((field) => {
      if (field.name !== 'user_id') {
        field.disabled = true;
      }
    });

    invitationForm.querySelectorAll('input, select, button').forEach((field) => {
      if (field.name !== 'user_id') {
        field.disabled = true;
      }
    });

    if (!document.querySelector('#post-login-message')) {
      postForm.insertAdjacentHTML(
        'beforebegin',
        '<div id="post-login-message" class="empty-state">未登入時不能發文</div>'
      );
    }

    if (!document.querySelector('#plan-login-message')) {
      planForm.insertAdjacentHTML(
        'beforebegin',
        '<div id="plan-login-message" class="empty-state">未登入時不能新增訓練計畫</div>'
      );
    }

    if (!document.querySelector('#invitation-login-message')) {
      invitationForm.insertAdjacentHTML(
        'beforebegin',
        '<div id="invitation-login-message" class="empty-state">未登入時不能建立揪團</div>'
      );
    }
  }

  postForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const user = requireCurrentUser('請先登入再發文');

    if (!user) {
      return;
    }

    const payload = serializeForm(event.currentTarget);

    payload.user_id = Number(user.user_id);
    payload.board_id = Number(payload.board_id || boardId);

    if (!payload.board_id) {
      window.alert('請選擇要發佈的專欄');
      return;
    }

    try {
      const result = await API.post('/posts', payload);
      window.location.href = `/post.html?id=${result.post_id}`;
    } catch (err) {
      window.alert(err.message);
    }
  });

  planForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const user = requireCurrentUser('請先登入再新增訓練計畫');

    if (!user) {
      return;
    }

    const payload = serializeForm(event.currentTarget);
    const selectedBoard = findBoardById(boards, payload.board_id || boardId);

    if (!selectedBoard) {
      window.alert('請選擇要發佈的專欄');
      return;
    }

    payload.user_id = Number(user.user_id);
    payload.board_id = Number(payload.board_id || boardId);
    payload.sport_type = selectedBoard.sport_type;

    if (payload.reps !== undefined) {
      payload.reps = Number(payload.reps);
    }

    if (payload.sets !== undefined) {
      payload.sets = Number(payload.sets);
    }

    try {
      const result = await API.post('/workoutplans', payload);
      window.alert('訓練計畫建立成功');

      if (result.plan_id) {
        window.location.href = `/workoutplan.html?id=${result.plan_id}`;
      } else {
        window.location.href = `/board.html?id=${payload.board_id}`;
      }
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

    payload.board_id = Number(payload.board_id || boardId);

    if (!payload.board_id) {
      window.alert('請選擇要發佈的專欄');
      return;
    }

    payload.user_id = Number(user.user_id);
    payload.event_time = toApiDateTime(payload.event_time);

    try {
      await API.post('/invitations', payload);
      window.location.href = `/board.html?id=${payload.board_id}`;
    } catch (err) {
      window.alert(err.message);
    }
  });
}

initBoardPage();