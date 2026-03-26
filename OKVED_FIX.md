# 🔧 Исправление бага с ОКВЭД

## Проблема
Код пытался получить расшифровку ОКВЭД через `data.okved_type`, но это поле содержит только год версии ОКВЭД (например "2014"), а не название вида деятельности.

## Правильная структура ответа DaData

### Основной ОКВЭД:
```json
{
  "data": {
    "okved": "24.45",
    "okved_type": "2014",  // ❌ Это не название! Это версия ОКВЭД
    "data": {
      "okved": {
        "code": "24.45",
        "name": "Производство прочих цветных металлов"  // ✅ ВОТ ОНО!
      }
    }
  }
}
```

### Дополнительные ОКВЭД:
```json
{
  "data": {
    "okveds": [
      {
        "kod": "24.45",
        "name": "Производство прочих цветных металлов",  // ✅ Правильное поле
        "type": "2014"  // ❌ Это версия, не название
      }
    ]
  }
}
```

## Внесенные исправления

### 1. Загрузка данных из ЕГРЮЛ (`loadFromEgrulBtn`)
**Было:**
```javascript
const okvedText = data.okved_type 
    ? `${data.okved} - ${data.okved_type}` 
    : data.okved;
```

**Стало:**
```javascript
let okvedName = '';
// Проверяем наличие вложенной структуры data.data.okved.name
if (result.suggestions[0].data?.data?.okved?.name) {
    okvedName = result.suggestions[0].data.data.okved.name;
}

const okvedText = okvedName 
    ? `${data.okved} - ${okvedName}` 
    : data.okved;
```

### 2. Дополнительные ОКВЭД
**Было:**
```javascript
const text = okv.type 
    ? `• ${okv.kod} - ${okv.type}` 
    : `• ${okv.kod}`;
```

**Стало:**
```javascript
const text = okv.name 
    ? `• ${okv.kod} - ${okv.name}` 
    : `• ${okv.kod}`;
```

### 3. Сохранение в базу данных
**Было:**
```javascript
const legalData = currentLegalData ? {
    okved: currentLegalData.okved,
    okvedType: currentLegalData.okved_type,  // ❌ Неправильно
    okveds: currentLegalData.okveds || [],
    // ...
} : null;
```

**Стало:**
```javascript
const legalData = currentLegalData ? {
    okved: currentLegalData.okved,
    okvedName: currentLegalData.data?.okved?.name || '',  // ✅ Правильный путь
    okveds: (currentLegalData.okveds || []).map(okv => ({
        kod: okv.kod,
        name: okv.name  // ✅ Сохраняем правильное поле name
    })),
    // ...
} : null;
```

### 4. Отображение в модальном окне просмотра
**Было:**
```javascript
const okvedText = ent.legalData.okvedType 
    ? `${escapeHtml(ent.legalData.okved)} - ${escapeHtml(ent.legalData.okvedType)}` 
    : escapeHtml(ent.legalData.okved);
```

**Стало:**
```javascript
const okvedText = ent.legalData.okvedName 
    ? `${escapeHtml(ent.legalData.okved)} - ${escapeHtml(ent.legalData.okvedName)}` 
    : escapeHtml(ent.legalData.okved);
```

### 5. Отображение при редактировании
Аналогичные исправления в функции `editEnterprise`:
- `okvedType` → `okvedName`
- `okv.type` → `okv.name`

## Добавлено логирование
Для отладки добавлено логирование полной структуры ответа DaData в консоль:
```javascript
console.log('=== ПОЛНЫЙ ОТВЕТ DADATA ===');
console.log(JSON.stringify(result.suggestions[0], null, 2));
```

## Результат
✅ Теперь приложение корректно извлекает и отображает расшифровки ОКВЭД:
- **24.45** → **24.45 - Производство прочих цветных металлов**

Вместо неправильного:
- ❌ **24.45 - 2014** (версия ОКВЭД вместо расшифровки)

## Миграция данных
⚠️ **Внимание!** Существующие записи в базе данных содержат старую структуру с `okvedType` вместо `okvedName`. 

Для корректного отображения старых записей можно:
1. Переоткрыть и пересохранить каждую запись через "Загрузить из ЕГРЮЛ"
2. Написать скрипт миграции данных (если записей много)

Новые записи будут сохраняться правильно.
