async function initWorkoutPlanPage() {
  fillUserIdInputs();

  const currentUser = getCurrentUser();
  const planId = getParams().get('id');
  if (!planId) {
    el('#plan-detail').innerHTML = createEmptyState('缺少 plan id');
    return;
  }

  try {
    const query = currentUser ? `?user_id=${currentUser.user_id}` : '';
    const [boards, plan] = await Promise.all([
      API.get('/boards'),
      API.get(`/workoutplans/${planId}${query}`),
    ]);

    const activeBoard = boards.find((board) => board.sport_type === plan.sport_type);
    renderBoardSidebar(boards, activeBoard?.board_id || null);
    renderPlan(plan, currentUser);
    bindWorkoutPlanActions(planId, plan, currentUser);
  } catch (err) {
    showMessage(el('#plan-detail'), err.message, true);
  }
}

function renderPlan(plan, currentUser) {
  const isOwner = currentUser && Number(currentUser.user_id) === Number(plan.user_id);
  const saveLabel = Number(plan.saved_by_viewer) ? '取消收藏' : '收藏';

  el('#plan-detail').innerHTML = `
    <p class="eyebrow">${escapeHtml(plan.sport_type)}</p>
    <div class="action-row">
      <div>
        <h1>${escapeHtml(plan.title)}</h1>
        <div class="meta-line">建立者 ${escapeHtml(plan.username)} · ${formatDate(plan.created_at)}</div>
      </div>
      <div class="chip-row">
        <button id="save-plan-btn" class="primary-btn" type="button" ${currentUser ? '' : 'disabled'}>${saveLabel}</button>
        ${isOwner ? '<button id="delete-plan-btn" class="ghost-btn" type="button">刪除計畫</button>' : ''}
      </div>
    </div>
    <div class="chip-row" style="margin-top:16px;">
      <span class="chip">${escapeHtml(plan.difficulty_level)}</span>
      <span class="chip muted-chip">${escapeHtml(plan.sport_type)}</span>
      <span class="chip muted-chip">${escapeHtml(plan.muscle_group)}</span>
    </div>
    <div class="panel-card" style="margin-top:18px;background:var(--surface-soft);box-shadow:none;">
      <h3>動作詳情</h3>
      <div class="stack-list" style="margin-top:14px;">
        <div class="mini-card">
          <strong>${escapeHtml(plan.exercise_name)}</strong>
          <div class="meta-line">肌肉群：${escapeHtml(plan.muscle_group)}</div>
          <div class="meta-line">組數：${plan.sets} · 次數：${plan.reps}</div>
        </div>
      </div>
    </div>
    <div class="meta-line" style="margin-top:16px;">目前收藏數：${plan.save_count}</div>
  `;
}

function bindWorkoutPlanActions(planId, plan, currentUser) {
  const status = el('#plan-status');
  const sessionForm = el('#session-form');

  if (!currentUser) {
    disableFormWithMessage(sessionForm, '請先登入後再收藏計畫或開始訓練', status);
  }

  el('#save-plan-btn')?.addEventListener('click', async () => {
    const user = requireCurrentUser('請先登入再收藏計畫');
    if (!user) {
      return;
    }

    try {
      if (Number(plan.saved_by_viewer)) {
        await API.delete(`/workoutplans/${planId}/save`, { user_id: user.user_id });
      } else {
        await API.post(`/workoutplans/${planId}/save`, { user_id: user.user_id });
      }
      window.location.reload();
    } catch (err) {
      showMessage(status, err.message, true);
    }
  });

  el('#delete-plan-btn')?.addEventListener('click', async () => {
    if (!currentUser) {
      return;
    }

    try {
      await API.delete(`/workoutplans/${planId}`, { user_id: currentUser.user_id });
      window.location.href = '/board.html';
    } catch (err) {
      showMessage(status, err.message, true);
    }
  });

  sessionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = requireCurrentUser('請先登入再建立訓練紀錄');
    if (!user) {
      return;
    }

    const payload = serializeForm(event.currentTarget);
    payload.user_id = Number(user.user_id);
    payload.plan_id = Number(planId);
    payload.start_time = toApiDateTime(payload.start_time);
    payload.end_time = toApiDateTime(payload.end_time);

    try {
      await API.post('/sessions', payload);
      showMessage(status, '訓練紀錄已建立');
      event.currentTarget.reset();
      fillUserIdInputs();
    } catch (err) {
      showMessage(status, err.message, true);
    }
  });
}

initWorkoutPlanPage();
