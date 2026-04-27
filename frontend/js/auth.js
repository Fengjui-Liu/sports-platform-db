function initAuthPage() {
  setupTabs();
  const loginForm = el('#login-form');
  const registerForm = el('#register-form');
  const status = el('#auth-status');

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = serializeForm(loginForm);

    try {
      const result = await API.post('/users/login', payload);
      setCurrentUser(result.user);
      showMessage(status, `登入成功，user_id = ${result.user.user_id}`);
      window.location.href = `/profile.html?id=${result.user.user_id}`;
    } catch (err) {
      showMessage(status, err.message, true);
    }
  });

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = serializeForm(registerForm);

    try {
      const result = await API.post('/users/register', payload);
      showMessage(status, `註冊成功，請使用 user_id ${result.user_id} 登入`);
      registerForm.reset();
    } catch (err) {
      showMessage(status, err.message, true);
    }
  });
}

initAuthPage();
