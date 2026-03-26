# 💰 Добавлена выручка предприятия

## Описание

Добавлено отображение выручки предприятия из данных DaData API.

## Источник данных

Из ответа DaData `findById/party`:
```json
{
  "data": {
    "finance": {
      "revenue": 123456789,  // Выручка в рублях
      "year": 2023          // Год данных
    }
  }
}
```

## Реализованная функциональность

### 1. Загрузка из ЕГРЮЛ
При нажатии кнопки "🔍 Загрузить из ЕГРЮЛ":
- Получается `data.finance.revenue` и `data.finance.year`
- Отображается в секции "Юридическая информация"
- Формат: `123 456 789 ₽ (2023 г.)`
- Если данных нет: `Нет данных`

**Код:**
```javascript
// Выручка предприятия
if (data.finance && data.finance.revenue !== null && data.finance.revenue !== undefined) {
    const revenue = data.finance.revenue;
    const year = data.finance.year || 'н/д';
    const formattedRevenue = new Intl.NumberFormat('ru-RU').format(revenue);
    document.getElementById('legalRevenue').textContent = `${formattedRevenue} ₽ (${year} г.)`;
} else {
    document.getElementById('legalRevenue').textContent = 'Нет данных';
}
```

### 2. Отображение в HTML (index.html)

Добавлен элемент в секцию "Юридическая информация":
```html
<div class="legal-info-item">
    <span class="legal-label">Выручка предприятия:</span>
    <span id="legalRevenue">-</span>
</div>
```

### 3. Сохранение в Firestore

В `legalData` добавлены поля:
```javascript
const legalData = currentLegalData ? {
    // ... другие поля
    revenue: currentLegalData.finance?.revenue || null,      // Выручка в рублях
    revenueYear: currentLegalData.finance?.year || null      // Год данных
} : null;
```

### 4. Отображение в модальном окне просмотра (viewEnterprise)

```javascript
// Выручка предприятия
if (ent.legalData.revenue !== null && ent.legalData.revenue !== undefined) {
    const formattedRevenue = new Intl.NumberFormat('ru-RU').format(ent.legalData.revenue);
    const year = ent.legalData.revenueYear || 'н/д';
    html += `<div style="display: grid; grid-template-columns: 180px 1fr; gap: 10px;">
        <span style="color: #9ca3af; font-weight: 600; font-size: 0.9em;">Выручка предприятия:</span>
        <span style="color: #d1d5db;">${formattedRevenue} ₽ (${year} г.)</span>
    </div>`;
} else {
    html += `<div style="display: grid; grid-template-columns: 180px 1fr; gap: 10px;">
        <span style="color: #9ca3af; font-weight: 600; font-size: 0.9em;">Выручка предприятия:</span>
        <span style="color: #d1d5db;">Нет данных</span>
    </div>`;
}
```

### 5. Отображение при редактировании (editEnterprise)

```javascript
// Выручка
if (ent.legalData.revenue !== null && ent.legalData.revenue !== undefined) {
    const formattedRevenue = new Intl.NumberFormat('ru-RU').format(ent.legalData.revenue);
    const year = ent.legalData.revenueYear || 'н/д';
    document.getElementById('legalRevenue').textContent = `${formattedRevenue} ₽ (${year} г.)`;
} else {
    document.getElementById('legalRevenue').textContent = 'Нет данных';
}
```

### 6. Экспорт в CSV

Добавлена колонка "Выручка" в экспорт:

**Заголовок:**
```csv
Название;Информация;Отрасли;Категории;ИНН;ОГРН;ОКВЭД;Юридический адрес;Выручка;Контакты
```

**Данные:**
```javascript
// Выручка
let revenueStr = '';
if (ent.legalData?.revenue !== null && ent.legalData?.revenue !== undefined) {
    const formattedRevenue = new Intl.NumberFormat('ru-RU').format(ent.legalData.revenue);
    const year = ent.legalData.revenueYear || 'н/д';
    revenueStr = `${formattedRevenue} ₽ (${year} г.)`;
} else {
    revenueStr = 'Нет данных';
}
```

## Форматирование

Используется `Intl.NumberFormat('ru-RU')` для форматирования числа:
- `123456789` → `123 456 789`
- Пробелы между разрядами (российский стандарт)

## Примеры отображения

### Когда данные есть:
```
Выручка предприятия: 123 456 789 ₽ (2023 г.)
```

### Когда данных нет:
```
Выручка предприятия: Нет данных
```

### Когда год неизвестен:
```
Выручка предприятия: 123 456 789 ₽ (н/д г.)
```

## Структура данных в Firestore

```javascript
{
  "legalData": {
    "inn": "7707083893",
    "ogrn": "1027700132195",
    "fullName": "Публичное акционерное общество ...",
    "okved": "24.45",
    "okvedName": "Производство прочих цветных металлов",
    "okveds": [...],
    "address": "...",
    "registrationDate": "2002-08-05",
    "revenue": 123456789,        // ⭐ НОВОЕ
    "revenueYear": 2023          // ⭐ НОВОЕ
  }
}
```

## Обработка edge cases

✅ `revenue === null` → "Нет данных"  
✅ `revenue === undefined` → "Нет данных"  
✅ `revenue === 0` → "0 ₽ (год г.)"  
✅ `year === null` → "123 456 789 ₽ (н/д г.)"  
✅ Нет объекта `finance` → "Нет данных"

## Бонус: исправлена ошибка в экспорте ОКВЭД

Попутно исправлена ошибка в функции экспорта CSV:

**Было (неправильно):**
```javascript
const mainOkved = ent.legalData.okvedType  // ❌ okvedType - это версия!
    ? `${ent.legalData.okved} - ${ent.legalData.okvedType}` 
    : ent.legalData.okved;
```

**Стало (правильно):**
```javascript
const mainOkved = ent.legalData.okvedName  // ✅ okvedName - это расшифровка
    ? `${ent.legalData.okved} - ${ent.legalData.okvedName}` 
    : ent.legalData.okved;
```

## Тестирование

1. Открыть приложение
2. Добавить новое предприятие
3. Ввести ИНН (например: 7707083893)
4. Нажать "🔍 Загрузить из ЕГРЮЛ"
5. Проверить отображение выручки в секции "Юридическая информация"
6. Сохранить предприятие
7. Открыть предприятие на просмотр → выручка отображается
8. Редактировать предприятие → выручка отображается
9. Экспортировать в CSV → колонка "Выручка" присутствует

## ✅ Итог

Добавлена полная поддержка выручки предприятия:
- ✅ Загрузка из DaData API
- ✅ Отображение в форме редактирования
- ✅ Отображение в модальном окне просмотра
- ✅ Сохранение в Firestore
- ✅ Экспорт в CSV
- ✅ Правильное форматирование с пробелами
- ✅ Обработка всех edge cases
