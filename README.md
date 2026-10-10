# OpenUtility API

> The backend API that powers the OpenUtility web dashboard and connects it with the OpenUtility Discord Bot.

OpenUtility API is a Vercel-ready serverless backend for authentication, guild management, server configuration, bot synchronization, and persistent dashboard data. It keeps sensitive Discord credentials and server-side logic away from the frontend.

## ✨ Features

- 🔐 **Discord OAuth2** — Secure user authentication through Discord.
- 🏠 **Guild Management** — Retrieve accessible servers and their channels.
- ⚙️ **Server Configuration** — Read and update dashboard settings per guild.
- 🛡️ **Moderation and history** — Permission-checked moderation actions, case history, and per-server dashboard change history.
- 🤖 **Bot Synchronization** — Keep bot configuration and the web dashboard synchronized.
- 💾 **Upstash Redis** — Persistent production storage.
- 🧪 **Development Fallback** — Optional process-local storage for development.
- ☁️ **Vercel Ready** — Designed for serverless deployment.

## 🔌 API Routes

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API health check |
| `GET` | `/api/csrf` | Get the session-bound CSRF token |
| `GET` | `/api/auth/discord` | Start Discord OAuth2 login |
| `GET` | `/api/auth/discord/callback` | Handle OAuth2 callback |
| `POST` | `/api/auth/logout` | End the current session |
| `GET` | `/api/me` | Get the authenticated user |
| `GET` | `/api/guilds` | Get accessible Discord guilds |
| `GET` | `/api/guilds/:guildId/channels` | Get guild channels |
| `GET` | `/api/guilds/:guildId/config` | Get dashboard configuration |
| `PUT` | `/api/guilds/:guildId/config` | Update dashboard configuration |
| `GET` | `/api/guilds/:guildId/moderation` | List recent moderation cases |
| `POST` | `/api/guilds/:guildId/moderation` | Execute an authorized moderation action |
| `GET` | `/api/guilds/:guildId/audit` | Get per-server dashboard change history |
| `POST` | `/api/guilds/:guildId/audit` | Record an allowlisted dashboard change event |
| `GET/PUT` | `/api/guilds/:guildId/bot-profile` | Read or update the bot profile |
| `GET` | `/api/guilds/:guildId/logging` | Read logging configuration |
| `GET` | `/api/guilds/:guildId/embeds` | List saved embeds |\n| `POST` | `/api/guilds/:guildId/embeds` | Save an embed or send it to a channel |
| `GET` | `/api/bot/guild/:guildId/config` | Get bot-synced configuration |
| `PUT` | `/api/bot/guild/:guildId/config` | Update bot-synced configuration |

Guild-scoped dashboard routes require an authenticated session and permission to manage the requested Discord server. State-changing browser requests require the session-bound CSRF token and configured frontend origin. Bot-sync routes use the separate bot synchronization secret.

## 🚀 Deployment

### 1. Deploy to Vercel

Import this repository into Vercel and deploy it as a serverless project.

### 2. Configure environment variables

```env
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
DISCORD_REDIRECT_URI=
FRONTEND_URL=
SESSION_SECRET=
BOT_SYNC_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Redeploy after adding or changing environment variables.

### 3. Configure Discord OAuth2

Add this callback URL to the Discord Developer Portal:

```text
https://YOUR-PROJECT.vercel.app/api/auth/discord/callback
```

`DISCORD_REDIRECT_URI` must match the configured Discord redirect URI.

> ⚠️ Never expose `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `SESSION_SECRET`, or `BOT_SYNC_SECRET` in frontend code or public repositories.

## 🤖 Bot Synchronization

The OpenUtility Bot can synchronize guild configuration with this API using `BOT_SYNC_SECRET`.

```http
Authorization: Bearer <BOT_SYNC_SECRET>
```

Use the bot configuration endpoint:

```text
https://YOUR-PROJECT.vercel.app/api/bot/guild/:guildId/config
```

For the bot, configure:

```env
WEBSITE_SYNC_URL=https://YOUR-PROJECT.vercel.app
WEBSITE_SYNC_SECRET=<same value as BOT_SYNC_SECRET>
```

The bot can `GET` the website's current configuration and `PUT` its current guild snapshot/configuration.

## 💾 Storage

Production deployments use Upstash Redis when configured:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Without Redis, the API may use process-local memory for development. This fallback is **not durable** and should not be used for production data. Production deployments fail closed when persistent Redis is missing.

## 🔒 Security

- Store secrets only in environment variables.
- Use strong, randomly generated session and sync secrets; keep them separate.
- Never commit `.env` files or credentials.
- Keep OAuth redirect URLs restricted to trusted application URLs.
- Use HTTPS in production.
- Keep the dashboard and API on HTTPS.
- Moderation routes verify Discord permissions and role hierarchy; embed sending validates the destination channel.

## 🛠️ Local Development

```bash
git clone https://github.com/OpenUtility2/openutility-api.git
cd openutility-api
npm install
npm run check
```

Create your local environment configuration, add the required variables, and run the project's configured development command.

## 🧩 OpenUtility Ecosystem

OpenUtility API is part of the wider OpenUtility project:

- **OpenUtility Bot** — Discord server management, moderation, utilities, logging, and configuration.
- **OpenUtility Dashboard** — Web-based server management interface.
- **OpenUtility API** — Authentication, configuration, storage, and bot synchronization backend.

## 📄 License

See the repository for the applicable license.

Built with ❤️ for **OpenUtility**.

## Production configuration

Configure these variables in the deployment provider (never commit real values):

- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `DISCORD_BOT_TOKEN`
- `DISCORD_REDIRECT_URI` — exact OAuth callback URL registered in Discord
- `FRONTEND_URL=https://openutility.bot.nu` — exact dashboard origin, with no path
- `SESSION_SECRET` — a long, randomly generated secret
- `BOT_SYNC_SECRET` — a separate long, randomly generated secret shared with the bot
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — persistent storage

The health endpoint checks storage reachability. Browser state-changing requests must include the session-bound `X-CSRF-Token` returned by `GET /api/csrf` and must originate from the configured frontend origin.
