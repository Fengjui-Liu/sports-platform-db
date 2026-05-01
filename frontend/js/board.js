async function initBoardPage() {
  fillUserIdInputs();
  setupTabs();

  const params = new URLSearchParams(window.location.search);
  const boardId = params.get('id') || params.get('board_id');
  if (!boardId) {
    el('#board-hero').innerHTML = createEmptyState('缺少 board id');
    return;
  }

  const [boards, posts, plans, invitations] = await Promise.all([
    API.get('/boards'),
    API.get(`/boards/${boardId}/posts`),
    API.get('/workoutplans'),
    API.get('/invitations'),
  ]).catch((err) => {
    el('#board-hero').innerHTML = createEmptyState(err.message);
    return [[], [], [], []];
  });

  const board = boards.find((item) => String(item.board_id) === String(boardId));
  if (!board) {
    el('#board-hero').innerHTML = createEmptyState('找不到專欄');
    return;
  }

  el('#board-hero').innerHTML = `
    <div>
      <p class="eyebrow">${board.sport_type}</p>
      <h1>${board.sport_type} 專欄</h1>
      <p class="hero-copy">${board.description || '尚未提供描述'}</p>
    </div>
    <div class="chip-row">
      <span class="chip">${posts.length} 篇貼文</span>
      <span class="chip">${formatDate(board.created_at)}</span>
    </div>
  `;

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

  const boardPlans = plans.filter((plan) => plan.sport_type === board.sport_type);
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

  const boardInvitations = invitations.filter((invitation) => String(invitation.board_id) === String(boardId));
  el('#board-invitations').insertAdjacentHTML(
    'beforeend',
    boardInvitations.length
      ? boardInvitations
          .map(
            (item) => `
              <div class="list-card">
                <div class="action-row">
                  <strong>${item.title}</strong>
                  <button class="action-btn join-btn" data-id="${item.invitation_id}">加入揪團</button>
                </div>
                <p>${item.location}</p>
                <div class="meta-line">
                  ${item.participant_count} / ${item.max_participants} 人 · ${formatDate(item.event_time)} · by ${item.username}
                </div>
              </div>
            `
          )
          .join('')
      : createEmptyState('目前沒有揪團')
  );

  el('#post-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentUser = getCurrentUser();
    if (!currentUser?.user_id) {
      window.alert('請先登入再發文');
      window.location.href = '/auth.html';
      return;
    }

    const payload = serializeForm(event.currentTarget);
    payload.board_id = Number(boardId);
    payload.user_id = Number(currentUser.user_id);

    try {
      await API.post('/posts', payload);
      window.location.reload();
    } catch (err) {
      window.alert(err.message);
    }
  });

  el('#invitation-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentUser = getCurrentUser();
    if (!currentUser?.user_id) {
      window.alert('請先登入再建立揪團');
      window.location.href = '/auth.html';
      return;
    }

    const payload = serializeForm(event.currentTarget);
    payload.board_id = Number(boardId);
    payload.user_id = Number(currentUser.user_id);

    try {
      await API.post('/invitations', payload);
      window.location.reload();
    } catch (err) {
      window.alert(err.message);
    }
  });

  document.querySelectorAll('.join-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const userId = prompt('輸入要加入的 user_id');
      if (!userId) {
        return;
      }

      try {
        await API.post(`/invitations/${button.dataset.id}/join`, { user_id: Number(userId) });
        window.location.reload();
      } catch (err) {
        window.alert(err.message);
      }
    });
  });
}

initBoardPage();
