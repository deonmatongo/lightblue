# lightblue

A private one-on-one chat with Ru.

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. In **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` → your Anthropic API key
4. Click **Deploy**

## Local development

```bash
cp .env.example .env.local
# add your ANTHROPIC_API_KEY to .env.local

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
