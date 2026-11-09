(function () {
    'use strict';

    const USERS_KEY = 'foodboom-users';
    const CURRENT_USER_KEY = 'foodboom-current-user';

    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toastText');

    let toastTimer = null;
    function showToast(msg) {
        toastText.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
    }

    function getCurrentUser() {
        try {
            const raw = localStorage.getItem(CURRENT_USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }
    function setCurrentUser(user) {
        try { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user)); } catch {}
    }

    async function hashPassword(password) {
        const salted = password + '|foodboom-salt-v1';
        if (window.crypto && window.crypto.subtle) {
            try {
                const enc = new TextEncoder();
                const data = enc.encode(salted);
                const hash = await crypto.subtle.digest('SHA-256', data);
                return Array.from(new Uint8Array(hash))
                    .map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (e) {}
        }
        let h1 = 0, h2 = 0;
        for (let i = 0; i < salted.length; i++) {
            const c = salted.charCodeAt(i);
            h1 = ((h1 << 5) - h1) + c; h1 &= h1;
            h2 = ((h2 << 7) - h2) + c; h2 &= h2;
        }
        return 'fb_' + Math.abs(h1).toString(16) + Math.abs(h2).toString(16);
    }

    function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
    function isPhone(v) {
        const d = v.replace(/\D/g, '');
        return d.length === 11 && (d[0] === '7' || d[0] === '8');
    }
    function isStrongPassword(v) {
        return v.length >= 8 && /[a-zA-Zа-яА-Я]/.test(v) && /\d/.test(v);
    }
    function clearErrors(form) {
        form.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
        form.querySelectorAll('.consent-checkbox input.error').forEach(el => el.classList.remove('error'));
        form.querySelectorAll('.form-hint').forEach(el => { if (el.id && el.id.endsWith('Hint')) el.style.display = 'none'; });
    }
    function setError(input, msg) {
        input.classList.add('error');
        if (msg) {
            const hint = input.closest('.form-group')?.querySelector('.form-hint');
            if (hint) hint.textContent = msg;
        }
    }

    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');

    function switchTab(name) {
        tabs.forEach(t => {
            const active = t.dataset.tab === name;
            t.classList.toggle('active', active);
            t.setAttribute('aria-selected', String(active));
        });
        forms.forEach(f => f.classList.toggle('active', f.dataset.panel === name));
        clearErrors(document.getElementById('loginForm'));
        clearErrors(document.getElementById('registerForm'));
    }
    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    document.querySelectorAll('[data-switch]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(link.dataset.switch);
        });
    });

    const urlParams = new URLSearchParams(window.location.search);
    const startTab = urlParams.get('tab');
    if (startTab === 'register' || startTab === 'login') {
        switchTab(startTab);
    }

    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.parentElement.querySelector('input');
            if (!input) return;
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            btn.textContent = type === 'password' ? '👁' : '🙈';
            btn.setAttribute('aria-label', type === 'password' ? 'Показать пароль' : 'Скрыть пароль');
        });
    });

    const regPhone = document.getElementById('regPhone');
    if (regPhone) {
        regPhone.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.startsWith('8')) value = '7' + value.slice(1);
            if (!value.startsWith('7') && value.length > 0) value = '7' + value;
            let formatted = '';
            if (value.length > 0) formatted = '+7';
            if (value.length > 1) formatted += ' (' + value.slice(1, 4);
            if (value.length >= 5) formatted += ') ' + value.slice(4, 7);
            if (value.length >= 8) formatted += '-' + value.slice(7, 9);
            if (value.length >= 10) formatted += '-' + value.slice(9, 11);
            e.target.value = formatted;
        });
    }

    const regPassword = document.getElementById('regPassword');
    const passwordStrength = document.getElementById('passwordStrength');
    if (regPassword && passwordStrength) {
        const bars = passwordStrength.querySelectorAll('span');
        regPassword.addEventListener('input', () => {
            const v = regPassword.value;
            let score = 0;
            if (v.length >= 8) score++;
            if (/[a-zA-Zа-яА-Я]/.test(v) && /\d/.test(v)) score++;
            if (v.length >= 12) score++;
            if (/[^a-zA-Zа-яА-Я0-9]/.test(v)) score++;
            bars.forEach((bar, i) => bar.classList.toggle('active', i < score));
        });
    }

    function checkConsent() {
        const consent = document.getElementById('regConsentAll');
        const hint = document.getElementById('regConsentAllHint');
        
        if (consent && !consent.checked) {
            consent.classList.add('error');
            if (hint) hint.style.display = 'block';
            return false;
        } else if (consent) {
            consent.classList.remove('error');
            if (hint) hint.style.display = 'none';
        }
        return true;
    }

    const registerForm = document.getElementById('registerForm');
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(registerForm);

        const name = document.getElementById('regName');
        const email = document.getElementById('regEmail');
        const phone = document.getElementById('regPhone');
        const pass = document.getElementById('regPassword');
        const pass2 = document.getElementById('regPassword2');

        let valid = true;
        if (name.value.trim().length < 2) { setError(name); valid = false; }
        if (!isEmail(email.value.trim())) { setError(email); valid = false; }
        if (!isPhone(phone.value)) { setError(phone); valid = false; }
        if (!isStrongPassword(pass.value)) { setError(pass); valid = false; }
        if (pass.value !== pass2.value) { setError(pass2); valid = false; }
        if (!checkConsent()) valid = false;

        if (!valid) {
            const firstErr = registerForm.querySelector('.form-control.error, .consent-checkbox input.error');
            if (firstErr) firstErr.focus();
            return;
        }

        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const origText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Создаём...';

        const passwordHash = await hashPassword(pass.value);

        const userData = {
            name: name.value.trim(),
            email: email.value.trim().toLowerCase(),
            phone: phone.value.trim(),
            phoneDigits: phone.value.replace(/\D/g, ''),
            passwordHash: passwordHash,
            marketing: !!document.getElementById('regMarketing')?.checked,
            consentPD: true,
            consentPolicy: true,
            consentDate: new Date().toISOString()
        };

        try {
            const response = await fetch('/api/save_user.php', { // <-- Добавлен слэш
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            const result = await response.json();

            if (!result.success) {
                setError(email, result.error || 'Ошибка регистрации');
                submitBtn.disabled = false;
                submitBtn.textContent = origText;
                return;
            }

            setCurrentUser(result.user);
            showToast(`Добро пожаловать, ${result.user.name}!`);
            setTimeout(() => { window.location.href = 'index.html'; }, 1200);

        } catch (error) {
            alert('Ошибка соединения с сервером. Проверьте, включен ли PHP.');
            submitBtn.disabled = false;
            submitBtn.textContent = origText;
        }
    });

    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(loginForm);

        const identifier = document.getElementById('loginIdentifier');
        const password = document.getElementById('loginPassword');

        let valid = true;
        const idValue = identifier.value.trim();
        const isEmailId = isEmail(idValue);
        const isPhoneId = isPhone(idValue);
        if (!isEmailId && !isPhoneId) { setError(identifier); valid = false; }
        if (password.value.length === 0) { setError(password, 'Введите пароль'); valid = false; }
        if (!valid) { identifier.focus(); return; }

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const origText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Входим...';

        const hash = await hashPassword(password.value);

        try {
            const response = await fetch('/api/login.php', { // <-- Добавлен слэш
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identifier: idValue,
                    passwordHash: hash
                })
            });
            const result = await response.json();

            if (!result.success) {
                setError(identifier, result.error || 'Ошибка входа');
                submitBtn.disabled = false;
                submitBtn.textContent = origText;
                identifier.focus();
                return;
            }

            setCurrentUser(result.user);
            showToast(`С возвращением, ${result.user.name}!`);
            setTimeout(() => { window.location.href = 'index.html'; }, 1000);

        } catch (error) {
            alert('Ошибка соединения с сервером.');
            submitBtn.disabled = false;
            submitBtn.textContent = origText;
        }
    });

    const forgotLink = document.getElementById('forgotLink');
    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            showToast('Функция восстановления пароля будет доступна позже');
        });
    }

    document.querySelectorAll('.social-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const provider = btn.dataset.provider || 'соцсети';
            showToast(`Вход через ${provider} — функция в разработке`);
        });
    });

    const guestLoginBtn = document.getElementById('guestLoginBtn');
    if (guestLoginBtn) {
        guestLoginBtn.addEventListener('click', () => {
            setCurrentUser({
                id: 'guest_' + Date.now(),
                name: 'Гость',
                isGuest: true
            });
            showToast('Вы вошли как гость');
            setTimeout(() => { window.location.href = 'index.html'; }, 1000);
        });
    }

    const existingUser = getCurrentUser();
    if (existingUser && !existingUser.isGuest) {
        const banner = document.createElement('div');
        banner.className = 'auth-already-logged';
        banner.innerHTML = `
            <span>Вы уже вошли как <strong>${existingUser.name}</strong></span>
            <a href="index.html" class="btn btn--primary">В меню</a>
        `;
        const card = document.querySelector('.auth-card');
        if (card && card.parentElement) {
            card.parentElement.insertBefore(banner, card);
        }
    }
})();