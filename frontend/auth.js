let session = null;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bookshelf-account') : null;
channel?.addEventListener('message', () => location.reload());
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function authRequest(path, data) {
  const response = await fetch('/api/auth' + path, {
    method: data ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: {'Content-Type':'application/json', 'X-Requested-With':'bookshelf', ...(session ? {'X-CSRF-Token':session.csrf_token} : {})},
    ...(data ? {body:JSON.stringify(data)} : {})
  });
  if (!response.ok) {
    let result;
    try { result = await response.json(); } catch {}
    const error = new Error(typeof result?.detail === 'string' ? result.detail : '输入格式不正确，请检查用户名和密码长度');
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export async function requireAccount() {
  try { session = await authRequest('/me'); return session.user; }
  catch (error) {
    return new Promise(resolve => showAuth(resolve, error.status === 401 ? '' : '暂时无法连接书房，请确认服务已启动后重试。'));
  }
}

function showAuth(resolve, message = '', mode = 'login') {
  document.documentElement.dataset.theme = 'modern';
  const register = mode === 'register';
  document.querySelector('#app').innerHTML = `
    <main class="auth-page">
      <section class="auth-story">
        <a class="auth-brand" href="/">藏间 <small>DIGITAL BOOKSHELF</small></a>
        <div class="eyebrow">A ROOM OF YOUR OWN</div>
        <h1>世界很大，<br>总有一间书房<br>属于你<span>。</span></h1>
        <p>收藏喜欢的文字，续上昨天的故事。<br>从这里，拥有自己的数字书架。</p>
        <div class="auth-books" aria-hidden="true"><span>THE ART OF READING</span><span>小 王 子</span><span>A ROOM OF ONE'S OWN</span><span>慢 慢 读</span><span>STAY CURIOUS</span></div>
        <div class="auth-plank"></div>
        <small class="auth-quote">一人，一盏灯，一整个世界。</small>
      </section>
      <section class="auth-card">
        <div class="eyebrow">YOUR PERSONAL LIBRARY</div>
        <h2>${register ? '为自己，开一间书房' : '欢迎回到你的书房'}</h2>
        <p>${register ? '注册后，你的书籍与阅读进度将独立保存。' : '登录后，接着上一次的故事读下去。'}</p>
        <div class="auth-tabs"><button type="button" data-mode="login" class="${register?'':'active'}">登录</button><button type="button" data-mode="register" class="${register?'active':''}">注册</button></div>
        <form id="auth-form">
          ${register ? '<label>怎么称呼你<input name="display_name" autocomplete="nickname" maxlength="40" placeholder="你的昵称（选填）"></label>' : ''}
          <label>用户名<input name="username" autocomplete="username" required minlength="3" maxlength="32" pattern="[a-zA-Z0-9_-]+" placeholder="3—32 位字母、数字、下划线或短横线" autocapitalize="none" spellcheck="false"></label>
          <label>密码<span class="password-field"><input name="password" type="password" autocomplete="${register?'new-password':'current-password'}" required minlength="15" maxlength="128" placeholder="至少 15 个字符，可使用一句好记的话"><button type="button" class="toggle-password" aria-label="显示密码">显示</button></span></label>
          ${register ? '<label>确认密码<input name="confirm_password" type="password" autocomplete="new-password" required minlength="15" maxlength="128" placeholder="再输入一次密码"></label>' : ''}
          <p class="auth-error" role="alert">${escape(message)}</p>
          <button type="submit" class="primary auth-submit">${register ? '创建我的书房' : '进入我的书房'} <span>→</span></button>
        </form>
        <p class="auth-footnote">每个账号都有独立书架，书籍仅自己可见。</p>
      </section>
    </main>`;
  document.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => showAuth(resolve, '', button.dataset.mode));
  const form = document.querySelector('#auth-form');
  form.querySelector('.toggle-password').onclick = e => {
    const input = form.elements.password;
    const hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    e.currentTarget.textContent = hidden ? '隐藏' : '显示';
    e.currentTarget.setAttribute('aria-label', hidden ? '隐藏密码' : '显示密码');
  };
  form.onsubmit = async event => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(form));
    const error = form.querySelector('.auth-error');
    if (register && fields.password !== fields.confirm_password) { error.textContent = '两次输入的密码不一致'; return; }
    delete fields.confirm_password;
    const button = form.querySelector('.auth-submit');
    button.disabled = true;
    button.textContent = register ? '正在准备你的书房…' : '正在开门…';
    try {
      session = await authRequest(register ? '/register' : '/login', fields);
      channel?.postMessage('account-changed');
      resolve(session.user);
    } catch (failure) {
      error.textContent = failure.status ? failure.message : '连接失败，请稍后重试';
      button.disabled = false;
      button.textContent = register ? '创建我的书房 →' : '进入我的书房 →';
    }
  };
}

export async function sessionFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (!['GET','HEAD','OPTIONS'].includes(method)) headers.set('X-CSRF-Token', session?.csrf_token || '');
  const response = await fetch(url, {...options, headers, credentials:'same-origin'});
  if (response.status === 401) {
    session = null;
    channel?.postMessage('account-changed');
    location.reload();
    throw new Error('登录已过期，请重新登录');
  }
  return response;
}

export async function logout() {
  try { await authRequest('/logout', {}); }
  catch (error) { if (error.status !== 401) throw error; }
  session = null;
  channel?.postMessage('account-changed');
  location.reload();
}
