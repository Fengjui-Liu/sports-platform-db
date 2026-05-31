async function initEditPostPage() {
  const currentUser = requireCurrentUser('請先登入後再編輯貼文');
  const postId = getParams().get('id');
  const status = el('#edit-post-status');
  const form = el('#edit-post-form');

  if (!currentUser || !form) {
    return;
  }

  if (!postId) {
    showMessage(status, '缺少 post id', true);
    return;
  }

  const detailUrl = `/post.html?id=${encodeURIComponent(postId)}`;
  el('#back-to-post')?.setAttribute('href', detailUrl);
  el('#cancel-edit-post')?.setAttribute('href', detailUrl);

  try {
    const [post, boards] = await Promise.all([
      API.get(`/posts/${postId}?user_id=${currentUser.user_id}`),
      API.get('/boards'),
    ]);

    if (Number(post.user_id) !== Number(currentUser.user_id)) {
      showMessage(status, '只能編輯自己的貼文', true);
      window.setTimeout(() => { window.location.href = '/'; }, 900);
      return;
    }

    fillBoardSelect(boards, post.board_id);
    form.title.value = post.title || '';
    form.content.value = post.content || '';
    form.image_url.value = post.image_url || '';

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await savePostEdit(postId, form, status, currentUser);
    });
  } catch (err) {
    showMessage(status, err.message || '載入貼文失敗', true);
  }
}

function fillBoardSelect(boards, selectedBoardId = '') {
  const select = el('#edit-post-board');
  if (!select) {
    return;
  }

  select.innerHTML = `
    <option value="" disabled hidden>請選擇專欄</option>
    ${boards.map((board) => `
      <option value="${board.board_id}">${escapeHtml(board.sport_type)}</option>
    `).join('')}
  `;

  select.value = String(selectedBoardId || '');
}

async function savePostEdit(postId, form, status, currentUser) {
  const payload = serializeForm(form);
  payload.user_id = Number(currentUser.user_id);
  payload.board_id = Number(payload.board_id);
  payload.title = String(payload.title || '').trim();
  payload.content = String(payload.content || '').trim();
  payload.image_url = payload.image_url || null;

  if (!payload.board_id) {
    showMessage(status, '請選擇專欄', true);
    return;
  }

  if (!payload.title) {
    showMessage(status, '請輸入貼文標題', true);
    return;
  }

  if (!payload.content) {
    showMessage(status, '請輸入貼文內容', true);
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = '儲存中...';
  }

  try {
    await API.put(`/posts/${postId}`, payload);
    showMessage(status, '貼文已更新');
    window.location.href = `/post.html?id=${encodeURIComponent(postId)}`;
  } catch (err) {
    showMessage(status, err.message || '更新貼文失敗', true);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = '儲存修改';
    }
  }
}

initEditPostPage();
