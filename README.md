
<div align="center">

# 🔥 GREAT DEMON V4.9

### The Ultimate WhatsApp Anime & Entertainment Bot

[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-yellow?style=for-the-badge&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Bot-25D366?style=for-the-badge&logo=whatsapp)](https://whatsapp.com/)
[![Telegram](https://img.shields.io/badge/Telegram-Integration-26A5E4?style=for-the-badge&logo=telegram)](https://telegram.org/)
[![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render)](https://render.com/)

**Developed by Kelvin**

</div>

---

## 📖 About

GREAT DEMON V4.9 is a WhatsApp automation bot built with JavaScript and Baileys. It combines entertainment, anime character collections, group management, and interactive features in one project.

## ✨ Features

- 🎴 Anime character collection and card shop
- 💰 Economy and wallet system
- 🔄 Player-to-player card trading
- 🎨 Anime artwork support
- 👥 Group management tools
- 🛡️ Anti-link and anti-spam protection
- 📸 WhatsApp Group Status features
- 🤖 Telegram management integration
- 🎵 Media and entertainment commands

## 🧰 Requirements

- Node.js 22 or newer
- Git
- A WhatsApp account
- Telegram bot token (optional)

## 🚀 Installation

```bash
git clone YOUR_REPOSITORY_URL
cd YOUR_REPOSITORY
npm install
npm start
```

Follow the WhatsApp pairing instructions shown in the terminal.

## ☁️ Deploy on Render

1. Push your project to GitHub.
2. Sign in to [Render](https://render.com/).
3. Create a new **Web Service**.
4. Connect your GitHub repository.
5. Select the Node.js environment.
6. Set the build command:

```bash
npm install
```

7. Set the start command:

```bash
npm start
```

8. Add the required environment variables.
9. Deploy your service.

### Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Render web service port |
| `DATA_DIR` | Persistent data directory |
| `OWNER_NUMBER` | Bot owner's WhatsApp number |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_OWNER_ID` | Telegram owner's numeric ID |

For persistent storage, attach a Render disk and configure:

```env
DATA_DIR=/var/data
```

## 🤖 Telegram Setup

1. Open Telegram.
2. Search for [@BotFather](https://t.me/BotFather).
3. Send `/newbot`.
4. Follow the instructions to create your bot.
5. Copy the token provided by BotFather.
6. Add it to Render as `TELEGRAM_BOT_TOKEN`.

### Get your Telegram ID

1. Open your Telegram bot.
2. Send `/myid`.
3. Copy the numeric ID returned.
4. Add it to Render as `TELEGRAM_OWNER_ID`.

## 🎮 Anime Card Economy

GREAT DEMON includes an anime card collection system with:

- Card spawning and collection
- Tier-based card prices
- Card shop
- Player-to-player trading
- Trade confirmation and cancellation

## 🛠️ Troubleshooting

**Bot refuses to start**
- Check your Node.js version.
- Run `npm install` again.
- Check your Render logs.

**Session disappears after restart**
- Configure persistent storage.
- Set `DATA_DIR` to the mounted disk path.

**Telegram integration is not responding**
- Check your bot token.
- Confirm the Telegram owner ID.
- Check Render environment variables.

## 🔐 Security

- Keep your WhatsApp session private.
- Never publish your Telegram bot token.
- Do not share private environment variables.
- Use trusted deployment platforms.

## 👨‍💻 Developer

**Kelvin**

Project: GREAT DEMON V4.9

---

<div align="center">

**GREAT DEMON V4.9 — Built for the anime community.**

</div>
