// app.js - Основная логика приложения с Firestore
import { db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot } from './firebase-init.js';

const COLLECTION_NAME = 'enterprises';
let enterprises = [];
let editingId = null;

// Проверка авторизации
function checkAuth() {
    const isAuthorized = localStorage.getItem('isAuthorized');
    if (!isAuthorized) {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
    } else {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
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

// Отображение предприятий
function displayEnterprises() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedIndustries = Array.from(document.querySelectorAll('#industryFilter input:checked')).map(cb => cb.value);

    const filtered = enterprises.filter(ent => {
        const matchesSearch = ent.name.toLowerCase().includes(searchTerm) || 
                            (ent.info && ent.info.toLowerCase().includes(searchTerm));
        const matchesIndustry = selectedIndustries.length === 0 || 
                               selectedIndustries.some(ind => ent.industries.includes(ind));
        return matchesSearch && matchesIndustry;
    });

    const container = document.getElementById('enterprisesContainer');
    container.innerHTML = '';

    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">Нет предприятий для отображения</p>';
        return;
    }

    filtered.forEach(ent => {
        const card = document.createElement('div');
        card.className = 'enterprise-card';
        card.innerHTML = `
            <h3>${ent.name}</h3>
            <p>${ent.info || 'Нет информации'}</p>
            <div class="industries">
                ${ent.industries.map(ind => `<span class="industry-tag">${ind}</span>`).join('')}
            </div>
            <div class="card-actions">
                <button onclick="editEnterprise('${ent.id}')">✏️ Редактировать</button>
                <button onclick="deleteEnterprise('${ent.id}')" style="background: #e74c3c;">🗑️ Удалить</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// Открыть модальное окно
document.getElementById('addBtn').addEventListener('click', () => {
    editingId = null;
    document.getElementById('modalTitle').textContent = 'Добавить предприятие';
    document.getElementById('enterpriseName').value = '';
    document.getElementById('enterpriseInfo').value = '';
    document.querySelectorAll('#industryCheckboxes input').forEach(cb => cb.checked = false);
    document.getElementById('modal').style.display = 'flex';
});

// Закрыть модальное окно
document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('modal').style.display = 'none';
});

// Сохранить предприятие
document.getElementById('saveBtn').addEventListener('click', async () => {
    const name = document.getElementById('enterpriseName').value.trim();
    const info = document.getElementById('enterpriseInfo').value.trim();
    const industries = Array.from(document.querySelectorAll('#industryCheckboxes input:checked')).map(cb => cb.value);

    if (!name) {
        alert('Введите название предприятия!');
        return;
    }

    if (industries.length === 0) {
        alert('Выберите хотя бы одну отрасль!');
        return;
    }

    try {
        if (editingId) {
            // Обновление
            await updateDoc(doc(db, COLLECTION_NAME, editingId), {
                name,
                info,
                industries,
                updatedAt: new Date().toISOString()
            });
        } else {
            // Добавление
            await addDoc(collection(db, COLLECTION_NAME), {
                name,
                info,
                industries,
                createdAt: new Date().toISOString()
            });
        }
        document.getElementById('modal').style.display = 'none';
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
    
    document.querySelectorAll('#industryCheckboxes input').forEach(cb => {
        cb.checked = ent.industries.includes(cb.value);
    });
    
    document.getElementById('modal').style.display = 'flex';
};

// Удалить предприятие
window.deleteEnterprise = async (id) => {
    if (!confirm('Удалить это предприятие?')) return;

    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
        console.error("Ошибка удаления:", error);
        alert("Ошибка удаления данных. Проверьте консоль.");
    }
};

// Поиск
document.getElementById('searchInput').addEventListener('input', displayEnterprises);

// Фильтр по отраслям
document.querySelectorAll('#industryFilter input').forEach(cb => {
    cb.addEventListener('change', displayEnterprises);
});

// Инициализация
checkAuth();
