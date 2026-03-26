# 📝 Новые функции: Редактирование юридических данных + Выбор предприятий

## Задача 1: Редактирование юридической информации ✅

### Проблема
После загрузки данных из ЕГРЮЛ все поля отображались как неизменяемый текст (`<span>`), и пользователь не мог их отредактировать.

### Решение
Все поля юридической информации заменены на редактируемые `<input>` и `<textarea>` элементы.

---

### Редактируемые поля

1. **ОГРН** - `<input type="text">`
2. **Полное наименование** - `<textarea rows="2">`
3. **ОКВЭД (основной)**:
   - Код: `<input type="text">` (например, `24.45`)
   - Расшифровка: `<input type="text">` (например, `Производство прочих цветных металлов`)
4. **Юридический адрес** - `<textarea rows="2">`
5. **Дата регистрации** - `<input type="text">` (формат: `2002-08-05`)
6. **Выручка предприятия**:
   - Сумма: `<input type="number">` (в рублях)
   - Год: `<input type="number">` (например, `2023`)

---

### HTML структура

**Было (неред actor):**
```html
<div class="legal-info-item">
    <span class="legal-label">ОГРН:</span>
    <span id="legalOgrn">-</span>
</div>
```

**Стало (редактируемое):**
```html
<div>
    <label>ОГРН:</label>
    <input type="text" id="legalOgrnInput" placeholder="ОГРН">
</div>
```

---

### JavaScript изменения

#### 1. Загрузка из ЕГРЮЛ
**Было:**
```javascript
document.getElementById('legalOgrn').textContent = data.ogrn || '-';
```

**Стало:**
```javascript
document.getElementById('legalOgrnInput').value = data.ogrn || '';
```

#### 2. Сохранение данных
Теперь данные берутся из полей формы, а не из `currentLegalData`:

```javascript
const ogrnValue = document.getElementById('legalOgrnInput')?.value.trim();
const fullNameValue = document.getElementById('legalFullNameInput')?.value.trim();
const okvedCode = document.getElementById('legalOkvedCodeInput')?.value.trim();
const okvedName = document.getElementById('legalOkvedNameInput')?.value.trim();
const addressValue = document.getElementById('legalAddressInput')?.value.trim();
const regDateValue = document.getElementById('legalRegDateInput')?.value.trim();
const revenueValue = document.getElementById('legalRevenueInput')?.value;
const revenueYearValue = document.getElementById('legalRevenueYearInput')?.value;

const legalData = (inn || ogrnValue || fullNameValue || okvedCode || addressValue || regDateValue || revenueValue) ? {
    inn: inn || '',
    ogrn: ogrnValue || '',
    fullName: fullNameValue || '',
    okved: okvedCode || '',
    okvedName: okvedName || '',
    okveds: currentLegalData?.okveds || [],
    address: addressValue || '',
    registrationDate: regDateValue || '',
    revenue: revenueValue ? parseInt(revenueValue) : null,
    revenueYear: revenueYearValue ? parseInt(revenueYearValue) : null
} : null;
```

#### 3. Редактирование предприятия
При открытии формы редактирования заполняются input поля:

```javascript
if (ent.legalData) {
    document.getElementById('legalOgrnInput').value = ent.legalData.ogrn || '';
    document.getElementById('legalFullNameInput').value = ent.legalData.fullName || '';
    document.getElementById('legalOkvedCodeInput').value = ent.legalData.okved || '';
    document.getElementById('legalOkvedNameInput').value = ent.legalData.okvedName || '';
    document.getElementById('legalAddressInput').value = ent.legalData.address || '';
    document.getElementById('legalRegDateInput').value = ent.legalData.registrationDate || '';
    document.getElementById('legalRevenueInput').value = ent.legalData.revenue || '';
    document.getElementById('legalRevenueYearInput').value = ent.legalData.revenueYear || '';
}
```

#### 4. Сброс при создании нового
```javascript
document.getElementById('legalOgrnInput').value = '';
document.getElementById('legalFullNameInput').value = '';
document.getElementById('legalOkvedCodeInput').value = '';
document.getElementById('legalOkvedNameInput').value = '';
document.getElementById('legalAddressInput').value = '';
document.getElementById('legalRegDateInput').value = '';
document.getElementById('legalRevenueInput').value = '';
document.getElementById('legalRevenueYearInput').value = '';
```

---

### Workflow

1. **Создание нового предприятия:**
   - Ввести ИНН
   - Нажать "🔍 Загрузить из ЕГРЮЛ"
   - Поля автоматически заполняются
   - Пользователь может **отредактировать** любое значение
   - Нажать "💾 Сохранить"

2. **Редактирование существующего:**
   - Открыть предприятие на редактирование
   - Поля заполняются сохранёнными данными
   - Пользователь может изменить любое поле
   - Сохранить изменения

3. **Ручной ввод (без ЕГРЮЛ):**
   - Можно заполнить поля вручную
   - Сохраняются как есть

---

## Задача 2: Выбор предприятий на главной странице ✅

### Функциональность

Добавлена возможность выбирать предприятия на главной странице для быстрой выгрузки их почт.

---

### UI элементы

#### 1. Чекбокс на каждой карточке
```html
<input type="checkbox" 
       class="enterprise-select-cb" 
       data-enterprise-id="${ent.id}" 
       style="position: absolute; top: 15px; right: 15px; width: 20px; height: 20px; cursor: pointer;">
```

Расположение: **правый верхний угол** карточки предприятия

#### 2. Панель управления выбором
Появляется, когда выбрано хотя бы одно предприятие:

```html
<div id="selectionPanel" style="display: none;">
    <span id="selectedCount">0</span> предприятий выбрано
    
    [✅ Выбрать все]
    [❌ Снять выбор]
    [📧 Выгрузить почты выбранных]
</div>
```

**Расположение:** Над списком предприятий

---

### Кнопки управления

#### Выбрать все
```javascript
document.querySelectorAll('.enterprise-select-cb').forEach(cb => {
    cb.checked = true;
});
```
Выбирает все видимые предприятия (с учётом фильтров).

#### Снять выбор
```javascript
document.querySelectorAll('.enterprise-select-cb').forEach(cb => {
    cb.checked = false;
});
```
Снимает выбор со всех предприятий.

#### Выгрузить почты выбранных
Открывает модальное окно с почтами выбранных предприятий.

---

### Формат выгрузки

**Для выбранных предприятий (через чекбоксы):**
```
email1@mail.ru, email2@mail.ru, email3@mail.ru
```
✅ Простой список через запятую  
✅ БЕЗ нумерации  
✅ БЕЗ названий компаний  

**Для фильтрованных предприятий (через кнопку в header):**
```
1. АО "Компания А" - email1@mail.ru
2. ООО "Компания Б" - email2@mail.ru, email3@mail.ru
```
✅ Нумерованный список  
✅ С названиями компаний  

---

### Логика выгрузки

```javascript
document.getElementById('exportSelectedMailingBtn').addEventListener('click', () => {
    // Получаем ID выбранных предприятий
    const selectedIds = Array.from(document.querySelectorAll('.enterprise-select-cb:checked'))
        .map(cb => cb.dataset.enterpriseId);
    
    if (selectedIds.length === 0) {
        alert('Выберите хотя бы одно предприятие!');
        return;
    }
    
    // Фильтруем предприятия
    const selectedEnterprises = enterprises.filter(ent => selectedIds.includes(ent.id));
    
    // Собираем почты (удаление дубликатов)
    const allEmails = [];
    selectedEnterprises.forEach(ent => {
        if (ent.mailingEmails && ent.mailingEmails.length > 0) {
            ent.mailingEmails.forEach(email => {
                if (!allEmails.includes(email)) {
                    allEmails.push(email);
                }
            });
        }
    });
    
    // Формат: простой список через запятую
    const resultText = allEmails.join(', ');
    
    // Отображение
    document.getElementById('mailingCount').textContent = 
        `Выбрано предприятий: ${selectedIds.length} | Всего почт: ${allEmails.length}`;
    document.getElementById('mailingEmailsText').value = resultText;
    document.getElementById('mailingResultModal').style.display = 'flex';
});
```

---

### Автообновление счётчика

Функция `updateSelectionPanel()` вызывается при:
- Клике на чекбокс
- Нажатии "Выбрать все"
- Нажатии "Снять выбор"
- Перерисовке списка предприятий

```javascript
function updateSelectionPanel() {
    const selectedCheckboxes = document.querySelectorAll('.enterprise-select-cb:checked');
    const count = selectedCheckboxes.length;
    
    const panel = document.getElementById('selectionPanel');
    const countSpan = document.getElementById('selectedCount');
    
    if (count > 0) {
        panel.style.display = 'block';  // Показываем панель
        countSpan.textContent = count;
    } else {
        panel.style.display = 'none';   // Скрываем панель
    }
}
```

---

### Примеры использования

#### Пример 1: Выбрать 3 предприятия
1. Поставить галочки на 3 карточках
2. Появляется панель: "3 предприятий выбрано"
3. Нажать "📧 Выгрузить почты выбранных"
4. Получить список: `email1@mail.ru, email2@mail.ru, email3@mail.ru`

#### Пример 2: Выбрать все металлургические
1. Применить фильтр "Металлургия"
2. Нажать "✅ Выбрать все"
3. Все металлургические предприятия выбраны
4. Нажать "📧 Выгрузить почты выбранных"

#### Пример 3: Снять выбор
1. После выбора нескольких предприятий
2. Нажать "❌ Снять выбор"
3. Все чекбоксы сняты
4. Панель скрывается

---

### Различия в выгрузке

| Способ | Формат | Когда использовать |
|--------|--------|-------------------|
| **Через чекбоксы** | `email1, email2, email3` | Для конкретных предприятий |
| **Через кнопку header** | `1. Компания - email` | Для группы по фильтрам |

---

### CSS стили

```css
.enterprise-select-cb {
    position: absolute;
    top: 15px;
    right: 15px;
    width: 20px;
    height: 20px;
    cursor: pointer;
}

#selectionPanel {
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 12px;
    padding: 15px;
    margin-bottom: 20px;
}
```

---

## ✅ Итог

### Задача 1 - Редактирование юридической информации:
- ✅ Все поля юридической информации редактируемые
- ✅ Автозаполнение из ЕГРЮЛ
- ✅ Возможность ручной правки
- ✅ Сохранение в Firestore
- ✅ Корректная загрузка при редактировании

### Задача 2 - Выбор предприятий:
- ✅ Чекбоксы на карточках (правый верхний угол)
- ✅ Панель управления выбором
- ✅ Кнопки "Выбрать все" / "Снять выбор"
- ✅ Выгрузка почт выбранных (простой список через запятую)
- ✅ Счётчик выбранных предприятий
- ✅ Автоматическое скрытие/показ панели
- ✅ Удаление дубликатов email
