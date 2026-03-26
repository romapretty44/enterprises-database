# Инструкция по деплою - База предприятий

## 🚀 Быстрый старт

### 1. Деплой на Firebase Hosting

```bash
cd /root/.openclaw/workspace/enterprises-database

# Логин в Firebase (если нужно)
firebase login

# Деплой всего проекта
firebase deploy
```

Или по отдельности:

```bash
# Только Firestore правила
firebase deploy --only firestore:rules

# Только Storage правила
firebase deploy --only storage:rules

# Только Hosting
firebase deploy --only hosting
```

### 2. Проверка после деплоя

1. Откройте браузер и перейдите на URL hosting:
   ```
   https://enterprises-database.web.app
   ```

2. Войдите с паролем: `444455555`

3. Протестируйте основные функции (см. TESTING.md)

### 3. Настройка Firebase Storage (если еще не настроено)

1. Откройте Firebase Console: https://console.firebase.google.com/
2. Выберите проект `enterprises-database`
3. Перейдите в раздел "Storage"
4. Если Storage не активирован:
   - Нажмите "Get Started"
   - Выберите режим "Production mode"
   - Выберите region (например, europe-west1)
5. Деплойте правила Storage:
   ```bash
   firebase deploy --only storage:rules
   ```

### 4. Проверка Firestore

1. Откройте Firebase Console → Firestore Database
2. Убедитесь, что созданы коллекции:
   - `enterprises` - основная коллекция
   - `trash` - корзина (создастся при первом удалении)
   - `industries` - список отраслей (создастся автоматически)

### 5. Инициализация базовых данных

При первом запуске приложение автоматически создаст коллекцию `industries` с базовыми отраслями:
- Промышленность
- Судоремонт
- Добыча
- Обработка
- Лёгкая промышленность
- Рыбная отрасль
- Металлургия
- Лесная промышленность
- ОПК
- Машиностроение
- АПК
- Проект

## 🔒 Безопасность

### Текущее состояние
- Авторизация: жёсткий пароль в коде (`444455555`)
- Firestore: открытый доступ для чтения/записи
- Storage: открытый доступ для загрузки файлов в папку `/enterprises/`

### Рекомендации для продакшна

#### 1. Firebase Authentication
Добавьте Firebase Auth для нормальной авторизации:

```javascript
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const auth = getAuth();
signInWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    // Успешный вход
  });
```

#### 2. Firestore Rules
Обновите `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Требуется авторизация
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

#### 3. Storage Rules
Обновите `storage.rules`:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /enterprises/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 📊 Мониторинг

### Firebase Console
Регулярно проверяйте:
1. **Firestore Usage** - количество чтений/записей
2. **Storage Usage** - объём загруженных файлов
3. **Hosting Bandwidth** - трафик сайта

### Квоты бесплатного плана (Spark)
- Firestore: 50,000 чтений/день
- Firestore: 20,000 записей/день
- Storage: 5 GB хранения
- Storage: 1 GB загрузки/день
- Hosting: 10 GB хранения
- Hosting: 360 MB/день трафика

## 🛠️ Обслуживание

### Резервное копирование

#### Экспорт Firestore
```bash
# Через Firebase Console
# Firestore → Import/Export → Export

# Или через gcloud CLI
gcloud firestore export gs://enterprises-database.appspot.com/firestore-backups
```

#### Резервное копирование Storage
```bash
# Через gsutil
gsutil -m cp -r gs://enterprises-database.appspot.com/enterprises ./backup/
```

### Очистка корзины

Создайте Cloud Function для автоматической очистки старых записей в корзине (>30 дней):

```javascript
// Пример Cloud Function
exports.cleanTrash = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 дней
    const snapshot = await db.collection('trash')
      .where('deletedAt', '<', new Date(cutoff).toISOString())
      .get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  });
```

## 🐛 Отладка

### Проблема: файлы не загружаются
1. Проверьте консоль браузера (F12)
2. Убедитесь, что Storage активирован
3. Проверьте правила Storage
4. Проверьте CORS настройки

### Проблема: данные не сохраняются
1. Проверьте консоль браузера
2. Проверьте Firestore правила
3. Убедитесь, что Firebase SDK подключён корректно
4. Проверьте Network вкладку (запросы к Firestore)

### Проблема: фильтры не работают
1. Проверьте консоль на JS ошибки
2. Убедитесь, что коллекция `industries` существует
3. Очистите кэш браузера
4. Проверьте real-time listeners

## 📱 Производительность

### Оптимизация
1. **Firestore**: используйте индексы для сложных запросов
2. **Storage**: оптимизируйте размер загружаемых файлов
3. **Hosting**: включите CDN кэширование
4. **App**: минифицируйте CSS/JS для продакшна

### Индексы Firestore
Если нужны сложные запросы, добавьте в `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "enterprises",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "industries", "arrayConfig": "CONTAINS" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## 📞 Поддержка

При проблемах с деплоем:
1. Проверьте Firebase Console на ошибки
2. Посмотрите логи: `firebase functions:log`
3. Проверьте статус Firebase: https://status.firebase.google.com/

---

**Последнее обновление:** 26.03.2026  
**Firebase Project ID:** enterprises-database  
**Hosting URL:** https://enterprises-database.web.app
