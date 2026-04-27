import "dotenv/config";

const testEmbeddingAPI = async () => {
    console.log('Testing Embedding API...');
    const response = await fetch('https://api-inference.modelscope.cn/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: process.env.EMBEDDINGS_MODEL_NAME,
            input: '测试文本',
            encoding_format: 'float'
        })
    });
    
    const data = await response.json();
    console.log('Embedding API Response:');
    console.log(JSON.stringify(data, null, 2));
};

const testChatAPI = async () => {
    console.log('\n\nTesting Chat API...');
    const response = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: process.env.MODEL_NAME,
            messages: [{ role: 'user', content: '你好' }]
        })
    });
    
    const data = await response.json();
    console.log('Chat API Response:');
    console.log(JSON.stringify(data, null, 2));
};

(async () => {
    await testEmbeddingAPI();
    await testChatAPI();
})().catch(console.error);
