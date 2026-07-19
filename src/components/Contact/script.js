// ============================================
// SIMPLE PROJECT ANALYZER
// Sin pretender ser IA - solo matching inteligente
// ============================================

const services = [
    // Moke Systems
    {
        name: 'Kernel Development',
        keywords: ['kernel', 'monolithic', 'microkernel', 'system call', 'scheduling', 'memory management', 'low-level', 'operating system', 'os'],
        basePrice: 15000,
        pricePerWord: 500
    },
    {
        name: 'Driver & Firmware Engineering',
        keywords: ['driver', 'firmware', 'device', 'hardware', 'usb', 'pci', 'gpio', 'i2c', 'spi', 'embedded'],
        basePrice: 12000,
        pricePerWord: 400
    },
    {
        name: 'Secure Systems & Encryption',
        keywords: ['secure', 'encryption', 'cryptography', 'protocol', 'security', 'trusted', 'authenticated', 'encrypted'],
        basePrice: 16000,
        pricePerWord: 500
    },
    
    // Moke Automotive
    {
        name: 'Infotainment Systems',
        keywords: ['infotainment', 'dash', 'dashboard', 'cluster', 'display', 'hmi', 'touch', 'screen', 'instrument'],
        basePrice: 18000,
        pricePerWord: 600
    },
    {
        name: 'Autonomous Driving & ADAS',
        keywords: ['autonomous', 'self-driving', 'adas', 'sensor', 'lidar', 'radar', 'camera', 'perception', 'control'],
        basePrice: 25000,
        pricePerWord: 800
    },
    {
        name: 'Automotive IoT & Telematics',
        keywords: ['telematics', 'connected', 'v2x', 'gps', 'can', 'obd', 'diagnostic', 'real-time', 'vehicle data'],
        basePrice: 16000,
        pricePerWord: 500
    },
    
    // Newton AI
    {
        name: 'Autonomous AI Agents',
        keywords: ['ai', 'agent', 'autonomous', 'llm', 'gpt', 'openai', 'decision', 'reasoning', 'planning'],
        basePrice: 20000,
        pricePerWord: 700
    },
    {
        name: 'Process Automation',
        keywords: ['automation', 'rpa', 'workflow', 'process', 'orchestration', 'pipeline', 'robot', 'bot'],
        basePrice: 15000,
        pricePerWord: 500
    },
    {
        name: 'Machine Learning Systems',
        keywords: ['machine learning', 'ml', 'neural', 'deep learning', 'training', 'inference', 'model', 'predict'],
        basePrice: 18000,
        pricePerWord: 600
    },
    
    // ZTRN
    {
        name: 'Architecture & Brutalist Design',
        keywords: ['architecture', 'brutalist', 'design', 'structure', 'space', 'geometry', 'concrete', 'minimal'],
        basePrice: 10000,
        pricePerWord: 300
    },
    {
        name: 'Engineering Consulting',
        keywords: ['consulting', 'strategy', 'review', 'assessment', 'audit', 'advisory', 'expert', 'fractional'],
        basePrice: 8000,
        pricePerWord: 300
    }
];

// Palabras que ignoramos (stopwords)
const stopwords = [
    'the', 'and', 'for', 'with', 'from', 'have', 'are', 'you', 'how', 'why', 
    'can', 'will', 'your', 'what', 'when', 'where', 'need', 'want', 'looking',
    'building', 'develop', 'create', 'make', 'do', 'does', 'did', 'has', 'had',
    'but', 'so', 'because', 'since', 'while', 'during', 'without', 'through'
];

// Extraer palabras relevantes
function extractWords(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2)
        .filter(w => !stopwords.includes(w));
}

// Analizar el texto
function analyzeText(text) {
    if (!text || text.trim().length < 5) {
        return { services: [], total: 0, message: 'Describe your project' };
    }

    const words = extractWords(text);
    if (words.length < 2) {
        return { services: [], total: 0, message: 'Please describe your project with more details' };
    }

    // Calcular puntuación para cada servicio
    const results = services.map(service => {
        let score = 0;
        let matches = [];

        for (const keyword of service.keywords) {
            // Buscar coincidencias exactas o parciales
            for (const word of words) {
                if (word.includes(keyword) || keyword.includes(word)) {
                    score += 1;
                    matches.push(keyword);
                    break;
                }
            }
        }

        // Bonus por múltiples coincidencias
        const uniqueMatches = [...new Set(matches)];
        const bonus = uniqueMatches.length > 2 ? uniqueMatches.length * 0.5 : 0;

        const totalScore = score + bonus;
        const price = service.basePrice + (service.pricePerWord * Math.min(words.length, 15));

        return {
            name: service.name,
            score: totalScore,
            price: Math.ceil(price / 100) * 100,
            matches: uniqueMatches.slice(0, 3)
        };
    });

    // Filtrar servicios con puntuación > 0 y ordenar por score
    const relevant = results
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score);

    if (relevant.length === 0) {
        return {
            services: [],
            total: 0,
            message: 'We couldn\'t match your project. Please be more specific about the technical area.'
        };
    }

    // Tomar los 3 más relevantes
    const topServices = relevant.slice(0, 3);
    const total = topServices.reduce((sum, s) => sum + s.price, 0);

    return {
        services: topServices,
        total: total,
        message: null
    };
}