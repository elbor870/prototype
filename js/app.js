// ============================================================
// app.js - Полноценное SPA для бронирования гостиницы "Светлые Сны"
// ============================================================

// ============ МОДЕЛЬ ДАННЫХ ============
const DB = {
    init() {
        if (!localStorage.getItem('hotel_db_initialized')) {
            const initialData = {
                users: [
                    { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
                    { id: 2, username: 'guest', password: 'guest123', role: 'guest' }
                ],
                categories: [
                    { id: 1, name: 'Стандартный' },
                    { id: 2, name: 'Студия' },
                    { id: 3, name: 'Люкс' }
                ],
                rooms: [
                    { 
                        id: 1, category_id: 1, name: 'Стандарт', price: 10000, 
                        image: 'standart.png', 
                        features: ['Включен завтрак', 'Душ + Ванна'] 
                    },
                    { 
                        id: 2, category_id: 2, name: 'Студия', price: 8000, 
                        image: 'studio.jpg', 
                        features: ['Включен завтрак, обед', 'Душ + Ванна', 'Кондиционер'] 
                    },
                    { 
                        id: 3, category_id: 3, name: 'Люкс', price: 19000, 
                        image: 'lux.png', 
                        features: ['Включен завтрак, обед, ужин', 'Душ + Ванна', 'Кондиционер', 'Телевизор', 'Мини-бар', 'Вид на город'] 
                    }
                ],
                bookings: []
            };
            localStorage.setItem('hotel_db', JSON.stringify(initialData));
            localStorage.setItem('hotel_db_initialized', 'true');
            localStorage.setItem('current_user', JSON.stringify(null));
        }
    },

    getDB() {
        return JSON.parse(localStorage.getItem('hotel_db'));
    },

    saveDB(db) {
        localStorage.setItem('hotel_db', JSON.stringify(db));
    },

    getCurrentUser() {
        return JSON.parse(localStorage.getItem('current_user'));
    },

    setCurrentUser(user) {
        localStorage.setItem('current_user', JSON.stringify(user));
    },

    getRooms() {
        const db = this.getDB();
        return db.rooms.map(room => {
            const category = db.categories.find(c => c.id === room.category_id);
            return { ...room, category_name: category ? category.name : 'Без категории' };
        });
    },

    getRoomsFiltered(categoryId = null, checkIn = null, checkOut = null) {
        let rooms = this.getRooms();
        
        if (categoryId) {
            rooms = rooms.filter(r => r.category_id === parseInt(categoryId));
        }

        if (checkIn && checkOut) {
            const db = this.getDB();
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
            
            rooms = rooms.filter(room => {
                const conflictingBookings = db.bookings.filter(b => 
                    b.room_id === room.id && 
                    b.status !== 'rejected' &&
                    new Date(b.check_in) < checkOutDate &&
                    new Date(b.check_out) > checkInDate
                );
                return conflictingBookings.length === 0;
            });
        }

        return rooms;
    },

    addBooking(booking) {
        const db = this.getDB();
        const newBooking = {
            id: db.bookings.length > 0 ? Math.max(...db.bookings.map(b => b.id)) + 1 : 1,
            ...booking,
            status: 'pending',
            created_at: new Date().toISOString()
        };
        db.bookings.push(newBooking);
        this.saveDB(db);
        return newBooking;
    },

    getBookings(statusFilter = null) {
        const db = this.getDB();
        let bookings = db.bookings.map(booking => {
            const room = db.rooms.find(r => r.id === booking.room_id);
            const category = room ? db.categories.find(c => c.id === room.category_id) : null;
            const nights = Math.ceil((new Date(booking.check_out) - new Date(booking.check_in)) / (1000 * 60 * 60 * 24));
            return {
                ...booking,
                room_name: room ? room.name : 'Номер удален',
                category_name: category ? category.name : 'Категория удалена',
                price_per_night: room ? room.price : 0,
                nights_count: nights,
                total_price: nights * (room ? room.price : 0)
            };
        });

        if (statusFilter) {
            bookings = bookings.filter(b => b.status === statusFilter);
        }

        return bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    updateBookingStatus(bookingId, status) {
        const db = this.getDB();
        const booking = db.bookings.find(b => b.id === bookingId);
        if (booking) {
            booking.status = status;
            this.saveDB(db);
            return true;
        }
        return false;
    },

    login(username, password) {
        const db = this.getDB();
        const user = db.users.find(u => u.username === username && u.password === password);
        if (user) {
            this.setCurrentUser({ id: user.id, username: user.username, role: user.role });
            return true;
        }
        return false;
    },

    logout() {
        this.setCurrentUser(null);
    },

    deleteBooking(bookingId) {
        const db = this.getDB();
        db.bookings = db.bookings.filter(b => b.id !== bookingId);
        this.saveDB(db);
        return true;
    }
};

// ============ ПРИЛОЖЕНИЕ ============
const App = {
    currentPage: 'catalog',
    roomsPerPage: 6,
    currentPageNum: 1,

    init() {
        DB.init();
        this.setupEventListeners();
        
        // Обработка начального hash
        const hash = window.location.hash || '#catalog';
        this.navigate(hash);
        
        window.addEventListener('hashchange', () => {
            this.navigate(window.location.hash);
        });

        // Обработка кнопки "Назад"
        window.addEventListener('popstate', () => {
            this.navigate(window.location.hash);
        });
    },

    navigate(hash) {
        const page = hash.replace('#', '').split('?')[0] || 'catalog';
        this.currentPage = page;
        
        // Скрываем все страницы
        document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
        
        // Показываем нужную страницу
        const pageElement = document.getElementById(`page-${page}`);
        if (pageElement) {
            pageElement.classList.add('active');
        }

        // Обновляем содержимое страниц
        switch(page) {
            case 'catalog':
                this.renderCatalog();
                break;
            case 'order':
                this.renderOrderForm();
                break;
            case 'admin':
                this.renderAdminPanel();
                break;
            case 'login':
                this.renderLoginForm();
                break;
        }

        this.updateNavbar();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    updateNavbar() {
        const user = DB.getCurrentUser();
        const nav = document.getElementById('mainNav');
        if (!nav) return;

        let html = `
            <li class="nav-item"><a href="#" class="nav-link">Приезжайте как гости, уезжайте как друзья!</a></li>
        `;

        if (user) {
            if (user.role === 'admin') {
                html += `<li class="nav-item"><a href="#admin" class="nav-link">👑 Панель администратора</a></li>`;
            }
            html += `<li class="nav-item"><a href="#logout" class="nav-link" id="logoutBtn">🚪 Выйти (${user.username})</a></li>`;
        } else {
            html += `<li class="nav-item"><a href="#login" class="nav-link">🔑 Войти</a></li>`;
        }

        nav.innerHTML = html;

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                DB.logout();
                this.showToast('Вы вышли из системы', 'info');
                window.location.hash = 'catalog';
                this.updateNavbar();
            });
        }
    },

    showToast(message, type = 'success') {
        const container = document.querySelector('.toast-container');
        if (!container) return;

        const colors = {
            success: 'bg-success text-white',
            danger: 'bg-danger text-white',
            warning: 'bg-warning text-dark',
            info: 'bg-info text-dark'
        };

        const toast = document.createElement('div');
        toast.className = `toast align-items-center ${colors[type] || colors.info} border-0 show`;
        toast.role = 'alert';
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 5000);
    },

    // ============ КАТАЛОГ ============
    renderCatalog() {
        const container = document.querySelector('#page-catalog .rooms-container');
        if (!container) return;

        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const categoryId = params.get('category_id');
        const checkIn = params.get('check_in');
        const checkOut = params.get('check_out');

        const rooms = DB.getRoomsFiltered(categoryId, checkIn, checkOut);
        const categories = DB.getDB().categories;

        this.renderFilters(categories, categoryId, checkIn, checkOut);

        if (rooms.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info text-center w-100 my-4">
                    😕 Нет доступных номеров по заданным критериям.
                </div>
            `;
            return;
        }

        const totalPages = Math.ceil(rooms.length / this.roomsPerPage);
        if (this.currentPageNum > totalPages) this.currentPageNum = 1;
        const start = (this.currentPageNum - 1) * this.roomsPerPage;
        const end = start + this.roomsPerPage;
        const pageRooms = rooms.slice(start, end);

        let html = '';
        pageRooms.forEach(room => {
            html += `
                <div class="card">
                    <img src="img/${room.image}" class="card-img-top" alt="${room.name}" style="height: 200px; object-fit: cover;">
                    <div class="card-body">
                        <h3>🏷️ ${room.category_name}</h3>
                        <h5>💰 ${room.price.toLocaleString()} ₽ / чел</h5>
                        <h5>📋 Характеристики:</h5>
                        <ul class="list-group">
                            ${room.features.map(f => `<li class="list-group-item">✓ ${f}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="d-grid gap-2 p-2">
                        <a href="#order?room_id=${room.id}" class="btn btn-success">📝 Забронировать</a>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        if (totalPages > 1) {
            let paginationHtml = `
                <div class="pagination-wrapper w-100 d-flex justify-content-center my-3">
                    <nav>
                        <ul class="pagination">
                            <li class="page-item ${this.currentPageNum === 1 ? 'disabled' : ''}">
                                <a class="page-link" href="#" data-page="${this.currentPageNum - 1}">← Предыдущая</a>
                            </li>
            `;
            
            for (let i = 1; i <= totalPages; i++) {
                paginationHtml += `
                    <li class="page-item ${i === this.currentPageNum ? 'active' : ''}">
                        <a class="page-link" href="#" data-page="${i}">${i}</a>
                    </li>
                `;
            }

            paginationHtml += `
                            <li class="page-item ${this.currentPageNum === totalPages ? 'disabled' : ''}">
                                <a class="page-link" href="#" data-page="${this.currentPageNum + 1}">Следующая →</a>
                            </li>
                        </ul>
                    </nav>
                </div>
            `;

            const parent = container.parentElement;
            let existingPagination = parent.querySelector('.pagination-wrapper');
            if (existingPagination) existingPagination.remove();
            
            const wrapper = document.createElement('div');
            wrapper.innerHTML = paginationHtml;
            parent.appendChild(wrapper.firstElementChild);

            parent.querySelectorAll('.page-link[data-page]').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const page = parseInt(e.target.dataset.page);
                    if (page > 0 && page <= totalPages) {
                        this.currentPageNum = page;
                        this.renderCatalog();
                    }
                });
            });
        }
    },

    renderFilters(categories, selectedCategory, checkIn, checkOut) {
        const container = document.querySelector('#page-catalog .filter-container');
        if (!container) return;

        let html = `
            <form class="d-flex gap-2 flex-wrap align-items-center" id="filterForm">
                <div class="dropdown">
                    <button class="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        📂 Категории
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="#catalog">🌐 Все</a></li>
        `;

        categories.forEach(cat => {
            const active = selectedCategory && parseInt(selectedCategory) === cat.id ? ' active' : '';
            html += `<li><a class="dropdown-item${active}" href="#catalog?category_id=${cat.id}">${cat.name}</a></li>`;
        });

        html += `
                    </ul>
                </div>
                <input type="date" name="check_in" class="form-control" style="width: auto;" placeholder="📅 Заезд" value="${checkIn || ''}">
                <input type="date" name="check_out" class="form-control" style="width: auto;" placeholder="📅 Выезд" value="${checkOut || ''}">
                <button class="btn btn-primary my-1" type="submit">🔍 Применить</button>
                <a href="#catalog" class="btn btn-danger my-1">🔄 Сбросить</a>
            </form>
        `;

        container.innerHTML = html;

        const form = document.getElementById('filterForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const checkIn = formData.get('check_in');
            const checkOut = formData.get('check_out');
            const categoryId = selectedCategory || '';
            
            let url = '#catalog';
            const params = new URLSearchParams();
            if (categoryId) params.append('category_id', categoryId);
            if (checkIn) params.append('check_in', checkIn);
            if (checkOut) params.append('check_out', checkOut);
            if (params.toString()) url += '?' + params.toString();
            
            this.currentPageNum = 1;
            window.location.hash = url;
        });
    },

    // ============ ФОРМА БРОНИРОВАНИЯ ============
    renderOrderForm() {
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const roomId = params.get('room_id');
        const container = document.querySelector('#page-order .order-container');
        if (!container) return;

        if (!roomId) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    ⚠️ Пожалуйста, выберите номер для бронирования из <a href="#catalog" class="alert-link">каталога</a>.
                </div>
            `;
            return;
        }

        const room = DB.getRooms().find(r => r.id === parseInt(roomId));
        if (!room) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    ❌ Номер не найден. Вернитесь в <a href="#catalog" class="alert-link">каталог</a>.
                </div>
            `;
            return;
        }

        const savedFormData = sessionStorage.getItem('order_form_data');
        const formData = savedFormData ? JSON.parse(savedFormData) : {};

        container.innerHTML = `
            <div class="d-flex justify-content-between flex-wrap align-items-center">
                <h1>📝 Бронирование: ${room.category_name}</h1>
                <a href="#catalog" class="btn btn-outline-secondary">← Назад к каталогу</a>
            </div>

            ${formData.success ? `
                <div class="alert alert-success text-center my-3" role="alert">
                    ✅ Заявка успешно отправлена! Ожидайте подтверждения от администратора.
                </div>
            ` : ''}

            ${formData.error ? `
                <div class="alert alert-danger text-center my-3" role="alert">
                    ❌ ${formData.error}
                </div>
            ` : ''}

            <form class="row g-3 my-2" id="orderForm" novalidate>
                <input type="hidden" name="room_id" value="${roomId}">
                
                <div class="col-md-4">
                    <label for="validationCustom01" class="form-label">👤 Имя</label>
                    <input type="text" class="form-control ${formData.errors?.name ? 'is-invalid' : ''}" 
                           id="validationCustom01" name="name" 
                           value="${formData.name || ''}" required>
                    <div class="invalid-feedback">${formData.errors?.name || 'Пожалуйста, введите имя'}</div>
                </div>
                
                <div class="col-md-4">
                    <label for="validationCustom02" class="form-label">👤 Фамилия</label>
                    <input type="text" class="form-control ${formData.errors?.surname ? 'is-invalid' : ''}" 
                           id="validationCustom02" name="surname" 
                           value="${formData.surname || ''}" required>
                    <div class="invalid-feedback">${formData.errors?.surname || 'Пожалуйста, введите фамилию'}</div>
                </div>
                
                <div class="col-md-4">
                    <label for="validationCustomPhone" class="form-label">📞 Телефон</label>
                    <input type="text" class="form-control ${formData.errors?.phone ? 'is-invalid' : ''}" 
                           id="validationCustomPhone" name="phone" 
                           value="${formData.phone || ''}" required>
                    <div class="invalid-feedback">${formData.errors?.phone || 'Пожалуйста, введите номер телефона'}</div>
                </div>
                
                <div class="col-md-6">
                    <label for="validationCustom03" class="form-label">✉️ Email</label>
                    <input type="email" class="form-control ${formData.errors?.email ? 'is-invalid' : ''}" 
                           id="validationCustom03" name="email" 
                           value="${formData.email || ''}" required>
                    <div class="invalid-feedback">${formData.errors?.email || 'Пожалуйста, введите email'}</div>
                </div>
                
                <div class="col-md-3">
                    <label for="validationCustom04" class="form-label">📅 Дата заезда</label>
                    <input type="date" class="form-control ${formData.errors?.check_in ? 'is-invalid' : ''}" 
                           id="validationCustom04" name="check_in" 
                           value="${formData.check_in || ''}" required>
                    <div class="invalid-feedback">${formData.errors?.check_in || 'Пожалуйста, введите дату заезда'}</div>
                </div>
                
                <div class="col-md-3">
                    <label for="validationCustom05" class="form-label">📅 Дата выезда</label>
                    <input type="date" class="form-control ${formData.errors?.check_out ? 'is-invalid' : ''}" 
                           id="validationCustom05" name="check_out" 
                           value="${formData.check_out || ''}" required>
                    <div class="invalid-feedback">${formData.errors?.check_out || 'Пожалуйста, введите дату выезда'}</div>
                </div>
                
                ${formData.errors?.room ? `
                    <div class="col-12">
                        <div class="alert alert-danger">${formData.errors.room}</div>
                    </div>
                ` : ''}
                
                <div class="d-grid gap-2">
                    <button class="btn btn-primary btn-lg" type="submit">📤 Отправить заявку</button>
                </div>
            </form>
        `;

        if (typeof $.fn.inputmask !== 'undefined') {
            $('#validationCustomPhone').inputmask({"mask": "+7(999)999-99-99"});
        }

        const form = document.getElementById('orderForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitOrderForm(new FormData(form));
        });

        sessionStorage.removeItem('order_form_data');
    },

    submitOrderForm(formData) {
        const data = {
            room_id: parseInt(formData.get('room_id')),
            name: formData.get('name').trim(),
            surname: formData.get('surname').trim(),
            phone: formData.get('phone').trim(),
            email: formData.get('email').trim(),
            check_in: formData.get('check_in'),
            check_out: formData.get('check_out')
        };

        const errors = {};

        if (!data.name) errors.name = 'Имя обязательно для заполнения.';
        if (!data.surname) errors.surname = 'Фамилия обязательна для заполнения.';
        if (!data.phone) errors.phone = 'Телефон обязателен для заполнения.';
        if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.email = 'Введите корректный email.';
        }
        if (!data.check_in) errors.check_in = 'Выберите дату заезда.';
        if (!data.check_out) errors.check_out = 'Выберите дату выезда.';
        if (data.check_in && data.check_out && new Date(data.check_in) >= new Date(data.check_out)) {
            errors.check_out = 'Дата выезда должна быть позже даты заезда.';
        }

        if (Object.keys(errors).length === 0) {
            const bookings = DB.getDB().bookings;
            const conflict = bookings.some(b => 
                b.room_id === data.room_id && 
                b.status !== 'rejected' &&
                new Date(b.check_in) < new Date(data.check_out) &&
                new Date(b.check_out) > new Date(data.check_in)
            );
            if (conflict) {
                errors.room = 'Номер уже забронирован на выбранные даты. Пожалуйста, выберите другие даты.';
            }
        }

        const formDataToSave = { ...data, errors, success: false };
        sessionStorage.setItem('order_form_data', JSON.stringify(formDataToSave));

        if (Object.keys(errors).length > 0) {
            window.location.hash = `order?room_id=${data.room_id}`;
            return;
        }

        DB.addBooking(data);
        
        const successData = { ...data, errors: {}, success: true };
        sessionStorage.setItem('order_form_data', JSON.stringify(successData));
        
        this.showToast('✅ Заявка успешно отправлена!', 'success');
        window.location.hash = `order?room_id=${data.room_id}`;
    },

    // ============ ПАНЕЛЬ АДМИНИСТРАТОРА ============
    renderAdminPanel() {
        const user = DB.getCurrentUser();
        if (!user || user.role !== 'admin') {
            window.location.hash = 'login';
            return;
        }

        const container = document.querySelector('#page-admin .admin-container');
        if (!container) return;

        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const statusFilter = params.get('status');

        const bookings = DB.getBookings(statusFilter);

        container.innerHTML = `
            <div class="d-flex justify-content-between flex-wrap align-items-center">
                <h1>👑 Панель администратора</h1>
                <div class="d-flex gap-2 flex-wrap">
                    <a href="#admin" class="btn btn-outline-secondary ${!statusFilter ? 'active' : ''}">📋 Все</a>
                    <a href="#admin?status=pending" class="btn btn-outline-warning ${statusFilter === 'pending' ? 'active' : ''}">⏳ На рассмотрении</a>
                    <a href="#admin?status=approved" class="btn btn-outline-success ${statusFilter === 'approved' ? 'active' : ''}">✅ Одобренные</a>
                    <a href="#admin?status=rejected" class="btn btn-outline-danger ${statusFilter === 'rejected' ? 'active' : ''}">❌ Отклоненные</a>
                </div>
            </div>

            ${bookings.length === 0 ? `
                <div class="alert alert-info my-3">📭 Нет заявок для отображения.</div>
            ` : `
                <div class="d-flex justify-content-around flex-wrap align-items-center">
                    ${bookings.map(booking => `
                        <div class="card">
                            <div class="card-body">
                                <h5>👤 ${booking.guest_surname} ${booking.guest_name}</h5>
                                <h5>📞 ${booking.guest_phone}</h5>
                                <h6>🏨 ${booking.room_name} (${booking.category_name})</h6>
                                <ul class="list-group">
                                    <li class="list-group-item">📅 Заезд: ${new Date(booking.check_in).toLocaleDateString('ru-RU')}</li>
                                    <li class="list-group-item">📅 Выезд: ${new Date(booking.check_out).toLocaleDateString('ru-RU')}</li>
                                    <li class="list-group-item">🌙 Ночей: ${booking.nights_count}</li>
                                    <li class="list-group-item">💰 Сумма: ${booking.total_price.toLocaleString()} ₽</li>
                                    <li class="list-group-item">📧 ${booking.guest_email}</li>
                                    <li class="list-group-item">Статус: 
                                        <span class="badge ${booking.status === 'pending' ? 'bg-warning' : (booking.status === 'approved' ? 'bg-success' : 'bg-danger')}">
                                            ${booking.status === 'pending' ? '⏳ На рассмотрении' : (booking.status === 'approved' ? '✅ Одобрена' : '❌ Отклонена')}
                                        </span>
                                    </li>
                                </ul>
                            </div>
                            ${booking.status === 'pending' ? `
                                <div class="d-grid gap-2 p-2">
                                    <button class="btn btn-success approve-btn" data-id="${booking.id}">✅ Одобрить</button>
                                    <button class="btn btn-danger reject-btn" data-id="${booking.id}">❌ Отклонить</button>
                                </div>
                            ` : `
                                <div class="d-grid gap-2 p-2">
                                    <button class="btn btn-outline-danger delete-btn" data-id="${booking.id}">🗑️ Удалить</button>
                                </div>
                            `}
                        </div>
                    `).join('')}
                </div>
            `}
        `;

        container.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('✅ Подтвердить бронирование?')) {
                    DB.updateBookingStatus(parseInt(btn.dataset.id), 'approved');
                    this.showToast('✅ Заявка одобрена!', 'success');
                    this.renderAdminPanel();
                }
            });
        });

        container.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('❌ Отклонить бронирование?')) {
                    DB.updateBookingStatus(parseInt(btn.dataset.id), 'rejected');
                    this.showToast('❌ Заявка отклонена', 'warning');
                    this.renderAdminPanel();
                }
            });
        });

        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('🗑️ Удалить заявку?')) {
                    DB.deleteBooking(parseInt(btn.dataset.id));
                    this.showToast('🗑️ Заявка удалена', 'info');
                    this.renderAdminPanel();
                }
            });
        });
    },

    // ============ ФОРМА ВХОДА ============
    renderLoginForm() {
        const user = DB.getCurrentUser();
        if (user) {
            window.location.hash = user.role === 'admin' ? 'admin' : 'catalog';
            return;
        }

        const container = document.querySelector('#page-login .login-container');
        if (!container) return;

        container.innerHTML = `
            <div class="d-flex justify-content-between flex-wrap align-items-center">
                <h1>🔑 Вход в систему</h1>
                <a href="#catalog" class="btn btn-outline-secondary">← Назад</a>
            </div>
            <div class="row justify-content-center">
                <div class="col-md-6">
                    <form class="my-4" id="loginForm">
                        <div class="my-3">
                            <label for="username" class="form-label">👤 Логин</label>
                            <input type="text" class="form-control" id="username" name="username" required>
                        </div>
                        <div class="my-3">
                            <label for="password" class="form-label">🔒 Пароль</label>
                            <input type="password" class="form-control" id="password" name="password" required>
                        </div>
                        <div id="loginError" class="alert alert-danger" style="display: none;"></div>
                        <div class="d-grid gap-2">
                            <button class="btn btn-primary btn-lg" type="submit">🚪 Войти</button>
                        </div>
                    </form>
                    <div class="alert alert-info">
                        <h6>📝 Тестовые учетные записи:</h6>
                        <p class="mb-1"><strong>Администратор:</strong> admin / admin123</p>
                        <p class="mb-0"><strong>Гость:</strong> guest / guest123</p>
                    </div>
                </div>
            </div>
        `;

        const form = document.getElementById('loginForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            if (DB.login(username, password)) {
                const user = DB.getCurrentUser();
                this.showToast(`👋 Добро пожаловать, ${user.username}!`, 'success');
                window.location.hash = user.role === 'admin' ? 'admin' : 'catalog';
            } else {
                const error = document.getElementById('loginError');
                error.textContent = '❌ Неверный логин или пароль.';
                error.style.display = 'block';
            }
        });
    },

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const orderLink = e.target.closest('a[href*="order"]');
            if (orderLink) {
                e.preventDefault();
                const href = orderLink.getAttribute('href');
                window.location.hash = href;
            }

            const filterLink = e.target.closest('.dropdown-menu a[href*="catalog"]');
            if (filterLink) {
                e.preventDefault();
                const href = filterLink.getAttribute('href');
                window.location.hash = href;
            }
        });
    }
};

// ============ ЗАПУСК ============
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
