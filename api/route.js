module.exports = async (req, res) => {
    // 1. Обов'язкові заголовки для AMP CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-AMP-Source-Origin');
    res.setHeader('AMP-Access-Control-Allow-Source-Origin', 'https://' + req.headers.host);
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).json({}); // Обробка Preflight
    }

    try {
        // 2. Отримання ID моделі з тіла POST-запиту
        const modelId = req.body.model; 

        if (!modelId) {
            return res.status(400).json({ AMP_FORM_ERROR: { message: 'Model ID is missing.' } });
        }

        // 3. Тут ви виконуєте ЛОГІКУ ОНОВЛЕННЯ ЛІЧИЛЬНИКА (як у вашій функції addRating)
        // ... (Код завантаження, оновлення лічильника та збереження в jsonbin.io) ...
        
        // **Приклад: Запуск вашої логіки оновлення JSONBIN.IO тут **

        // ...

        // 4. Повернення успішної відповіді AMP
        return res.status(200).json({ 
            AMP_FORM_SUCCESS: { message: `Модель ${modelId} оцінена.` } 
        });

    } catch (error) {
        // 5. Повернення відповіді про помилку AMP
        return res.status(500).json({ 
            AMP_FORM_ERROR: { message: 'Error! Please, try again later.' } 
        });
    }
};