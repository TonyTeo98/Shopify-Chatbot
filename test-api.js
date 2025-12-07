import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
  baseURL: process.env.CLAUDE_BASE_URL,
  defaultHeaders: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  }
});

async function test() {
  try {
    console.log('Testing API...');
    console.log('Base URL:', process.env.CLAUDE_BASE_URL);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello, who are you?' }]
    });

    console.log('Success!');
    console.log(message.content[0].text);
  } catch (error) {
    console.error('Error:', error.status, error.message);
    console.error('Headers:', error.headers);
  }
}

test();
