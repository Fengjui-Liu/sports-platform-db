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

    renderBoardSelector(boards, boardId);
    renderBoardHero(board, posts.length);
    renderBoardPosts(posts);
    renderBoardPlans(plans.filter((plan) => plan.sport_type === board.sport_type));
    renderBoardInvitations(invitations.filter((invitation) => String(invitation.board_id) === String(boardId)), currentUser);
    bindBoardForms(boardId, currentUser);

    const composeMode = params.get('compose');
    if (composeMode) {
      document.querySelector('.tab-btn[data-tab="posts"]')?.click();
    }
  } catch (err) {
    el('#board-hero').innerHTML = createEmptyState(err.message);
  }
}

function renderBoardSelector(boards, activeBoardId) {
  const selector = el('#board-selector');
  selector.innerHTML = boards
    .map(
      (board) => `
        <a class="mini-card" href="/board.html?id=${board.board_id}">
          <div class="action-row">
            <strong>${board.sport_type}</strong>
            ${String(board.board_id) === String(activeBoardId) ? '<span class="chip active">目前專欄</span>' : ''}
          </div>
          <p>${board.description || '尚未提供描述'}</p>
        </a>
      `
    )
    .join('');
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
      <span class="chip">${postCount} 篇貼文</span>
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
                <span class="chip">${plan.difficulty_level}</span>
                <span class="chip">${plan.exercise_name}</span>
              </div>
              <span>${plan.reps} reps · ${plan.sets} sets</span>
              <span class="muted">by ${plan.username}</span>
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
    postForm.querySelectorAll('input, textarea, button').forEach((field) => {
      if (field.name !== 'user_id') {
        field.disabled = true;
      }
    });
    invitationForm.querySelectorAll('input, button').forEach((field) => {
      if (field.name !== 'user_id') {
        field.disabled = true;
      }
    });
    postForm.insertAdjacentHTML('beforebegin', createEmptyState('未登入時不能發文'));
    invitationForm.insertAdjacentHTML('beforebegin', createEmptyState('未登入時不能建立揪團'));
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

initBoardPage();
