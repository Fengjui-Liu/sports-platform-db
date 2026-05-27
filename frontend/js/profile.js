async function initProfilePage() {
  const params = getParams();
  const currentUser = getCurrentUser();
  const userId = params.get('id') || (currentUser && currentUser.user_id);

  if (!userId) {
    el('#profile-card').innerHTML = createEmptyState('請先登入，或帶入 ?id= 參數');
    return;
  }

  fillUserIdInputs();

  try {
    const viewerId = currentUser?.user_id || userId;

    const [
      user,
      bodyRecords,
      posts,
      sessions,
      savedPlans,
      createdPlans,
      createdInvitations,
      joinedInvitations,
    ] = await Promise.all([
      API.get(`/users/${userId}`),
      API.get(`/users/${userId}/bodyrecord`),
      API.get(`/users/${userId}/posts`),
      API.get(`/users/${userId}/sessions`),
      API.get(`/users/${userId}/saved-plans`),
      API.get(`/workoutplans?user_id=${userId}`),
      API.get(`/invitations?owner_id=${userId}&user_id=${viewerId}`),
      API.get(`/invitations?participant_user_id=${userId}&user_id=${viewerId}`),
    ]);

    renderProfile(user, {
      createdPlansCount: createdPlans.length,
      createdInvitationsCount: createdInvitations.length,
      joinedInvitationsCount: joinedInvitations.length,
    });

    renderBodyRecords(bodyRecords);

    renderSimpleList(
      '#profile-posts',
      posts,
      (post) => `
        <a class="list-card" href="/post.html?id=${post.post_id}">
          <div class="action-row">
            <div>
              <div class="chip-row">
                <span class="chip">${getBoardEmoji(post.board_name)} ${escapeHtml(post.board_name)}</span>
              </div>
              <h3 style="margin-top:12px;">${escapeHtml(post.title || '未命名貼文')}</h3>
            </div>
            <span class="meta-line">${formatDate(post.created_at)}</span>
          </div>

          <p class="page-description">${escapeHtml(truncateText(post.content, 120))}</p>

          <div class="chip-row">
            <span class="chip muted-chip">❤️ ${post.like_count}</span>
            <span class="chip muted-chip">💬 ${post.comment_count || 0}</span>
          </div>
        </a>
      `,
      '目前沒有貼文'
    );

    renderSimpleList(
      '#profile-created-plans',
      createdPlans,
      (plan) => `
        <a class="mini-card" href="/workoutplan.html?id=${plan.plan_id}">
          <div class="action-row">
            <strong>${escapeHtml(plan.title)}</strong>
            <span class="chip">${escapeHtml(plan.sport_type)}</span>
          </div>
          <p>${escapeHtml(plan.exercise_name)} · ${plan.reps || 0} reps × ${plan.sets || 0} sets</p>
          <div class="meta-line">
            ${escapeHtml(plan.difficulty_level || '未設定難度')} · 收藏 ${plan.save_count || 0} · ${formatDate(plan.created_at)}
          </div>
        </a>
      `,
      '目前沒有建立訓練計畫'
    );

    renderSimpleList(
      '#profile-created-invitations',
      createdInvitations,
      (invitation) => `
        <a class="mini-card" href="/board.html?id=${invitation.board_id}">
          <div class="action-row">
            <strong>${escapeHtml(invitation.title)}</strong>
            <span class="chip">${escapeHtml(invitation.board_name)}</span>
          </div>
          <p>${escapeHtml(invitation.location)}</p>
          <div class="meta-line">
            ${invitation.participant_count || 0} / ${invitation.max_participants} 人 · ${formatDate(invitation.event_time)}
          </div>
        </a>
      `,
      '目前沒有建立揪團'
    );

    renderSimpleList(
      '#profile-joined-invitations',
      joinedInvitations,
      (invitation) => `
        <a class="mini-card" href="/board.html?id=${invitation.board_id}">
          <div class="action-row">
            <strong>${escapeHtml(invitation.title)}</strong>
            <span class="chip">${escapeHtml(invitation.board_name)}</span>
          </div>
          <p>${escapeHtml(invitation.location)}</p>
          <div class="meta-line">
            ${invitation.participant_count || 0} / ${invitation.max_participants} 人 · ${formatDate(invitation.event_time)}
          </div>
        </a>
      `,
      '目前沒有參加揪團'
    );

    renderSimpleList(
      '#profile-sessions',
      sessions,
      (session) => `
        <div class="mini-card">
          <strong>${escapeHtml(session.title || '未命名計畫')}</strong>
          <p class="page-description">${escapeHtml(session.notes || '無備註')}</p>
          <div class="meta-line">${formatDate(session.start_time)}</div>
        </div>
      `,
      '目前沒有訓練紀錄'
    );

    renderSimpleList(
      '#profile-saved-plans',
      savedPlans,
      (plan) => `
        <a class="mini-card" href="/workoutplan.html?id=${plan.plan_id}">
          <strong>${escapeHtml(plan.title)}</strong>
          <p class="page-description">${escapeHtml(plan.exercise_name)} · ${plan.reps} reps × ${plan.sets} sets</p>
          <div class="meta-line">${escapeHtml(plan.username)}</div>
        </a>
      `,
      '目前沒有收藏計畫'
    );

    bindProfileForms(userId, currentUser);
  } catch (err) {
    showMessage(el('#profile-card'), err.message, true);
  }
}

function renderProfile(user, stats = {}) {
  const avatar = user.profile_image
    ? `<img class="avatar" src="${escapeHtml(user.profile_image)}" alt="avatar">`
    : `<span class="avatar-circle" style="width:88px;height:88px;font-size:32px;">${escapeHtml(getUserInitials(user.username))}</span>`;

  el('#profile-card').innerHTML = `
    <div class="profile-head">
      <div class="profile-summary">
        ${avatar}
        <div>
          <h1>${escapeHtml(user.username)}</h1>
          <div class="meta-line">${escapeHtml(user.email)}</div>
          <p class="page-description">${escapeHtml(user.bio || '這位使用者還沒有填寫自我介紹。')}</p>
          <div class="chip-row" style="margin-top:12px;">
            <span class="chip">貼文數 ${user.post_count || 0}</span>
            <span class="chip">建立計畫 ${stats.createdPlansCount || 0}</span>
            <span class="chip">建立揪團 ${stats.createdInvitationsCount || 0}</span>
            <span class="chip">參加揪團 ${stats.joinedInvitationsCount || 0}</span>
            <span class="chip">訓練次數 ${user.session_count || 0}</span>
            <span class="chip">收藏計畫數 ${user.saved_plan_count || 0}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const profileForm = el('#profile-form');

  if (profileForm) {
    profileForm.bio.value = user.bio || '';
    profileForm.profile_image.value = user.profile_image || '';
  }
}

function renderBodyRecords(records) {
  const chartShell = el('#bodyrecord-chart');

  if (!records.length) {
    chartShell.innerHTML = createEmptyState('尚未建立身體數據');
    return;
  }

  chartShell.innerHTML = `
    <div class="chart-shell">
      <canvas id="body-chart" class="chart-canvas" width="900" height="260"></canvas>
      <div class="legend">
        <span><span class="legend-dot" style="background:#1f4396;"></span>體重</span>
        <span><span class="legend-dot" style="background:#2d9ce0;"></span>體脂</span>
      </div>
    </div>
    <div class="stack-list" style="margin-top:16px;">
      ${records
        .map(
          (record) => `
            <div class="mini-card">
              <strong>${formatDate(record.recorded_at)}</strong>
              <div class="meta-line">
                體重 ${record.weight} kg · 身高 ${record.height} cm · 體脂 ${record.body_fat} %
              </div>
            </div>
          `
        )
        .join('')}
    </div>
  `;

  drawBodyChart([...records].reverse());
}

function drawBodyChart(records) {
  const canvas = el('#body-chart');

  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const padding = 32;
  const weights = records.map((item) => Number(item.weight));
  const bodyFats = records.map((item) => Number(item.body_fat));
  const allValues = [...weights, ...bodyFats];
  const maxValue = Math.max(...allValues);
  const minValue = Math.min(...allValues);
  const range = maxValue - minValue || 1;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f8faff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#dbe3f1';
  ctx.lineWidth = 1;

  for (let i = 0; i < 4; i += 1) {
    const y = padding + ((height - padding * 2) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  const toPoint = (value, index, total) => {
    const x = padding + ((width - padding * 2) / Math.max(total - 1, 1)) * index;
    const y = height - padding - ((value - minValue) / range) * (height - padding * 2);
    return { x, y };
  };

  const drawLine = (values, color) => {
    ctx.beginPath();

    values.forEach((value, index) => {
      const point = toPoint(value, index, values.length);

      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    values.forEach((value, index) => {
      const point = toPoint(value, index, values.length);

      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  drawLine(weights, '#1f4396');
  drawLine(bodyFats, '#2d9ce0');
}

function renderSimpleList(selector, items, renderer, emptyText) {
  const target = el(selector);

  if (!target) {
    return;
  }

  target.innerHTML = items.length
    ? items.map(renderer).join('')
    : createEmptyState(emptyText);
}

function bindProfileForms(userId, currentUser) {
  const canEdit = currentUser && Number(currentUser.user_id) === Number(userId);

  if (!canEdit) {
    disableFormWithMessage(el('#profile-form'), '請使用自己的帳號修改個人資料');
    disableFormWithMessage(el('#bodyrecord-form'), '請使用自己的帳號新增身體數據');
  }

  el('#profile-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!canEdit) {
      return;
    }

    const payload = serializeForm(event.currentTarget);

    try {
      await API.put(`/users/${userId}`, payload);
      window.location.reload();
    } catch (err) {
      window.alert(err.message);
    }
  });

  el('#bodyrecord-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!canEdit) {
      return;
    }

    const payload = serializeForm(event.currentTarget);

    if (payload.recorded_at) {
      payload.recorded_at = toApiDateTime(payload.recorded_at);
    }

    try {
      await API.post(`/users/${userId}/bodyrecord`, payload);
      window.location.reload();
    } catch (err) {
      window.alert(err.message);
    }
  });
}

initProfilePage();