async function initCreatePage() {
  fillUserIdInputs();
  setupTabs();

  const currentUser = getCurrentUser();
  const params = getParams();
  const defaultTab = params.get('tab');

  if (!currentUser) {
    disableFormWithMessage(el('#post-form'), '請先登入後再發文');
    disableFormWithMessage(el('#plan-form'), '請先登入後再新增訓練計畫');
    disableFormWithMessage(el('#invitation-form'), '請先登入後再建立揪團');
  }

  try {
    const boards = await API.get('/boards');

    fillCreateBoardSelects(boards);
    bindCreateForms(currentUser, boards);

    if (defaultTab) {
      activateCreateTab(defaultTab);
    }
  } catch (err) {
    window.alert(err.message);
  }
}

function activateCreateTab(tabName) {
  const button = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);

  if (button) {
    button.click();
  }
}

function fillCreateBoardSelects(boards) {
  fillCreateSingleBoardSelect('#post-board-select', boards);
  fillCreateSingleBoardSelect('#plan-board-select', boards);
  fillCreateSingleBoardSelect('#invitation-board-select', boards);

  syncCreatePlanSportType(boards);
}

function fillCreateSingleBoardSelect(selector, boards) {
  const select = el(selector);

  if (!select) {
    return;
  }

  select.innerHTML = `
    <option value="" disabled selected hidden>請選擇要發佈的專欄</option>
    ${boards
      .map(
        (board) => `
          <option value="${board.board_id}">
            ${escapeHtml(board.sport_type)}
          </option>
        `
      )
      .join('')}
  `;

  select.value = '';
}

function syncCreatePlanSportType(boards) {
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

function findCreateBoardById(boards, boardId) {
  return boards.find((board) => String(board.board_id) === String(boardId));
}

function bindCreateForms(currentUser, boards) {
  const postForm = el('#post-form');
  const planForm = el('#plan-form');
  const invitationForm = el('#invitation-form');

  postForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const user = requireCurrentUser('請先登入再發文');

    if (!user) {
      return;
    }

    const payload = serializeForm(event.currentTarget);

    payload.user_id = Number(user.user_id);
    payload.board_id = Number(payload.board_id);

    if (!payload.board_id) {
      window.alert('請選擇要發佈的專欄');
      return;
    }

    if (!payload.title || !payload.title.trim()) {
      window.alert('請輸入貼文標題');
      return;
    }

    if (!payload.content || !payload.content.trim()) {
      window.alert('請輸入貼文內容');
      return;
    }

    try {
      await API.post('/posts', payload);
      window.location.href = `/board.html?id=${payload.board_id}&tab=posts`;
    } catch (err) {
      window.alert(err.message);
    }
  });

  planForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const user = requireCurrentUser('請先登入再新增訓練計畫');

    if (!user) {
      return;
    }

    const payload = serializeForm(event.currentTarget);
    const selectedBoard = findCreateBoardById(boards, payload.board_id);

    if (!selectedBoard) {
      window.alert('請選擇要發佈的專欄');
      return;
    }

    payload.user_id = Number(user.user_id);
    payload.board_id = Number(payload.board_id);
    payload.sport_type = selectedBoard.sport_type;

    if (payload.reps !== undefined) {
      payload.reps = Number(payload.reps);
    }

    if (payload.sets !== undefined) {
      payload.sets = Number(payload.sets);
    }

    try {
      await API.post('/workoutplans', payload);
      window.alert('訓練計畫建立成功');
      window.location.href = `/board.html?id=${payload.board_id}&tab=plans`;
    } catch (err) {
      window.alert(err.message);
    }
  });

  invitationForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const user = requireCurrentUser('請先登入再建立揪團');

    if (!user) {
      return;
    }

    const payload = serializeForm(event.currentTarget);

    payload.user_id = Number(user.user_id);
    payload.board_id = Number(payload.board_id);
    payload.max_participants = Number(payload.max_participants);
    payload.event_time = toApiDateTime(payload.event_time);

    if (!payload.board_id) {
      window.alert('請選擇要發佈的專欄');
      return;
    }

    if (!payload.title || !payload.title.trim()) {
      window.alert('請輸入活動標題');
      return;
    }

    if (!payload.location || !payload.location.trim()) {
      window.alert('請輸入地點');
      return;
    }

    if (!payload.event_time) {
      window.alert('請選擇活動時間');
      return;
    }

    if (!payload.max_participants || payload.max_participants < 1) {
      window.alert('人數上限必須至少為 1');
      return;
    }

    try {
      await API.post('/invitations', payload);
      window.location.href = `/board.html?id=${payload.board_id}&tab=invitations`;
    } catch (err) {
      window.alert(err.message);
    }
  });
}

initCreatePage();