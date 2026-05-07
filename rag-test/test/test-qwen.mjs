import '../../load-env.mjs';

const testQwen = async () => {
    console.log('Testing Qwen3-8B model...');
    console.log('='.repeat(80));
    
    const response = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: 'Qwen/Qwen3-8B',
            messages: [{ role: 'user', content: '你好，请简单回复' }]
        })
    });
    
    const data = await response.json();
    console.log('Response:');
    console.log(JSON.stringify(data, null, 2));
};

testQwen().catch(console.error);
