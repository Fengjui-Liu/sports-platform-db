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
        <button id="share-plan-btn" class="ghost-btn" type="button">分享</button>
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
          ${renderPlanDetailRows(plan)}
        </div>
      </div>
    </div>
    <div id="plan-save-count" class="meta-line" style="margin-top:16px;">目前收藏數：${plan.save_count || 0}</div>
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
      const result = Number(plan.saved_by_viewer)
        ? await API.delete(`/workoutplans/${planId}/save`, { user_id: user.user_id })
        : await API.post(`/workoutplans/${planId}/save`, { user_id: user.user_id });

      plan.saved_by_viewer = Number(result.saved_by_viewer);
      plan.save_count = Math.max(0, Number(result.save_count || 0));

      const saveButton = el('#save-plan-btn');
      if (saveButton) {
        saveButton.textContent = Number(plan.saved_by_viewer) ? '取消收藏' : '收藏';
      }

      const saveCount = el('#plan-save-count');
      if (saveCount) {
        saveCount.textContent = `目前收藏數：${plan.save_count}`;
      }
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

  el('#share-plan-btn')?.addEventListener('click', async () => {
    await downloadPlanImage(plan);
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

// ── 動作詳情 helper（依分類）────────────────────────────────────────────────

function renderPlanDetailRows(plan) {
  const category = getSportCategory(plan.sport_type);
  const rows = [];

  if (plan.exercise_name) {
    rows.push(`<strong>${escapeHtml(plan.exercise_name)}</strong>`);
  }

  if (category === 'strength') {
    if (plan.muscle_group) rows.push(`<div class="meta-line">肌群：${escapeHtml(plan.muscle_group)}</div>`);
    rows.push(`<div class="meta-line">組數：${plan.sets || 0} · 次數：${plan.reps || 0}</div>`);
  } else if (category === 'cardio') {
    if (plan.target_distance) rows.push(`<div class="meta-line">目標距離：${plan.target_distance} km</div>`);
    if (plan.target_duration) rows.push(`<div class="meta-line">目標時間：${plan.target_duration} 分鐘</div>`);
  } else if (category === 'combat') {
    if (plan.target_duration) rows.push(`<div class="meta-line">目標時間：${plan.target_duration} 分鐘</div>`);
    if (plan.rounds) rows.push(`<div class="meta-line">回合數：${plan.rounds}</div>`);
  } else {
    // cardio_no_distance + sport
    if (plan.target_duration) rows.push(`<div class="meta-line">目標時間：${plan.target_duration} 分鐘</div>`);
  }

  return rows.join('');
}

function buildShareCardDetails(plan) {
  const category = getSportCategory(plan.sport_type);
  const lines = [];

  if (category === 'strength') {
    if (plan.muscle_group) lines.push(`肌群：${plan.muscle_group}`);
    lines.push(`${plan.sets || 0} 組 × ${plan.reps || 0} 次`);
  } else if (category === 'cardio') {
    if (plan.target_distance) lines.push(`目標距離：${plan.target_distance} km`);
    if (plan.target_duration) lines.push(`目標時間：${plan.target_duration} 分鐘`);
  } else if (category === 'combat') {
    if (plan.target_duration) lines.push(`目標時間：${plan.target_duration} 分鐘`);
    if (plan.rounds) lines.push(`回合數：${plan.rounds}`);
  } else {
    if (plan.target_duration) lines.push(`目標時間：${plan.target_duration} 分鐘`);
  }

  return lines
    .map((l) => `<p style="margin:0 0 4px;font-size:15px;opacity:0.8;font-weight:600;">${escapeHtml(l)}</p>`)
    .join('');
}

// ── 分享卡片截圖 ──────────────────────────────────────────────────────────────

function buildShareCard(plan) {
  const card = document.createElement('div');

  const chip = (text, alpha = 0.18) =>
    `<span style="
      display:inline-flex;align-items:center;
      background:rgba(255,255,255,${alpha});
      border-radius:999px;padding:5px 14px;
      font-size:13px;font-weight:700;color:#fff;
    ">${escapeHtml(text || '')}</span>`;

  card.innerHTML = `
    <div style="
      position:relative;
      width:600px;
      background:#1f4396;
      color:#ffffff;
      padding:52px 48px 56px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      box-sizing:border-box;
      border-radius:18px;
      overflow:hidden;
    ">
      <!-- 裝飾圓 -->
      <div style="
        position:absolute;top:-80px;right:-80px;
        width:280px;height:280px;
        border-radius:50%;
        background:rgba(255,255,255,0.06);
        pointer-events:none;
      "></div>
      <div style="
        position:absolute;bottom:-60px;left:-60px;
        width:200px;height:200px;
        border-radius:50%;
        background:rgba(255,255,255,0.04);
        pointer-events:none;
      "></div>

      <!-- 上方標籤 -->
      <p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:0.12em;opacity:0.6;text-transform:uppercase;">
        訓練計畫
      </p>

      <!-- 計畫名稱 -->
      <h1 style="margin:0 0 24px;font-size:34px;font-weight:900;line-height:1.2;letter-spacing:-0.01em;">
        ${escapeHtml(plan.title || '訓練計畫')}
      </h1>

      <!-- 標籤列 -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:32px;">
        ${plan.sport_type ? chip(plan.sport_type) : ''}
        ${plan.difficulty_level ? chip(plan.difficulty_level) : ''}
        ${(getSportCategory(plan.sport_type) === 'strength' && plan.muscle_group) ? chip(plan.muscle_group, 0.12) : ''}
      </div>

      <!-- 動作詳情 -->
      <div style="
        background:rgba(255,255,255,0.1);
        border-radius:12px;
        padding:24px 28px;
      ">
        <p style="margin:0 0 8px;font-size:18px;font-weight:800;">
          ${escapeHtml(plan.exercise_name || '訓練動作')}
        </p>
        ${buildShareCardDetails(plan)}
      </div>

      <!-- 品牌 -->
      <p style="
        position:absolute;bottom:22px;right:28px;
        margin:0;font-size:12px;font-weight:800;
        letter-spacing:0.12em;opacity:0.45;
        text-transform:uppercase;
      ">SPORTBOARD</p>
    </div>
  `;

  // 定位到畫面外但仍在 DOM 內（html2canvas 需要元素可見）
  card.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
  return card;
}

async function downloadPlanImage(plan) {
  if (typeof html2canvas === 'undefined') {
    window.alert('截圖功能載入中，請稍後再試。');
    return;
  }

  const btn = el('#share-plan-btn');
  const originalText = btn ? btn.textContent : '';
  if (btn) { btn.textContent = '截圖中...'; btn.disabled = true; }

  const wrapper = buildShareCard(plan);
  document.body.appendChild(wrapper);
  const target = wrapper.firstElementChild;

  try {
    const canvas = await html2canvas(target, {
      scale: 2,           // 高解析度
      useCORS: true,
      backgroundColor: null,
      logging: false,
    });

    const safeTitle = (plan.title || '訓練計畫')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);

    const link = document.createElement('a');
    link.download = `sportboard_${safeTitle}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    window.alert('截圖失敗：' + err.message);
  } finally {
    wrapper.remove();
    if (btn) { btn.textContent = originalText; btn.disabled = false; }
  }
}

initWorkoutPlanPage();
