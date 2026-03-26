# 📧📋 Две кнопки выгрузки: Почты для рассылки

## Описание

Добавлена **вторая кнопка выгрузки** с другим форматом результата.

Теперь есть **два режима выгрузки** с разными форматами вывода.

---

## Кнопки в header

```
[📧 Выгрузка рассылки]  [📋 Список рассылки]
```

Обе кнопки открывают одно и то же модальное окно с фильтрами, но формат результата отличается.

---

## Форматы выгрузки

### 1. 📧 Выгрузка рассылки (простой список)

**Назначение:** Для копирования в поле BCC почтового клиента

**Формат:**
```
email1@mail.ru, email2@mail.ru, email3@mail.ru, email4@mail.ru, email5@mail.ru
```

**Характеристики:**
- ✅ Простой список через запятую с пробелом
- ✅ Только email адреса
- ✅ БЕЗ названий компаний
- ✅ БЕЗ нумерации
- ✅ Удаление дубликатов

**Использование:**
1. Скопировать все почты
2. Вставить в поле **BCC** почтового клиента
3. Отправить массовую рассылку (каждый получатель не видит других)

---

### 2. 📋 Список рассылки (нумерованный)

**Назначение:** Для учёта и контроля рассылки

**Формат:**
```
1. АО "Кольская ГМК" - info@kgmk.ru
2. ООО "Судоремонтный завод" - mail@zavod.ru, director@zavod.ru
3. ИП Иванов И.И. - ivan@business.ru
4. ПАО "Машиностроительный завод" - contact@machinery.ru, sales@machinery.ru
```

**Характеристики:**
- ✅ Нумерованный список (1, 2, 3, ...)
- ✅ Название каждой компании
- ✅ Все почты компании через запятую
- ✅ Удобно для учёта и проверки

**Использование:**
1. Скопировать весь список
2. Вставить в документ/таблицу для контроля
3. Отметить, кому отправлено
4. Вести учёт откликов

---

## Кнопки в панели выбора

При выборе предприятий через чекбоксы появляется панель с кнопками:

```
[✅ Выбрать все]  [❌ Снять выбор]  [📧 Выгрузить почты выбранных]  [📋 Список рассылки]
```

---

## Логика работы

### Переменная режима

```javascript
let currentMailingMode = 'simple'; // 'simple' или 'numbered'
```

### Установка режима при клике

**Кнопка "📧 Выгрузка рассылки":**
```javascript
document.getElementById('mailingBtn').addEventListener('click', () => {
    currentMailingMode = 'simple';
    openMailingFilterModal();
});
```

**Кнопка "📋 Список рассылки":**
```javascript
document.getElementById('mailingListBtn').addEventListener('click', () => {
    currentMailingMode = 'numbered';
    openMailingFilterModal();
});
```

---

### Универсальная функция выгрузки

```javascript
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
        // Нумерованный список с названиями компаний (для учёта)
        const mailingList = [];
        let index = 1;
        
        filtered.forEach(ent => {
            const companyName = ent.name;
            const emails = ent.mailingEmails.join(', ');
            mailingList.push(`${index}. ${companyName} - ${emails}`);
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
```

---

## Выгрузка выбранных предприятий

### Простой список (📧)

```javascript
document.getElementById('exportSelectedMailingBtn').addEventListener('click', () => {
    const selectedIds = Array.from(document.querySelectorAll('.enterprise-select-cb:checked'))
        .map(cb => cb.dataset.enterpriseId);
    
    const selectedEnterprises = enterprises.filter(ent => 
        selectedIds.includes(ent.id) && 
        ent.mailingEmails && 
        ent.mailingEmails.length > 0
    );
    
    // Собираем все почты в простой список
    const allEmails = [];
    selectedEnterprises.forEach(ent => {
        ent.mailingEmails.forEach(email => {
            if (!allEmails.includes(email)) {
                allEmails.push(email);
            }
        });
    });
    
    const resultText = allEmails.join(', ');
    // ...
});
```

### Нумерованный список (📋)

```javascript
document.getElementById('exportSelectedMailingListBtn').addEventListener('click', () => {
    const selectedIds = Array.from(document.querySelectorAll('.enterprise-select-cb:checked'))
        .map(cb => cb.dataset.enterpriseId);
    
    const selectedEnterprises = enterprises.filter(ent => 
        selectedIds.includes(ent.id) && 
        ent.mailingEmails && 
        ent.mailingEmails.length > 0
    );
    
    // Формируем нумерованный список
    const mailingList = [];
    let index = 1;
    
    selectedEnterprises.forEach(ent => {
        const companyName = ent.name;
        const emails = ent.mailingEmails.join(', ');
        mailingList.push(`${index}. ${companyName} - ${emails}`);
        index++;
    });
    
    const resultText = mailingList.join('\n');
    // ...
});
```

---

## Сравнение форматов

| Критерий | 📧 Выгрузка рассылки | 📋 Список рассылки |
|----------|---------------------|-------------------|
| **Формат** | `email1, email2, email3` | `1. Компания - email1, email2` |
| **Названия компаний** | ❌ Нет | ✅ Да |
| **Нумерация** | ❌ Нет | ✅ Да (1, 2, 3...) |
| **Назначение** | Для BCC рассылки | Для учёта и контроля |
| **Копирование** | В поле BCC | В документ/таблицу |
| **Удобство** | Быстро скопировать | Видно структуру |

---

## Примеры использования

### Пример 1: Массовая рассылка через BCC

**Задача:** Отправить письмо всем металлургическим предприятиям

**Действия:**
1. Нажать "📧 Выгрузка рассылки"
2. Выбрать фильтр "Металлургия"
3. Нажать "Выгрузить почты"
4. Скопировать: `info@metal1.ru, contact@metal2.ru, ...`
5. Вставить в поле **BCC** почтового клиента
6. Написать письмо и отправить

**Результат:** Каждый получатель не видит других адресатов ✅

---

### Пример 2: Учёт рассылки для отчёта

**Задача:** Составить список предприятий ОПК для отчёта о рассылке

**Действия:**
1. Нажать "📋 Список рассылки"
2. Выбрать фильтр "ОПК"
3. Нажать "Выгрузить почты"
4. Скопировать нумерованный список
5. Вставить в Excel/Word
6. Добавить колонку "Статус отправки"

**Результат:**
```
1. ПАО "Машзавод" - info@zavod.ru      | ✅ Отправлено
2. АО "Спецтехника" - mail@spec.ru     | ⏳ В процессе
3. ООО "ОПК Комплект" - office@opk.ru  | ✅ Отправлено
```

---

### Пример 3: Выбранные предприятия

**Задача:** Отправить письмо 5 конкретным предприятиям

**Действия:**
1. Поставить галочки на нужных карточках (5 штук)
2. Нажать "📧 Выгрузить почты выбранных" (простой список)
3. Скопировать в BCC

**Альтернатива:**
1. Те же 5 галочек
2. Нажать "📋 Список рассылки" (нумерованный)
3. Получить список с названиями для контроля

---

## Workflow сценарии

### Сценарий 1: Еженедельная рассылка новостей

1. **Подготовка:** "📋 Список рассылки" → Экспорт в Excel
2. **Проверка:** Просмотр списка, удаление ненужных
3. **Отправка:** "📧 Выгрузка рассылки" → BCC поле Gmail
4. **Отчёт:** Отметить в Excel "Отправлено 26.03.2026"

### Сценарий 2: Целевая рассылка по отрасли

1. Фильтр "Металлургия" + "ОПК"
2. "📋 Список рассылки" → Проверка, кто попал
3. "📧 Выгрузка рассылки" → Копирование в BCC
4. Отправка специального предложения

### Сценарий 3: Выборочная рассылка

1. Выбрать через чекбоксы 10 предприятий
2. "📋 Список рассылки" → Убедиться, что выбрали правильные
3. "📧 Выгрузить почты выбранных" → BCC
4. Отправить персонализированное письмо

---

## HTML элементы

### Header кнопки:
```html
<button id="mailingBtn" class="export-btn">📧 Выгрузка рассылки</button>
<button id="mailingListBtn" class="export-btn">📋 Список рассылки</button>
```

### Панель выбора кнопки:
```html
<button id="exportSelectedMailingBtn" class="save-btn">📧 Выгрузить почты выбранных</button>
<button id="exportSelectedMailingListBtn" class="save-btn">📋 Список рассылки</button>
```

---

## Различия в коде

**Простой список (удаление дубликатов):**
```javascript
const allEmails = [];
filtered.forEach(ent => {
    ent.mailingEmails.forEach(email => {
        if (!allEmails.includes(email)) {  // Проверка дубликатов
            allEmails.push(email);
        }
    });
});
const resultText = allEmails.join(', ');
```

**Нумерованный список (с названиями):**
```javascript
const mailingList = [];
let index = 1;
filtered.forEach(ent => {
    const companyName = ent.name;
    const emails = ent.mailingEmails.join(', ');
    mailingList.push(`${index}. ${companyName} - ${emails}`);
    index++;
});
const resultText = mailingList.join('\n');
```

---

## ✅ Итог

**Две кнопки = два формата:**

1. **📧 Выгрузка рассылки**
   - Простой список через запятую
   - Для BCC рассылки
   - Быстрое копирование

2. **📋 Список рассылки**
   - Нумерованный список с названиями
   - Для учёта и контроля
   - Структурированный формат

**Обе работают с:**
- ✅ Фильтрами (отрасли + категории)
- ✅ Выбранными предприятиями (чекбоксы)
- ✅ Удалением дубликатов email
- ✅ Подсчётом статистики

**Универсальность:** Одна логика фильтрации, разные форматы вывода!
