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
    const [post, comments] = await Promise.all([
      API.get(`/posts/${postId}${query}`),
      API.get(`/posts/${postId}/comments${query}`),
    ]);

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
      <div>
        <p class="eyebrow">${post.board_name}</p>
        <h1>${post.post_type}</h1>
        <div class="meta-line">by ${post.username} · ${formatDate(post.created_at)}</div>
      </div>
      <div class="chip-row">
        <button id="like-btn" class="primary-btn" ${currentUser ? '' : 'disabled'}>${likeButtonLabel}</button>
        ${isOwner ? '<button id="delete-post-btn" class="gray-btn">刪除貼文</button>' : ''}
      </div>
    </div>
    <p>${post.content}</p>
    ${post.image_url ? `<img class="cover-image" src="${post.image_url}" alt="post image">` : ''}
    <div class="chip-row">
      <span class="chip">❤️ ${post.like_count}</span>
      <span class="chip">💬 ${post.comment_count}</span>
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
                <strong>${comment.username}</strong>
                ${currentUser && Number(comment.can_delete) ? `<button class="action-btn delete-comment-btn" data-id="${comment.comment_id}">刪除</button>` : ''}
              </div>
              <p>${comment.content}</p>
              <div class="meta-line">${formatDate(comment.created_at)}</div>
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
    commentForm.querySelectorAll('textarea, button').forEach((field) => {
      field.disabled = true;
    });
    showMessage(commentStatus, '請先登入後再留言或按讚', true);
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

initPostPage();
