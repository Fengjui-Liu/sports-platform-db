async function initProfilePage() {
  const params = getParams();
  const currentUser = getCurrentUser();
  const userId = params.get('id') || (currentUser && currentUser.user_id);

  if (!userId) {
    el('#profile-card').innerHTML = createEmptyState('請先登入，或帶入 `?id=` 參數');
    return;
  }

  fillUserIdInputs();

  try {
    const [user, bodyRecords, posts, sessions, savedPlans] = await Promise.all([
      API.get(`/users/${userId}`),
      API.get(`/users/${userId}/bodyrecord`),
      API.get(`/users/${userId}/posts`),
      API.get(`/users/${userId}/sessions`),
      API.get(`/users/${userId}/saved-plans`),
    ]);

    renderProfile(user);
    renderBodyRecords(bodyRecords);
    renderSimpleList('#profile-posts', posts, (post) => `
      <a class="mini-card" href="/post.html?id=${post.post_id}">
        <strong>${post.board_name}</strong>
        <p>${post.content}</p>
        <div class="meta-line">❤️ ${post.like_count} · ${formatDate(post.created_at)}</div>
      </a>
    `, '目前沒有貼文');
    renderSimpleList('#profile-sessions', sessions, (session) => `
      <div class="mini-card">
        <strong>${session.title || '未命名計畫'}</strong>
        <p>${session.notes || '無備註'}</p>
        <div class="meta-line">${formatDate(session.start_time)}</div>
      </div>
    `, '目前沒有訓練紀錄');
    renderSimpleList('#profile-saved-plans', savedPlans, (plan) => `
      <a class="mini-card" href="/workoutplan.html?id=${plan.plan_id}">
        <strong>${plan.title}</strong>
        <p>${plan.exercise_name} · ${plan.reps} reps × ${plan.sets} sets</p>
        <div class="meta-line">${plan.username}</div>
      </a>
    `, '目前沒有收藏計畫');

    bindProfileForms(userId, user);
  } catch (err) {
    showMessage(el('#profile-card'), err.message, true);
  }
}

function renderProfile(user) {
  el('#profile-card').innerHTML = `
    <div class="profile-head">
      <img class="avatar" src="${user.profile_image || 'https://placehold.co/128x128?text=SP'}" alt="avatar">
      <div>
        <h2>${user.username}</h2>
        <p>${user.email}</p>
      </div>
    </div>
    <p>${user.bio || '這位使用者還沒有填寫自介。'}</p>
    <div class="chip-row">
      <span class="chip">${user.post_count} 篇貼文</span>
      <span class="chip">${user.session_count} 筆訓練</span>
      <span class="chip">${user.saved_plan_count} 個收藏</span>
      <span class="chip">${user.follower_count} 位追蹤者</span>
    </div>
  `;

  const profileForm = el('#profile-form');
  profileForm.bio.value = user.bio || '';
  profileForm.profile_image.value = user.profile_image || '';
}

function renderBodyRecords(records) {
  const chartShell = el('#bodyrecord-chart');
  if (!records.length) {
    chartShell.innerHTML = createEmptyState('尚未建立身體數據');
    return;
  }

  const ordered = [...records].reverse();
  const width = 760;
  const height = 240;
  const padding = 32;
  const weights = ordered.map((item) => Number(item.weight));
  const bodyFats = ordered.map((item) => Number(item.body_fat));
  const maxValue = Math.max(...weights, ...bodyFats);
  const minValue = Math.min(...weights, ...bodyFats);
  const range = maxValue - minValue || 1;

  const pointString = (values) =>
    values
      .map((value, index) => {
        const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
        const y = height - padding - ((value - minValue) / range) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');

  chartShell.innerHTML = `
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="body record chart">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#dce2ef" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#dce2ef" />
      <polyline class="weight-line" points="${pointString(weights)}"></polyline>
      <polyline class="bodyfat-line" points="${pointString(bodyFats)}"></polyline>
      <text x="${padding}" y="${padding - 8}">Weight / Body Fat</text>
      <text x="${width - padding - 120}" y="${padding - 8}" fill="#213b99">藍：體重 紅：體脂</text>
    </svg>
    <div class="stack-list">
      ${records
        .map(
          (record) => `
            <div class="mini-card">
              <strong>${formatDate(record.recorded_at)}</strong>
              <div class="meta-line">體重 ${record.weight} kg · 身高 ${record.height} cm · 體脂 ${record.body_fat} %</div>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function renderSimpleList(selector, items, renderer, emptyText) {
  el(selector).innerHTML = items.length ? items.map(renderer).join('') : createEmptyState(emptyText);
}

function bindProfileForms(userId) {
  el('#profile-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = serializeForm(event.currentTarget);

    try {
      await API.put(`/users/${userId}`, payload);
      window.location.reload();
    } catch (err) {
      window.alert(err.message);
    }
  });

  el('#bodyrecord-form').addEventListener('submit', async (event) => {
    event.preventDefault();
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
