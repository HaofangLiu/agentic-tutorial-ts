import '../../load-env.mjs';

const testWithParams = async (params) => {
    console.log('\nTesting with params:');
    console.log(JSON.stringify(params, null, 2));
    console.log('='.repeat(80));
    
    const response = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify(params)
    });
    
    const data = await response.json();
    console.log('Response:');
    console.log(JSON.stringify(data, null, 2));
};

(async () => {
    // Test 1: Basic request without stream parameter
    await testWithParams({
        model: 'MiniMax/MiniMax-M2.7',
        messages: [{ role: 'user', content: '你好' }]
    });
    
    // Test 2: With max_tokens
    await testWithParams({
        model: 'MiniMax/MiniMax-M2.7',
        messages: [{ role: 'user', content: '你好' }],
        max_tokens: 100
    });
    
    // Test 3: With temperature
    await testWithParams({
        model: 'MiniMax/MiniMax-M2.7',
        messages: [{ role: 'user', content: '你好' }],
        temperature: 0.7,
        max_tokens: 100
    });
})().catch(console.error);
