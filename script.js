(function () {
    'use strict';

    const STORAGE_KEY = 'foodboom-cart';
    const CURRENT_USER_KEY = 'foodboom-current-user';
    const DELIVERY_FEE = 200;
    const FREE_DELIVERY_FROM = 1500;
    const VALID_PROMOS = { 'BOOM10': 10, 'WELCOME15': 15 };
    let appliedPromo = null;
    let cart = loadCart();

    function loadCart() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }
    function saveCart() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (e) {}
    }
    function getCurrentUser() {
        try {
            const raw = localStorage.getItem(CURRENT_USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }
    function formatPrice(n) { return Math.round(n).toLocaleString('ru-RU') + ' ₽'; }
    function cartSubtotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }
    function cartCount() { return cart.reduce((s, i) => s + i.qty, 0); }
    function cartDiscount() {
        if (!appliedPromo) return 0;
        return Math.round(cartSubtotal() * appliedPromo / 100);
    }

    const header = document.getElementById('header');
    const burger = document.getElementById('burger');
    const nav = document.getElementById('nav');
    const cartToggle = document.getElementById('cartToggle');
    const cartBadge = document.getElementById('cartBadge');
    const cartEl = document.getElementById('cart');
    const cartOverlay = document.getElementById('cartOverlay');
    const cartClose = document.getElementById('cartClose');
    const cartItemsEl = document.getElementById('cartItems');
    const cartFooter = document.getElementById('cartFooter');
    const cartTotalEl = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutOverlay = document.getElementById('checkoutOverlay');
    const modalClose = document.getElementById('modalClose');
    const checkoutStep = document.getElementById('checkoutStep');
    const successStep = document.getElementById('successStep');
    const authCheckStep = document.getElementById('authCheckStep');
    const orderForm = document.getElementById('orderForm');
    const submitBtn = document.getElementById('submitBtn');
    const successClose = document.getElementById('successClose');
    const sumItems = document.getElementById('sumItems');
    const sumDelivery = document.getElementById('sumDelivery');
    const sumTotal = document.getElementById('sumTotal');
    const sumDiscount = document.getElementById('sumDiscount');
    const discountRow = document.getElementById('discountRow');
    const addressGroup = document.getElementById('addressGroup');
    const addressInput = document.getElementById('address');
    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toastText');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const emptySearch = document.getElementById('emptySearch');
    const resetSearch = document.getElementById('resetSearch');
    const promoCodeInput = document.getElementById('promoCode');
    const applyPromoBtn = document.getElementById('applyPromo');
    const promoMessage = document.getElementById('promoMessage');
    const mobileCartBar = document.getElementById('mobileCartBar');
    const mobileCartCount = document.getElementById('mobileCartCount');
    const mobileCartTotal = document.getElementById('mobileCartTotal');
    const mobileCartBtn = document.getElementById('mobileCartBtn');
    const consentCheckbox = document.getElementById('consentCheckbox');
    const consentHint = document.getElementById('consentHint');
    const callModal = document.getElementById('callModal');
    const callClose = document.getElementById('callClose');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const scrollBehavior = () => reducedMotion.matches ? 'auto' : 'smooth';

    function trapFocus(container) {
        function handler(e) {
            if (e.key !== 'Tab') return;
            // Recompute after a cart update or switching checkout steps.
            const list = Array.from(container.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )).filter(el => !el.disabled && el.offsetParent !== null && el.tabIndex >= 0);
            if (!list.length) { e.preventDefault(); return; }
            const first = list[0], last = list[list.length - 1];
            if (e.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
        container.addEventListener('keydown', handler);
        return () => container.removeEventListener('keydown', handler);
    }
    let cartTrapCleanup = null;
    let checkoutTrapCleanup = null;

    let toastTimer = null;
    function showToast(msg, isError = false) {
        toast.firstElementChild.textContent = isError ? '!' : '✓';
        toastText.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
    }
    async function postJSON(url, data) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data), signal: controller.signal
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const result = await response.json();
            if (!result.success) throw new Error('Request was not saved');
            return result;
        } finally { clearTimeout(timeout); }
    }
    let lockedScrollY = 0;
    function lockScroll() {
        if (document.body.classList.contains('no-scroll')) return;
        lockedScrollY = window.scrollY;
        document.body.style.setProperty('--locked-scroll-y', `-${lockedScrollY}px`);
        document.body.classList.add('no-scroll');
    }
    function unlockScroll() {
        if (!cartEl.classList.contains('show') && !checkoutOverlay.classList.contains('show') && !callModal.classList.contains('show') && document.body.classList.contains('no-scroll')) {
            document.body.classList.remove('no-scroll');
            document.body.style.removeProperty('--locked-scroll-y');
            window.scrollTo({ top: lockedScrollY, behavior: 'instant' });
        }
    }

    function renderBadge() {
        const count = cartCount();
        document.body.classList.toggle('has-mobile-cart', count > 0);
        cartBadge.textContent = count;
        cartBadge.classList.toggle('show', count > 0);
        if (count > 0) {
            mobileCartBar.classList.add('show');
            mobileCartCount.textContent = count + ' ' + pluralize(count, 'товар', 'товара', 'товаров');
            mobileCartTotal.textContent = formatPrice(cartSubtotal());
        } else {
            mobileCartBar.classList.remove('show');
        }
    }
    function pluralize(n, one, few, many) {
        const mod10 = n % 10, mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
        return many;
    }
    function bumpBadge() {
        if (!reducedMotion.matches && cartBadge.animate) cartBadge.animate([
            { transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }
        ], { duration: 250 });
    }
    function bumpTotal() {
        if (!reducedMotion.matches && cartEl.classList.contains('show') && cartTotalEl.animate) cartTotalEl.animate([
            { transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }
        ], { duration: 200 });
    }

    function renderCardFooter(card) {
        const id = card.dataset.id;
        const inCart = cart.find(i => i.id === id);
        const footer = card.querySelector('[data-card-footer]');
        const price = Number(card.dataset.price);
        const name = card.dataset.name;

        if (inCart) {
            footer.innerHTML = `
                <span class="card__price">${formatPrice(price * inCart.qty)}</span>
                <div class="card__qty" role="group" aria-label="Количество">
                    <button type="button" data-card-action="dec" data-id="${id}" aria-label="Уменьшить количество">−</button>
                    <span>${inCart.qty}</span>
                    <button type="button" data-card-action="inc" data-id="${id}" aria-label="Увеличить количество">+</button>
                </div>
            `;
        } else {
            const imgEl = card.querySelector('.card__image');
            footer.innerHTML = `
                <span class="card__price">${formatPrice(price)}</span>
                <button type="button" class="card__btn" data-card-action="add" data-id="${id}" data-name="${name}" data-price="${price}" data-image="${imgEl ? (imgEl.currentSrc || imgEl.src) : ''}">В корзину</button>
            `;
        }
    }
    function renderAllCardFooters() {
        document.querySelectorAll('.card').forEach(renderCardFooter);
    }
    function renderProductFooter(id) {
        const card = allCards.find(card => card.dataset.id === id);
        if (card) renderCardFooter(card);
    }

    function renderCart(force = false) {
        renderBadge();
        // Build the offscreen drawer only when it is opened or already visible.
        if (!force && !cartEl.classList.contains('show')) return;
        const focused = document.activeElement;
        const focusedItem = focused && focused.closest('.cart-item');
        const focusedId = focusedItem && focusedItem.dataset.id;
        const focusedAction = focused && focused.dataset.action;
        const previousScroll = cartItemsEl.scrollTop;
        if (cart.length === 0) {
            cartItemsEl.innerHTML = `
                <div class="cart__empty">
                    <div class="cart__empty-icon" aria-hidden="true">🍣</div>
                    <h4>Корзина пуста</h4>
                    <p>Добавьте что-нибудь вкусное из меню</p>
                    <button class="btn btn--outline" id="emptyGoMenu">Перейти к меню</button>
                </div>`;
            cartFooter.style.display = 'none';
            const goBtn = document.getElementById('emptyGoMenu');
            if (goBtn) goBtn.addEventListener('click', () => {
                closeCart();
                document.getElementById('menu').scrollIntoView({ behavior: scrollBehavior() });
            });
            if (focusedItem) cartClose.focus({ preventScroll: true });
            return;
        }

        const subtotal = cartSubtotal();
        const toFree = FREE_DELIVERY_FROM - subtotal;
        let freeMsg = '';
        if (toFree > 0) {
            freeMsg = `<div class="cart__free-delivery">До бесплатной доставки: ${formatPrice(toFree)}</div>`;
        }

        cartItemsEl.innerHTML = freeMsg + cart.map(item => `
            <div class="cart-item" data-id="${item.id}">
                <img class="cart-item__img" src="${item.image}" alt="${item.name}" loading="lazy" decoding="async" width="72" height="72">
                <div class="cart-item__info">
                    <div class="cart-item__top">
                        <div class="cart-item__name">${item.name}</div>
                        <button class="cart-item__remove" data-action="remove" aria-label="Удалить ${item.name}">×</button>
                    </div>
                    <div class="cart-item__bottom">
                        <div class="qty">
                            <button class="qty__btn" data-action="dec" aria-label="Уменьшить количество">−</button>
                            <span class="qty__num">${item.qty}</span>
                            <button class="qty__btn" data-action="inc" aria-label="Увеличить количество">+</button>
                        </div>
                        <div class="cart-item__price">${formatPrice(item.price * item.qty)}</div>
                    </div>
                </div>
            </div>`).join('');
        cartFooter.style.display = 'block';
        cartTotalEl.textContent = formatPrice(subtotal);
        cartItemsEl.scrollTop = previousScroll;
        if (focusedItem) {
            const replacementItem = Array.from(cartItemsEl.querySelectorAll('.cart-item')).find(el => el.dataset.id === focusedId);
            const replacementButton = replacementItem && Array.from(replacementItem.querySelectorAll('button')).find(el => el.dataset.action === focusedAction);
            (replacementButton || cartClose).focus({ preventScroll: true });
        }
    }

    function addToCart(product) {
        const existing = cart.find(i => i.id === product.id);
        if (existing) existing.qty += 1;
        else cart.push({ ...product, qty: 1 });
        saveCart(); renderCart(); renderProductFooter(product.id); bumpBadge();
        showToast(`«${product.name}» добавлено`);
    }
    function changeQty(id, delta) {
        const item = cart.find(i => i.id === id);
        if (!item) return;
        item.qty += delta;
        if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
        saveCart(); renderCart(); renderProductFooter(id); bumpTotal();
    }
    function removeItem(id) {
        cart = cart.filter(i => i.id !== id);
        saveCart(); renderCart(); renderProductFooter(id);
    }

    document.getElementById('cards').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-card-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        const action = btn.dataset.cardAction;
        const card = btn.closest('.card');
        if (action === 'add') {
            addToCart({
                id: id,
                name: btn.dataset.name,
                price: Number(btn.dataset.price),
                image: card.querySelector('img').currentSrc || btn.dataset.image
            });
        } else if (action === 'inc') {
            changeQty(id, 1);
        } else if (action === 'dec') {
            changeQty(id, -1);
        }
        // Replacing a footer should retain keyboard focus on the same product.
        const next = card.querySelector(`[data-card-action="${action === 'add' ? 'inc' : action}"]`) || card.querySelector('button');
        if (next) next.focus({ preventScroll: true });
    });

    cartItemsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const itemEl = e.target.closest('.cart-item');
        if (!itemEl) return;
        const id = itemEl.dataset.id;
        const action = btn.dataset.action;
        if (action === 'inc') changeQty(id, 1);
        else if (action === 'dec') changeQty(id, -1);
        else if (action === 'remove') removeItem(id);
    });

    const cardsContainer = document.getElementById('cards');
    const allCards = Array.from(cardsContainer.querySelectorAll('.card'));

    function applyFilters() {
        const cat = document.querySelector('.category-btn.active').dataset.category;
        const query = searchInput.value.trim().toLowerCase();
        let visible = 0;
        allCards.forEach(card => {
            const matchCat = cat === 'all' || card.dataset.category === cat;
            const matchQuery = !query || card.dataset.name.toLowerCase().includes(query);
            if (matchCat && matchQuery) { card.classList.remove('hidden'); visible++; }
            else card.classList.add('hidden');
        });
        emptySearch.style.display = visible === 0 ? 'flex' : 'none';
    }
    function applySort() {
        const val = sortSelect.value;
        const sorted = [...allCards].sort((a, b) => {
            if (val === 'price-asc') return Number(a.dataset.price) - Number(b.dataset.price);
            if (val === 'price-desc') return Number(b.dataset.price) - Number(a.dataset.price);
            if (val === 'name') return a.dataset.name.localeCompare(b.dataset.name, 'ru');
            return 0;
        });
        const fragment = document.createDocumentFragment();
        sorted.forEach(c => fragment.appendChild(c));
        cardsContainer.appendChild(fragment);
    }

    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyFilters();
        });
    });
    searchInput.addEventListener('input', applyFilters);
    sortSelect.addEventListener('change', applySort);
    resetSearch.addEventListener('click', () => {
        searchInput.value = '';
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.category-btn[data-category="all"]').classList.add('active');
        applyFilters();
    });

    let lastFocusedEl = null;
    function openCart() {
        lastFocusedEl = document.activeElement;
        renderCart(true);
        cartEl.inert = false;
        cartEl.classList.add('show');
        cartOverlay.classList.add('show');
        lockScroll();
        cartTrapCleanup = trapFocus(cartEl);
        cartClose.focus({ preventScroll: true });
    }
    function closeCart() {
        cartEl.classList.remove('show');
        cartEl.inert = true;
        cartOverlay.classList.remove('show');
        unlockScroll();
        if (cartTrapCleanup) { cartTrapCleanup(); cartTrapCleanup = null; }
        if (lastFocusedEl && lastFocusedEl.isConnected) lastFocusedEl.focus({ preventScroll: true });
    }
    cartToggle.addEventListener('click', openCart);
    cartClose.addEventListener('click', closeCart);
    cartOverlay.addEventListener('click', closeCart);
    mobileCartBtn.addEventListener('click', openCart);

    function calcDelivery(subtotal) {
        const method = document.querySelector('input[name="delivery"]:checked').value;
        if (method === 'pickup') return 0;
        if (subtotal >= FREE_DELIVERY_FROM) return 0;
        return DELIVERY_FEE;
    }
    function updateSummary() {
        const subtotal = cartSubtotal();
        const discount = cartDiscount();
        const delivery = calcDelivery(subtotal);
        const total = subtotal - discount + delivery;

        sumItems.textContent = formatPrice(subtotal);
        if (discount > 0) {
            discountRow.style.display = 'flex';
            sumDiscount.textContent = '-' + formatPrice(discount);
        } else {
            discountRow.style.display = 'none';
        }
        if (delivery === 0) sumDelivery.innerHTML = '<span class="order-summary__free">Бесплатно</span>';
        else sumDelivery.textContent = formatPrice(delivery);
        sumTotal.textContent = formatPrice(total);
    }

    function openCheckout() {
        if (cart.length === 0) return;
        closeCart();
        
        checkoutStep.style.display = 'none';
        successStep.style.display = 'none';
        if (authCheckStep) authCheckStep.style.display = 'none';

        const currentUser = getCurrentUser();

        if (!currentUser) {
            if (authCheckStep) authCheckStep.style.display = 'block';
        } else {
            showCheckoutForm();
        }

        checkoutOverlay.classList.add('show');
        checkoutOverlay.inert = false;
        lockScroll();
        checkoutTrapCleanup = trapFocus(checkoutOverlay);
        modalClose.focus({ preventScroll: true });
    }

    function showCheckoutForm() {
        if (authCheckStep) authCheckStep.style.display = 'none';
        checkoutStep.style.display = 'block';
        
        orderForm.reset();
        appliedPromo = null;
        promoMessage.className = 'promo-message';
        promoMessage.textContent = '';
        if (consentCheckbox) consentCheckbox.classList.remove('error');
        if (consentHint) consentHint.style.display = 'none';
        document.querySelector('input[name="delivery"][value="delivery"]').checked = true;
        document.querySelector('input[name="payment"][value="online-card"]').checked = true;
        toggleAddressField();
        updateSummary();
        clearErrors();

        const currentUser = getCurrentUser();
        const subtitle = document.getElementById('checkoutSubtitle');
        
        if (currentUser && currentUser.isGuest && subtitle) {
            subtitle.innerHTML = 'Вы оформляете заказ как <strong>Гость</strong>. <a href="auth.html" style="color:var(--primary)">Войти в аккаунт</a>';
        } else if (subtitle) {
            subtitle.textContent = 'Заполните данные — и мы привезём заказ в течение 60 минут';
        }

        if (currentUser && !currentUser.isGuest) {
            const _nameInput = document.getElementById('name');
            const _phoneInput = document.getElementById('phone');
            if (_nameInput && !_nameInput.value) _nameInput.value = currentUser.name || '';
            if (_phoneInput && !_phoneInput.value && currentUser.phone) {
                _phoneInput.value = currentUser.phone;
                _phoneInput.dispatchEvent(new Event('input'));
            }
        }

        // Let the customer choose when to open the mobile keyboard.
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            requestAnimationFrame(() => {
                if (checkoutOverlay.classList.contains('show')) document.getElementById('name').focus({ preventScroll: true });
            });
        } else if (checkoutOverlay.classList.contains('show')) modalClose.focus({ preventScroll: true });
    }

    window.redirectToAuth = function(tab) {
        localStorage.setItem('foodboom-open-checkout', 'true');
        window.location.href = `auth.html?tab=${tab}`;
    };

    window.continueAsGuest = function() {
        const guestUser = {
            id: 'guest_' + Date.now(),
            name: 'Гость',
            isGuest: true
        };
        try { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(guestUser)); } catch {}
        renderUserMenu();
        showCheckoutForm();
    };

    function closeCheckout() {
        checkoutOverlay.classList.remove('show');
        checkoutOverlay.inert = true;
        unlockScroll();
        if (checkoutTrapCleanup) { checkoutTrapCleanup(); checkoutTrapCleanup = null; }
        cartToggle.focus({ preventScroll: true });
    }
    function toggleAddressField() {
        const method = document.querySelector('input[name="delivery"]:checked').value;
        if (method === 'pickup') {
            addressGroup.style.display = 'none';
            addressInput.required = false;
            addressInput.value = '';
        } else {
            addressGroup.style.display = 'block';
            addressInput.required = true;
        }
    }
    checkoutBtn.addEventListener('click', openCheckout);
    modalClose.addEventListener('click', closeCheckout);
    checkoutOverlay.addEventListener('click', (e) => {
        if (e.target === checkoutOverlay) closeCheckout();
    });
    document.querySelectorAll('input[name="delivery"]').forEach(radio => {
        radio.addEventListener('change', () => {
            toggleAddressField();
            updateSummary();
        });
    });

    applyPromoBtn.addEventListener('click', () => {
        const code = promoCodeInput.value.trim().toUpperCase();
        promoMessage.className = 'promo-message';
        if (!code) {
            promoMessage.textContent = 'Введите промокод';
            promoMessage.classList.add('error');
            return;
        }
        if (VALID_PROMOS[code]) {
            appliedPromo = VALID_PROMOS[code];
            promoMessage.textContent = `Промокод применён: скидка ${appliedPromo}%`;
            promoMessage.classList.add('success');
            updateSummary();
        } else {
            appliedPromo = null;
            promoMessage.textContent = 'Промокод не найден';
            promoMessage.classList.add('error');
            updateSummary();
        }
    });

    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', (e) => {
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

    function clearErrors() {
        orderForm.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
    }
    function validate() {
        clearErrors();
        let valid = true;
        const name = document.getElementById('name');
        if (name.value.trim().length < 2) { name.classList.add('error'); valid = false; }
        const phone = document.getElementById('phone');
        const digits = phone.value.replace(/\D/g, '');
        if (digits.length < 11) { phone.classList.add('error'); valid = false; }
        const method = document.querySelector('input[name="delivery"]:checked').value;
        if (method === 'delivery') {
            const address = document.getElementById('address');
            if (address.value.trim().length < 5) { address.classList.add('error'); valid = false; }
        }

        if (consentCheckbox && !consentCheckbox.checked) {
            consentCheckbox.classList.add('error');
            if (consentHint) consentHint.style.display = 'block';
            valid = false;
        } else {
            if (consentCheckbox) consentCheckbox.classList.remove('error');
            if (consentHint) consentHint.style.display = 'none';
        }
        return valid;
    }
    
    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (submitBtn.disabled) return;
        if (!validate()) {
            const firstError = orderForm.querySelector('.form-control.error, #consentCheckbox.error');
            if (firstError) firstError.focus();
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправляем...';
        
        try {
            const subtotal = cartSubtotal();
            const discount = cartDiscount();
            const delivery = calcDelivery(subtotal);
            const total = subtotal - discount + delivery;
            const method = document.querySelector('input[name="delivery"]:checked').value;
            const payment = document.querySelector('input[name="payment"]:checked').value;
            
            const paymentLabels = {
                'online-card': 'картой онлайн',
                'sbp': 'через СБП',
                'cash': 'наличными курьеру',
                'card-courier': 'картой курьеру'
            };
            
            const orderNum = 'FB-' + String(Date.now()).slice(-6);
            document.getElementById('orderNumber').textContent = orderNum;

            const currentUser = getCurrentUser(); 
            
            const newOrder = {
                id: orderNum,
                date: new Date().toISOString(),
                status: 'new',
                isGuest: currentUser ? !!currentUser.isGuest : true, 
                customer: {
                    name: document.getElementById('name').value.trim(),
                    phone: document.getElementById('phone').value.trim(),
                    address: method === 'pickup' ? 'Самовывоз (ул. Дежнева, 57)' : document.getElementById('address').value.trim(),
                    comment: document.getElementById('comment').value.trim() || '—'
                },
                accountEmail: currentUser ? (currentUser.isGuest ? 'Гость' : currentUser.email) : 'Гость',
                items: [...cart],
                total: total,
                delivery: method === 'pickup' ? 'Самовывоз' : 'Доставка',
                payment: paymentLabels[payment]
            };
            
            await postJSON('api/save_order.php', newOrder);

            let info = `Сумма к оплате: ${formatPrice(total)}. Оплата: ${paymentLabels[payment]}. `;
            info += 'Согласие на обработку персональных данных получено. ';
            if (method === 'pickup') info += 'Заберите заказ по адресу: ул. Дежнева, 57.';
            else info += 'Курьер свяжется с вами для подтверждения.';
            if (appliedPromo) info += ` Применён промокод: −${appliedPromo}%.`;
            
            document.getElementById('successInfo').textContent = info;
            cart = []; appliedPromo = null; saveCart(); renderCart(); renderAllCardFooters();
            checkoutStep.style.display = 'none';
            successStep.style.display = 'block';
            successClose.focus({ preventScroll: true });
        } catch (err) {
            showToast('Не удалось подтвердить заказ. Корзина сохранена.', true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Подтвердить заказ';
        }
    });
    
    successClose.addEventListener('click', closeCheckout);

    let scrollFrame = 0;
    const updateHeader = () => {
        scrollFrame = 0;
        header.classList.toggle('scrolled', (document.body.classList.contains('no-scroll') ? lockedScrollY : window.scrollY) > 20);
    };
    window.addEventListener('scroll', () => {
        if (!scrollFrame) scrollFrame = requestAnimationFrame(updateHeader);
    }, { passive: true });
    updateHeader();
    burger.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('open');
        burger.setAttribute('aria-expanded', String(isOpen));
    });
    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('open');
            burger.setAttribute('aria-expanded', 'false');
        });
    });
    document.addEventListener('click', (e) => {
        if (!nav.contains(e.target) && !burger.contains(e.target)) {
            nav.classList.remove('open');
            burger.setAttribute('aria-expanded', 'false');
        }
    });
    window.matchMedia('(max-width: 1100px)').addEventListener('change', () => {
        nav.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const top = target.getBoundingClientRect().top + window.pageYOffset - 80;
                window.scrollTo({ top, behavior: scrollBehavior() });
            }
        });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (checkoutOverlay.classList.contains('show')) closeCheckout();
            else if (cartEl.classList.contains('show')) closeCart();
            else if (callModal.classList.contains('show')) closeCall();
            else if (nav.classList.contains('open')) {
                nav.classList.remove('open');
                burger.setAttribute('aria-expanded', 'false');
                burger.focus();
            }
        }
    });

    if ('IntersectionObserver' in window && !reducedMotion.matches && window.matchMedia('(min-width: 769px) and (hover: hover)').matches) {
        document.documentElement.classList.add('reveal-ready');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0, rootMargin: '80px' });
        document.querySelectorAll('.anim').forEach(el => observer.observe(el));
    }

    function renderUserMenu() {
        const user = getCurrentUser();
        const loginLink = document.getElementById('loginLink');
        const loggedUser = document.getElementById('loggedUser');
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        
        if (!loginLink || !loggedUser) return;
        
        if (user) {
            loginLink.style.display = 'none';
            loggedUser.style.display = 'block';
            
            if (user.isGuest) {
                if (userAvatar) userAvatar.textContent = '👤';
                if (userName) userName.textContent = 'Гость';
                const settingsLink = document.querySelector('.user-menu__item[href="auth.html"]');
                if (settingsLink) settingsLink.style.display = 'none';
            } else {
                if (userAvatar) userAvatar.textContent = (user.name || '?').charAt(0).toUpperCase();
                if (userName) userName.textContent = user.name || 'Пользователь';
                const settingsLink = document.querySelector('.user-menu__item[href="auth.html"]');
                if (settingsLink) settingsLink.style.display = 'block';
            }
        } else {
            loginLink.style.display = '';
            loggedUser.style.display = 'none';
        }
    }

    const userMenuToggle = document.getElementById('userMenuToggle');
    const userDropdown = document.getElementById('userDropdown');
    if (userMenuToggle && userDropdown) {
        userMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = userDropdown.classList.toggle('show');
            userMenuToggle.classList.toggle('open', isOpen);
            userMenuToggle.setAttribute('aria-expanded', String(isOpen));
        });
        document.addEventListener('click', (e) => {
            if (!userDropdown.contains(e.target) && e.target !== userMenuToggle && !userMenuToggle.contains(e.target)) {
                userDropdown.classList.remove('show');
                userMenuToggle.classList.remove('open');
                userMenuToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            try { localStorage.removeItem(CURRENT_USER_KEY); } catch {}
            showToast('Вы вышли из аккаунта');
            renderUserMenu();
            if (userDropdown) userDropdown.classList.remove('show');
            if (userMenuToggle) {
                userMenuToggle.classList.remove('open');
                userMenuToggle.setAttribute('aria-expanded', 'false');
            }
            const nameInput = document.getElementById('name');
            const phoneInput = document.getElementById('phone');
            if (nameInput) nameInput.value = '';
            if (phoneInput) phoneInput.value = '';
        });
    }

    renderUserMenu();
    
    let autoOpenCheckout = false;
    try {
        autoOpenCheckout = localStorage.getItem('foodboom-open-checkout');
        if (autoOpenCheckout) localStorage.removeItem('foodboom-open-checkout');
    } catch {}
    if (autoOpenCheckout) {
        openCheckout();
    }

    // === ОБРАТНЫЙ ЗВОНОК ===
    let callTrapCleanup = null;
    let callReturnFocus = null;
    document.getElementById('callOpen').addEventListener('click', () => {
        callReturnFocus = document.activeElement;
        callModal.inert = false;
        callModal.classList.add('show');
        lockScroll();
        callTrapCleanup = trapFocus(callModal);
        callClose.focus({ preventScroll: true });
    });
    function closeCall() {
        callModal.classList.remove('show');
        callModal.inert = true;
        if (callTrapCleanup) { callTrapCleanup(); callTrapCleanup = null; }
        unlockScroll();
        if (callReturnFocus) callReturnFocus.focus({ preventScroll: true });
    }
    callClose.addEventListener('click', closeCall);
    callModal.addEventListener('click', (e) => { if (e.target === callModal) closeCall(); });
    const callForm = document.getElementById('callForm');
    if (callForm) {
        callForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('callName').value;
            const phone = document.getElementById('callPhone').value;
            
            const btn = callForm.querySelector('button');
            btn.disabled = true;
            btn.textContent = 'Отправка...';

            try {
                await postJSON('api/save_request.php', { name, phone, comment: 'Запрос обратного звонка' });
                closeCall();
                showToast('Заявка отправлена! Мы перезвоним.');
                callForm.reset();
            } catch (err) {
                showToast('Не удалось отправить заявку. Попробуйте ещё раз.', true);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Жду звонка';
            }
        });
    }

    // === ФОРМА ОБРАТНОЙ СВЯЗИ ===
    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
        // Маска телефона для формы обратной связи
        const fbPhone = document.getElementById('fbPhone');
        if (fbPhone) {
            fbPhone.addEventListener('input', (e) => {
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

        feedbackForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('fbName').value.trim();
            const phone = document.getElementById('fbPhone').value.trim();
            const message = document.getElementById('fbMessage').value.trim();

            if (!name || !phone || !message) {
                alert('Пожалуйста, заполните все поля.');
                return;
            }

            const btn = feedbackForm.querySelector('button[type="submit"]');
            const origText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Отправка...';

            try {
                await postJSON('api/save_request.php', { name, phone, comment: message });
                
                showToast('Сообщение отправлено!');
                feedbackForm.reset();
            } catch (err) {
                showToast('Не удалось отправить сообщение. Попробуйте ещё раз.', true);
            } finally {
                btn.disabled = false;
                btn.textContent = origText;
            }
        });
    }

    renderCart();
    renderAllCardFooters();
})();
