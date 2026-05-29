// === 地圖與定位邏輯開始 ===
window.initMap = function () {
  const defaultPos = { lat: 25.0339, lng: 121.5644 }; // 預設為台北101附近

  const mapContainer = document.getElementById("map-container");
  if (!mapContainer) return; // 如果頁面沒有地圖容器就跳過

  const map = new google.maps.Map(mapContainer, {
    center: defaultPos,
    zoom: 15,
    disableDefaultUI: true,
    zoomControl: true,
  });

  const marker = new google.maps.Marker({
    position: defaultPos,
    map: map,
    draggable: true,
    animation: google.maps.Animation.DROP,
  });

  // 監聽圖釘拖拽結束事件
  marker.addListener("dragend", () => {
    const pos = marker.getPosition();
    updateCoords(pos.lat(), pos.lng());
  });

  setupGeoButton(map, marker);
};

function updateCoords(lat, lng) {
  const latInput = document.getElementById('inv-lat');
  const lngInput = document.getElementById('inv-lng');
  if (latInput) latInput.value = lat;
  if (lngInput) lngInput.value = lng;
}

function setupGeoButton(map, marker) {
  const btn = document.getElementById('btn-get-geo');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert("您的瀏覽器不支援地理定位");
      return;
    }

    btn.textContent = "定位中...";

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newPos = { lat: latitude, lng: longitude };

        map.setCenter(newPos);
        marker.setPosition(newPos);
        updateCoords(latitude, longitude);

        btn.textContent = "定位目前位置";
      },
      () => {
        alert("無法取得您的精確位置，請確認瀏覽器定位權限是否開啟。");
        btn.textContent = "定位目前位置";
      }
    );
  });
}
// === 地圖與定位邏輯結束 ===

// === 頁面初始化與表單邏輯開始 ===
async function initCreatePage() {
  fillUserIdInputs();
  setupTabs();
  setupImagePreview();

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

function setupImagePreview() {
  const input = el('#post-image-input');
  const preview = el('#post-image-preview');

  if (!input || !preview) return;

  input.addEventListener('change', () => {
    preview.innerHTML = '';
    const file = input.files[0];

    if (file) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      preview.appendChild(img);
    }
  });
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

    // event.currentTarget becomes null after the first await — capture it now
    const form = event.currentTarget;
    const user = requireCurrentUser('請先登入再發文');
    if (!user) return;

    const submitBtn = postForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    const imageInput = el('#post-image-input');

    // 圖片上傳邏輯
    if (imageInput && imageInput.files.length > 0) {
      submitBtn.disabled = true;
      submitBtn.textContent = '上傳中...';

      const formData = new FormData();
      formData.append('image', imageInput.files[0]);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error || '圖片上傳失敗');
        
        el('#post-image-url').value = result.imageUrl;
      } catch (err) {
        window.alert(err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        return;
      }
    }

    const payload = serializeForm(form);

    payload.user_id = Number(user.user_id);
    payload.board_id = Number(payload.board_id);

    if (!payload.board_id) {
      window.alert('請選擇要發佈的專欄');
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
      return;
    }

    if (!payload.title || !payload.title.trim()) {
      window.alert('請輸入貼文標題');
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
      return;
    }

    if (!payload.content || !payload.content.trim()) {
      window.alert('請輸入貼文內容');
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
      return;
    }

    try {
      await API.post('/posts', payload);
      window.location.href = `/board.html?id=${payload.board_id}&tab=posts`;
    } catch (err) {
      window.alert(err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });

  planForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;

    const user = requireCurrentUser('請先登入再新增訓練計畫');

    if (!user) {
      return;
    }

    const payload = serializeForm(form);
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
    const form = event.currentTarget;

    const user = requireCurrentUser('請先登入再建立揪團');

    if (!user) {
      return;
    }

    const payload = serializeForm(form);

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
