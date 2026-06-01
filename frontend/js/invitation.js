async function initInvitationPage() {
  fillUserIdInputs();

  const currentUser = getCurrentUser();
  const invitationId = getParams().get('id');

  if (!invitationId) {
    el('#invitation-detail').innerHTML = createEmptyState('缺少揪團 ID');
    return;
  }

  try {
    const query = currentUser ? `?user_id=${currentUser.user_id}` : '';
    const [boards, invitation] = await Promise.all([
      API.get('/boards'),
      API.get(`/invitations/${invitationId}${query}`),
    ]);

    const activeBoard = boards.find((b) => b.board_id === invitation.board_id);
    renderBoardSidebar(boards, activeBoard?.board_id || null);
    renderInvitationDetail(invitation, currentUser);
    initInvitationMap(invitation);
  } catch (err) {
    showMessage(el('#invitation-detail'), err.message, true);
  }
}

function renderInvitationDetail(item, currentUser) {
  const container = el('#invitation-detail');
  if (!container) return;

  const ended = isInvitationEnded(item);
  const actionState = getInvitationActionState(item, currentUser);
  const participants = getInvitationParticipants(item);
  const confirmed = participants.filter((p) => p.status === 'confirmed');
  const waitlisted = participants.filter((p) => p.status === 'waitlisted');

  const disabled = actionState.disabled ? 'disabled' : '';
  const dangerStyle = actionState.danger
    ? 'background:#fee2e2;color:#c53b3b;border-color:#fca5a5;'
    : '';

  const actionButton = actionState.hidden
    ? ''
    : `<button
        class="primary-btn invitation-action-btn"
        data-action="${actionState.action}"
        data-board-id="${item.board_id}"
        data-id="${item.invitation_id}"
        style="${dangerStyle}"
        ${disabled}
       >${actionState.label}</button>`;

  container.innerHTML = `
    <div class="action-row" style="align-items:flex-start;gap:16px;">
      <div style="flex:1;">
        <p class="eyebrow">
          <a href="/board.html?id=${item.board_id}&tab=invitations" style="color:var(--primary);text-decoration:none;">
            ${getSportIcon(item.board_name)}${escapeHtml(getSportName(item.board_name) || '揪團')}
          </a>
        </p>
        <h1>${escapeHtml(item.title)}</h1>
        <div class="meta-line">
          發起人：<a class="user-link" href="/user.html?id=${item.user_id}">${escapeHtml(item.username || '未知使用者')}</a>
          &middot; ${formatPostMetaTime(item)}
        </div>
      </div>
      ${ended
        ? '<span class="invitation-badge invitation-badge-ended" style="font-size:14px;padding:6px 14px;">已結束</span>'
        : '<span class="invitation-badge" style="font-size:14px;padding:6px 14px;">揪團中</span>'}
    </div>

    <div class="chip-row" style="margin-top:16px;">
      ${item.location ? `<span class="chip"><i class="bi bi-geo-alt"></i> ${escapeHtml(item.location)}</span>` : ''}
      ${item.event_time ? `<span class="chip"><i class="bi bi-calendar3"></i> ${formatDate(item.event_time)}</span>` : ''}
      <span class="chip"><i class="bi bi-people"></i> ${item.participant_count || 0} / ${item.max_participants || '?'} 人</span>
      ${Number(item.waitlist_count || 0) > 0 ? `<span class="chip muted-chip">候補 ${item.waitlist_count} 人</span>` : ''}
    </div>

    ${confirmed.length ? `
      <div style="margin-top:20px;">
        <div class="section-label" style="font-weight:600;margin-bottom:8px;color:var(--muted);font-size:13px;">參與者 (${confirmed.length})</div>
        <div class="chip-row">
          ${confirmed.map((p) => `
            <a href="/user.html?id=${p.user_id}" style="text-decoration:none;">
              <span class="chip muted-chip">${escapeHtml(p.username)}</span>
            </a>`).join('')}
        </div>
      </div>` : ''}

    ${waitlisted.length ? `
      <div style="margin-top:16px;">
        <div class="section-label" style="font-weight:600;margin-bottom:8px;color:var(--muted);font-size:13px;">候補名單 (${waitlisted.length})</div>
        <div class="chip-row">
          ${waitlisted.map((p) => `
            <a href="/user.html?id=${p.user_id}" style="text-decoration:none;">
              <span class="chip muted-chip">${escapeHtml(p.username)}</span>
            </a>`).join('')}
        </div>
      </div>` : ''}

    ${item.location ? `
    <div style="margin-top:20px;">
      <div id="invitation-map" style="height:300px;border-radius:12px;border:1px solid var(--border);background:#eee;"></div>
      <div id="invitation-distance" class="meta-line" style="margin-top:8px;color:var(--muted);font-size:13px;min-height:18px;"></div>
    </div>` : ''}

    ${actionButton ? `<div style="margin-top:24px;">${actionButton}</div>` : ''}
  `;

  const btn = container.querySelector('.invitation-action-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      if (btn.dataset.action === 'full' || btn.dataset.action === 'ended') return;

      const user = requireCurrentUser(
        btn.dataset.action === 'join' ? '請先登入再加入揪團' : '請先登入再操作揪團'
      );
      if (!user) return;

      try {
        if (btn.dataset.action === 'join') {
          await API.post(`/invitations/${btn.dataset.id}/join`, { user_id: user.user_id });
        } else if (btn.dataset.action === 'leave') {
          await API.delete(`/invitations/${btn.dataset.id}/join`, { user_id: user.user_id });
        } else if (btn.dataset.action === 'cancel') {
          if (!window.confirm('確定要取消這個揪團嗎？取消後所有參與紀錄也會刪除。')) return;
          await API.delete(`/invitations/${btn.dataset.id}`, { user_id: user.user_id });
          window.location.href = `/board.html?id=${btn.dataset.boardId}&tab=invitations`;
          return;
        }

        window.location.reload();
      } catch (err) {
        window.alert(err.message);
      }
    });
  }
}

function isInvitationEnded(item) {
  return item.event_time && new Date(item.event_time).getTime() <= Date.now();
}

function getInvitationParticipants(item) {
  if (Array.isArray(item.participants)) {
    return item.participants.filter((p) => p && p.username);
  }
  return [];
}

function getInvitationActionState(item, currentUser) {
  const currentUserId = currentUser?.user_id;
  const isJoined = getInvitationParticipants(item).some(
    (p) => Number(p.user_id) === Number(currentUserId)
  );
  const isFull = Number(item.participant_count || 0) >= Number(item.max_participants || 0);

  if (isInvitationEnded(item)) {
    return { label: '已結束', action: 'ended', disabled: true, danger: false, hidden: true };
  }

  if (!currentUser) {
    return { label: '登入後加入', action: 'login', disabled: true, danger: false };
  }

  if (Number(item.user_id) === Number(currentUser.user_id)) {
    return { label: '取消揪團', action: 'cancel', disabled: false, danger: true };
  }

  if (isJoined || Number(item.joined_by_viewer)) {
    return {
      label: item.viewer_status === 'waitlisted' ? '退出候補' : '退出揪團',
      action: 'leave',
      disabled: false,
      danger: false,
    };
  }

  if (isFull) {
    return { label: '已額滿', action: 'full', disabled: true, danger: false };
  }

  return { label: '加入揪團', action: 'join', disabled: false, danger: false };
}

// ── 地圖 ──────────────────────────────────────────────────────────────────────

async function initInvitationMap(item) {
  if (!item.location) return;
  const mapEl = el('#invitation-map');
  if (!mapEl || typeof L === 'undefined') return;

  const coords = await geocodeLocation(item.location);
  if (!coords) {
    mapEl.style.display = 'none';
    el('#invitation-distance')?.remove();
    return;
  }

  const { lat, lng } = coords;
  const map = L.map('invitation-map').setView([lat, lng], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const popupContent = [
    `<strong>${escapeHtml(item.title)}</strong>`,
    item.event_time ? `<div>${formatDate(item.event_time)}</div>` : '',
    `<div>${escapeHtml(item.location)}</div>`,
  ].join('');

  L.marker([lat, lng])
    .addTo(map)
    .bindPopup(popupContent)
    .openPopup();

  // Google Maps 連結（右下角）
  const gmControl = L.control({ position: 'bottomright' });
  gmControl.onAdd = () => {
    const a = document.createElement('a');
    a.href = `https://www.google.com/maps?q=${lat},${lng}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = '在 Google Maps 開啟';
    a.style.cssText = [
      'display:block',
      'background:#fff',
      'padding:6px 10px',
      'border-radius:6px',
      'font-size:12px',
      'font-weight:600',
      'color:#1f4396',
      'text-decoration:none',
      'box-shadow:0 1px 5px rgba(0,0,0,0.2)',
      'white-space:nowrap',
    ].join(';');
    return a;
  };
  gmControl.addTo(map);

  // 距離（若瀏覽器支援 geolocation）
  const distEl = el('#invitation-distance');
  if (distEl && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = getDistance(pos.coords.latitude, pos.coords.longitude, lat, lng);
        distEl.textContent = dist < 1
          ? `距離你約 ${Math.round(dist * 1000)} 公尺`
          : `距離你約 ${dist.toFixed(1)} 公里`;
      },
      () => { /* 用戶拒絕定位，不顯示距離 */ }
    );
  }
}

async function geocodeLocation(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=zh-TW`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'zh-TW,zh;q=0.9' } });
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

initInvitationPage();
