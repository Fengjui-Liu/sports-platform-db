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
  const isLiked = Number(post.liked_by_viewer) === 1;
  const isBookmarked = Number(post.bookmarked_by_viewer) === 1;

  el('#post-detail').innerHTML = `
    <div class="action-row">
      <div>
        <p class="eyebrow">${getSportIcon(post.board_name)}${escapeHtml(getSportName(post.board_name))}</p>
        <h1>${escapeHtml(post.title || '未命名貼文')}</h1>
        <div class="meta-line">
          ${renderPostTypeLabel(post.post_type)} ·
          <a class="user-link" href="/user.html?id=${post.user_id}">
            ${escapeHtml(post.username)}
          </a> ·
          ${formatDate(post.created_at)}
        </div>
      </div>

      <div class="chip-row">
        ${isOwner ? `<button id="delete-post-btn" class="gray-btn">刪除貼文</button>` : ''}
      </div>
    </div>

    <p class="page-description" style="white-space:pre-wrap;">${escapeHtml(post.content)}</p>

    ${post.image_url ? `<img class="cover-image" src="${escapeHtml(post.image_url)}" alt="post image">` : ''}

    <div class="post-detail-actions">
      <button
        id="like-btn"
        class="action-icon-btn ${isLiked ? 'is-liked' : ''}"
        data-liked="${isLiked}"
        ${currentUser ? '' : 'disabled'}
      >
        <span class="like-icon">${isLiked ? '♥' : '♡'}</span>
        <span id="like-count">${post.like_count || 0}</span>
      </button>

      <span class="action-icon-btn" style="cursor:default;">
        留言 <span>${post.comment_count || 0}</span>
      </span>

      <button
        id="bookmark-btn"
        class="action-icon-btn ${isBookmarked ? 'is-bookmarked' : ''}"
        data-bookmarked="${isBookmarked}"
        ${currentUser ? '' : 'disabled'}
      >
        <span class="bookmark-icon">${isBookmarked ? '★' : '☆'}</span>
        ${isBookmarked ? '已收藏' : '收藏'}
      </button>

      <button
        id="like-summary-btn"
        class="chip"
        type="button"
        style="border:none;cursor:pointer;position:relative;"
      >
        查看按讚
        <div
          id="like-floating-list"
          style="display:none;position:absolute;left:0;top:40px;z-index:50;min-width:220px;max-width:320px;background:#ffffff;border:1px solid #d8e2f3;border-radius:18px;box-shadow:0 18px 45px rgba(20,40,90,0.16);padding:16px;text-align:left;"
        >
          ${renderLikeFloatingList(post)}
        </div>
      </button>
    </div>
  `;
}

function normalizeLikeUsers(post) {
  if (Array.isArray(post.like_users)) {
    return post.like_users
      .map((u) => ({ id: u.id || u.user_id, username: u.username }))
      .filter((u) => u.username);
  }
  return String(post.like_usernames || '')
    .split(',')
    .map((username) => ({ username: username.trim() }))
    .filter((u) => u.username);
}

function renderLikeFloatingList(post) {
  const users = normalizeLikeUsers(post);

  if (!users.length) {
    return `<strong style="display:block;color:#123f91;margin-bottom:10px;">按讚名單</strong>
            <div class="meta-line">目前還沒有人按讚</div>`;
  }

  return `
    <strong style="display:block;color:#123f91;margin-bottom:12px;">按讚名單</strong>
    <div class="chip-row">
      ${users
        .map(
          (u) =>
            `<a class="chip muted-chip" href="/user.html?id=${u.id || ''}" style="text-decoration:none;">${escapeHtml(u.username)}</a>`
        )
        .join('')}
    </div>
  `;
}

function bindLikeFloatingList() {
  const trigger = el('#like-summary-btn');
  const floatingList = el('#like-floating-list');

  if (!trigger || !floatingList) return;

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    floatingList.style.display = floatingList.style.display === 'block' ? 'none' : 'block';
  });

  floatingList.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', () => { floatingList.style.display = 'none'; });
}

function renderPostTypeLabel(postType) {
  if (!postType || String(postType).toLowerCase() === 'text') return '貼文';
  return escapeHtml(postType);
}

function renderComments(postId, comments, currentUser) {
  const commentList = el('#comment-list');
  if (!commentList) return;

  const commentCount = el('#comment-count');
  if (commentCount) commentCount.textContent = `(${comments.length})`;

  commentList.innerHTML = comments.length
    ? comments.map((comment) => renderCommentItem(comment, currentUser)).join('')
    : createEmptyState('目前沒有留言');

  bindCommentDeleteButtons(commentList, currentUser);
}

function renderCommentItem(comment, currentUser) {
  const canDelete = currentUser && Number(comment.can_delete);
  return `
    <div class="mini-card" data-comment-id="${comment.comment_id}">
      <div class="action-row">
        <a href="/user.html?id=${comment.user_id}" style="text-decoration:none;">
          <strong style="color:var(--primary);">${escapeHtml(comment.username)}</strong>
        </a>
        ${
          canDelete
            ? `<button class="action-btn delete-comment-btn" data-id="${comment.comment_id}" style="color:var(--danger);border-color:var(--danger);">刪除</button>`
            : ''
        }
      </div>
      <p style="margin:8px 0;white-space:pre-wrap;">${escapeHtml(comment.content)}</p>
      <div class="meta-line">${formatDate(comment.created_at)}</div>
    </div>
  `;
}

function bindCommentDeleteButtons(container, currentUser) {
  container.querySelectorAll('.delete-comment-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const user = requireCurrentUser('請先登入再刪除留言');
      if (!user) return;
      if (!window.confirm('確定要刪除這則留言嗎？')) return;

      try {
        await API.delete(`/comments/${button.dataset.id}`, { user_id: user.user_id });
        button.closest('[data-comment-id]')?.remove();

        const commentCount = el('#comment-count');
        if (commentCount) {
          const current = parseInt(commentCount.textContent.replace(/\D/g, '')) || 0;
          commentCount.textContent = `(${Math.max(0, current - 1)})`;
        }
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
    commentForm?.querySelectorAll('textarea, button').forEach((f) => { f.disabled = true; });
    showMessage(commentStatus, '請先登入後再留言或按讚');
  }

  // Like — optimistic update
  const likeBtn = el('#like-btn');
  const likeCount = el('#like-count');

  likeBtn?.addEventListener('click', async () => {
    const user = requireCurrentUser('請先登入再按讚');
    if (!user) return;

    const isLiked = likeBtn.dataset.liked === 'true';
    const current = parseInt(likeCount.textContent) || 0;
    const newLiked = !isLiked;
    const newCount = newLiked ? current + 1 : Math.max(0, current - 1);

    likeBtn.dataset.liked = String(newLiked);
    likeBtn.classList.toggle('is-liked', newLiked);
    likeBtn.querySelector('.like-icon').textContent = newLiked ? '♥' : '♡';
    likeCount.textContent = newCount;
    triggerLikeAnimation(likeBtn, likeCount);

    try {
      if (newLiked) {
        await API.post(`/posts/${postId}/like`, { user_id: user.user_id });
      } else {
        await API.delete(`/posts/${postId}/like`, { user_id: user.user_id });
      }
    } catch (err) {
      likeBtn.dataset.liked = String(isLiked);
      likeBtn.classList.toggle('is-liked', isLiked);
      likeBtn.querySelector('.like-icon').textContent = isLiked ? '♥' : '♡';
      likeCount.textContent = current;
      window.alert('操作失敗：' + err.message);
    }
  });

  // Bookmark — optimistic update
  const bookmarkBtn = el('#bookmark-btn');

  bookmarkBtn?.addEventListener('click', async () => {
    const user = requireCurrentUser('請先登入再收藏');
    if (!user) return;

    const isBookmarked = bookmarkBtn.dataset.bookmarked === 'true';
    const newBookmarked = !isBookmarked;

    bookmarkBtn.dataset.bookmarked = String(newBookmarked);
    bookmarkBtn.classList.toggle('is-bookmarked', newBookmarked);
    bookmarkBtn.querySelector('.bookmark-icon').textContent = newBookmarked ? '★' : '☆';
    bookmarkBtn.childNodes[bookmarkBtn.childNodes.length - 1].textContent =
      newBookmarked ? ' 已收藏' : ' 收藏';

    try {
      if (newBookmarked) {
        await API.post(`/posts/${postId}/bookmark`, { user_id: user.user_id });
      } else {
        await API.delete(`/posts/${postId}/bookmark`, { user_id: user.user_id });
      }
    } catch (err) {
      bookmarkBtn.dataset.bookmarked = String(isBookmarked);
      bookmarkBtn.classList.toggle('is-bookmarked', isBookmarked);
      bookmarkBtn.querySelector('.bookmark-icon').textContent = isBookmarked ? '★' : '☆';
      window.alert('操作失敗：' + err.message);
    }
  });

  // Delete post
  el('#delete-post-btn')?.addEventListener('click', async () => {
    if (!currentUser || !window.confirm('確定要刪除這篇貼文嗎？')) return;
    try {
      await API.delete(`/posts/${postId}`, { user_id: currentUser.user_id });
      window.location.href = `/board.html?id=${post.board_id}`;
    } catch (err) {
      window.alert(err.message);
    }
  });

  // Comment form — append without reload
  commentForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = requireCurrentUser('請先登入再留言');
    if (!user) return;

    const payload = serializeForm(event.currentTarget);
    payload.user_id = Number(user.user_id);

    const submitBtn = commentForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const result = await API.post(`/posts/${postId}/comments`, payload);

      const newComment = {
        comment_id: result.comment_id,
        user_id: user.user_id,
        username: user.username,
        content: payload.content,
        created_at: new Date().toISOString(),
        can_delete: 1,
      };

      const commentList = el('#comment-list');
      commentList.querySelector('.empty-state')?.remove();

      const div = document.createElement('div');
      div.innerHTML = renderCommentItem(newComment, user);
      const card = div.firstElementChild;
      commentList.appendChild(card);
      bindCommentDeleteButtons(card, user);

      commentForm.reset();
      fillUserIdInputs();

      const commentCount = el('#comment-count');
      if (commentCount) {
        const current = parseInt(commentCount.textContent.replace(/\D/g, '')) || 0;
        commentCount.textContent = `(${current + 1})`;
      }

      showMessage(commentStatus, '', false);
    } catch (err) {
      showMessage(commentStatus, err.message, true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

initPostPage();
