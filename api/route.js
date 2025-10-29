import { URLSearchParams } from 'url';

const BIN_ID = "6900f54c43b1c97be987ac1d";
const API_KEY = process.env.JSONBIN_MASTER_KEY || "$2a$10$.mM/3AtMsD1ap9ApkDduIOdz/0tt.j9613TBCoIV/equtWdmV8yky"; 
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// Відновлюємо функцію для надійного парсингу body
async function parseFormBody(req) {
    // 1. Спробувати нативний req.body (працює для JSON/Next.js)
    if (req.body && Object.keys(req.body).length > 0) {
        return req.body;
    }

    // 2. Якщо native body порожній, спробувати парсити сирі дані
    const rawBody = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => data += chunk.toString());
        req.on('end', () => resolve(data));
    });

    if (!rawBody) return {};
    
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(rawBody);
        const body = {};
        for (const [key, value] of params.entries()) {
            body[key] = value;
        }
        return body;
    } 
    
    if (contentType.includes('application/json')) {
        try {
            return JSON.parse(rawBody);
        } catch (e) {
            // Якщо парсинг JSON не вдався, це може бути порожнє або пошкоджене тіло
            return {};
        }
    }
    
    return {};
}


export default async function handler(req, res) {
    // 1. Встановлення CORS/AMP Заголовків
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-AMP-Source-Origin');
    res.setHeader('AMP-Access-Control-Allow-Source-Origin', 'https://' + req.headers.host);
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).json({});
    }
    
    // 2. Отримання та парсинг даних форми
    const body = await parseFormBody(req);
    
    try {
        // 3. ЧИТАЄМО ЗНАЧЕННЯ З ТІЛА ЗАПИТУ
        const model = body.model; 
        const modelId = parseInt(model); 

        if (isNaN(modelId)) {
            // Це поверне помилку 400, якщо model не була передана з форми
            return res.status(400).json({ 
                AMP_FORM_ERROR: { message: 'Model ID is missing or invalid. Check the form field name.' } 
            });
        }
        
        // 4. ЛОГІКА ОНОВЛЕННЯ JSONBIN.IO

        // A. Завантаження поточних даних
        const loadRes = await fetch(`${API_URL}/latest`, {
            headers: {"X-Master-Key": API_KEY}
        });
        const data = (await loadRes.json()).record;

        // B. Оновлення лічильника
        const targetModel = data.models.find(m => m.id === modelId);
        if (!targetModel) {
            return res.status(404).json({ 
                AMP_FORM_ERROR: { message: `Model ${modelId} not found in the data.` } 
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

        // 5. Успішна відповідь AMP
        return res.status(200).json({
            success: true,
            AMP_FORM_SUCCESS: { message: `Rating for model ${modelId} submitted successfully.` }
        });

    } catch (error) {
        console.error("Vercel API Error:", error);
        // 6. Відповідь про помилку AMP
        return res.status(500).json({
            AMP_FORM_ERROR: { message: 'Server Error. Please, try again later. Check Vercel logs for details.' }
        });
    }
}
