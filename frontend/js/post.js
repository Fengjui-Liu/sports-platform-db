async function initPostPage() {
  fillUserIdInputs();

  const postId = getParams().get('id');
  if (!postId) {
    el('#post-detail').innerHTML = createEmptyState('缺少 post id');
    return;
  }

  try {
    const [post, comments] = await Promise.all([API.get(`/posts/${postId}`), API.get(`/posts/${postId}/comments`)]);

    el('#post-detail').innerHTML = `
      <div class="action-row">
        <div>
          <p class="eyebrow">${post.board_name}</p>
          <h1>${post.post_type}</h1>
          <div class="meta-line">by ${post.username} · ${formatDate(post.created_at)}</div>
        </div>
        <button id="like-btn" class="primary-btn">❤️ 按讚</button>
      </div>
      <p>${post.content}</p>
      ${post.image_url ? `<img class="cover-image" src="${post.image_url}" alt="post image">` : ''}
      <div class="chip-row">
        <span class="chip">❤️ ${post.like_count}</span>
        <span class="chip">💬 ${post.comment_count}</span>
      </div>
    `;

    renderComments(comments);

    el('#like-btn').addEventListener('click', async () => {
      const userId = Number(prompt('輸入按讚用的 user_id', currentUserIdOrBlank()));
      if (!userId) {
        return;
      }

      try {
        await API.post(`/posts/${postId}/like`, { user_id: userId });
        window.location.reload();
      } catch (err) {
        window.alert(err.message);
      }
    });

    el('#comment-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = serializeForm(event.currentTarget);
      payload.user_id = Number(payload.user_id);

      try {
        await API.post(`/posts/${postId}/comments`, payload);
        window.location.reload();
      } catch (err) {
        window.alert(err.message);
      }
    });
  } catch (err) {
    showMessage(el('#post-detail'), err.message, true);
  }
}

function renderComments(comments) {
  el('#comment-list').innerHTML = comments.length
    ? comments
        .map(
          (comment) => `
            <div class="mini-card">
              <strong>${comment.username}</strong>
              <p>${comment.content}</p>
              <div class="meta-line">${formatDate(comment.created_at)}</div>
            </div>
          `
        )
        .join('')
    : createEmptyState('目前沒有留言');
}

initPostPage();
