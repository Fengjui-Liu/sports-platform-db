async function initPostPage() {
  fillUserIdInputs();

  const currentUser = getCurrentUser();
  const postId = getParams().get('id');
  if (!postId) {
    el('#post-detail').innerHTML = createEmptyState('缺少 post id');
    return;
  }

  try {
    const query = currentUser ? `?user_id=${currentUser.user_id}` : '';
    const [boards, post, comments] = await Promise.all([
      API.get('/boards'),
      API.get(`/posts/${postId}${query}`),
      API.get(`/posts/${postId}/comments${query}`),
    ]);

    renderBoardSidebar(boards, post.board_id);
    renderPost(post, currentUser);
    renderComments(postId, comments, currentUser);
    bindPostActions(postId, post, currentUser);
  } catch (err) {
    showMessage(el('#post-detail'), err.message, true);
  }
}

function renderPost(post, currentUser) {
  const isOwner = currentUser && Number(currentUser.user_id) === Number(post.user_id);
  const likeButtonLabel = Number(post.liked_by_viewer) ? '取消按讚' : '❤️ 按讚';

  el('#post-detail').innerHTML = `
    <div class="action-row">
      <div class="profile-summary">
        <span class="avatar-circle">${escapeHtml(getUserInitials(post.username))}</span>
        <div>
          <div class="chip-row">
            <span class="chip">${getBoardEmoji(post.board_name)} ${escapeHtml(post.board_name)}</span>
          </div>
          <h1 style="margin-top:12px;">${escapeHtml(post.username)}</h1>
          <div class="meta-line">${formatDate(post.created_at)}</div>
        </div>
      </div>
      <div class="chip-row">
        <button id="like-btn" class="primary-btn" type="button" ${currentUser ? '' : 'disabled'}>${likeButtonLabel}</button>
        ${isOwner ? '<button id="delete-post-btn" class="ghost-btn" type="button">刪除貼文</button>' : ''}
      </div>
    </div>
    <p class="page-description">${escapeHtml(post.content)}</p>
    ${post.image_url ? `<img class="cover-image" src="${escapeHtml(post.image_url)}" alt="post image">` : ''}
    <div class="chip-row" style="margin-top:16px;">
      <span class="chip muted-chip">❤️ ${post.like_count}</span>
      <span class="chip muted-chip">💬 ${post.comment_count}</span>
      ${renderPostTypeChip(post.post_type)}
    </div>
  `;
}

function renderComments(postId, comments, currentUser) {
  el('#comment-list').innerHTML = comments.length
    ? comments
        .map(
          (comment) => `
            <div class="mini-card">
              <div class="action-row">
                <div class="profile-summary">
                  <span class="avatar-circle" style="width:40px;height:40px;font-size:14px;">${escapeHtml(getUserInitials(comment.username))}</span>
                  <div>
                    <strong>${escapeHtml(comment.username)}</strong>
                    <div class="meta-line">${formatDate(comment.created_at)}</div>
                  </div>
                </div>
                ${currentUser && Number(comment.can_delete) ? `<button class="action-btn delete-comment-btn" data-id="${comment.comment_id}" type="button">刪除</button>` : ''}
              </div>
              <p class="page-description">${escapeHtml(comment.content)}</p>
            </div>
          `
        )
        .join('')
    : createEmptyState('目前沒有留言');

  document.querySelectorAll('.delete-comment-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const user = requireCurrentUser('請先登入再刪除留言');
      if (!user) {
        return;
      }

      try {
        await API.delete(`/comments/${button.dataset.id}`, { user_id: user.user_id });
        window.location.reload();
      } catch (err) {
        window.alert(err.message);
      }
    });
  });
}

function bindPostActions(postId, post, currentUser) {
  const commentStatus = el('#comment-status');
  const commentForm = el('#comment-form');

  if (!currentUser) {
    disableFormWithMessage(commentForm, '請先登入後再留言或按讚', commentStatus);
  }

  el('#like-btn')?.addEventListener('click', async () => {
    const user = requireCurrentUser('請先登入再按讚');
    if (!user) {
      return;
    }

    try {
      if (Number(post.liked_by_viewer)) {
        await API.delete(`/posts/${postId}/like`, { user_id: user.user_id });
      } else {
        await API.post(`/posts/${postId}/like`, { user_id: user.user_id });
      }
      window.location.reload();
    } catch (err) {
      window.alert(err.message);
    }
  });

  el('#delete-post-btn')?.addEventListener('click', async () => {
    if (!currentUser) {
      return;
    }

    try {
      await API.delete(`/posts/${postId}`, { user_id: currentUser.user_id });
      window.location.href = `/board.html?id=${post.board_id}`;
    } catch (err) {
      window.alert(err.message);
    }
  });

  commentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = requireCurrentUser('請先登入再留言');
    if (!user) {
      return;
    }

    const payload = serializeForm(event.currentTarget);
    payload.user_id = Number(user.user_id);

    try {
      await API.post(`/posts/${postId}/comments`, payload);
      window.location.reload();
    } catch (err) {
      showMessage(commentStatus, err.message, true);
    }
  });
}

function renderPostTypeChip(postType) {
  if (!postType || String(postType).toLowerCase() === 'text') {
    return '';
  }
  return `<span class="chip muted-chip">${escapeHtml(postType)}</span>`;
}

initPostPage();
