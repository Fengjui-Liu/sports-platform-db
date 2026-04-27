function showAuthScreen(name) {
  const mapping = {
    home: '#auth-home',
    login: '#auth-login',
    register: '#auth-register',
  };

  document.querySelectorAll('.auth-screen').forEach((section) => {
    section.classList.remove('active');
  });

  const target = el(mapping[name] || mapping.home);
  if (target) {
    target.classList.add('active');
  }
}

function initAuthPage() {
  const loginForm = el('#login-form');
  const registerForm = el('#register-form');
  const loginStatus = el('#login-status');
  const registerStatus = el('#register-status');

  document.querySelectorAll('[data-auth-page]').forEach((button) => {
    button.addEventListener('click', () => {
      showAuthScreen(button.dataset.authPage);
    });
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = serializeForm(loginForm);

    try {
      const result = await API.post('/users/login', payload);
      setCurrentUser(result.user);
      showMessage(loginStatus, `登入成功，user_id = ${result.user.user_id}`);
      window.location.href = `/profile.html?id=${result.user.user_id}`;
    } catch (err) {
      showMessage(loginStatus, err.message, true);
    }
  });

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = serializeForm(registerForm);

    try {
      const result = await API.post('/users/register', payload);
      showMessage(registerStatus, `註冊成功，請使用 user_id ${result.user_id} 登入`);
      registerForm.reset();
      showAuthScreen('login');
    } catch (err) {
      showMessage(registerStatus, err.message, true);
    }
  });
}

initAuthPage();
