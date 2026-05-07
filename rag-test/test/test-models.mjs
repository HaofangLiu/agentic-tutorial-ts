import '../../load-env.mjs';

const testModel = async (modelName) => {
    console.log(`\nTesting model: ${modelName}`);
    console.log('='.repeat(80));
    
    const response = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: '你好，请简单回复' }],
            stream: false
        })
    });
    
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
};

(async () => {
    await testModel('MiniMax/MiniMax-M2.7');
    await testModel('Qwen/Qwen2.5-7B-Instruct');
    await testModel('Qwen/Qwen2.5-Coder-7B-Instruct');
})().catch(console.error);
