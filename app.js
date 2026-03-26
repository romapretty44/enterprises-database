// app.js - Основная логика приложения с Firestore
import { db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, where } from './firebase-init.js';

const COLLECTION_NAME = 'enterprises';
const TRASH_COLLECTION = 'trash';
const INDUSTRIES_COLLECTION = 'industries';
const PRODUCTS_COLLECTION = 'products';
const CATEGORIES_COLLECTION = 'categories';
let enterprises = [];
let trashedEnterprises = [];
let industries = [];
let products = [];
let categories = [];
let editingId = null;
let contactsCounter = 0;
let productsCounter = 0;

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
        loadProducts();
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

// Загрузка списка видов продукции
async function loadProducts() {
    try {
        const querySnapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
        products = [];
        querySnapshot.forEach((doc) => {
            products.push(doc.data().name);
        });
        
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

// Добавление новой категории
document.getElementById('closeAddCategoryModal').addEventListener('click', () => {
    document.getElementById('addCategoryModal').style.display = 'none';
});

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
        card.innerHTML = `
            <h3>${escapeHtml(ent.name)}</h3>
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
            <p>${escapeHtml(ent.info || 'Нет информации')}</p>
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

    content.innerHTML = html;
    modal.style.display = 'flex';
};

// Открыть модальное окно добавления
document.getElementById('addBtn').addEventListener('click', () => {
    editingId = null;
    document.getElementById('modalTitle').textContent = 'Добавить предприятие';
    document.getElementById('enterpriseName').value = '';
    document.getElementById('enterpriseInfo').value = '';
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
            // Добавляем в коллекцию products если новый
            if (!products.includes(value)) {
                products.push(value);
                addDoc(collection(db, PRODUCTS_COLLECTION), { name: value }).catch(err => console.error(err));
            }
        }
    });

    // Контакты
    const contacts = [];
    document.querySelectorAll('.contact-form').forEach(form => {
        const fullName = form.querySelector('.contact-fullname').value.trim();
        const position = form.querySelector('.contact-position').value.trim();
        const workPhone = form.querySelector('.contact-workphone').value.trim();
        const email = form.querySelector('.contact-email').value.trim();
        const mobilePhone = form.querySelector('.contact-mobilephone').value.trim();
        
        if (fullName) {
            contacts.push({ fullName, position, workPhone, email, mobilePhone });
        }
    });

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
    
    document.getElementById('modalTitle').textContent = 'Редактировать предприятие';
    document.getElementById('enterpriseName').value = ent.name;
    document.getElementById('enterpriseInfo').value = ent.info || '';
    
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
    
    document.getElementById('modal').style.display = 'flex';
};

// Удалить предприятие (в корзину)
window.deleteEnterprise = async (id) => {
    if (!confirm('Переместить это предприятие в корзину?')) return;

    try {
        const ent = enterprises.find(e => e.id === id);
        if (!ent) return;

        // Копируем в корзину
        await addDoc(collection(db, TRASH_COLLECTION), {
            ...ent,
            deletedAt: new Date().toISOString(),
            originalId: id
        });

        // Удаляем из основной коллекции
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        alert('Предприятие перемещено в корзину');
    } catch (error) {
        console.error("Ошибка удаления:", error);
        alert("Ошибка удаления данных. Проверьте консоль.");
    }
};

// Корзина
document.getElementById('trashBtn').addEventListener('click', async () => {
    try {
        const querySnapshot = await getDocs(collection(db, TRASH_COLLECTION));
        trashedEnterprises = [];
        querySnapshot.forEach((doc) => {
            trashedEnterprises.push({ id: doc.id, ...doc.data() });
        });

        const container = document.getElementById('trashContainer');
        
        if (trashedEnterprises.length === 0) {
            container.innerHTML = '<p style="text-align: center;">Корзина пуста</p>';
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
        }

        document.getElementById('trashModal').style.display = 'flex';
    } catch (error) {
        console.error("Ошибка загрузки корзины:", error);
        alert("Ошибка загрузки корзины");
    }
});

document.getElementById('closeTrashModal').addEventListener('click', () => {
    document.getElementById('trashModal').style.display = 'none';
});

window.restoreEnterprise = async (trashId, originalId) => {
    try {
        const ent = trashedEnterprises.find(e => e.id === trashId);
        if (!ent) return;

        // Копируем обратно в основную коллекцию
        const { id, deletedAt, originalId: _, ...data } = ent;
        await addDoc(collection(db, COLLECTION_NAME), data);

        // Удаляем из корзины
        await deleteDoc(doc(db, TRASH_COLLECTION, trashId));
        
        // Удаляем из локального массива
        trashedEnterprises = trashedEnterprises.filter(e => e.id !== trashId);
        
        // Обновляем отображение корзины
        const container = document.getElementById('trashContainer');
        if (trashedEnterprises.length === 0) {
            container.innerHTML = '<p style="text-align: center;">Корзина пуста</p>';
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
        }
        
        alert('Предприятие восстановлено!');
    } catch (error) {
        console.error("Ошибка восстановления:", error);
        alert("Ошибка восстановления");
    }
};

window.deletePermanently = async (trashId) => {
    if (!confirm('ВНИМАНИЕ! Предприятие будет удалено навсегда. Продолжить?')) return;

    try {
        await deleteDoc(doc(db, TRASH_COLLECTION, trashId));
        
        // Удаляем из локального массива
        trashedEnterprises = trashedEnterprises.filter(e => e.id !== trashId);
        
        // Обновляем отображение корзины
        const container = document.getElementById('trashContainer');
        if (trashedEnterprises.length === 0) {
            container.innerHTML = '<p style="text-align: center;">Корзина пуста</p>';
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
        }
        
        alert('Предприятие удалено навсегда');
    } catch (error) {
        console.error("Ошибка окончательного удаления:", error);
        alert("Ошибка удаления");
    }
};

// Экспорт в Excel/CSV
document.getElementById('exportBtn').addEventListener('click', () => {
    if (enterprises.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }

    // Формируем CSV
    let csv = 'Название;Информация;Отрасли;Категории;Контакты\n';
    
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
        
        const contacts = (ent.contacts || []).map(c => 
            `${c.fullName} (${c.position}) - ${c.workPhone}, ${c.email}, ${c.mobilePhone}`
        ).join(' | ').replace(/;/g, ',');
        
        csv += `${name};${info};${industries};${categoriesStr};${contacts}\n`;
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
