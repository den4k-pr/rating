import { URLSearchParams } from 'url';

const BIN_ID = "6900f54c43b1c97be987ac1d";
const API_KEY = process.env.JSONBIN_MASTER_KEY || "$2a$10$.mM/3AtMsD1ap9ApkDduIOdz/0tt.j9613TBCoIV/equtWdmV8yky";
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// Відновлюємо функцію для надійного парсингу body з логуванням
async function parseFormBody(req) {
    console.log('--- START BODY PARSING ---');
    console.log('Request Headers (Content-Type):', req.headers['content-type']);

    // 1. Спробувати нативний req.body (працює для JSON/Next.js)
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('PARSING METHOD: Native req.body used.');
        console.log('Parsed Body (Native):', req.body);
        return req.body;
    }

    // 2. Якщо native body порожній, спробувати парсити сирі дані
    const rawBody = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => data += chunk.toString());
        req.on('end', () => resolve(data));
    });

    console.log('Raw Request Body:', rawBody);

    if (!rawBody) {
        console.log('PARSING RESULT: Raw body is empty.');
        return {};
    }
    
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
        console.log('PARSING METHOD: URL-encoded detected.');
        try {
            const params = new URLSearchParams(rawBody);
            const body = {};
            for (const [key, value] of params.entries()) {
                body[key] = value;
            }
            console.log('Parsed Body (URL-encoded):', body);
            return body;
        } catch (e) {
            console.error('URL-encoded Parsing Error:', e.message);
            return {};
        }
    } 
    
    if (contentType.includes('application/json')) {
        console.log('PARSING METHOD: JSON detected.');
        try {
            const body = JSON.parse(rawBody);
            console.log('Parsed Body (JSON):', body);
            return body;
        } catch (e) {
            console.error('JSON Parsing Error:', e.message);
            // Якщо парсинг JSON не вдався, це може бути порожнє або пошкоджене тіло
            return {};
        }
    }
    
    console.log('PARSING RESULT: Unknown content type or successful native parsing (fallthrough).');
    return {};
}

// --------------------------------------------------------------------------------------
// ОСНОВНИЙ ОБРОБНИК (handler)
// --------------------------------------------------------------------------------------

export default async function handler(req, res) {
    // 1. Встановлення CORS/AMP Заголовків
    // ... (заголовки залишаються без змін)
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-AMP-Source-Origin');
    res.setHeader('AMP-Access-Control-Allow-Source-Origin', 'https://' + req.headers.host);
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).json({});
    }

    console.log(`\n================================`);
    console.log(`NEW REQUEST: ${req.method} ${req.url}`);
    console.log(`Origin Header: ${req.headers.origin}`);
    console.log(`Host Header: ${req.headers.host}`);
    console.log(`================================`);
    
    // 2. Отримання та парсинг даних форми
    const body = await parseFormBody(req);
    
    try {
        // 3. ЧИТАЄМО ЗНАЧЕННЯ З ТІЛА ЗАПИТУ
        const model = body.model;
        const modelId = parseInt(model);
        
        console.log('FORM DATA CHECK:');
        console.log('  body:', body);
        console.log('  model (string):', model);
        console.log('  modelId (number):', modelId);

        if (isNaN(modelId)) {
            // ЛОГУВАННЯ ПОМИЛКИ 400
            const errorMessage = 'Model ID is missing or invalid.';
            console.error(`ERROR 400: ${errorMessage} Received value:`, model);
            
            // ПОВЕРНЕННЯ ПОМИЛКИ 400 З ДЕТАЛЯМИ ДЛЯ AMP
            return res.status(400).json({ 
                AMP_FORM_ERROR: { 
                    message: `${errorMessage} (Model: "${model}", Body: ${JSON.stringify(body)})` // <--- Додаємо деталі
                } 
            });
        }
        
        // 4. ЛОГІКА ОНОВЛЕННЯ JSONBIN.IO
        console.log('JSONBIN LOGIC: Starting data load...');
        
        // A. Завантаження поточних даних
        const loadRes = await fetch(`${API_URL}/latest`, {
            headers: {"X-Master-Key": API_KEY}
        });

        if (!loadRes.ok) {
            const loadErrorText = await loadRes.text();
            console.error('JSONBIN LOAD ERROR:', loadRes.status, loadErrorText);
            throw new Error(`Failed to load data (Status: ${loadRes.status})`);
        }
        
        const data = (await loadRes.json()).record;
        console.log('JSONBIN LOGIC: Data loaded successfully. Attempting to find model...');

        // B. Оновлення лічильника
        const targetModel = data.models.find(m => m.id === modelId);
        
        if (!targetModel) {
            const errorMessage = `Model ${modelId} not found in the data.`;
            console.error(`ERROR 404: ${errorMessage}`);
            return res.status(404).json({ 
                AMP_FORM_ERROR: { message: errorMessage } 
            });
        }
        
        console.log(`JSONBIN LOGIC: Found model ${modelId}. Current count: ${targetModel.count}.`);
        targetModel.count++;
        console.log(`JSONBIN LOGIC: New count: ${targetModel.count}.`);


        // C. Збереження оновлених даних
        console.log('JSONBIN LOGIC: Saving updated data...');
        const saveRes = await fetch(API_URL, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-Master-Key": API_KEY
            },
            body: JSON.stringify(data)
        });
        
        if (!saveRes.ok) {
            const saveErrorText = await saveRes.text();
            console.error('JSONBIN SAVE ERROR:', saveRes.status, saveErrorText);
            throw new Error(`Failed to save data (Status: ${saveRes.status})`);
        }
        
        console.log('JSONBIN LOGIC: Data saved successfully.');

        // 5. Успішна відповідь AMP
        console.log(`SUCCESS 200: Rating for model ${modelId} submitted.`);
        return res.status(200).json({
            success: true,
            AMP_FORM_SUCCESS: { message: `Rating for model ${modelId} submitted successfully.` }
        });

    } catch (error) {
        // 6. Відповідь про помилку AMP
        console.error("!!! FATAL VERCEL API Error:", error.message, error.stack);
        
        // Повертаємо загальну помилку, але з деталями (хоча AMP може не відображати весь текст)
        return res.status(500).json({
            AMP_FORM_ERROR: { 
                message: `Server Error. Try again. Details: ${error.message}` 
            }
        });
    }
}
