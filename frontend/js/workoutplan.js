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
    const plan = await API.get(`/workoutplans/${planId}${query}`);

    renderPlan(plan, currentUser);
    bindWorkoutPlanActions(planId, plan, currentUser);
  } catch (err) {
    showMessage(el('#plan-detail'), err.message, true);
  }
}

function renderPlan(plan, currentUser) {
  const isOwner = currentUser && Number(currentUser.user_id) === Number(plan.user_id);
  const saveLabel = Number(plan.saved_by_viewer) ? '取消收藏' : '收藏計畫';

  el('#plan-detail').innerHTML = `
    <div class="action-row">
      <div>
        <p class="eyebrow">${plan.sport_type}</p>
        <h1>${plan.title}</h1>
        <div class="meta-line">by ${plan.username} · ${formatDate(plan.created_at)}</div>
      </div>
      <div class="chip-row">
        <button id="save-plan-btn" class="primary-btn" ${currentUser ? '' : 'disabled'}>${saveLabel}</button>
        ${isOwner ? '<button id="delete-plan-btn" class="gray-btn">刪除計畫</button>' : ''}
      </div>
    </div>
    <div class="chip-row">
      <span class="chip">${plan.difficulty_level}</span>
      <span class="chip">${plan.exercise_name}</span>
      <span class="chip">${plan.muscle_group}</span>
    </div>
    <p>動作清單：${plan.exercise_name}</p>
    <p>${plan.reps} reps × ${plan.sets} sets</p>
    <p class="muted">目前收藏數：${plan.save_count}</p>
  `;
}

function bindWorkoutPlanActions(planId, plan, currentUser) {
  const status = el('#plan-status');
  const sessionForm = el('#session-form');

  if (!currentUser) {
    sessionForm.querySelectorAll('textarea, input, button').forEach((field) => {
      if (field.name !== 'user_id') {
        field.disabled = true;
      }
    });
    showMessage(status, '請先登入後再收藏計畫或建立訓練紀錄', true);
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
