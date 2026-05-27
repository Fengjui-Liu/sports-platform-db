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
        <p class="eyebrow">${escapeHtml(post.board_name)}</p>
        <h1>${escapeHtml(post.title || '未命名貼文')}</h1>
        <div class="meta-line">
          ${renderPostTypeLabel(post.post_type)} · by ${escapeHtml(post.username)} · ${formatDate(post.created_at)}
        </div>
      </div>

      <div class="chip-row">
        <button id="like-btn" class="primary-btn" ${currentUser ? '' : 'disabled'}>${likeButtonLabel}</button>
        ${isOwner ? '<button id="delete-post-btn" class="gray-btn">刪除貼文</button>' : ''}
      </div>
    </div>

    <p class="page-description">${escapeHtml(post.content)}</p>

    ${post.image_url ? `<img class="cover-image" src="${escapeHtml(post.image_url)}" alt="post image">` : ''}

    <div class="chip-row" style="position:relative;">
      <button
        id="like-summary-btn"
        class="chip"
        type="button"
        style="border:none; cursor:pointer;"
      >
        ❤️ ${post.like_count || 0}
      </button>

      <span class="chip">💬 ${post.comment_count || 0}</span>

      <div
        id="like-floating-list"
        style="
          display:none;
          position:absolute;
          left:0;
          top:44px;
          z-index:50;
          min-width:220px;
          max-width:320px;
          background:#ffffff;
          border:1px solid #d8e2f3;
          border-radius:18px;
          box-shadow:0 18px 45px rgba(20, 40, 90, 0.16);
          padding:16px;
        "
      >
        ${renderLikeFloatingList(post.like_usernames)}
      </div>
    </div>
  `;
}

function renderLikeFloatingList(likeUsernames) {
  const names = String(likeUsernames || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  if (!names.length) {
    return `
      <strong style="display:block; color:#123f91; margin-bottom:10px;">按讚名單</strong>
      <div class="meta-line">目前還沒有人按讚這篇貼文</div>
    `;
  }

  return `
    <strong style="display:block; color:#123f91; margin-bottom:12px;">按讚名單</strong>
    <div class="chip-row">
      ${names
        .map((name) => `<span class="chip muted-chip">${escapeHtml(name)}</span>`)
        .join('')}
    </div>
  `;
}

function bindLikeFloatingList() {
  const trigger = el('#like-summary-btn');
  const floatingList = el('#like-floating-list');

  if (!trigger || !floatingList) {
    return;
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();

    const isVisible = floatingList.style.display === 'block';
    floatingList.style.display = isVisible ? 'none' : 'block';
  });

  floatingList.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  document.addEventListener('click', () => {
    floatingList.style.display = 'none';
  });
}

function renderPostTypeLabel(postType) {
  if (!postType || String(postType).toLowerCase() === 'text') {
    return '貼文';
  }

  return escapeHtml(postType);
}

function renderComments(postId, comments, currentUser) {
  el('#comment-list').innerHTML = comments.length
    ? comments
        .map(
          (comment) => `
            <div class="mini-card">
              <div class="action-row">
                <strong>${escapeHtml(comment.username)}</strong>
                ${
                  currentUser && Number(comment.can_delete)
                    ? `<button class="action-btn delete-comment-btn" data-id="${comment.comment_id}">刪除</button>`
                    : ''
                }
              </div>
              <p>${escapeHtml(comment.content)}</p>
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

      const confirmed = window.confirm('確定要刪除這則留言嗎？');

      if (!confirmed) {
        return;
      }

      try {
        await API.delete(`/comments/${button.dataset.id}`, {
          user_id: user.user_id,
        });

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

  bindLikeFloatingList();

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
        await API.delete(`/posts/${postId}/like`, {
          user_id: user.user_id,
        });
      } else {
        await API.post(`/posts/${postId}/like`, {
          user_id: user.user_id,
        });
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

    const confirmed = window.confirm('確定要刪除這篇貼文嗎？');

    if (!confirmed) {
      return;
    }

    try {
      await API.delete(`/posts/${postId}`, {
        user_id: currentUser.user_id,
      });

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