import { URLSearchParams } from 'url';

const BIN_ID = "6900f54c43b1c97be987ac1d";
const API_KEY = process.env.JSONBIN_MASTER_KEY || "$2a$10$.mM/3AtMsD1ap9ApkDduIOdz/0tt.j9613TBCoIV/equtWdmV8yky"; 
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// Функцію parseFormBody видалено, використовуємо нативний req.body Vercel
// якщо Content-Type: application/json

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-AMP-Source-Origin');
    res.setHeader('AMP-Access-Control-Allow-Source-Origin', 'https://' + req.headers.host);
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).json({});
    }
    
    // Пряме використання req.body (Він повинен містити { model: 'X' })
    const body = req.body;
    
    try {
        // ЧИТАЄМО ЗНАЧЕННЯ З ТІЛА ЗАПИТУ, НАДІСЛАНОГО ФОРМОЮ
        const model = body.model; 
        const modelId = parseInt(model); 

        if (isNaN(modelId)) {
            return res.status(400).json({ 
                AMP_FORM_ERROR: { message: 'Model ID is missing or invalid. Check the form field name.' } 
            });
        }
        
        // --- ЛОГІКА ОНОВЛЕННЯ JSONBIN.IO ---

        const loadRes = await fetch(`${API_URL}/latest`, {
            headers: {"X-Master-Key": API_KEY}
        });
        const data = (await loadRes.json()).record;

        const targetModel = data.models.find(m => m.id === modelId);
        if (!targetModel) {
            return res.status(404).json({ 
                AMP_FORM_ERROR: { message: `Model ${modelId} not found in the data.` } 
            });
        }
        targetModel.count++;

        await fetch(API_URL, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-Master-Key": API_KEY
            },
            body: JSON.stringify(data)
        });

        return res.status(200).json({
            success: true,
            AMP_FORM_SUCCESS: { message: `Rating for model ${modelId} submitted successfully.` }
        });

    } catch (error) {
        console.error("Vercel API Error:", error);
        return res.status(500).json({
            AMP_FORM_ERROR: { message: 'Server Error. Please, try again later. Check Vercel logs for details.' }
        });
    }
}
