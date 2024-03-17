const express = require('express');
const bodyParser = require('body-parser');
const OpenAI = require('openai');

const openai = new OpenAI('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');

const app = express();

app.use(bodyParser.json());

app.post('/api/completions', async (req, res) => {
    const prompt = req.body.prompt;
    const maxTokens = req.body.max_tokens;

    try {
        const response = await openai.complete({
            engine: 'davinci-codex',
            prompt: prompt,
            max_tokens: maxTokens
        });

        res.json(response.data.choices[0].text);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error completing prompt' });
    }
});

app.listen(3000, () => console.log('Server listening on port 3000'));
