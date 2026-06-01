let editPlanBoards = [];

async function initEditPlanPage() {
  const currentUser = requireCurrentUser('請先登入後再編輯訓練計畫');
  const planId = getParams().get('id');
  const form = el('#edit-plan-form');
  const status = el('#edit-plan-status');

  if (!currentUser || !form) {
    return;
  }

  if (!planId) {
    showMessage(status, '缺少 plan id', true);
    return;
  }

  const planUrl = `/workoutplan.html?id=${encodeURIComponent(planId)}`;
  el('#back-to-plan')?.setAttribute('href', planUrl);
  el('#cancel-edit-plan')?.setAttribute('href', planUrl);

  try {
    const [plan, boards] = await Promise.all([
      API.get(`/workoutplans/${planId}?user_id=${currentUser.user_id}`),
      API.get('/boards'),
    ]);

    if (Number(plan.user_id) !== Number(currentUser.user_id)) {
      showMessage(status, '只能編輯自己的訓練計畫', true);
      window.setTimeout(() => { window.location.href = '/'; }, 900);
      return;
    }

    editPlanBoards = boards;
    fillPlanBoardSelect(boards, plan);
    fillPlanForm(form, plan);
    bindPlanBoardChange(form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await savePlanEdit(planId, form, status, currentUser);
    });
  } catch (err) {
    showMessage(status, err.message || '載入訓練計畫失敗', true);
  }
}

function fillPlanBoardSelect(boards, plan) {
  const select = el('#edit-plan-board');
  if (!select) {
    return;
  }

  select.innerHTML = `
    <option value="" disabled hidden>請選擇專欄</option>
    ${boards.map((board) => `
      <option value="${board.board_id}">${escapeHtml(board.sport_type)}</option>
    `).join('')}
  `;

  const matchedBoard = boards.find((board) => board.sport_type === plan.sport_type);
  select.value = matchedBoard ? String(matchedBoard.board_id) : '';
}

function fillPlanForm(form, plan) {
  form.title.value = plan.title || '';
  form.is_public.value = Number(plan.is_public) ? '1' : '0';
  form.difficulty_level.value = plan.difficulty_level || '';
  form.exercise_name.value = plan.exercise_name || '';
  form.muscle_group.value = plan.muscle_group || '';
  form.reps.value = plan.reps ?? '';
  form.sets.value = plan.sets ?? '';
  form.target_distance.value = plan.target_distance ?? '';
  form.target_duration.value = plan.target_duration ?? '';
  form.rounds.value = plan.rounds ?? '';
  updateEditPlanFields(getSelectedSportType());
}

function bindPlanBoardChange(form) {
  const select = el('#edit-plan-board');
  if (!select) {
    return;
  }

  select.addEventListener('change', () => {
    updateEditPlanFields(getSelectedSportType());
  });
}

function getSelectedSportType() {
  const boardId = el('#edit-plan-board')?.value;
  const board = editPlanBoards.find((item) => String(item.board_id) === String(boardId));
  return board ? board.sport_type : '';
}

function updateEditPlanFields(sportType) {
  const category = getSportCategory(sportType);
  const fieldMap = {
    'edit-plan-field-strength': ['strength'],
    'edit-plan-field-distance': ['cardio'],
    'edit-plan-field-duration': ['cardio', 'cardio_no_distance', 'combat', 'sport'],
    'edit-plan-field-rounds': ['combat'],
  };

  Object.entries(fieldMap).forEach(([id, visibleCategories]) => {
    const group = document.getElementById(id);
    if (!group) return;
    const visible = visibleCategories.includes(category);
    group.classList.toggle('d-none', !visible);
    if (!visible) {
      group.querySelectorAll('input').forEach((input) => {
        input.value = '';
        input.removeAttribute('required');
      });
    }
  });
}

function toNonNegativeInteger(value, fallback = 0) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : NaN;
}

async function savePlanEdit(planId, form, status, currentUser) {
  const selectedSportType = getSelectedSportType();
  const category = getSportCategory(selectedSportType);
  const payload = serializeForm(form);

  payload.user_id = Number(currentUser.user_id);
  payload.board_id = Number(payload.board_id);
  payload.sport_type = selectedSportType;
  payload.title = String(payload.title || '').trim();
  payload.exercise_name = String(payload.exercise_name || '').trim();
  payload.muscle_group = String(payload.muscle_group || '').trim();
  payload.is_public = Number(payload.is_public);
  payload.reps = toNonNegativeInteger(payload.reps, 0);
  payload.sets = toNonNegativeInteger(payload.sets, 0);

  if (!payload.board_id || !payload.sport_type) {
    showMessage(status, '請選擇專欄', true);
    return;
  }

  if (!payload.title) {
    showMessage(status, '請輸入計畫標題', true);
    return;
  }

  if (!payload.difficulty_level) {
    showMessage(status, '請選擇難度', true);
    return;
  }

  if (!payload.exercise_name) {
    showMessage(status, '請輸入訓練項目', true);
    return;
  }

  if (category === 'strength' && !payload.muscle_group) {
    showMessage(status, '請輸入訓練部位', true);
    return;
  }

  if (Number.isNaN(payload.reps) || Number.isNaN(payload.sets)) {
    showMessage(status, 'reps / sets 必須是 0 或正整數', true);
    return;
  }

  if (![0, 1].includes(payload.is_public)) {
    showMessage(status, '請選擇公開狀態', true);
    return;
  }

  ['target_distance', 'target_duration', 'rounds'].forEach((key) => {
    if (payload[key] !== undefined) {
      payload[key] = payload[key] === '' ? null : Number(payload[key]);
    }
  });

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = '儲存中...';
  }

  try {
    await API.put(`/workoutplans/${planId}`, payload);
    showMessage(status, '訓練計畫已更新');
    window.location.href = `/workoutplan.html?id=${encodeURIComponent(planId)}`;
  } catch (err) {
    showMessage(status, err.message || '更新訓練計畫失敗', true);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = '儲存修改';
    }
  }
}

initEditPlanPage();
