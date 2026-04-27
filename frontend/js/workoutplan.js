async function initWorkoutPlanPage() {
  fillUserIdInputs();

  const planId = getParams().get('id');
  if (!planId) {
    el('#plan-detail').innerHTML = createEmptyState('缺少 plan id');
    return;
  }

  try {
    const plan = await API.get(`/workoutplans/${planId}`);

    el('#plan-detail').innerHTML = `
      <div class="action-row">
        <div>
          <p class="eyebrow">${plan.sport_type}</p>
          <h1>${plan.title}</h1>
          <div class="meta-line">by ${plan.username} · ${formatDate(plan.created_at)}</div>
        </div>
        <button id="save-plan-btn" class="primary-btn">收藏計畫</button>
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

    el('#save-plan-btn').addEventListener('click', async () => {
      const userId = Number(prompt('輸入收藏用的 user_id', currentUserIdOrBlank()));
      if (!userId) {
        return;
      }

      try {
        await API.post(`/workoutplans/${planId}/save`, { user_id: userId });
        window.location.reload();
      } catch (err) {
        window.alert(err.message);
      }
    });

    el('#session-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = serializeForm(event.currentTarget);
      payload.user_id = Number(payload.user_id);
      payload.plan_id = Number(planId);

      try {
        await API.post('/sessions', payload);
        window.alert('訓練紀錄已建立');
        event.currentTarget.reset();
        fillUserIdInputs();
      } catch (err) {
        window.alert(err.message);
      }
    });
  } catch (err) {
    showMessage(el('#plan-detail'), err.message, true);
  }
}

initWorkoutPlanPage();
