# Tahfidz Bootcamp API

Backend API server for Tahfidz Bootcamp Application.

## Deploy to Render

1. Connect your GitHub repository to Render
2. Create a new **Web Service**
3. Configure as follows:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node
4. Add environment variables (see below)

## Environment Variables

```
DATABASE_URL=./data/tahfidz.db
JWT_SECRET=your-secure-jwt-secret
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=production
BREVO_API_KEY=your-brevo-api-key
SENDER_EMAIL=your-verified-email@domain.com
GAS_API_KEY=your-gas-api-key
```
