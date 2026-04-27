async function initHome() {
  try {
    const [boards, posts] = await Promise.all([API.get('/boards'), API.get('/posts')]);

    const boardGrid = el('#board-grid');
    boardGrid.innerHTML = boards.length
      ? boards
          .map(
            (board) => `
              <a class="board-link" href="/board.html?id=${board.board_id}">
                <div class="chip-row"><span class="chip">${board.sport_type}</span></div>
                <h3>${board.sport_type}</h3>
                <p>${board.description || '尚未提供描述'}</p>
                <span>建立時間：${formatDate(board.created_at)}</span>
              </a>
            `
          )
          .join('')
      : createEmptyState('目前沒有任何專欄');

    const latestPosts = el('#latest-posts');
    latestPosts.innerHTML = posts.length
      ? posts
          .slice(0, 6)
          .map(
            (post) => `
              <a class="list-card" href="/post.html?id=${post.post_id}">
                <div class="action-row">
                  <strong>${post.username}</strong>
                  <span class="chip">${post.board_name}</span>
                </div>
                <p>${post.content}</p>
                <div class="meta-line">❤️ ${post.like_count} · 💬 ${post.comment_count} · ${formatDate(post.created_at)}</div>
              </a>
            `
          )
          .join('')
      : createEmptyState('目前沒有任何貼文');
  } catch (err) {
    showMessage(el('#latest-posts'), err.message, true);
  }
}

initHome();
