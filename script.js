// Константа для ключа хранилища
const STORAGE_KEY = 'enterprises_cloud_db_v1';
const PASSWORD = '444455555';

// DOM элементы авторизации
const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');
const container = document.querySelector('.container');
const syncStatus = document.getElementById('syncStatus');

// Хранилище данных
let enterprises = [];

// Проверяем авторизацию
if (localStorage.getItem('authenticated') === 'true') {
    showApp();
} else {
    loginScreen.style.display = 'flex';
}

// Обработка входа
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (passwordInput.value === PASSWORD) {
        localStorage.setItem('authenticated', 'true');
        showApp();
    } else {
        loginError.textContent = '❌ Неверный пароль';
        passwordInput.value = '';
        setTimeout(() => {
            loginError.textContent = '';
        }, 3000);
    }
});

function showApp() {
    loginScreen.style.display = 'none';
    container.style.display = 'block';
    initApp();
}

function initApp() {
    // DOM элементы приложения (инициализируем здесь!)
    window.modal = document.getElementById('modal');
    window.addBtn = document.getElementById('addBtn');
    window.closeBtn = document.querySelector('.close');
    window.cancelBtn = document.getElementById('cancelBtn');
    window.enterpriseForm = document.getElementById('enterpriseForm');
    window.searchInput = document.getElementById('searchInput');
    window.enterprisesList = document.getElementById('enterprisesList');
    window.filterCheckboxes = document.querySelectorAll('.filter-checkbox');
    
    // Загружаем данные
    loadData();
    renderEnterprises();
    
    // Автообновление каждые 10 секунд
    setInterval(() => {
        loadData(true);
    }, 10000);
    
    // События
    window.addBtn.addEventListener('click', () => openModal());
    window.closeBtn.addEventListener('click', closeModal);
    window.cancelBtn.addEventListener('click', closeModal);
    
    window.addEventListener('click', (e) => {
        if (e.target === window.modal) closeModal();
    });
    
    window.enterpriseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveEnterprise();
    });
    
    window.searchInput.addEventListener('input', renderEnterprises);
    
    window.filterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', renderEnterprises);
    });
}

// Загрузка данных из localStorage
function loadData(silent = false) {
    if (!silent) {
        syncStatus.textContent = '🔄 Загрузка...';
    }
    
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        
        if (stored) {
            const data = JSON.parse(stored);
            enterprises = data.enterprises || [];
            console.log('✅ Загружено предприятий:', enterprises.length);
        } else {
            enterprises = [];
            console.log('ℹ️ Данных нет, создан пустой массив');
            saveData(); // Сохраняем пустую структуру
        }
        
        syncStatus.textContent = '✅ Синхронизировано';
        
        if (!silent) {
            renderEnterprises();
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        syncStatus.textContent = '⚠️ Ошибка загрузки';
        enterprises = [];
    }
}

// Сохранение данных в localStorage
function saveData() {
    syncStatus.textContent = '💾 Сохранение...';
    
    try {
        const data = {
            enterprises: enterprises,
            lastUpdate: new Date().toISOString()
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        console.log('✅ Сохранено предприятий:', enterprises.length);
        
        // Уведомляем другие вкладки
        window.dispatchEvent(new StorageEvent('storage', {
            key: STORAGE_KEY,
            newValue: JSON.stringify(data)
        }));
        
        syncStatus.textContent = '✅ Сохранено';
        setTimeout(() => {
            syncStatus.textContent = '✅ Синхронизировано';
        }, 1000);
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        syncStatus.textContent = '⚠️ Ошибка сохранения';
    }
}

// Слушаем изменения из других вкладок
window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
        try {
            const data = JSON.parse(e.newValue);
            enterprises = data.enterprises || [];
            renderEnterprises();
            console.log('🔄 Обновлено из другой вкладки');
            syncStatus.textContent = '🔄 Обновлено из другой вкладки';
            setTimeout(() => {
                syncStatus.textContent = '✅ Синхронизировано';
            }, 2000);
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
        }
    }
});

function openModal(enterprise = null) {
    window.modal.style.display = 'block';
    
    if (enterprise) {
        document.getElementById('modalTitle').textContent = 'Редактировать предприятие';
        document.getElementById('enterpriseId').value = enterprise.id;
        document.getElementById('name').value = enterprise.name;
        document.getElementById('description').value = enterprise.description;
        
        document.querySelectorAll('input[name="industries"]').forEach(checkbox => {
            checkbox.checked = enterprise.industries.includes(checkbox.value);
        });
    } else {
        document.getElementById('modalTitle').textContent = 'Добавить предприятие';
        window.enterpriseForm.reset();
        document.getElementById('enterpriseId').value = '';
    }
}

function closeModal() {
    window.modal.style.display = 'none';
    window.enterpriseForm.reset();
}

function saveEnterprise() {
    const id = document.getElementById('enterpriseId').value;
    const name = document.getElementById('name').value.trim();
    const description = document.getElementById('description').value.trim();
    const industries = Array.from(document.querySelectorAll('input[name="industries"]:checked'))
        .map(cb => cb.value);
    
    if (!name) {
        alert('Введите название предприятия');
        return;
    }
    
    if (industries.length === 0) {
        alert('Выберите хотя бы одну отрасль');
        return;
    }
    
    if (id) {
        // Редактирование
        const index = enterprises.findIndex(e => e.id === id);
        if (index !== -1) {
            enterprises[index] = { id, name, description, industries };
        }
    } else {
        // Добавление
        const newEnterprise = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
            name,
            description,
            industries
        };
        enterprises.push(newEnterprise);
    }
    
    saveData();
    renderEnterprises();
    closeModal();
}

function deleteEnterprise(id) {
    if (confirm('Вы уверены, что хотите удалить это предприятие?')) {
        enterprises = enterprises.filter(e => e.id !== id);
        saveData();
        renderEnterprises();
    }
}

function editEnterprise(id) {
    const enterprise = enterprises.find(e => e.id === id);
    if (enterprise) {
        openModal(enterprise);
    }
}

function renderEnterprises() {
    if (!window.searchInput || !window.enterprisesList) {
        return; // Элементы ещё не инициализированы
    }
    
    const searchTerm = window.searchInput.value.toLowerCase();
    const activeFilters = Array.from(window.filterCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    let filtered = enterprises.filter(enterprise => {
        const matchesSearch = enterprise.name.toLowerCase().includes(searchTerm) ||
                            enterprise.description.toLowerCase().includes(searchTerm) ||
                            enterprise.industries.some(ind => ind.toLowerCase().includes(searchTerm));
        
        const matchesFilters = activeFilters.length === 0 || 
                             enterprise.industries.some(ind => activeFilters.includes(ind));
        
        return matchesSearch && matchesFilters;
    });
    
    if (filtered.length === 0) {
        window.enterprisesList.innerHTML = `
            <div class="empty-state">
                <h3>Предприятия не найдены</h3>
                <p>Попробуйте изменить параметры поиска или добавьте новое предприятие</p>
            </div>
        `;
        return;
    }
    
    window.enterprisesList.innerHTML = filtered.map(enterprise => `
        <div class="enterprise-card">
            <div class="enterprise-header">
                <div>
                    <div class="enterprise-name">${escapeHtml(enterprise.name)}</div>
                    <div class="enterprise-industries">
                        ${enterprise.industries.map(ind => `
                            <span class="industry-tag">${escapeHtml(ind)}</span>
                        `).join('')}
                    </div>
                </div>
            </div>
            ${enterprise.description ? `
                <div class="enterprise-description">${escapeHtml(enterprise.description)}</div>
            ` : ''}
            <div class="enterprise-actions">
                <button class="btn btn-edit" onclick="editEnterprise('${enterprise.id}')">✏️ Редактировать</button>
                <button class="btn btn-danger" onclick="deleteEnterprise('${enterprise.id}')">🗑️ Удалить</button>
            </div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Делаем функции глобальными
window.editEnterprise = editEnterprise;
window.deleteEnterprise = deleteEnterprise;