const STORAGE_KEY = 'shorttik_state_v1';
const DEFAULT_EFFECTS = {
  none: { filter: 'none', label: 'Normal' },
  neon: { filter: 'saturate(1.5) contrast(1.08) brightness(1.08) hue-rotate(10deg)', label: 'Neon' },
  vintage: { filter: 'sepia(0.36) saturate(0.9) contrast(1.1)', label: 'Vintage' },
  bw: { filter: 'grayscale(1) contrast(1.18)', label: 'Preto & Branco' },
  warm: { filter: 'sepia(0.3) saturate(1.25) contrast(1.06)', label: 'Quente' }
};

const initialState = {
  users: [],
  posts: [],
  followRequests: [],
  chats: [],
  activeUserId: null,
  selectedChatUserId: null,
  currentView: 'feed'
};

let state = loadState();

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return clone(initialState);

  try {
    const parsed = JSON.parse(saved);
    return {
      ...clone(initialState),
      ...parsed,
      users: parsed.users || clone(initialState.users),
      posts: parsed.posts || clone(initialState.posts),
      followRequests: parsed.followRequests || [],
      chats: parsed.chats || [],
      activeUserId: parsed.activeUserId || null,
      selectedChatUserId: parsed.selectedChatUserId || null,
      currentView: parsed.currentView || 'feed'
    };
  } catch (error) {
    return clone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getActiveUser() {
  return state.users.find((user) => user.id === state.activeUserId) || null;
}

function isFollowing(userId, targetId) {
  const user = state.users.find((item) => item.id === userId);
  return Boolean(user && user.following && user.following.includes(targetId));
}

function getUserById(id) {
  return state.users.find((user) => user.id === id);
}

function getCurrentUserPosts() {
  const user = getActiveUser();
  if (!user) return [];
  return state.posts.filter((post) => post.userId === user.id);
}

function toggleView(viewName) {
  state.currentView = viewName;
  document.querySelectorAll('.menu-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewName);
  });
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('active', view.id === `${viewName}-view`);
  });
  saveState();
}

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function buildUserListFromArray(users) {
  const activeUser = getActiveUser();
  if (!users.length) return '<p class="empty-state">Nenhuma pessoa por enquanto.</p>';

  return users.map((user) => {
    if (!activeUser || user.id === activeUser.id) return '';
    const isFollowingTarget = isFollowing(activeUser.id, user.id);

    return `
      <div class="suggestion-item">
        <div class="suggestion-main">
          <div class="avatar gradient">${user.avatar}</div>
          <div>
            <strong>${user.fullName}</strong>
            <span>@${user.username}</span>
          </div>
        </div>
        <button class="follow-btn ${isFollowingTarget ? 'following' : ''}" data-follow-user="${user.id}">${isFollowingTarget ? 'Seguindo' : 'Seguir'}</button>
      </div>
    `;
  }).join('');
}

function renderSuggestions() {
  const container = document.getElementById('suggestions-list');
  const activeUser = getActiveUser();
  if (!activeUser) {
    container.innerHTML = '';
    return;
  }

  const visible = state.users.filter((user) => user.id !== activeUser.id && !activeUser.following.includes(user.id));
  container.innerHTML = buildUserListFromArray(visible);
  document.getElementById('suggestion-count').textContent = String(visible.length);

  document.querySelectorAll('[data-follow-user]').forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.followUser;
      const targetUser = getUserById(targetId);
      if (!targetUser || !activeUser) return;

      const existingRequest = state.followRequests.find((req) => req.fromUserId === activeUser.id && req.toUserId === targetId && req.status === 'pending');
      if (existingRequest) return;

      state.followRequests.push({
        id: `req-${Date.now()}`,
        fromUserId: activeUser.id,
        toUserId: targetId,
        status: 'pending'
      });

      button.textContent = 'Pedido enviado';
      button.disabled = true;
      button.style.opacity = '0.75';
      saveState();
      renderRequests();
      renderSuggestions();
    });
  });
}

function renderRequests() {
  const container = document.getElementById('requests-list');
  const activeUser = getActiveUser();
  if (!activeUser) {
    container.innerHTML = '';
    return;
  }

  const pending = state.followRequests.filter((request) => request.toUserId === activeUser.id && request.status === 'pending');
  document.getElementById('request-count').textContent = String(pending.length);

  if (!pending.length) {
    container.innerHTML = '<p class="empty-state">Nenhuma solicitação pendente.</p>';
    return;
  }

  container.innerHTML = pending.map((request) => {
    const fromUser = getUserById(request.fromUserId);
    if (!fromUser) return '';

    return `
      <div class="request-item">
        <div class="request-main">
          <div class="avatar gradient">${fromUser.avatar}</div>
          <div>
            <strong>${fromUser.fullName}</strong>
            <span>@${fromUser.username}</span>
          </div>
        </div>
        <div class="request-actions">
          <button class="accept-btn" data-accept-request="${request.id}">Aceitar</button>
          <button class="deny-btn" data-deny-request="${request.id}">Recusar</button>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('[data-accept-request]').forEach((button) => {
    button.addEventListener('click', () => {
      const requestId = button.dataset.acceptRequest;
      const request = state.followRequests.find((item) => item.id === requestId);
      if (!request) return;

      request.status = 'accepted';
      const followerUser = getUserById(request.toUserId);
      const followingUser = getUserById(request.fromUserId);

      if (followerUser && followingUser) {
        if (!followerUser.following.includes(request.fromUserId)) followerUser.following.push(request.fromUserId);
        if (!followingUser.followers.includes(request.toUserId)) followingUser.followers.push(request.toUserId);
      }

      if (!state.chats.some((chat) => chat.users.includes(request.toUserId) && chat.users.includes(request.fromUserId))) {
        state.chats.push({ id: `c-${Date.now()}`, users: [request.toUserId, request.fromUserId], messages: [] });
      }

      saveState();
      renderRequests();
      renderSuggestions();
      renderChat();
      renderStats();
      renderProfile();
    });
  });

  document.querySelectorAll('[data-deny-request]').forEach((button) => {
    button.addEventListener('click', () => {
      const requestId = button.dataset.denyRequest;
      state.followRequests = state.followRequests.filter((item) => item.id !== requestId);
      saveState();
      renderRequests();
      renderSuggestions();
    });
  });
}

function renderStats() {
  const activeUser = getActiveUser();
  if (!activeUser) return;

  document.getElementById('stat-followers').textContent = String(activeUser.followers.length);
  document.getElementById('stat-following').textContent = String(activeUser.following.length);
  document.getElementById('stat-likes').textContent = String(activeUser.likes);

  document.getElementById('mini-name').textContent = activeUser.fullName;
  document.getElementById('mini-handle').textContent = `@${activeUser.username}`;
  document.getElementById('mini-avatar').textContent = activeUser.avatar;

  document.getElementById('profile-name').textContent = activeUser.fullName;
  document.getElementById('profile-handle').textContent = `@${activeUser.username}`;
  document.getElementById('profile-bio').textContent = activeUser.bio;
  document.getElementById('profile-avatar').textContent = activeUser.avatar;
  document.getElementById('profile-posts-count').textContent = String(getCurrentUserPosts().length);
  document.getElementById('profile-followers-count').textContent = String(activeUser.followers.length);
  document.getElementById('profile-following-count').textContent = String(activeUser.following.length);
  document.getElementById('profile-likes-count').textContent = String(activeUser.likes);
}

function toggleLike(postId) {
  const activeUser = getActiveUser();
  if (!activeUser) return;

  const post = state.posts.find((item) => item.id === postId);
  if (!post) return;

  if (post.likedBy.includes(activeUser.id)) {
    post.likedBy = post.likedBy.filter((userId) => userId !== activeUser.id);
    post.likes = Math.max(post.likes - 1, 0);
  } else {
    post.likedBy.push(activeUser.id);
    post.likes += 1;
    activeUser.likes += 1;
  }

  saveState();
  renderFeed();
  renderProfile();
  renderStats();
}

function renderFeed() {
  const feedList = document.getElementById('feed-list');
  const activeUser = getActiveUser();
  if (!activeUser) {
    feedList.innerHTML = '';
    return;
  }

  const visiblePosts = [...state.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!visiblePosts.length) {
    feedList.innerHTML = '<div class="card empty-state-card"><p class="empty-state">Seu feed está vazio. Publique o primeiro vídeo para começar.</p></div>';
    return;
  }

  feedList.innerHTML = visiblePosts.map((post) => {
    const user = getUserById(post.userId);
    if (!user) return '';

    const isLiked = post.likedBy.includes(activeUser.id);
    const effectStyle = DEFAULT_EFFECTS[post.effect]?.filter || 'none';

    return `
      <article class="video-card">
        <video src="${post.src}" muted loop autoplay playsinline style="filter: ${effectStyle};"></video>
        <div class="video-overlay">
          <div class="video-info">
            <div class="user-inline">
              <div class="avatar gradient">${user.avatar}</div>
              <strong>${user.fullName}</strong>
            </div>
            <p class="video-caption">${post.caption}</p>
          </div>
          <div class="video-actions">
            <div class="action-pill">
              <button type="button" data-like-post="${post.id}" aria-label="curtir">${isLiked ? '💗' : '🤍'}</button>
              <span>${post.likes}</span>
            </div>
            <div class="action-pill">
              <button type="button" aria-label="comentários">💬</button>
              <span>${post.comments}</span>
            </div>
            <div class="action-pill">
              <button type="button" aria-label="compartilhar">↗</button>
              <span>Share</span>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  document.querySelectorAll('[data-like-post]').forEach((button) => {
    button.addEventListener('click', () => toggleLike(button.dataset.likePost));
  });
}

function renderProfile() {
  const activeUser = getActiveUser();
  if (!activeUser) return;

  const posts = getCurrentUserPosts();
  const container = document.getElementById('profile-posts');

  if (!posts.length) {
    container.innerHTML = '<div class="card"><p class="empty-state">Você ainda não publicou nenhum vídeo.</p></div>';
    return;
  }

  container.innerHTML = posts.map((post) => {
    const effectStyle = DEFAULT_EFFECTS[post.effect]?.filter || 'none';
    const media = post.src.endsWith('.mp4') || post.src.endsWith('.webm')
      ? `<video src="${post.src}" muted playsinline style="filter: ${effectStyle};"></video>`
      : `<img src="${post.src}" alt="post" style="filter: ${effectStyle};" />`;

    return `
      <div class="post-tile">
        ${media}
        <div class="post-overlay">💗 ${post.likes} • 💬 ${post.comments}</div>
      </div>
    `;
  }).join('');
}

function renderChat() {
  const chatSidebar = document.getElementById('chat-sidebar');
  const chatWindow = document.getElementById('chat-window');
  const activeUser = getActiveUser();
  if (!activeUser) {
    chatWindow.innerHTML = '';
    chatSidebar.innerHTML = '';
    return;
  }

  const allowedChats = state.chats.filter((chat) => chat.users.includes(activeUser.id));
  const visibleThreads = allowedChats.map((chat) => {
    const otherUserId = chat.users.find((id) => id !== activeUser.id);
    const otherUser = getUserById(otherUserId);
    return { chat, otherUser };
  }).filter((entry) => entry.otherUser);

  if (!visibleThreads.length) {
    chatSidebar.innerHTML = '<p class="empty-state">Nenhum chat disponível ainda. Acompanhe solicitações de seguir para desbloquear.</p>';
    chatWindow.innerHTML = '<div class="empty-chat"><p>Selecione uma conversa.</p></div>';
    return;
  }

  const selectedUserId = state.selectedChatUserId || visibleThreads[0].otherUser.id;
  state.selectedChatUserId = selectedUserId;

  chatSidebar.innerHTML = visibleThreads.map(({ otherUser }) => `
    <button class="chat-thread ${selectedUserId === otherUser.id ? 'active' : ''}" data-chat-user="${otherUser.id}">
      <div class="avatar gradient">${otherUser.avatar}</div>
      <div>
        <strong>${otherUser.fullName}</strong>
        <span>@${otherUser.username}</span>
      </div>
    </button>
  `).join('');

  const activeThread = visibleThreads.find(({ otherUser }) => otherUser.id === selectedUserId);
  if (!activeThread) return;

  const chat = activeThread.chat;
  const otherUser = activeThread.otherUser;

  chatWindow.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="avatar gradient">${otherUser.avatar}</div>
        <div>
          <strong>${otherUser.fullName}</strong>
          <span>@${otherUser.username}</span>
        </div>
      </div>
      <button class="secondary-btn" data-open-chat="${otherUser.id}">Abrir</button>
    </div>
    <div class="message-list">
      ${chat.messages.length ? chat.messages.map((message) => `
        <div class="message ${message.senderId === activeUser.id ? 'mine' : 'other'}">${message.text}</div>
      `).join('') : '<p class="empty-state">Comece a conversa.</p>'}
    </div>
    <form id="chat-form" class="chat-form">
      <input id="chat-input" type="text" placeholder="Mensagem para ${otherUser.fullName}" maxlength="200" required />
      <button type="submit" class="primary-btn">Enviar</button>
    </form>
  `;

  document.querySelectorAll('[data-chat-user]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedChatUserId = button.dataset.chatUser;
      saveState();
      renderChat();
    });
  });

  document.getElementById('chat-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    const thread = state.chats.find((item) => item.users.includes(activeUser.id) && item.users.includes(selectedUserId));
    if (!thread) return;

    thread.messages.push({
      id: `m-${Date.now()}`,
      senderId: activeUser.id,
      text: message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    saveState();
    renderChat();
  });
}

function renderAll() {
  const activeUser = getActiveUser();
  const authScreen = document.getElementById('auth-screen');
  const appScreen = document.getElementById('app-screen');

  if (!activeUser) {
    authScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
    return;
  }

  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');

  renderStats();
  renderFeed();
  renderProfile();
  renderSuggestions();
  renderRequests();
  renderChat();
  toggleView(state.currentView);
}

function registerUser(event) {
  event.preventDefault();
  const fullName = document.getElementById('register-fullname').value.trim();
  const username = document.getElementById('register-name').value.trim();
  const password = document.getElementById('register-password').value.trim();

  if (!fullName || !username || !password) {
    alert('Preencha todos os campos para criar sua conta.');
    return;
  }

  if (state.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    alert('Esse nome de usuário já existe. Escolha outro.');
    return;
  }

  const newUser = {
    id: `u-${Date.now()}`,
    fullName,
    username,
    password,
    bio: 'Novo criador de vídeos curtos.',
    avatar: fullName.charAt(0).toUpperCase(),
    followers: [],
    following: [],
    likes: 0
  };

  state.users.push(newUser);
  state.activeUserId = newUser.id;
  saveState();
  renderAll();
  event.target.reset();
}

function loginUser(event) {
  event.preventDefault();
  const name = document.getElementById('login-name').value.trim();
  const password = document.getElementById('login-password').value.trim();

  const user = state.users.find((item) => item.username.toLowerCase() === name.toLowerCase() && item.password === password);
  if (!user) {
    alert('Usuário ou senha incorretos.');
    return;
  }

  state.activeUserId = user.id;
  saveState();
  renderAll();
  event.target.reset();
}

function handleLogout() {
  state.activeUserId = null;
  state.selectedChatUserId = null;
  saveState();
  renderAll();
}

function createVideoPost({ src, caption, effect }) {
  const activeUser = getActiveUser();
  if (!activeUser) return;

  state.posts.unshift({
    id: `p-${Date.now()}`,
    userId: activeUser.id,
    src,
    caption: caption || 'Novo vídeo curto!',
    likes: 0,
    comments: 0,
    effect: effect || 'none',
    createdAt: new Date().toISOString(),
    likedBy: []
  });

  saveState();
  renderAll();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleUploadSubmit() {
  const fileInput = document.getElementById('upload-input');
  const caption = document.getElementById('post-caption').value.trim();
  const effect = document.getElementById('effect-select').value;
  const file = fileInput.files[0];

  if (!file) {
    alert('Selecione um vídeo ou imagem para publicar.');
    return;
  }

  const dataUrl = await readFileAsDataUrl(file);
  createVideoPost({ src: dataUrl, caption, effect });
  closeModal('upload-modal');
  fileInput.value = '';
  document.getElementById('post-caption').value = '';
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-image-preview').classList.add('hidden');
}

function setupMediaPreview() {
  const uploadInput = document.getElementById('upload-input');
  const videoPreview = document.getElementById('upload-preview');
  const imagePreview = document.getElementById('upload-image-preview');

  uploadInput.addEventListener('change', () => {
    const file = uploadInput.files[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    if (file.type.startsWith('video')) {
      videoPreview.src = objectUrl;
      videoPreview.classList.remove('hidden');
      imagePreview.classList.add('hidden');
      videoPreview.play();
    } else {
      imagePreview.src = objectUrl;
      imagePreview.classList.remove('hidden');
      videoPreview.classList.add('hidden');
    }
  });
}

async function startCamera() {
  const video = document.getElementById('camera-preview');
  const effect = document.getElementById('camera-effect-select').value;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Seu navegador não suporta acesso à câmera.');
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  video.srcObject = stream;
  video.style.filter = DEFAULT_EFFECTS[effect]?.filter || 'none';
}

function applyCameraEffect() {
  const video = document.getElementById('camera-preview');
  const effect = document.getElementById('camera-effect-select').value;
  if (video) {
    video.style.filter = DEFAULT_EFFECTS[effect]?.filter || 'none';
  }
}

function captureCameraFrame() {
  const video = document.getElementById('camera-preview');
  if (!video.srcObject) {
    alert('Ative a câmera antes de capturar.');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/png');
  createVideoPost({ src: dataUrl, caption: 'Efeito de rosto em ação ✨', effect: document.getElementById('camera-effect-select').value });
  closeModal('camera-modal');
}

async function recordCameraVideo() {
  const video = document.getElementById('camera-preview');
  const stream = video.srcObject;
  if (!stream) {
    alert('Ative a câmera antes de gravar.');
    return;
  }

  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const reader = new FileReader();
    reader.onload = () => {
      createVideoPost({
        src: reader.result,
        caption: 'Vídeo gravado com efeito na cara 🎥',
        effect: document.getElementById('camera-effect-select').value
      });
      closeModal('camera-modal');
    };
    reader.readAsDataURL(blob);
  };

  recorder.start();
  setTimeout(() => recorder.stop(), 3000);
}

function attachGlobalListeners() {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((tab) => tab.classList.toggle('active', tab === button));
      document.querySelectorAll('.auth-form').forEach((form) => form.classList.toggle('active', form.id === `${button.dataset.authTab}-form`));
    });
  });

  document.getElementById('login-form').addEventListener('submit', loginUser);
  document.getElementById('register-form').addEventListener('submit', registerUser);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  document.querySelectorAll('.menu-btn').forEach((button) => {
    button.addEventListener('click', () => toggleView(button.dataset.view));
  });

  document.getElementById('open-upload-btn').addEventListener('click', () => openModal('upload-modal'));
  document.getElementById('camera-open-btn').addEventListener('click', () => openModal('camera-modal'));
  document.getElementById('submit-post-btn').addEventListener('click', handleUploadSubmit);
  document.getElementById('camera-start-btn').addEventListener('click', startCamera);
  document.getElementById('camera-capture-btn').addEventListener('click', captureCameraFrame);
  document.getElementById('camera-record-btn').addEventListener('click', recordCameraVideo);
  document.getElementById('camera-effect-select').addEventListener('change', applyCameraEffect);

  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => closeModal(button.dataset.close));
  });

  document.getElementById('search-input').addEventListener('input', (event) => {
    const text = event.target.value.trim().toLowerCase();
    const activeUser = getActiveUser();
    if (!activeUser) return;

    const otherUsers = state.users.filter((user) => user.id !== activeUser.id && (user.fullName.toLowerCase().includes(text) || user.username.toLowerCase().includes(text)));
    document.getElementById('suggestions-list').innerHTML = buildUserListFromArray(otherUsers);
  });

  setupMediaPreview();
}

attachGlobalListeners();
renderAll();
