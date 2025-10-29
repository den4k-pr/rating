// api/rate.js
// Vercel автоматично надає 'fetch', тому 'require' не потрібен.

const BIN_ID = "6900f54c43b1c97be987ac1d";
// !!! Встановіть цей ключ як змінну оточення (Environment Variable) на Vercel для безпеки!
const API_KEY = process.env.JSONBIN_MASTER_KEY || "$2a$10$.mM/3AtMsD1ap9ApkDduIOdz/0tt.j9613TBCoIV/equtWdmV8yky"; 
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// Функція для обробки запиту
export default async function handler(req, res) {
    // 1. Встановлення CORS/AMP Заголовків (Критично важливо для AMP-форм)
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Дозволяємо POST і OPTIONS
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-AMP-Source-Origin');
    res.setHeader('AMP-Access-Control-Allow-Source-Origin', 'https://' + req.headers.host);
    res.setHeader('Content-Type', 'application/json');

    // Обробка попередніх запитів (Preflight)
    if (req.method === 'OPTIONS') {
        return res.status(200).json({});
    }

    // 2. Очікуємо POST-запит з даними форми
    if (req.method !== 'POST') {
        return res.status(405).json({ AMP_FORM_ERROR: { message: 'Method Not Allowed' } });
    }

    try {
        // Очікуємо ID моделі з прихованого поля форми
        const { model } = req.body; 
        const modelId = parseInt(model); 

        if (isNaN(modelId)) {
            return res.status(400).json({ 
                AMP_FORM_ERROR: { message: 'Invalid model ID provided.' } 
            });
        }
        
        // --- Початок логіки оновлення JSONBin.io ---

        // A. Завантаження поточних даних
        const loadRes = await fetch(`${API_URL}/latest`, {
            headers: {"X-Master-Key": API_KEY}
        });
        const data = (await loadRes.json()).record;

        // B. Оновлення лічильника
        const targetModel = data.models.find(m => m.id === modelId);
        if (!targetModel) {
            return res.status(404).json({ 
                AMP_FORM_ERROR: { message: 'Model not found.' } 
            });
        }
        targetModel.count++;

        // C. Збереження оновлених даних
        await fetch(API_URL, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-Master-Key": API_KEY
            },
            body: JSON.stringify(data)
        });

        // --- Кінець логіки оновлення JSONBin.io ---

        // 3. Успішна відповідь (щоб AMP показав "Well done!")
        return res.status(200).json({
            success: true,
            AMP_FORM_SUCCESS: { message: `Rating for model ${modelId} submitted successfully.` }
        });

    } catch (error) {
        console.error("Vercel API Error:", error);
        // 4. Відповідь про помилку (щоб AMP показав "Error: Please, try again later.")
        return res.status(500).json({
            AMP_FORM_ERROR: { message: 'Server Error. Please, try again later.' }
        });
    }
}
