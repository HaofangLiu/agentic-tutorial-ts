import "dotenv/config";

const testModelScopeAPI = async () => {
    const response = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: process.env.MODEL_NAME,
            messages: [{ role: 'user', content: '你好，请简单回复' }],
            stream: false
        })
    });
    
    const data = await response.json();
    console.log('API Response:');
    console.log(JSON.stringify(data, null, 2));
};

testModelScopeAPI().catch(console.error);
