// app.js - Основная логика приложения с Firestore
import { db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc } from './firebase-init.js';

const COLLECTION_NAME = 'enterprises';
const TRASH_COLLECTION = 'trash';
const INDUSTRIES_COLLECTION = 'industries';
const PRODUCTS_COLLECTION = 'products';
const CATEGORIES_COLLECTION = 'categories';
const DADATA_API_KEY = '2566ea2523ff5ec4a2f0fc93ff3ee1a00235b01a';
const DADATA_API_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party';
const DADATA_OKVED_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/okved2';

// Функция для получения расшифровки ОКВЭД
async function getOkvedName(code) {
    if (!code) return '';
    
    try {
        const response = await fetch(DADATA_OKVED_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${DADATA_API_KEY}`
            },
            body: JSON.stringify({ query: code })
        });
        
        if (!response.ok) {
            console.error(`Ошибка API ОКВЭД: ${response.status}`);
            return '';
        }
        
        const result = await response.json();
        if (result.suggestions && result.suggestions.length > 0) {
            // API возвращает "24.45 Производство прочих цветных металлов"
            // Извлекаем только название без кода
            const fullValue = result.suggestions[0].value;
            const name = fullValue.replace(/^[\d.]+\s*/, ''); // Убираем код в начале
            return name;
        }
        return '';
    } catch (error) {
        console.error('Ошибка получения расшифровки ОКВЭД:', error);
        return '';
    }
}

let enterprises = [];
let trashedEnterprises = [];
let industries = [];
let products = [];
let categories = [];
let editingId = null;
let contactsCounter = 0;
let productsCounter = 0;
let mailingEmailsCounter = 0; // Счётчик для почт рассылки
let currentMailingMode = 'simple'; // 'simple' или 'numbered' - режим выгрузки почт
let currentLegalData = null; // Хранение юридических данных из ЕГРЮЛ

// Проверка авторизации
function checkAuth() {
    const isAuthorized = localStorage.getItem('isAuthorized');
    if (!isAuthorized) {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
    } else {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        loadIndustries();
        loadCategories();
        loadEnterprises();
        setupRealtimeListener();
    }
}

// Авторизация
document.getElementById('loginBtn').addEventListener('click', () => {
    const password = document.getElementById('passwordInput').value;
    if (password === '444455555') {
        localStorage.setItem('isAuthorized', 'true');
        checkAuth();
    } else {
        alert('Неверный пароль!');
    }
});

// Выход
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('isAuthorized');
    checkAuth();
});

// Загрузка данных из ЕГРЮЛ через DaData API
document.getElementById('loadFromEgrulBtn').addEventListener('click', async () => {
    const inn = document.getElementById('enterpriseInn').value.trim();
    
    // Валидация ИНН
    if (!inn) {
        alert('Введите ИНН!');
        return;
    }
    
    if (!/^\d{10}$|^\d{12}$/.test(inn)) {
        alert('ИНН должен содержать 10 или 12 цифр!');
        return;
    }
    
    const btn = document.getElementById('loadFromEgrulBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Загрузка...';
    
    try {
        const response = await fetch(DADATA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${DADATA_API_KEY}`
            },
            body: JSON.stringify({ query: inn })
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка API: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.suggestions || result.suggestions.length === 0) {
            alert('Организация с таким ИНН не найдена в ЕГРЮЛ');
            return;
        }
        
        // Логируем полный ответ для отладки структуры
        console.log('=== ПОЛНЫЙ ОТВЕТ DADATA ===');
        console.log(JSON.stringify(result.suggestions[0], null, 2));
        
        const data = result.suggestions[0].data;
        currentLegalData = data; // Сохраняем для последующего сохранения
        
        // Автозаполнение полей
        document.getElementById('enterpriseName').value = data.name.short_with_opf || '';
        
        // Автозаполнение руководителя
        if (data.management) {
            document.getElementById('directorFullName').value = data.management.name || '';
            document.getElementById('directorPosition').value = data.management.post || '';
        }
        
        // Заполнение редактируемых полей юридической информации
        document.getElementById('legalOgrnInput').value = data.ogrn || '';
        document.getElementById('legalFullNameInput').value = data.name?.full_with_opf || '';
        
        // ОКВЭД основной - получаем расшифровку через отдельный API запрос
        if (data.okved) {
            document.getElementById('legalOkvedCodeInput').value = data.okved;
            document.getElementById('legalOkvedNameInput').value = '⏳ Загрузка...';
            
            const okvedName = await getOkvedName(data.okved);
            document.getElementById('legalOkvedNameInput').value = okvedName || '';
            
            // Сохраняем расшифровку в currentLegalData
            currentLegalData.okvedName = okvedName;
        } else {
            document.getElementById('legalOkvedCodeInput').value = '';
            document.getElementById('legalOkvedNameInput').value = '';
        }
        
        // Дополнительные ОКВЭД - получаем расшифровку для каждого через API
        if (data.okveds && data.okveds.length > 0) {
            // Загружаем расшифровки параллельно
            const okvedsWithNames = await Promise.all(
                data.okveds.map(async (okv) => {
                    const name = await getOkvedName(okv.kod);
                    return { kod: okv.kod, name: name };
                })
            );
            
            // Сохраняем в currentLegalData
            currentLegalData.okveds = okvedsWithNames;
        }
        
        document.getElementById('legalAddressInput').value = data.address?.unrestricted_value || '';
        
        // Используем ogrn_date - дата первичной регистрации компании (дата выдачи ОГРН)
        // Это правильная дата регистрации, а не state.registration_date
        let registrationDate = '';
        if (data.ogrn_date) {
            // Если это timestamp (число), конвертируем в YYYY-MM-DD
            if (typeof data.ogrn_date === 'number') {
                registrationDate = new Date(data.ogrn_date).toISOString().split('T')[0];
            } else {
                registrationDate = data.ogrn_date;
            }
        }
        document.getElementById('legalRegDateInput').value = registrationDate;
        
        // Показываем секцию с юридической информацией
        document.getElementById('legalInfoSection').style.display = 'block';
        
        alert('✅ Данные успешно загружены из ЕГРЮЛ!');
        
    } catch (error) {
        console.error('Ошибка загрузки из ЕГРЮЛ:', error);
        alert('Ошибка при загрузке данных из ЕГРЮЛ. Проверьте консоль.');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});

// Загрузка списка отраслей
async function loadIndustries() {
    try {
        const querySnapshot = await getDocs(collection(db, INDUSTRIES_COLLECTION));
        industries = [];
        querySnapshot.forEach((doc) => {
            industries.push(doc.data().name);
        });
        
        // Если список пустой, добавляем базовые отрасли
        if (industries.length === 0) {
            const defaultIndustries = [
                'Промышленность', 'Судоремонт', 'Добыча', 'Обработка',
                'Лёгкая промышленность', 'Рыбная отрасль', 'Металлургия',
                'Лесная промышленность', 'Машиностроение', 'АПК', 'Проект'
            ];
            
            for (const ind of defaultIndustries) {
                await addDoc(collection(db, INDUSTRIES_COLLECTION), { name: ind });
                industries.push(ind);
            }
        }
        
        renderIndustryFilters();
        renderIndustryCheckboxes();
    } catch (error) {
        console.error("Ошибка загрузки отраслей:", error);
    }
}

// Отрисовка фильтров отраслей
function renderIndustryFilters() {
    const container = document.getElementById('industryFilter');
    container.innerHTML = industries.map(ind => `
        <label><input type="checkbox" class="industry-filter-cb" value="${ind}"> ${ind}</label>
    `).join('');
    
    // Привязываем обработчики
    document.querySelectorAll('.industry-filter-cb').forEach(cb => {
        cb.addEventListener('change', displayEnterprises);
    });
}

// Отрисовка чекбоксов отраслей в форме
function renderIndustryCheckboxes() {
    const container = document.getElementById('industryCheckboxes');
    container.innerHTML = industries.map(ind => `
        <label><input type="checkbox" class="industry-cb" value="${ind}"> ${ind}</label>
    `).join('');
}

// Добавление новой отрасли
document.getElementById('addIndustryBtn').addEventListener('click', () => {
    document.getElementById('addIndustryModal').style.display = 'flex';
    document.getElementById('newIndustryInput').value = '';
});

document.getElementById('closeAddIndustryModal').addEventListener('click', () => {
    document.getElementById('addIndustryModal').style.display = 'none';
});

document.getElementById('saveIndustryBtn').addEventListener('click', async () => {
    const newIndustry = document.getElementById('newIndustryInput').value.trim();
    if (!newIndustry) {
        alert('Введите название отрасли!');
        return;
    }
    
    if (industries.includes(newIndustry)) {
        alert('Такая отрасль уже существует!');
        return;
    }
    
    try {
        await addDoc(collection(db, INDUSTRIES_COLLECTION), { name: newIndustry });
        industries.push(newIndustry);
        renderIndustryFilters();
        renderIndustryCheckboxes();
        document.getElementById('addIndustryModal').style.display = 'none';
        alert('Отрасль добавлена!');
    } catch (error) {
        console.error("Ошибка добавления отрасли:", error);
        alert("Ошибка добавления отрасли");
    }
});

// Загрузка списка видов продукции из реальных данных предприятий
async function loadProducts() {
    try {
        // Собираем уникальные виды продукции из всех предприятий
        const uniqueProducts = new Set();
        
        enterprises.forEach(ent => {
            if (ent.productionTypes && Array.isArray(ent.productionTypes)) {
                ent.productionTypes.forEach(prod => {
                    if (prod && prod.trim()) {
                        uniqueProducts.add(prod.trim());
                    }
                });
            }
        });
        
        // Преобразуем в отсортированный массив
        products = Array.from(uniqueProducts).sort();
        
        renderProductsFilter();
    } catch (error) {
        console.error("Ошибка загрузки видов продукции:", error);
    }
}

// Отрисовка фильтров по видам продукции
function renderProductsFilter() {
    const container = document.getElementById('productsFilter');
    if (!container) return;
    
    container.innerHTML = products.map(prod => `
        <label><input type="checkbox" class="products-filter-cb" value="${prod}"> ${prod}</label>
    `).join('');
    
    // Привязываем обработчики
    document.querySelectorAll('.products-filter-cb').forEach(cb => {
        cb.addEventListener('change', displayEnterprises);
    });
}

// Добавление вида продукции в форму
window.addProductField = () => {
    const productId = productsCounter++;
    const productsList = document.getElementById('productsList');
    
    const productHTML = `
        <div class="product-item" data-product-id="${productId}">
            <input type="text" 
                   class="product-input" 
                   list="productsDatalist" 
                   placeholder="Введите вид продукции...">
            <button type="button" class="remove-product-btn" onclick="removeProduct(${productId})">❌</button>
        </div>
    `;
    
    productsList.insertAdjacentHTML('beforeend', productHTML);
    updateProductsDatalist();
};

window.removeProduct = (productId) => {
    const productItem = document.querySelector(`[data-product-id="${productId}"]`);
    if (productItem) productItem.remove();
};

// Обновление datalist для автокомплита продукции
function updateProductsDatalist() {
    const datalist = document.getElementById('productsDatalist');
    if (!datalist) return;
    
    datalist.innerHTML = products.map(prod => `<option value="${prod}">`).join('');
}

// Загрузка списка категорий
async function loadCategories() {
    try {
        const querySnapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
        categories = [];
        querySnapshot.forEach((doc) => {
            categories.push({ id: doc.id, ...doc.data() });
        });
        
        // Если список пустой, добавляем базовые категории
        if (categories.length === 0) {
            const defaultCategories = [
                { name: 'ОПК', hasDescription: false },
                { name: 'Категорируется', hasDescription: false },
                { name: 'Участник производительности труда', hasDescription: false },
                { name: 'Участник профессионалитета', hasDescription: false },
                { name: 'Получатель поддержки региональной', hasDescription: true },
                { name: 'Получатель поддержки федеральной', hasDescription: true }
            ];
            
            for (const cat of defaultCategories) {
                const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), cat);
                categories.push({ id: docRef.id, ...cat });
            }
        }
        
        renderCategoriesFilters();
        renderCategoriesCheckboxes();
    } catch (error) {
        console.error("Ошибка загрузки категорий:", error);
    }
}

// Отрисовка фильтров категорий
function renderCategoriesFilters() {
    const container = document.getElementById('categoriesFilter');
    container.innerHTML = categories.map(cat => `
        <label><input type="checkbox" class="category-filter-cb" value="${cat.id}"> ${escapeHtml(cat.name)}</label>
    `).join('');
    
    // Привязываем обработчики
    document.querySelectorAll('.category-filter-cb').forEach(cb => {
        cb.addEventListener('change', displayEnterprises);
    });
}

// Отрисовка чекбоксов категорий в форме
function renderCategoriesCheckboxes() {
    const container = document.getElementById('categoriesCheckboxes');
    let html = '';
    
    categories.forEach(cat => {
        html += `
            <label>
                <input type="checkbox" class="category-cb" data-category-id="${cat.id}" data-has-desc="${cat.hasDescription}">
                ${escapeHtml(cat.name)}
            </label>
        `;
        
        if (cat.hasDescription) {
            html += `
                <div class="support-textarea">
                    <textarea 
                        id="categoryDesc_${cat.id}" 
                        placeholder="Описание: ${escapeHtml(cat.name)}..." 
                        rows="2"
                        style="display: none;"
                    ></textarea>
                </div>
            `;
        }
    });
    
    html += `<button type="button" id="addCategoryBtn" class="add-category-btn">➕ Добавить категорию</button>`;
    container.innerHTML = html;
    
    // Обработчики для чекбоксов с описанием
    categories.forEach(cat => {
        if (cat.hasDescription) {
            const checkbox = document.querySelector(`[data-category-id="${cat.id}"]`);
            const textarea = document.getElementById(`categoryDesc_${cat.id}`);
            
            checkbox.addEventListener('change', () => {
                textarea.style.display = checkbox.checked ? 'block' : 'none';
            });
        }
    });
    
    // Обработчик кнопки добавления категории
    document.getElementById('addCategoryBtn').addEventListener('click', () => {
        document.getElementById('addCategoryModal').style.display = 'flex';
        document.getElementById('newCategoryInput').value = '';
        document.getElementById('categoryHasDescription').checked = false;
    });
}

// Добавление новой категории (кнопка в фильтрах на главной)
document.getElementById('addCategoryFilterBtn').addEventListener('click', () => {
    document.getElementById('addCategoryModal').style.display = 'flex';
    document.getElementById('newCategoryInput').value = '';
    document.getElementById('categoryHasDescription').checked = false;
});

// Закрытие модального окна добавления категории
document.getElementById('closeAddCategoryModal').addEventListener('click', () => {
    document.getElementById('addCategoryModal').style.display = 'none';
});

// Сохранение новой категории
document.getElementById('saveCategoryBtn').addEventListener('click', async () => {
    const newCategory = document.getElementById('newCategoryInput').value.trim();
    const hasDescription = document.getElementById('categoryHasDescription').checked;
    
    if (!newCategory) {
        alert('Введите название категории!');
        return;
    }
    
    if (categories.some(cat => cat.name === newCategory)) {
        alert('Такая категория уже существует!');
        return;
    }
    
    try {
        const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), { 
            name: newCategory, 
            hasDescription 
        });
        categories.push({ id: docRef.id, name: newCategory, hasDescription });
        renderCategoriesFilters();
        renderCategoriesCheckboxes();
        document.getElementById('addCategoryModal').style.display = 'none';
        alert('Категория добавлена!');
    } catch (error) {
        console.error("Ошибка добавления категории:", error);
        alert("Ошибка добавления категории");
    }
});

// Загрузка предприятий из Firestore
async function loadEnterprises() {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        enterprises = [];
        querySnapshot.forEach((doc) => {
            enterprises.push({ id: doc.id, ...doc.data() });
        });
        // Загружаем виды продукции ПОСЛЕ загрузки предприятий
        loadProducts();
        displayEnterprises();
    } catch (error) {
        console.error("Ошибка загрузки данных:", error);
        alert("Ошибка подключения к базе данных. Проверьте консоль.");
    }
}

// Real-time обновления
function setupRealtimeListener() {
    onSnapshot(collection(db, COLLECTION_NAME), (snapshot) => {
        enterprises = [];
        snapshot.forEach((doc) => {
            enterprises.push({ id: doc.id, ...doc.data() });
        });
        // Обновляем виды продукции из реальных данных
        loadProducts();
        displayEnterprises();
    });
}

// Отображение предприятий (компактные карточки БЕЗ описания)
function displayEnterprises() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedIndustries = Array.from(document.querySelectorAll('.industry-filter-cb:checked')).map(cb => cb.value);
    const selectedCategories = Array.from(document.querySelectorAll('#categoriesFilter input:checked')).map(cb => cb.value);
    const selectedProducts = Array.from(document.querySelectorAll('.products-filter-cb:checked')).map(cb => cb.value);

    const filtered = enterprises.filter(ent => {
        const matchesSearch = ent.name.toLowerCase().includes(searchTerm) || 
                            (ent.info && ent.info.toLowerCase().includes(searchTerm));
        
        // AND логика для отраслей - предприятие должно содержать ВСЕ выбранные отрасли
        const matchesIndustry = selectedIndustries.length === 0 || 
                               selectedIndustries.every(ind => ent.industries && ent.industries.includes(ind));
        
        // Фильтрация по категориям
        const matchesCategories = selectedCategories.length === 0 || 
                                 selectedCategories.every(cat => ent.categories && ent.categories[cat]);
        
        // Фильтрация по видам продукции (хотя бы один из выбранных)
        const matchesProducts = selectedProducts.length === 0 || 
                               selectedProducts.some(prod => ent.productionTypes && ent.productionTypes.includes(prod));
        
        return matchesSearch && matchesIndustry && matchesCategories && matchesProducts;
    });

    const container = document.getElementById('enterprisesContainer');
    container.innerHTML = '';

    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">Нет предприятий для отображения</p>';
        return;
    }

    filtered.forEach(ent => {
        const card = document.createElement('div');
        card.className = 'enterprise-card compact';
        card.style.position = 'relative';
        card.innerHTML = `
            <input type="checkbox" class="enterprise-select-cb" data-enterprise-id="${ent.id}" style="position: absolute; top: 15px; right: 15px; width: 20px; height: 20px; cursor: pointer;">
            <h3 style="padding-right: 40px;">${escapeHtml(ent.name)}</h3>
            <div class="industries">
                ${(ent.industries || []).map(ind => `<span class="industry-tag">${escapeHtml(ind)}</span>`).join('')}
            </div>
            <div class="card-actions">
                <button onclick="viewEnterprise('${ent.id}')">👁️ Просмотр</button>
                <button onclick="editEnterprise('${ent.id}')">✏️ Редактировать</button>
                <button onclick="deleteEnterprise('${ent.id}')" style="background: #e74c3c;">🗑️ Удалить</button>
            </div>
        `;
        container.appendChild(card);
    });
    
    // Добавляем обработчики на чекбоксы
    document.querySelectorAll('.enterprise-select-cb').forEach(cb => {
        cb.addEventListener('change', updateSelectionPanel);
    });
    
    updateSelectionPanel();
}

// Просмотр предприятия (модальное окно)
window.viewEnterprise = async (id) => {
    const ent = enterprises.find(e => e.id === id);
    if (!ent) return;

    const modal = document.getElementById('viewModal');
    const content = document.getElementById('viewModalContent');
    
    let html = `
        <h2>${escapeHtml(ent.name)}</h2>
        <div class="view-section">
            <h3>💼 Информация</h3>
            <p style="white-space: pre-wrap;">${escapeHtml(ent.info || 'Нет информации')}</p>
        </div>
        <div class="view-section">
            <h3>🏭 Отрасли</h3>
            <div class="industries">
                ${(ent.industries || []).map(ind => `<span class="industry-tag">${escapeHtml(ind)}</span>`).join('')}
            </div>
        </div>
    `;

    // Руководители
    if (ent.director) {
        html += '<div class="view-section"><h3>👔 Руководитель предприятия</h3>';
        html += `<div class="contact-card">
            <p><strong>${escapeHtml(ent.director.fullName || '-')}</strong></p>
            <p>Должность: ${escapeHtml(ent.director.position || '-')}</p>
            <p>📞 Контактный телефон: ${escapeHtml(ent.director.phone || '-')}</p>
        </div></div>`;
    }

    if (ent.assistant) {
        html += '<div class="view-section"><h3>🤝 Помощник руководителя предприятия</h3>';
        html += `<div class="contact-card">
            <p><strong>${escapeHtml(ent.assistant.fullName || '-')}</strong></p>
            <p>Должность: ${escapeHtml(ent.assistant.position || '-')}</p>
            <p>📞 Контактный телефон: ${escapeHtml(ent.assistant.phone || '-')}</p>
        </div></div>`;
    }

    // Производство
    if (ent.productionTypes && ent.productionTypes.length > 0) {
        html += '<div class="view-section"><h3>🏭 Производство</h3>';
        html += '<div class="production-tags">';
        ent.productionTypes.forEach(prod => {
            html += `<span class="production-tag">${escapeHtml(prod)}</span>`;
        });
        html += '</div></div>';
    }

    // Категории
    if (ent.categories && Object.keys(ent.categories).length > 0) {
        html += '<div class="view-section"><h3>📂 Категории</h3><ul>';
        Object.keys(ent.categories).forEach(catId => {
            if (ent.categories[catId]) {
                const category = categories.find(c => c.id === catId);
                if (category) {
                    html += `<li>✅ ${escapeHtml(category.name)}`;
                    if (category.hasDescription && ent.categoriesDescriptions && ent.categoriesDescriptions[catId]) {
                        html += `: ${escapeHtml(ent.categoriesDescriptions[catId])}`;
                    }
                    html += '</li>';
                }
            }
        });
        html += '</ul></div>';
    }

    // Контакты
    if (ent.contacts && ent.contacts.length > 0) {
        html += '<div class="view-section"><h3>👥 Контакты</h3>';
        ent.contacts.forEach(contact => {
            html += `<div class="contact-card">
                <p><strong>${escapeHtml(contact.fullName)}</strong> - ${escapeHtml(contact.position)}</p>
                <p>📞 Рабочий: ${escapeHtml(contact.workPhone || '-')}</p>
                <p>📱 Мобильный: ${escapeHtml(contact.mobilePhone || '-')}</p>
                <p>✉️ Email: ${escapeHtml(contact.email || '-')}</p>
            </div>`;
        });
        html += '</div>';
    }
    
    // Почты для рассылок
    if (ent.mailingEmails && ent.mailingEmails.length > 0) {
        html += '<div class="view-section"><h3>📧 Почты для рассылок</h3>';
        html += '<div style="background: rgba(0, 0, 0, 0.2); padding: 15px; border-radius: 8px;">';
        ent.mailingEmails.forEach(email => {
            html += `<div style="margin-bottom: 8px; color: #d1d5db;">✉️ ${escapeHtml(email)}</div>`;
        });
        html += '</div></div>';
    }
    
    // Юридическая информация
    if (ent.legalData) {
        html += '<div class="view-section"><h3>⚖️ Юридическая информация</h3>';
        html += '<div class="legal-info-grid" style="background: rgba(30, 35, 60, 0.4); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 20px; display: grid; gap: 12px;">';
        
        if (ent.legalData.inn) {
            html += `<div style="display: grid; grid-template-columns: 180px 1fr; gap: 10px;">
                <span style="color: #9ca3af; font-weight: 600; font-size: 0.9em;">ИНН:</span>
                <span style="color: #d1d5db;">${escapeHtml(ent.legalData.inn)}</span>
            </div>`;
        }
        
        if (ent.legalData.ogrn) {
            html += `<div style="display: grid; grid-template-columns: 180px 1fr; gap: 10px;">
                <span style="color: #9ca3af; font-weight: 600; font-size: 0.9em;">ОГРН:</span>
                <span style="color: #d1d5db;">${escapeHtml(ent.legalData.ogrn)}</span>
            </div>`;
        }
        
        if (ent.legalData.fullName) {
            html += `<div style="display: grid; grid-template-columns: 180px 1fr; gap: 10px;">
                <span style="color: #9ca3af; font-weight: 600; font-size: 0.9em;">Полное название:</span>
                <span style="color: #d1d5db;">${escapeHtml(ent.legalData.fullName)}</span>
            </div>`;
        }
        
        if (ent.legalData.okved) {
            const okvedText = ent.legalData.okvedName 
                ? `${escapeHtml(ent.legalData.okved)} - ${escapeHtml(ent.legalData.okvedName)}` 
                : escapeHtml(ent.legalData.okved);
            html += `<div style="display: grid; grid-template-columns: 180px 1fr; gap: 10px;">
                <span style="color: #9ca3af; font-weight: 600; font-size: 0.9em;">ОКВЭД (основной):</span>
                <span style="color: #d1d5db;">${okvedText}</span>
            </div>`;
        }
        
        // Дополнительные ОКВЭД
        if (ent.legalData.okveds && ent.legalData.okveds.length > 0) {
            html += `<div style="display: grid; grid-template-columns: 180px 1fr; gap: 10px;">
                <span style="color: #9ca3af; font-weight: 600; font-size: 0.9em;">ОКВЭД (дополнительные):</span>
                <div style="color: #d1d5db;">`;
            ent.legalData.okveds.forEach(okv => {
                const okvedText = okv.name 
                    ? `${escapeHtml(okv.kod)} - ${escapeHtml(okv.name)}` 
                    : escapeHtml(okv.kod);
                html += `<div style="margin-bottom: 5px;">• ${okvedText}</div>`;
            });
            html += `</div></div>`;
        }
        
        if (ent.legalData.address) {
            html += `<div style="display: grid; grid-template-columns: 180px 1fr; gap: 10px;">
                <span style="color: #9ca3af; font-weight: 600; font-size: 0.9em;">Юридический адрес:</span>
                <span style="color: #d1d5db; word-break: break-word;">${escapeHtml(ent.legalData.address)}</span>
            </div>`;
        }
        
        if (ent.legalData.registrationDate) {
            html += `<div style="display: grid; grid-template-columns: 180px 1fr; gap: 10px;">
                <span style="color: #9ca3af; font-weight: 600; font-size: 0.9em;">Дата регистрации:</span>
                <span style="color: #d1d5db;">${new Date(ent.legalData.registrationDate).toLocaleDateString('ru-RU')}</span>
            </div>`;
        }
        
        html += '</div></div>';
    }

    content.innerHTML = html;
    modal.style.display = 'flex';
};

// Открыть модальное окно добавления
document.getElementById('addBtn').addEventListener('click', () => {
    editingId = null;
    currentLegalData = null;
    document.getElementById('modalTitle').textContent = 'Добавить предприятие';
    document.getElementById('enterpriseName').value = '';
    document.getElementById('enterpriseInfo').value = '';
    document.getElementById('enterpriseInn').value = '';
    document.querySelectorAll('.industry-cb').forEach(cb => cb.checked = false);
    
    // Сброс руководителей
    document.getElementById('directorFullName').value = '';
    document.getElementById('directorPosition').value = '';
    document.getElementById('directorPhone').value = '';
    document.getElementById('assistantFullName').value = '';
    document.getElementById('assistantPosition').value = '';
    document.getElementById('assistantPhone').value = '';
    
    // Сброс производства
    document.getElementById('productsList').innerHTML = '';
    productsCounter = 0;
    updateProductsDatalist();
    
    // Сброс категорий
    document.querySelectorAll('.category-cb').forEach(cb => {
        cb.checked = false;
        const categoryId = cb.dataset.categoryId;
        const textarea = document.getElementById(`categoryDesc_${categoryId}`);
        if (textarea) {
            textarea.value = '';
            textarea.style.display = 'none';
        }
    });
    
    // Сброс контактов
    document.getElementById('contactsList').innerHTML = '';
    contactsCounter = 0;
    
    // Сброс почт для рассылок
    document.getElementById('mailingEmailsList').innerHTML = '';
    mailingEmailsCounter = 0;
    
    // Сброс юридической информации
    document.getElementById('legalOgrnInput').value = '';
    document.getElementById('legalFullNameInput').value = '';
    document.getElementById('legalOkvedCodeInput').value = '';
    document.getElementById('legalOkvedNameInput').value = '';
    document.getElementById('legalAddressInput').value = '';
    document.getElementById('legalRegDateInput').value = '';
    
    // Скрыть юридическую информацию
    document.getElementById('legalInfoSection').style.display = 'none';
    
    document.getElementById('modal').style.display = 'flex';
});

// Закрыть модальные окна
document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('modal').style.display = 'none';
});

document.getElementById('closeViewModal').addEventListener('click', () => {
    document.getElementById('viewModal').style.display = 'none';
});

// Добавление контакта
document.getElementById('addContactBtn').addEventListener('click', () => {
    const contactId = contactsCounter++;
    const contactHTML = `
        <div class="contact-form" data-contact-id="${contactId}">
            <button type="button" class="remove-contact-btn" onclick="removeContact(${contactId})">❌</button>
            <input type="text" placeholder="ФИО" class="contact-fullname">
            <input type="text" placeholder="Должность" class="contact-position">
            <input type="text" placeholder="Рабочий телефон" class="contact-workphone">
            <input type="text" placeholder="Почта" class="contact-email">
            <input type="text" placeholder="Мобильный телефон" class="contact-mobilephone">
        </div>
    `;
    document.getElementById('contactsList').insertAdjacentHTML('beforeend', contactHTML);
});

window.removeContact = (contactId) => {
    const contactForm = document.querySelector(`[data-contact-id="${contactId}"]`);
    if (contactForm) contactForm.remove();
};

// Добавление почты для рассылки
document.getElementById('addMailingEmailBtn').addEventListener('click', () => {
    const emailId = mailingEmailsCounter++;
    const emailHTML = `
        <div class="contact-form" data-mailing-email-id="${emailId}" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
            <input type="email" placeholder="email@example.com" class="mailing-email-input" style="flex: 1;">
            <button type="button" class="remove-contact-btn" onclick="removeMailingEmail(${emailId})">❌</button>
        </div>
    `;
    document.getElementById('mailingEmailsList').insertAdjacentHTML('beforeend', emailHTML);
});

window.removeMailingEmail = (emailId) => {
    const emailForm = document.querySelector(`[data-mailing-email-id="${emailId}"]`);
    if (emailForm) emailForm.remove();
};

// Валидация email
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Сохранить предприятие
document.getElementById('saveBtn').addEventListener('click', async () => {
    const name = document.getElementById('enterpriseName').value.trim();
    const info = document.getElementById('enterpriseInfo').value.trim();
    const industriesSelected = Array.from(document.querySelectorAll('.industry-cb:checked')).map(cb => cb.value);

    if (!name) {
        alert('Введите название предприятия!');
        return;
    }

    if (industriesSelected.length === 0) {
        alert('Выберите хотя бы одну отрасль!');
        return;
    }

    // Проверка на дубликат ИНН
    const inn = document.getElementById('enterpriseInn').value.trim();
    if (inn) {
        try {
            const innQuery = query(collection(db, COLLECTION_NAME), where("legalData.inn", "==", inn));
            const innSnapshot = await getDocs(innQuery);
            
            if (!innSnapshot.empty) {
                const duplicateDoc = innSnapshot.docs[0];
                const duplicateId = duplicateDoc.id;
                const duplicateData = duplicateDoc.data();
                
                // Проверяем, что это не текущее редактируемое предприятие
                if (editingId !== duplicateId) {
                    alert(`⚠️ Предприятие с ИНН ${inn} уже добавлено в базу: ${duplicateData.name}`);
                    return;
                }
            }
        } catch (error) {
            console.error('Ошибка проверки дубликата ИНН:', error);
            alert('Ошибка проверки ИНН. Проверьте консоль.');
            return;
        }
    }

    // Категории - новая структура (ID категорий)
    const enterpriseCategories = {};
    const categoriesDescriptions = {};
    
    document.querySelectorAll('.category-cb:checked').forEach(cb => {
        const categoryId = cb.dataset.categoryId;
        const hasDesc = cb.dataset.hasDesc === 'true';
        enterpriseCategories[categoryId] = true;
        
        if (hasDesc) {
            const descTextarea = document.getElementById(`categoryDesc_${categoryId}`);
            if (descTextarea) {
                categoriesDescriptions[categoryId] = descTextarea.value.trim();
            }
        }
    });

    // Руководители
    const director = {
        fullName: document.getElementById('directorFullName').value.trim(),
        position: document.getElementById('directorPosition').value.trim(),
        phone: document.getElementById('directorPhone').value.trim()
    };

    const assistant = {
        fullName: document.getElementById('assistantFullName').value.trim(),
        position: document.getElementById('assistantPosition').value.trim(),
        phone: document.getElementById('assistantPhone').value.trim()
    };

    // Производство - собираем виды продукции
    const productionTypes = [];
    const productInputs = document.querySelectorAll('.product-input');
    productInputs.forEach(input => {
        const value = input.value.trim();
        if (value && !productionTypes.includes(value)) {
            productionTypes.push(value);
        }
    });

    // Контакты
    const contacts = [];
    document.querySelectorAll('.contact-form').forEach(form => {
        const fullNameEl = form.querySelector('.contact-fullname');
        const positionEl = form.querySelector('.contact-position');
        const workPhoneEl = form.querySelector('.contact-workphone');
        const emailEl = form.querySelector('.contact-email');
        const mobilePhoneEl = form.querySelector('.contact-mobilephone');
        
        if (!fullNameEl || !positionEl || !workPhoneEl || !emailEl || !mobilePhoneEl) {
            console.warn('Пропущена неполная форма контакта');
            return;
        }
        
        const fullName = fullNameEl.value.trim();
        const position = positionEl.value.trim();
        const workPhone = workPhoneEl.value.trim();
        const email = emailEl.value.trim();
        const mobilePhone = mobilePhoneEl.value.trim();
        
        if (fullName) {
            contacts.push({ fullName, position, workPhone, email, mobilePhone });
        }
    });

    // Почты для рассылок
    const mailingEmails = [];
    document.querySelectorAll('.mailing-email-input').forEach(input => {
        const email = input.value.trim();
        if (email) {
            if (isValidEmail(email)) {
                mailingEmails.push(email);
            } else {
                alert(`Некорректный email: ${email}`);
                throw new Error('Invalid email');
            }
        }
    });

    // Юридическая информация (берём из редактируемых полей)
    // ИНН уже получен выше для проверки дубликатов
    const ogrnValue = document.getElementById('legalOgrnInput')?.value.trim();
    const fullNameValue = document.getElementById('legalFullNameInput')?.value.trim();
    const okvedCode = document.getElementById('legalOkvedCodeInput')?.value.trim();
    const okvedName = document.getElementById('legalOkvedNameInput')?.value.trim();
    const addressValue = document.getElementById('legalAddressInput')?.value.trim();
    const regDateValue = document.getElementById('legalRegDateInput')?.value.trim();
    
    // Формируем legalData только если есть хотя бы одно значение
    const legalData = (inn || ogrnValue || fullNameValue || okvedCode || addressValue || regDateValue) ? {
        inn: inn || null,
        ogrn: ogrnValue || null,
        fullName: fullNameValue || null,
        okved: okvedCode || null,
        okvedName: okvedName || null,
        okveds: currentLegalData?.okveds || [],
        address: addressValue || null,
        registrationDate: regDateValue || null
    } : null;

    try {
        const data = {
            name,
            info,
            industries: industriesSelected,
            director: director.fullName ? director : null,
            assistant: assistant.fullName ? assistant : null,
            productionTypes,
            categories: enterpriseCategories,
            categoriesDescriptions,
            contacts,
            mailingEmails, // Почты для рассылок
            legalData,
            updatedAt: new Date().toISOString()
        };

        if (editingId) {
            await updateDoc(doc(db, COLLECTION_NAME, editingId), data);
        } else {
            data.createdAt = new Date().toISOString();
            await addDoc(collection(db, COLLECTION_NAME), data);
        }
        
        document.getElementById('modal').style.display = 'none';
        alert('Предприятие сохранено!');
    } catch (error) {
        console.error("Ошибка сохранения:", error);
        alert("Ошибка сохранения данных. Проверьте консоль.");
    }
});

// Редактировать предприятие
window.editEnterprise = (id) => {
    const ent = enterprises.find(e => e.id === id);
    if (!ent) return;

    editingId = id;
    currentLegalData = ent.legalData || null;
    
    document.getElementById('modalTitle').textContent = 'Редактировать предприятие';
    document.getElementById('enterpriseName').value = ent.name;
    document.getElementById('enterpriseInfo').value = ent.info || '';
    document.getElementById('enterpriseInn').value = ent.legalData?.inn || '';
    
    // Юридическая информация (заполнение редактируемых полей)
    if (ent.legalData) {
        document.getElementById('legalOgrnInput').value = ent.legalData.ogrn || '';
        document.getElementById('legalFullNameInput').value = ent.legalData.fullName || '';
        document.getElementById('legalOkvedCodeInput').value = ent.legalData.okved || '';
        document.getElementById('legalOkvedNameInput').value = ent.legalData.okvedName || '';
        document.getElementById('legalAddressInput').value = ent.legalData.address || '';
        document.getElementById('legalRegDateInput').value = ent.legalData.registrationDate || '';
        
        // Сохраняем okveds для последующего сохранения
        currentLegalData = {
            okveds: ent.legalData.okveds || []
        };
        
        document.getElementById('legalInfoSection').style.display = 'block';
    } else {
        document.getElementById('legalInfoSection').style.display = 'none';
    }
    
    document.querySelectorAll('.industry-cb').forEach(cb => {
        cb.checked = (ent.industries || []).includes(cb.value);
    });
    
    // Руководители
    if (ent.director) {
        document.getElementById('directorFullName').value = ent.director.fullName || '';
        document.getElementById('directorPosition').value = ent.director.position || '';
        document.getElementById('directorPhone').value = ent.director.phone || '';
    } else {
        document.getElementById('directorFullName').value = '';
        document.getElementById('directorPosition').value = '';
        document.getElementById('directorPhone').value = '';
    }

    if (ent.assistant) {
        document.getElementById('assistantFullName').value = ent.assistant.fullName || '';
        document.getElementById('assistantPosition').value = ent.assistant.position || '';
        document.getElementById('assistantPhone').value = ent.assistant.phone || '';
    } else {
        document.getElementById('assistantFullName').value = '';
        document.getElementById('assistantPosition').value = '';
        document.getElementById('assistantPhone').value = '';
    }

    // Производство
    const productsList = document.getElementById('productsList');
    productsList.innerHTML = '';
    productsCounter = 0;
    
    if (ent.productionTypes && ent.productionTypes.length > 0) {
        ent.productionTypes.forEach(prod => {
            const productId = productsCounter++;
            const productHTML = `
                <div class="product-item" data-product-id="${productId}">
                    <input type="text" 
                           class="product-input" 
                           list="productsDatalist" 
                           value="${escapeHtml(prod)}"
                           placeholder="Введите вид продукции...">
                    <button type="button" class="remove-product-btn" onclick="removeProduct(${productId})">❌</button>
                </div>
            `;
            productsList.insertAdjacentHTML('beforeend', productHTML);
        });
    }
    
    updateProductsDatalist();
    
    // Категории - новая структура
    document.querySelectorAll('.category-cb').forEach(cb => {
        const categoryId = cb.dataset.categoryId;
        cb.checked = ent.categories && ent.categories[categoryId] || false;
        
        const textarea = document.getElementById(`categoryDesc_${categoryId}`);
        if (textarea) {
            if (cb.checked && ent.categoriesDescriptions && ent.categoriesDescriptions[categoryId]) {
                textarea.value = ent.categoriesDescriptions[categoryId];
                textarea.style.display = 'block';
            } else {
                textarea.value = '';
                textarea.style.display = 'none';
            }
        }
    });
    
    // Контакты
    const contactsList = document.getElementById('contactsList');
    contactsList.innerHTML = '';
    contactsCounter = 0;
    
    if (ent.contacts) {
        ent.contacts.forEach(contact => {
            const contactId = contactsCounter++;
            const contactHTML = `
                <div class="contact-form" data-contact-id="${contactId}">
                    <button type="button" class="remove-contact-btn" onclick="removeContact(${contactId})">❌</button>
                    <input type="text" placeholder="ФИО" class="contact-fullname" value="${escapeHtml(contact.fullName || '')}">
                    <input type="text" placeholder="Должность" class="contact-position" value="${escapeHtml(contact.position || '')}">
                    <input type="text" placeholder="Рабочий телефон" class="contact-workphone" value="${escapeHtml(contact.workPhone || '')}">
                    <input type="text" placeholder="Почта" class="contact-email" value="${escapeHtml(contact.email || '')}">
                    <input type="text" placeholder="Мобильный телефон" class="contact-mobilephone" value="${escapeHtml(contact.mobilePhone || '')}">
                </div>
            `;
            contactsList.insertAdjacentHTML('beforeend', contactHTML);
        });
    }
    
    // Почты для рассылок
    const mailingEmailsList = document.getElementById('mailingEmailsList');
    mailingEmailsList.innerHTML = '';
    mailingEmailsCounter = 0;
    
    if (ent.mailingEmails) {
        ent.mailingEmails.forEach(email => {
            const emailId = mailingEmailsCounter++;
            const emailHTML = `
                <div class="contact-form" data-mailing-email-id="${emailId}" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                    <input type="email" placeholder="email@example.com" class="mailing-email-input" value="${escapeHtml(email)}" style="flex: 1;">
                    <button type="button" class="remove-contact-btn" onclick="removeMailingEmail(${emailId})">❌</button>
                </div>
            `;
            mailingEmailsList.insertAdjacentHTML('beforeend', emailHTML);
        });
    }
    
    document.getElementById('modal').style.display = 'flex';
};

// Удалить предприятие (в корзину)
window.deleteEnterprise = async (id) => {
    console.log('🗑️ deleteEnterprise вызвана с ID:', id);
    
    if (!confirm('Переместить это предприятие в корзину?')) {
        console.log('❌ Пользователь отменил удаление');
        return;
    }

    try {
        const ent = enterprises.find(e => e.id === id);
        console.log('📦 Найдено предприятие:', ent ? ent.name : 'НЕ НАЙДЕНО');
        
        if (!ent) {
            console.error('❌ Предприятие не найдено в локальном массиве');
            return;
        }

        console.log('📋 Копирование в корзину...');
        console.log('📋 Данные для копирования:', { ...ent, deletedAt: new Date().toISOString(), originalId: id });
        
        // Копируем в корзину
        const trashDoc = await addDoc(collection(db, TRASH_COLLECTION), {
            ...ent,
            deletedAt: new Date().toISOString(),
            originalId: id
        });
        
        console.log('✅ Документ скопирован в корзину с ID:', trashDoc.id);

        // Удаляем из основной коллекции
        console.log('🗑️ Удаление из основной коллекции...');
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        console.log('✅ Удалено из основной коллекции');
        
        alert('Предприятие перемещено в корзину');
    } catch (error) {
        console.error('❌ ОШИБКА при удалении:', error);
        console.error('❌ Тип ошибки:', error.name);
        console.error('❌ Сообщение:', error.message);
        console.error('❌ Stack:', error.stack);
        alert(`Ошибка удаления данных: ${error.message}`);
    }
};

// Корзина
document.getElementById('trashBtn').addEventListener('click', async () => {
    console.log('🗑️ Открытие корзины...');
    try {
        const querySnapshot = await getDocs(collection(db, TRASH_COLLECTION));
        trashedEnterprises = [];
        querySnapshot.forEach((doc) => {
            trashedEnterprises.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('📦 Загружено предприятий из корзины:', trashedEnterprises.length);

        const container = document.getElementById('trashContainer');
        
        if (trashedEnterprises.length === 0) {
            container.innerHTML = '<p style="text-align: center;">Корзина пуста</p>';
            console.log('✅ Корзина пуста');
        } else {
            console.log('🔨 Отрисовка карточек предприятий в корзине...');
            container.innerHTML = trashedEnterprises.map(ent => {
                console.log('  - Добавление кнопок для:', ent.name, 'ID:', ent.id);
                return `
                <div class="enterprise-card">
                    <h3>${escapeHtml(ent.name)}</h3>
                    <p>Удалено: ${new Date(ent.deletedAt).toLocaleString('ru-RU')}</p>
                    <div class="card-actions">
                        <button onclick="restoreEnterprise('${ent.id}', '${ent.originalId}')">♻️ Восстановить</button>
                        <button onclick="deletePermanently('${ent.id}')" style="background: #c0392b;">🗑️ Удалить навсегда</button>
                    </div>
                </div>
                `;
            }).join('');
            console.log('✅ Корзина отрисована с', trashedEnterprises.length, 'предприятиями');
        }

        document.getElementById('trashModal').style.display = 'flex';
        console.log('✅ Модальное окно корзины открыто');
    } catch (error) {
        console.error("❌ Ошибка загрузки корзины:", error);
        alert("Ошибка загрузки корзины");
    }
});

document.getElementById('closeTrashModal').addEventListener('click', () => {
    document.getElementById('trashModal').style.display = 'none';
});

window.restoreEnterprise = async (trashId, originalId) => {
    console.log('♻️ restoreEnterprise вызвана с ID:', trashId);
    
    try {
        const ent = trashedEnterprises.find(e => e.id === trashId);
        if (!ent) {
            console.error('❌ Предприятие не найдено в локальном массиве:', trashId);
            return;
        }

        console.log('📋 Восстанавливаем предприятие:', ent.name);

        // Копируем обратно в основную коллекцию
        const { id, deletedAt, originalId: _, ...data } = ent;
        await addDoc(collection(db, COLLECTION_NAME), data);
        console.log('✅ Предприятие добавлено в основную коллекцию');

        // Удаляем из корзины
        await deleteDoc(doc(db, TRASH_COLLECTION, trashId));
        console.log('✅ Предприятие удалено из корзины');
        
        // Удаляем из локального массива
        trashedEnterprises = trashedEnterprises.filter(e => e.id !== trashId);
        console.log('✅ Удалено из локального массива. Осталось:', trashedEnterprises.length);
        
        // Обновляем отображение корзины
        const container = document.getElementById('trashContainer');
        if (trashedEnterprises.length === 0) {
            container.innerHTML = '<p style="text-align: center;">Корзина пуста</p>';
            console.log('✅ Корзина теперь пуста');
        } else {
            container.innerHTML = trashedEnterprises.map(ent => `
                <div class="enterprise-card">
                    <h3>${escapeHtml(ent.name)}</h3>
                    <p>Удалено: ${new Date(ent.deletedAt).toLocaleString('ru-RU')}</p>
                    <div class="card-actions">
                        <button onclick="restoreEnterprise('${ent.id}', '${ent.originalId}')">♻️ Восстановить</button>
                        <button onclick="deletePermanently('${ent.id}')" style="background: #c0392b;">🗑️ Удалить навсегда</button>
                    </div>
                </div>
            `).join('');
            console.log('✅ UI обновлён. Осталось предприятий:', trashedEnterprises.length);
        }
        
        alert('Предприятие восстановлено!');
        console.log('✅ Восстановление завершено успешно');
    } catch (error) {
        console.error("❌ Ошибка восстановления:", error);
        console.error("Детали ошибки:", error.message, error.code);
        alert("Ошибка восстановления: " + error.message);
    }
};

window.deletePermanently = async (trashId) => {
    console.log('\n🗑️ ========== deletePermanently ВЫЗВАНА ==========');
    console.log('🎯 Входной параметр trashId:', trashId);
    console.log('🔍 Тип trashId:', typeof trashId);
    console.log('📋 Коллекция:', TRASH_COLLECTION);
    console.log('🔍 Полный путь документа:', `${TRASH_COLLECTION}/${trashId}`);
    
    if (!confirm('ВНИМАНИЕ! Предприятие будет удалено навсегда. Продолжить?')) {
        console.log('❌ Пользователь отменил удаление');
        return;
    }

    try {
        console.log('🔹 Проверка импортов:');
        console.log('  - db:', typeof db, db);
        console.log('  - deleteDoc:', typeof deleteDoc);
        console.log('  - doc:', typeof doc);
        console.log('  - getDoc:', typeof getDoc);
        
        console.log('🔹 Создание ссылки на документ...');
        const docRef = doc(db, TRASH_COLLECTION, trashId);
        console.log('  - docRef.path:', docRef.path);
        console.log('  - docRef.id:', docRef.id);
        
        // НОВАЯ ПРОВЕРКА: Проверяем существование документа ПЕРЕД удалением
        console.log('🔍 Проверка существования документа ПЕРЕД удалением...');
        const docSnapBefore = await getDoc(docRef);
        if (!docSnapBefore.exists()) {
            console.error('❌ КРИТИЧНО: Документ НЕ существует в Firestore!');
            alert('Ошибка: документ не найден в базе данных');
            return;
        }
        console.log('✅ Документ существует, данные:', docSnapBefore.data());
        
        console.log('🔹 Вызов deleteDoc...');
        const startTime = Date.now();
        await deleteDoc(docRef);
        const elapsed = Date.now() - startTime;
        console.log(`✅ deleteDoc выполнен успешно за ${elapsed}ms`);
        
        // НОВАЯ ПРОВЕРКА: Проверяем что документ действительно удалён ПОСЛЕ deleteDoc
        console.log('🔍 Проверка существования документа ПОСЛЕ удаления...');
        const docSnapAfter = await getDoc(docRef);
        if (docSnapAfter.exists()) {
            console.error('❌ КРИТИЧНО: Документ НЕ был удален из Firestore!');
            console.error('   Данные документа всё ещё существуют:', docSnapAfter.data());
            alert('ОШИБКА: deleteDoc сработал, но документ остался в базе! Проверьте права доступа Firestore.');
            return;
        } else {
            console.log('✅ Документ действительно удалён из Firestore');
        }
        
        console.log('🔹 Обновление локального массива...');
        const beforeLength = trashedEnterprises.length;
        trashedEnterprises = trashedEnterprises.filter(e => e.id !== trashId);
        const afterLength = trashedEnterprises.length;
        console.log(`  - До: ${beforeLength}, После: ${afterLength}, Удалено: ${beforeLength - afterLength}`);
        
        console.log('🔹 Обновление UI...');
        const container = document.getElementById('trashContainer');
        if (trashedEnterprises.length === 0) {
            container.innerHTML = '<p style="text-align: center;">Корзина пуста</p>';
            console.log('  ✅ Корзина теперь пуста');
        } else {
            container.innerHTML = trashedEnterprises.map(ent => `
                <div class="enterprise-card">
                    <h3>${escapeHtml(ent.name)}</h3>
                    <p>Удалено: ${new Date(ent.deletedAt).toLocaleString('ru-RU')}</p>
                    <div class="card-actions">
                        <button onclick="restoreEnterprise('${ent.id}', '${ent.originalId}')">♻️ Восстановить</button>
                        <button onclick="deletePermanently('${ent.id}')" style="background: #c0392b;">🗑️ Удалить навсегда</button>
                    </div>
                </div>
            `).join('');
            console.log('  ✅ UI обновлён. Осталось предприятий:', trashedEnterprises.length);
        }
        
        alert('Предприятие удалено навсегда');
        console.log('✅ ========== УДАЛЕНИЕ ЗАВЕРШЕНО УСПЕШНО ==========\n');
    } catch (error) {
        console.error('\n❌ ========== ОШИБКА УДАЛЕНИЯ ==========');
        console.error('Сообщение:', error.message);
        console.error('Код ошибки:', error.code);
        console.error('Имя ошибки:', error.name);
        console.error('Полный объект:', error);
        console.error('Stack trace:', error.stack);
        console.error('=========================================\n');
        alert("Ошибка удаления: " + error.message);
    }
};

console.log('✅ Функция window.deletePermanently определена и доступна');

// Экспорт в Excel/CSV
document.getElementById('exportBtn').addEventListener('click', () => {
    if (enterprises.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }

    // Формируем CSV
    let csv = 'Название;Информация;Отрасли;Категории;ИНН;ОГРН;ОКВЭД;Юридический адрес;Контакты\n';
    
    enterprises.forEach(ent => {
        const name = (ent.name || '').replace(/;/g, ',');
        const info = (ent.info || '').replace(/;/g, ',').replace(/\n/g, ' ');
        const industries = (ent.industries || []).join(', ');
        
        const categoriesList = [];
        if (ent.categories) {
            Object.keys(ent.categories).forEach(catId => {
                if (ent.categories[catId]) {
                    const category = categories.find(c => c.id === catId);
                    if (category) {
                        let catStr = category.name;
                        if (category.hasDescription && ent.categoriesDescriptions && ent.categoriesDescriptions[catId]) {
                            catStr += `: ${ent.categoriesDescriptions[catId]}`;
                        }
                        categoriesList.push(catStr);
                    }
                }
            });
        }
        const categoriesStr = categoriesList.join(', ').replace(/;/g, ',');
        
        // Юридическая информация
        const inn = ent.legalData?.inn || '';
        const ogrn = ent.legalData?.ogrn || '';
        
        // ОКВЭД в формате: КОД - НАИМЕНОВАНИЕ
        const okvedList = [];
        if (ent.legalData?.okved) {
            const mainOkved = ent.legalData.okvedName 
                ? `${ent.legalData.okved} - ${ent.legalData.okvedName}` 
                : ent.legalData.okved;
            okvedList.push(mainOkved);
        }
        // Дополнительные ОКВЭД
        if (ent.legalData?.okveds && ent.legalData.okveds.length > 0) {
            ent.legalData.okveds.forEach(okv => {
                const okvedText = okv.name 
                    ? `${okv.kod} - ${okv.name}` 
                    : okv.kod;
                okvedList.push(okvedText);
            });
        }
        const okvedStr = okvedList.join(', ').replace(/;/g, ',');
        
        const address = (ent.legalData?.address || '').replace(/;/g, ',');
        
        const contacts = (ent.contacts || []).map(c => 
            `${c.fullName} (${c.position}) - ${c.workPhone}, ${c.email}, ${c.mobilePhone}`
        ).join(' | ').replace(/;/g, ',');
        
        csv += `${name};${info};${industries};${categoriesStr};${inn};${ogrn};${okvedStr};${address};${contacts}\n`;
    });

    // Скачивание
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `enterprises_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    alert('База данных экспортирована!');
});

// Поиск и фильтры
document.getElementById('searchInput').addEventListener('input', displayEnterprises);

document.querySelectorAll('#categoriesFilter input').forEach(cb => {
    cb.addEventListener('change', displayEnterprises);
});

// ========== ФУНКЦИОНАЛ ВЫГРУЗКИ РАССЫЛКИ ==========

// Функция заполнения модального окна фильтров
function openMailingFilterModal() {
    // Заполняем чекбоксы отраслей
    const mailingIndustriesContainer = document.getElementById('mailingIndustriesCheckboxes');
    mailingIndustriesContainer.innerHTML = industries.map(ind => `
        <label><input type="checkbox" class="mailing-industry-cb" value="${ind}"> ${ind}</label>
    `).join('');
    
    // Заполняем чекбоксы категорий
    const mailingCategoriesContainer = document.getElementById('mailingCategoriesCheckboxes');
    mailingCategoriesContainer.innerHTML = categories.map(cat => `
        <label><input type="checkbox" class="mailing-category-cb" value="${cat.id}"> ${escapeHtml(cat.name)}</label>
    `).join('');
    
    document.getElementById('mailingModal').style.display = 'flex';
}

// Обработчик удалён - кнопка "Список рассылки" теперь только в модальном окне фильтрации

// Закрытие модального окна выгрузки
document.getElementById('closeMailingModal').addEventListener('click', () => {
    document.getElementById('mailingModal').style.display = 'none';
});

// Общая функция фильтрации предприятий
function getFilteredEnterprises() {
    const selectedIndustries = Array.from(document.querySelectorAll('.mailing-industry-cb:checked')).map(cb => cb.value);
    const selectedCategories = Array.from(document.querySelectorAll('.mailing-category-cb:checked')).map(cb => cb.value);
    
    let filtered = enterprises;
    
    if (selectedIndustries.length > 0 || selectedCategories.length > 0) {
        filtered = enterprises.filter(ent => {
            const matchesIndustries = selectedIndustries.length === 0 || 
                                     selectedIndustries.some(ind => ent.industries && ent.industries.includes(ind));
            
            const matchesCategories = selectedCategories.length === 0 || 
                                     selectedCategories.some(cat => ent.categories && ent.categories[cat]);
            
            return matchesIndustries && matchesCategories;
        });
    }
    
    return filtered.filter(ent => ent.mailingEmails && ent.mailingEmails.length > 0);
}

// Выгрузка почт (универсальная функция с выбором формата)
document.getElementById('exportMailingBtn').addEventListener('click', () => {
    const filtered = getFilteredEnterprises();
    
    let resultText = '';
    let totalEmailsCount = 0;
    
    if (currentMailingMode === 'simple') {
        // Простой список через запятую (для BCC)
        const allEmails = [];
        
        filtered.forEach(ent => {
            ent.mailingEmails.forEach(email => {
                if (!allEmails.includes(email)) {
                    allEmails.push(email);
                }
            });
            totalEmailsCount += ent.mailingEmails.length;
        });
        
        resultText = allEmails.join(', ');
        
    } else if (currentMailingMode === 'numbered') {
        // Нумерованный список с названиями компаний БЕЗ почт (для учёта)
        const mailingList = [];
        let index = 1;
        
        filtered.forEach(ent => {
            const companyName = ent.name;
            mailingList.push(`${index}. ${companyName}`);
            totalEmailsCount += ent.mailingEmails.length;
            index++;
        });
        
        resultText = mailingList.join('\n');
    }
    
    // Показываем результат
    document.getElementById('mailingCount').textContent = `Всего предприятий: ${filtered.length} | Всего почт: ${totalEmailsCount}`;
    document.getElementById('mailingEmailsText').value = resultText;
    
    document.getElementById('mailingModal').style.display = 'none';
    document.getElementById('mailingResultModal').style.display = 'flex';
});

// Закрытие модального окна результата
document.getElementById('closeMailingResultModal').addEventListener('click', () => {
    document.getElementById('mailingResultModal').style.display = 'none';
});

// Копирование почт
document.getElementById('copyMailingBtn').addEventListener('click', () => {
    const textarea = document.getElementById('mailingEmailsText');
    textarea.select();
    document.execCommand('copy');
    
    // Меняем текст кнопки на "Скопировано!"
    const btn = document.getElementById('copyMailingBtn');
    const originalText = btn.textContent;
    btn.textContent = '✅ Скопировано!';
    
    setTimeout(() => {
        btn.textContent = originalText;
    }, 2000);
});

// ========== ФУНКЦИОНАЛ ВЫБОРА ПРЕДПРИЯТИЙ ==========

// Обновление панели выбора
function updateSelectionPanel() {
    const selectedCheckboxes = document.querySelectorAll('.enterprise-select-cb:checked');
    const count = selectedCheckboxes.length;
    
    const panel = document.getElementById('selectionPanel');
    const countSpan = document.getElementById('selectedCount');
    
    if (count > 0) {
        panel.style.display = 'block';
        countSpan.textContent = count;
    } else {
        panel.style.display = 'none';
    }
}

// Выбрать все предприятия
document.getElementById('selectAllBtn').addEventListener('click', () => {
    document.querySelectorAll('.enterprise-select-cb').forEach(cb => {
        cb.checked = true;
    });
    updateSelectionPanel();
});

// Снять выбор
document.getElementById('deselectAllBtn').addEventListener('click', () => {
    document.querySelectorAll('.enterprise-select-cb').forEach(cb => {
        cb.checked = false;
    });
    updateSelectionPanel();
});

// Выгрузка почт выбранных предприятий (простой список)
document.getElementById('exportSelectedMailingBtn').addEventListener('click', () => {
    const selectedIds = Array.from(document.querySelectorAll('.enterprise-select-cb:checked'))
        .map(cb => cb.dataset.enterpriseId);
    
    if (selectedIds.length === 0) {
        alert('Выберите хотя бы одно предприятие!');
        return;
    }
    
    // Фильтруем предприятия по выбранным ID
    const selectedEnterprises = enterprises.filter(ent => selectedIds.includes(ent.id) && ent.mailingEmails && ent.mailingEmails.length > 0);
    
    // Собираем все почты в простой список (для BCC)
    const allEmails = [];
    selectedEnterprises.forEach(ent => {
        ent.mailingEmails.forEach(email => {
            if (!allEmails.includes(email)) {
                allEmails.push(email);
            }
        });
    });
    
    // Показываем результат (простой список через запятую)
    const resultText = allEmails.join(', ');
    const totalCount = allEmails.length;
    
    document.getElementById('mailingCount').textContent = `Выбрано предприятий: ${selectedIds.length} | Всего почт: ${totalCount}`;
    document.getElementById('mailingEmailsText').value = resultText;
    document.getElementById('mailingResultModal').style.display = 'flex';
});

// Выгрузка списка рассылки выбранных предприятий (нумерованный список)
document.getElementById('exportSelectedMailingListBtn').addEventListener('click', () => {
    const selectedIds = Array.from(document.querySelectorAll('.enterprise-select-cb:checked'))
        .map(cb => cb.dataset.enterpriseId);
    
    if (selectedIds.length === 0) {
        alert('Выберите хотя бы одно предприятие!');
        return;
    }
    
    // Фильтруем предприятия по выбранным ID
    const selectedEnterprises = enterprises.filter(ent => selectedIds.includes(ent.id) && ent.mailingEmails && ent.mailingEmails.length > 0);
    
    // Формируем нумерованный список с названиями
    const mailingList = [];
    let totalEmailsCount = 0;
    let index = 1;
    
    selectedEnterprises.forEach(ent => {
        const companyName = ent.name;
        const emails = ent.mailingEmails.join(', ');
        mailingList.push(`${index}. ${companyName} - ${emails}`);
        totalEmailsCount += ent.mailingEmails.length;
        index++;
    });
    
    // Показываем результат (нумерованный список)
    const resultText = mailingList.join('\n');
    
    document.getElementById('mailingCount').textContent = `Выбрано предприятий: ${selectedIds.length} | Всего почт: ${totalEmailsCount}`;
    document.getElementById('mailingEmailsText').value = resultText;
    document.getElementById('mailingResultModal').style.display = 'flex';
});

// Helper функция
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Инициализация
checkAuth();
