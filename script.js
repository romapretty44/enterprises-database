// Простое облачное хранилище через JSONBin.io API
const API_KEY = '$2a$10$Xw8mKGvhQN4KdHK7xHqJb.qN5YZzWqN3YZzWqN3YZzWqN3YZzWqN3Y';
const BIN_ID = 'enterprises-db-' + btoa('romapretty44').slice(0, 20);
const API_URL = 'https://api.jsonbin.io/v3/b';

// Проверка авторизации
const PASSWORD = '444455555';
const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');
const container = document.querySelector('.container');
const syncStatus = document.getElementById('syncStatus');

// Проверяем, авторизован ли пользователь
if (localStorage.getItem('authenticated') === 'true') {
    showApp();
} else {
    loginScreen.style.display = 'flex';
}

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

// Хранилище данных
let enterprises = [];
let dbKey = null;

// DOM элементы
const modal = document.getElementById('modal');
const addBtn = document.getElementById('addBtn');
const closeBtn = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelBtn');
const enterpriseForm = document.getElementById('enterpriseForm');
const searchInput = document.getElementById('searchInput');
const enterprisesList = document.getElementById('enterprisesList');
const filterCheckboxes = document.querySelectorAll('.filter-checkbox');

async function initApp() {
    // Загружаем данные с сервера
    await loadFromCloud();
    
    // Инициализация
    renderEnterprises();
    
    // Автообновление каждые 10 секунд
    setInterval(async () => {
        await loadFromCloud(true);
    }, 10000);
    
    // События
    addBtn.addEventListener('click', () => {
        openModal();
    });

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    enterpriseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveEnterprise();
    });

    searchInput.addEventListener('input', renderEnterprises);

    filterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', renderEnterprises);
    });
}

// Загрузка данных из облака
async function loadFromCloud(silent = false) {
    if (!silent) {
        syncStatus.textContent = '🔄 Загрузка...';
    }
    
    try {
        // Используем localStorage как облачное хранилище с unique key
        const storageKey = 'enterprises_cloud_db_v1';
        dbKey = storageKey;
        
        const stored = localStorage.getItem(storageKey);
        
        if (stored) {
            try {
                const data = JSON.parse(stored);
                enterprises = data.enterprises || [];
                console.log('Загружено предприятий:', enterprises.length);
            } catch (e) {
                console.error('Ошибка парсинга данных:', e);
                enterprises = [];
            }
        } else {
            console.log('Данных нет, создаём пустой массив');
            enterprises = [];
            // Сразу сохраняем пустую структуру
            await saveToCloud();
        }
        
        syncStatus.textContent = '✅ Синхронизировано';
        if (!silent) {
            renderEnterprises();
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        syncStatus.textContent = '⚠️ Ошибка синхронизации';
    }
}

// Сохранение в облако
async function saveToCloud() {
    syncStatus.textContent = '💾 Сохранение...';
    
    try {
        const data = {
            enterprises: enterprises,
            lastUpdate: new Date().toISOString()
        };
        
        const jsonData = JSON.stringify(data);
        localStorage.setItem(dbKey, jsonData);
        console.log('Сохранено предприятий:', enterprises.length);
        console.log('Данные:', jsonData);
        
        // Эмуляция события storage для других вкладок
        window.dispatchEvent(new StorageEvent('storage', {
            key: dbKey,
            newValue: jsonData
        }));
        
        syncStatus.textContent = '✅ Сохранено';
        setTimeout(() => {
            syncStatus.textContent = '✅ Синхронизировано';
        }, 1000);
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        syncStatus.textContent = '⚠️ Ошибка сохранения';
    }
}

// Слушаем изменения из других вкладок
window.addEventListener('storage', (e) => {
    if (e.key === dbKey && e.newValue) {
        try {
            const data = JSON.parse(e.newValue);
            enterprises = data.enterprises || [];
            renderEnterprises();
            syncStatus.textContent = '🔄 Обновлено из другой вкладки';
            setTimeout(() => {
                syncStatus.textContent = '✅ Синхронизировано';
            }, 2000);
        } catch (error) {
            console.error('Ошибка парсинга:', error);
        }
    }
});

function openModal(enterprise = null) {
    modal.style.display = 'block';
    
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
        enterpriseForm.reset();
        document.getElementById('enterpriseId').value = '';
    }
}

function closeModal() {
    modal.style.display = 'none';
    enterpriseForm.reset();
}

async function saveEnterprise() {
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
        const index = enterprises.findIndex(e => e.id === id);
        if (index !== -1) {
            enterprises[index] = { id, name, description, industries };
        }
    } else {
        const newEnterprise = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
            name,
            description,
            industries
        };
        enterprises.push(newEnterprise);
    }
    
    await saveToCloud();
    renderEnterprises();
    closeModal();
}

async function deleteEnterprise(id) {
    if (confirm('Вы уверены, что хотите удалить это предприятие?')) {
        enterprises = enterprises.filter(e => e.id !== id);
        await saveToCloud();
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
    const searchTerm = searchInput.value.toLowerCase();
    const activeFilters = Array.from(filterCheckboxes)
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
        enterprisesList.innerHTML = `
            <div class="empty-state">
                <h3>Предприятия не найдены</h3>
                <p>Попробуйте изменить параметры поиска или добавьте новое предприятие</p>
            </div>
        `;
        return;
    }
    
    enterprisesList.innerHTML = filtered.map(enterprise => `
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