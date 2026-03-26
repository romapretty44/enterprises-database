# 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: ОКВЭД расшифровка через API

## ❌ Проблема

API `findById/party` **НЕ возвращает** название ОКВЭД в структуре `data.data.okved.name`.

Он возвращает только:
```json
{
  "okved": "24.45",
  "okved_type": "2014"  // Только версию справочника!
}
```

## ✅ Решение

Использовать **отдельный API endpoint** для получения расшифровки ОКВЭД:

```
POST https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/okved2
```

### Реализованная функция:

```javascript
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
            const name = fullValue.replace(/^[\d.]+\s*/, ''); // Убираем код
            return name;
        }
        return '';
    } catch (error) {
        console.error('Ошибка получения расшифровки ОКВЭД:', error);
        return '';
    }
}
```

## 📝 Внесенные изменения

### 1. Добавлена константа для API ОКВЭД
```javascript
const DADATA_OKVED_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/okved2';
```

### 2. Добавлена функция `getOkvedName(code)`
Выполняет отдельный запрос к API для получения расшифровки по коду ОКВЭД.

### 3. Изменен обработчик загрузки из ЕГРЮЛ

**Основной ОКВЭД:**
```javascript
if (data.okved) {
    document.getElementById('legalOkved').textContent = '⏳ Загрузка расшифровки...';
    const okvedName = await getOkvedName(data.okved);
    
    const okvedText = okvedName 
        ? `${data.okved} - ${okvedName}` 
        : data.okved;
    document.getElementById('legalOkved').textContent = okvedText;
    
    // Сохраняем расшифровку в currentLegalData
    currentLegalData.okvedName = okvedName;
}
```

**Дополнительные ОКВЭД (параллельная загрузка):**
```javascript
if (data.okveds && data.okveds.length > 0) {
    document.getElementById('legalOkveds').innerHTML = '⏳ Загрузка расшифровок...';
    
    // Загружаем расшифровки параллельно
    const okvedsWithNames = await Promise.all(
        data.okveds.map(async (okv) => {
            const name = await getOkvedName(okv.kod);
            return { kod: okv.kod, name: name };
        })
    );
    
    // Сохраняем в currentLegalData
    currentLegalData.okveds = okvedsWithNames;
    
    // Отображаем
    const okvedsHtml = okvedsWithNames.map(okv => {
        const text = okv.name 
            ? `<div style="margin-bottom: 5px;">• ${okv.kod} - ${okv.name}</div>` 
            : `<div style="margin-bottom: 5px;">• ${okv.kod}</div>`;
        return text;
    }).join('');
    document.getElementById('legalOkveds').innerHTML = okvedsHtml;
}
```

### 4. Обновлено сохранение в базу данных

**Было:**
```javascript
okvedName: currentLegalData.data?.okved?.name || '', // ❌ Не работает
okveds: (currentLegalData.okveds || []).map(okv => ({
    kod: okv.kod,
    name: okv.name
})),
```

**Стало:**
```javascript
okvedName: currentLegalData.okvedName || '', // ✅ Получено через API
okveds: currentLegalData.okveds || [], // ✅ Уже содержит { kod, name }
```

## 🚀 Результат

### До исправления:
```
24.45 - 2014  ❌ (версия справочника вместо названия)
```

### После исправления:
```
24.45 - Производство прочих цветных металлов  ✅
```

## ⚡ Производительность

- **Основной ОКВЭД:** 1 дополнительный API запрос
- **Дополнительные ОКВЭД:** N параллельных запросов (через `Promise.all`)
- Индикация загрузки: "⏳ Загрузка расшифровки..." → плавный UX

## 🔍 Отладка

Полный ответ DaData логируется в консоль:
```javascript
console.log('=== ПОЛНЫЙ ОТВЕТ DADATA ===');
console.log(JSON.stringify(result.suggestions[0], null, 2));
```

## ✅ Тестирование

1. Открыть `index.html`
2. Войти в систему (пароль: 444455555)
3. Нажать "➕ Добавить предприятие"
4. Ввести любой ИНН (например: 7707083893)
5. Нажать "🔍 Загрузить из ЕГРЮЛ"
6. Проверить:
   - ✅ Основной ОКВЭД отображается с расшифровкой
   - ✅ Дополнительные ОКВЭД отображаются с расшифровками
   - ✅ При сохранении расшифровки попадают в базу
   - ✅ При просмотре предприятия расшифровки отображаются корректно

## 📊 API Endpoints используемые приложением

1. **`findById/party`** - получение данных организации по ИНН
   - Возвращает: название, адрес, ОГРН, коды ОКВЭД, руководителя
   
2. **`suggest/okved2`** ⭐ НОВЫЙ - получение расшифровки ОКВЭД по коду
   - Запрос: `{ "query": "24.45" }`
   - Ответ: `{ "value": "24.45 Производство прочих цветных металлов", ... }`

## 🎯 Итог

✅ ОКВЭД теперь корректно расшифровываются через официальный API DaData
✅ Поддержка множественных ОКВЭД с параллельной загрузкой
✅ Индикация процесса загрузки для лучшего UX
✅ Сохранение расшифровок в базу данных
