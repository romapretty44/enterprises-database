// Скрипт для удаления "ОПК" из коллекции industries (если он там случайно попал)
// "ОПК" должен быть только в категориях!

import { db, collection, getDocs, deleteDoc, doc } from './firebase-init.js';

const INDUSTRIES_COLLECTION = 'industries';

async function removeOPKFromIndustries() {
    console.log('🔍 Проверяем коллекцию industries на наличие "ОПК"...');
    
    try {
        const querySnapshot = await getDocs(collection(db, INDUSTRIES_COLLECTION));
        let found = false;
        
        for (const docSnapshot of querySnapshot.docs) {
            const data = docSnapshot.data();
            if (data.name === 'ОПК') {
                console.log(`❌ Найден "ОПК" в отраслях (ID: ${docSnapshot.id}). Удаляем...`);
                await deleteDoc(doc(db, INDUSTRIES_COLLECTION, docSnapshot.id));
                console.log('✅ "ОПК" успешно удалён из отраслей!');
                found = true;
            }
        }
        
        if (!found) {
            console.log('✅ "ОПК" не найден в отраслях. Всё правильно!');
            console.log('📋 Текущие отрасли:');
            querySnapshot.forEach((doc) => {
                console.log(`  - ${doc.data().name}`);
            });
        }
        
        console.log('\n✅ Проверка завершена!');
        
    } catch (error) {
        console.error('❌ Ошибка при проверке/удалении:', error);
    }
}

// Запускаем
removeOPKFromIndustries();
