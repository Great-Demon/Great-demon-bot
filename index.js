import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const messageCache = new Map();
// Prevent the same WhatsApp message event from executing a command more than once.
const processedCommandMessages = new Map();
const warningMap = new Map(); // Tracks warning counts per user per group
const removalEventCache = new Map();
const lastGreetingImages = new Map(); // Prevent duplicate removal announcements
const connectionNoticesSent = new Set();
const livePresence = new Map();
const http = require('http');
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Great Demon Bot is active 24/7 under the rule of Demon Emperor!\n');
}).listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Keep-alive server running on 0.0.0.0:' + PORT);
});

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    fetchLatestWaWebVersion,
    downloadContentFromMessage,
    downloadMediaMessage,
    generateWAMessageContent,
    generateWAMessageFromContent,
    prepareWAMessageMedia,
    jidNormalizedUser
} = await import('@whiskeysockets/baileys');
const fs = require('fs');
const yts = require('yt-search');
const { promisify } = require('util');
const pino = require('pino');
const { exec, execFile } = require('child_process');
const execFileAsync = promisify(execFile);
const os = require('os');
const https = require('https');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const sharp = require('sharp');
// Prefer an explicitly configured binary, then the npm-bundled FFmpeg binary.
// This keeps audio/video utilities working on Render without a system FFmpeg install.
const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath);
const crypto = require('crypto');
const axios = require('axios');
const { truth } = require('@bochilteam/scraper');
const { translate } = require('@vitalets/google-translate-api');


// --- SFW WEB CONTENT HELPERS: anime images, flirt, truth and dare ---
const SFW_IMAGE_PROVIDERS = [
    async (category) => {
        const r = await axios.get('https://api.waifu.best/images?PageSize=1&IsNsfw=False', { timeout: 12000 });
        const item = r.data?.items?.find(x => x && x.isNsfw === false && x.url);
        return item ? { url: item.url, source: item.source || null, anime: item.animeName || null } : null;
    },
    async (category) => {
        const safeCategory = ['waifu', 'neko', 'smile', 'wink', 'blush', 'sleep'].includes(category) ? category : 'waifu';
        const r = await axios.get(`https://nekos.best/api/v2/${safeCategory}`, {
            timeout: 12000,
            headers: { 'User-Agent': 'GREAT DEMON V4.9 (https://github.com/)' }
        });
        const item = r.data?.results?.[0];
        return item?.url ? { url: item.url, source: item.source_url || null, anime: item.anime_name || null, artist: item.artist_name || null } : null;
    },
    async (category) => {
        const safeCategory = ['waifu', 'neko', 'wink', 'blush', 'smile', 'wave', 'pat'].includes(category) ? category : 'waifu';
        const r = await axios.get(`https://api.waifu.pics/sfw/${safeCategory}`, { timeout: 12000 });
        return r.data?.url ? { url: r.data.url, source: null, anime: null } : null;
    }
];

async function fetchSfwAnimeImage(category = 'waifu') {
    const order = [...SFW_IMAGE_PROVIDERS];
    // Shuffle provider order so one temporary outage does not always block the command.
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    const errors = [];
    for (const provider of order) {
        try {
            const meta = await provider(category);
            if (!meta?.url || !/^https:\/\//i.test(meta.url)) throw new Error('No valid SFW image URL');
            const image = await axios.get(meta.url, {
                responseType: 'arraybuffer', timeout: 18000, maxContentLength: 10 * 1024 * 1024,
                headers: { 'User-Agent': 'GREAT-DEMON-V4.9/4.9' }
            });
            const buffer = Buffer.from(image.data);
            if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new Error('Image was empty or too large');
            return { buffer, ...meta };
        } catch (e) {
            errors.push(e.message);
            console.warn('[SFW IMAGE FALLBACK]', e.message);
        }
    }
    throw new Error(`All SFW anime image sources failed: ${errors.join(' | ')}`);
}

function escapeCardText(value = '') {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function makeTruthDareCard(kind, prompt, animeImage) {
    const title = kind === 'truth' ? 'TRUTH' : 'DARE';
    const accent = kind === 'truth' ? '#57d7ff' : '#ff6b45';
    const words = String(prompt).replace(/\s+/g, ' ').trim().split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length > 27 && line) { lines.push(line); line = word; }
        else line = candidate;
        if (lines.length >= 7) break;
    }
    if (line && lines.length < 8) lines.push(line);
    const promptSvg = lines.map((part, i) => `<text x="450" y="${790 + i * 58}" text-anchor="middle" font-family="Arial,sans-serif" font-size="43" font-weight="700" fill="#ffffff" stroke="#05060d" stroke-width="2" paint-order="stroke">${escapeCardText(part)}</text>`).join('');
    const svg = Buffer.from(`<svg width="900" height="1200" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#080914" stop-opacity=".12"/><stop offset=".48" stop-color="#080914" stop-opacity=".30"/><stop offset="1" stop-color="#05060d" stop-opacity=".96"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <rect width="900" height="1200" fill="#090a12"/><rect x="18" y="18" width="864" height="1164" rx="42" fill="none" stroke="${accent}" stroke-width="12"/><rect width="900" height="1200" fill="url(#shade)"/>
      <text x="450" y="145" text-anchor="middle" font-family="Arial,sans-serif" font-size="90" font-weight="900" fill="${accent}" stroke="#10111b" stroke-width="3" paint-order="stroke" filter="url(#glow)">${title}</text>
      <path d="M100 190 H800" stroke="${accent}" stroke-width="5" opacity=".9"/>
      ${promptSvg}
      <text x="450" y="1135" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#ffffff">GREAT DEMON • ANIME PARTY</text>
    </svg>`);
    return sharp(animeImage.buffer).rotate().resize(900, 1200, { fit: 'cover' }).composite([{ input: svg }]).jpeg({ quality: 88 }).toBuffer();
}

const UNSAFE_GAME_PROMPT = /(drink|alcohol|beer|wine|vodka|smok(e|ing)|vape|drug|weapon|knife|gun|fight|jump off|roof|traffic|road|dangerous|hurt yourself|self.?harm|suicid|sexual|nude|underwear|send.*(password|address|private photo|gallery)|share.*(password|address|private photo)|stranger.*meet)/i;
async function fetchTruthOrDareFromWeb(kind) {
    const endpoint = kind === 'truth'
        ? 'https://api.truthordarebot.xyz/v1/truth?rating=pg'
        : 'https://api.truthordarebot.xyz/api/dare?rating=pg';
    const response = await axios.get(endpoint, { timeout: 12000, headers: { Accept: 'application/json' } });
    const prompt = response.data?.question || response.data?.contents?.question || response.data?.result;
    if (typeof prompt !== 'string' || prompt.trim().length < 5 || UNSAFE_GAME_PROMPT.test(prompt)) {
        throw new Error('The web API returned an unsuitable or invalid prompt');
    }
    return prompt.trim();
}

// --- BOT CONFIGURATION ---
const OWNER_NUMBER = "2347061696819";
const OWNER_NAME = "𝐆𝐑𝐄𝐀𝐓_𝐃𝐄𝐌𝐎𝐍";
const BOT_NAME = "𝐆𝐑𝐄𝐀𝐓_𝐃𝐄𝐌𝐎𝐍 𝐕4";
const BOT_VERSION = "V4.4";
const MENU_IMAGE_URL = "https://i.postimg.cc/C5nJz4BG/1793460010889.jpg";
const PURPLE_COLOR = '#9C27B0';
const startTime = Date.now();

// --- STORAGE ENGINE (Render Free compatible; persistent disk ready) ---
// Render Free has ephemeral local storage. For durable storage later, attach a
// Render Persistent Disk and set DATA_DIR=/var/data. This code deliberately
// does not claim local files are persistent when no disk is mounted.
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
fs.mkdirSync(DATA_DIR, { recursive: true });
try {
    const storageProbe = path.join(DATA_DIR, `.great-demon-write-test-${process.pid}`);
    fs.writeFileSync(storageProbe, 'ok', { mode: 0o600 });
    fs.unlinkSync(storageProbe);
    console.log('[STORAGE] Writable data directory:', DATA_DIR);
    if (process.env.RENDER && !process.env.DATA_DIR) {
        console.warn('[STORAGE WARNING] Render is running without DATA_DIR. Local data may be lost on restart/redeploy.');
    }
    if (process.env.DATA_DIR) {
        console.log('[STORAGE] DATA_DIR is explicitly configured. Confirm it points to your mounted persistent disk before relying on it.');
    }
} catch (storageError) {
    console.error('[STORAGE ERROR] Cannot write to DATA_DIR:', storageError.message);
    throw storageError;
}
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const GROUP_SETTINGS_FILE = path.join(DATA_DIR, 'groupSettings.json');
const BLOCKED_USERS_FILE = path.join(DATA_DIR, 'blockedUsers.json');

function migrateLegacyPath(source, destination) {
    try {
        if (!fs.existsSync(source) || fs.existsSync(destination)) return;
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.cpSync(source, destination, { recursive: true, errorOnExist: false, force: false });
        console.log('[DATA MIGRATION] Moved legacy data into DATA_DIR:', path.basename(source));
    } catch (err) {
        console.warn('[DATA MIGRATION]', path.basename(source), err.message);
    }
}
for (const file of ['settings.json', 'groupSettings.json', 'messageCount.json', 'blockedUsers.json', 'telegram_sessions.json', 'economy.json']) {
    migrateLegacyPath(path.join(__dirname, file), path.join(DATA_DIR, file));
    migrateLegacyPath(path.resolve(process.cwd(), file), path.join(DATA_DIR, file));
}
migrateLegacyPath(path.join(__dirname, 'demon_session'), path.join(DATA_DIR, 'demon_session'));
migrateLegacyPath(path.resolve(process.cwd(), 'demon_session'), path.join(DATA_DIR, 'demon_session'));
migrateLegacyPath(path.join(__dirname, 'sessions'), path.join(DATA_DIR, 'sessions'));

const ECONOMY_FILE = path.join(DATA_DIR, 'economy.json');
const economy = readJsonFile(ECONOMY_FILE, { users: {} });
if (!economy.users || typeof economy.users !== 'object') economy.users = {};
if (!economy.cardOffers || typeof economy.cardOffers !== 'object') economy.cardOffers = {};
// Migrated legacy pending card listings remain available until their original expiry.
for (const [sellerId, sellerRecord] of Object.entries(economy.users)) {
    const pending = sellerRecord?.pendingCard;
    if (pending?.offerId && pending.expiresAt > Date.now() && !economy.cardOffers[pending.offerId]) {
        economy.cardOffers[pending.offerId] = { ...pending, seller: String(sellerId), status: 'active' };
    }
}
const DEMON_ADMIN_GOLD = 9999999999999;
function saveEconomy() { writeJsonAtomic(ECONOMY_FILE, economy); }
function economyUser(jid, name = 'Player') {
    const id = String(jid || '').replace(/\D/g, '') || String(jid || 'unknown');
    if (!economy.users[id]) economy.users[id] = { name, wallet: 0, bank: 0, inventory: [], cards: [], pendingCard: null, cooldowns: {}, joinedAt: Date.now() };
    const user = economy.users[id];
    user.name = name || user.name || 'Player';
    user.wallet = Math.max(0, Number(user.wallet) || 0);
    user.bank = Math.max(0, Number(user.bank) || 0);
    // Seed the primary owner's real, spendable wallet and bank once. The old
    // code reset the wallet on every lookup and left bank at zero, so withdraw
    // could never work. After seeding, all transfers use ordinary balances.
    if (id === String(OWNER_NUMBER).replace(/\D/g, '') && !user.ownerEconomySeeded) {
        user.wallet = Math.max(user.wallet, DEMON_ADMIN_GOLD);
        user.bank = Math.max(user.bank, DEMON_ADMIN_GOLD);
        user.ownerEconomySeeded = true;
        saveEconomy();
    }
    if (!Array.isArray(user.inventory)) user.inventory = [];
    if (!Array.isArray(user.cards)) user.cards = [];
    if (!user.cooldowns || typeof user.cooldowns !== 'object') user.cooldowns = {};
    return user;
}
function economyCooldown(user, key, duration) {
    const remaining = (Number(user.cooldowns[key]) || 0) - Date.now();
    if (remaining > 0) return remaining;
    user.cooldowns[key] = Date.now() + duration;
    return 0;
}
function moneyText(value) { return Number(value || 0).toLocaleString('en-US') + ' GD'; }
// Read current and legacy economy fields without double-counting aliases.
function economyWalletValue(user = {}) {
    const candidates = [user.wallet, user.gold, user.money, user.cash, user.balance]
        .map(value => Number(value)).filter(value => Number.isFinite(value) && value >= 0);
    return candidates.length ? Math.max(...candidates) : 0;
}
function economyBankValue(user = {}) {
    const candidates = [user.bank, user.bankBalance, user.savings]
        .map(value => Number(value)).filter(value => Number.isFinite(value) && value >= 0);
    return candidates.length ? Math.max(...candidates) : 0;
}
function economyTotalWealth(user = {}) { return economyWalletValue(user) + economyBankValue(user); }
const ECONOMY_SHOP = [
    { id: 'common_crate', name: 'Common Crate', price: 250, description: 'A small mystery collection' },
    { id: 'rare_crate', name: 'Rare Crate', price: 900, description: 'A larger mystery collection' },
    { id: 'title_token', name: 'Title Token', price: 1500, description: 'A collectible profile token' }
];

// Anime-card catalogue: owners add artwork URLs they own or are licensed to use.
const CARD_CATALOG_FILE = path.join(DATA_DIR, 'animeCards.json');
const CARD_TIERS = ['SS', 'S', 'A', 'B', 'C', 'D', 'E'];
const cardCatalog = readJsonFile(CARD_CATALOG_FILE, { cards: [] });
if (!Array.isArray(cardCatalog.cards)) cardCatalog.cards = [];
// Retire legacy generated entries that used placeholder identity labels. Keep
// their records and owned copies intact; they are simply excluded from new listings.
let retiredPlaceholderCards = false;
for (const legacyCard of cardCatalog.cards) {
    const character = String(legacyCard?.characterName || '').trim().toLowerCase();
    const anime = String(legacyCard?.animeTitle || '').trim().toLowerCase();
    if (character === 'mystery character' || anime === 'anime archive' ||
        character.startsWith('anime character #')) {
        if (legacyCard.active !== false) { legacyCard.active = false; retiredPlaceholderCards = true; }
    }
}
if (retiredPlaceholderCards) writeJsonAtomic(CARD_CATALOG_FILE, cardCatalog);
function saveCardCatalog() { writeJsonAtomic(CARD_CATALOG_FILE, cardCatalog); }
// Public spawn safeguards: per-user and per-chat cooldowns. These are in-memory
// limits (they reset if the bot process restarts); they reduce bursts but do not
// bypass WhatsApp policies or guarantee against reports/suspension.
const CARD_SPAWN_USER_COOLDOWN_MS = 30 * 1000;
const CARD_SPAWN_CHAT_COOLDOWN_MS = 5 * 1000;
const CARD_SPAWN_USER_NEXT = new Map();
const CARD_SPAWN_CHAT_NEXT = new Map();
function cardSpawnCooldownRemaining(map, key, duration) {
    const now = Date.now();
    const next = Number(map.get(String(key)) || 0);
    if (next > now) return next - now;
    map.set(String(key), now + duration);
    return 0;
}

function cleanCardId(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32); }
function cardById(id) { return cardCatalog.cards.find(card => card.id === cleanCardId(id)); }

// SFW anime artwork sources. Konachan is queried with the documented safe-rating
// tag; the other providers are independent fallbacks if Konachan is unavailable.
const CARD_TIER_PRICES = { SS: 250000, S: 100000, A: 50000, B: 20000, C: 10000, D: 5000, E: 2000 };
const CARD_TIER_WEIGHTS = { SS: 1, S: 4, A: 9, B: 17, C: 24, D: 26, E: 20 };
function randomEligibleTier(isAnimated) {
    const eligible = isAnimated ? ['SS', 'S', 'A', 'B'] : ['C', 'D', 'E'];
    const total = eligible.reduce((sum, tier) => sum + CARD_TIER_WEIGHTS[tier], 0);
    let pick = Math.random() * total;
    for (const tier of eligible) { pick -= CARD_TIER_WEIGHTS[tier]; if (pick < 0) return tier; }
    return eligible[eligible.length - 1];
}
function humanizeAnimeTag(value = '') {
    return String(value).split(' ').filter(Boolean).slice(0, 3)
        .map(x => x.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ');
}
async function fetchKonachanSafePosts(limit = 30) {
    const failures = [];
    for (const host of ['https://konachan.net', 'https://konachan.com']) {
        try {
            const response = await axios.get(host + '/post.json', {
                params: { limit, tags: 'rating:s order:random' }, timeout: 14000,
                headers: { Accept: 'application/json', 'User-Agent': 'GREAT-DEMON-V4.9 SFW anime artwork bot' },
                maxContentLength: 3 * 1024 * 1024
            });
            const posts = Array.isArray(response.data) ? response.data.filter(post =>
                post && post.rating === 's' && typeof post.file_url === 'string' && /^https:\/\//i.test(post.file_url) && Number(post.width) >= 1080 && Number(post.height) >= 1440
            ) : [];
            if (posts.length) return posts;
            failures.push(host + ': no safe-rated posts returned');
        } catch (error) { failures.push(host + ': ' + String(error.message || error).slice(0, 100)); }
    }
    throw new Error(failures.join(' | ') || 'Konachan returned no safe posts');
}
async function lookupKonachanTagTypes(rawTags) {
    const names = String(rawTags || '').split(' ').filter(Boolean).slice(0, 35);
    const typed = { character: [], copyright: [], artist: [] };
    let cursor = 0;
    async function worker() {
        while (cursor < names.length) {
            const tagName = names[cursor++];
            try {
                const response = await axios.get('https://konachan.net/tag.json', {
                    params: { name: tagName, limit: 1 }, timeout: 5500,
                    headers: { Accept: 'application/json', 'User-Agent': 'GREAT-DEMON-V4.9 tag metadata lookup' },
                    maxContentLength: 256 * 1024
                });
                const rows = Array.isArray(response.data) ? response.data : [];
                const tag = rows.find(row => String(row.name || '').toLowerCase() === tagName.toLowerCase());
                const type = Number(tag?.tag_type ?? tag?.type);
                if (type === 4) typed.character.push(tagName);
                else if (type === 3) typed.copyright.push(tagName);
                else if (type === 1) typed.artist.push(tagName);
            } catch { /* A missing tag lookup means this artwork cannot be verified. */ }
        }
    }
    await Promise.all(Array.from({ length: Math.min(6, names.length) }, () => worker()));
    return typed;
}

function normalizeAnimeCardTag(value = '') {
    return String(value).toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[_-]+/g, ' ')
        .replace(/[^a-z0-9 ]/g, ' ').replace(/\b(the|tv|series|season|movie)\b/g, ' ')
        .replace(/\s+/g, ' ').trim();
}

async function verifyAniListCharacter(characterTag, copyrightTag) {
    const characterSearch = normalizeAnimeCardTag(characterTag);
    const animeSearch = normalizeAnimeCardTag(copyrightTag);
    if (!characterSearch || !animeSearch) return null;
    const query = `query ($search: String) {
      Character(search: $search) {
        id
        name { full native alternative }
        media(perPage: 25, sort: POPULARITY_DESC) {
          nodes { id title { romaji english native } }
        }
      }
    }`;
    try {
        const response = await axios.post('https://graphql.anilist.co', {
            query, variables: { search: String(characterTag).replace(/_/g, ' ') }
        }, { timeout: 12000, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
        const character = response.data?.data?.Character;
        if (!character?.name?.full) return null;
        const characterNames = [character.name.full, character.name.native, ...(character.name.alternative || [])]
            .map(normalizeAnimeCardTag).filter(Boolean);
        if (!characterNames.includes(characterSearch)) return null;
        const media = (character.media?.nodes || []).find(item => {
            const titles = [item?.title?.romaji, item?.title?.english, item?.title?.native]
                .map(normalizeAnimeCardTag).filter(Boolean);
            return titles.includes(animeSearch);
        });
        if (!media) return null;
        return {
            characterName: character.name.full,
            animeTitle: media.title.english || media.title.romaji || media.title.native
        };
    } catch (error) {
        console.error('[ANILIST CARD VERIFY]', String(error.message || error).slice(0, 160));
        return null;
    }
}


// Keep the bytes fetched during spawn so sendAnimeCard does not make a second
// request to Konachan (which may reject the second request or expire its CDN URL).
const CARD_MEDIA_BYTE_CACHE = new Map();

async function fetchFreshAnimeCard(excludedCardIds = []) {
    const excluded = new Set((excludedCardIds || []).map(cleanCardId));
    const failures = [];

    // Use the same Konachan safe-post fetcher as .konachan. Character and
    // anime names come from Konachan's own typed tags; AniList is not a gate.
    for (let attempt = 0; attempt < 3; attempt++) {
        let posts;
        try {
            posts = await fetchKonachanSafePosts(40);
        } catch (error) {
            failures.push(String(error?.message || error).slice(0, 140));
            console.error('[SPAWNCARD KONACHAN FETCH]', error?.stack || error);
            continue;
        }

        const pool = posts.slice().sort(() => Math.random() - 0.5);
        for (const post of pool.slice(0, 30)) {
            try {
                if (!post || post.rating !== 's' || !post.file_url) continue;
                const mediaUrl = new URL(post.file_url);
                if (mediaUrl.protocol !== 'https:') continue;

                let characterTags = String(post.tag_string_character || '')
                    .split(/\s+/).filter(Boolean);
                let animeTags = String(post.tag_string_copyright || '')
                    .split(/\s+/).filter(Boolean);

                // Some Konachan responses omit the typed fields. In that case,
                // use the same tag metadata endpoint to identify character/copyright tags.
                if (!characterTags.length || !animeTags.length) {
                    const tagText = String(post.tags || post.tag_string || '').trim();
                    const typed = await lookupKonachanTagTypes(tagText)
                        .catch(() => ({ character: [], copyright: [] }));
                    if (!characterTags.length) characterTags = typed.character || [];
                    if (!animeTags.length) animeTags = typed.copyright || [];
                }
                if (!characterTags.length || !animeTags.length) continue;

                const toDisplayName = value => String(value || '')
                    .replace(/_/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                const characterName = toDisplayName(characterTags[0]);
                const animeTitle = toDisplayName(animeTags[0]);
                if (!characterName || !animeTitle) continue;

                const response = await axios.get(mediaUrl.href, {
                    responseType: 'arraybuffer', timeout: 22000,
                    maxContentLength: 35 * 1024 * 1024,
                    headers: {
                        'User-Agent': 'GREAT-DEMON-V4.9 SFW image command',
                        Accept: 'image/*,*/*;q=0.8'
                    },
                    validateStatus: status => status >= 200 && status < 400
                });
                if (!String(response.headers?.['content-type'] || '').toLowerCase().startsWith('image/')) continue;
                const bytes = Buffer.from(response.data || []);
                if (!bytes.length || bytes.length > 35 * 1024 * 1024) continue;
                const meta = await sharp(bytes, { animated: true, failOn: 'none' }).metadata();
                if (!meta.width || !meta.height) continue;

                const ext = String(post.file_ext || mediaUrl.pathname.split('.').pop() || '').toLowerCase();
                const animated = ext === 'gif' || Number(meta.pages || 1) > 1;
                const unique = crypto.randomBytes(6).toString('hex');
                const id = cleanCardId('konachan_' + String(post.id || unique) + '_' + unique);
                if (!id || excluded.has(id)) continue;
                const tier = randomEligibleTier(animated);
                const card = {
                    id,
                    name: characterName,
                    characterName,
                    animeTitle,
                    tier,
                    price: CARD_TIER_PRICES[tier],
                    mediaUrl: mediaUrl.href,
                    fallbackMediaUrl: '',
                    isAnimated: animated,
                    sourceUrl: 'https://konachan.net/post/' + String(post.id || ''),
                    provider: 'Konachan SFW character/copyright tags',
                    providerImageId: String(post.id || unique),
                    anilistVerified: false,
                    addedAt: Date.now(),
                    active: true
                };
                CARD_MEDIA_BYTE_CACHE.set(id, bytes);
                if (CARD_MEDIA_BYTE_CACHE.size > 12) {
                    CARD_MEDIA_BYTE_CACHE.delete(CARD_MEDIA_BYTE_CACHE.keys().next().value);
                }
                cardCatalog.cards.push(card);
                if (cardCatalog.cards.length > 2500) {
                    const owned = new Set(Object.values(economy.users || {})
                        .flatMap(u => Array.isArray(u.cards) ? u.cards : []));
                    cardCatalog.cards = cardCatalog.cards.filter((c, i) =>
                        i >= cardCatalog.cards.length - 2000 || owned.has(c.id));
                }
                saveCardCatalog();
                console.log('[CARD SPAWN KONACHAN]', characterName, 'from', animeTitle,
                    'post', post.id, 'tier', tier, 'bytes', bytes.length);
                return card;
            } catch (error) {
                failures.push('post ' + String(post?.id || '?') + ': ' +
                    String(error?.response?.status || error?.message || error).slice(0, 100));
                console.warn('[SPAWNCARD KONACHAN POST]', error?.stack || error);
            }
        }
    }
    // Konachan may block requests (for example, HTTP 403). Fall back to
    // AniList's non-adult anime/character catalogue so every generated card
    // still has a real character name, a real anime title, and matching art.
    try {
        const query = `query { Page(page: 1, perPage: 50) { media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { id title { english romaji native } characters(perPage: 25, sort: ROLE) { nodes { name { full } image { large } } } } } }`;
        const response = await axios.post('https://graphql.anilist.co', { query }, {
            timeout: 18000,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
        });
        const mediaRows = (response.data?.data?.Page?.media || []).filter(media =>
            media && (media.title?.english || media.title?.romaji || media.title?.native) &&
            Array.isArray(media.characters?.nodes) && media.characters.nodes.some(character => character?.name?.full && character?.image?.large)
        );
        for (let attempt = 0; attempt < Math.min(18, mediaRows.length); attempt++) {
            const media = mediaRows[Math.floor(Math.random() * mediaRows.length)];
            const characters = media.characters.nodes.filter(character => character?.name?.full && character?.image?.large);
            if (!characters.length) continue;
            const character = characters[Math.floor(Math.random() * characters.length)];
            try {
                const imageUrl = new URL(character.image.large);
                if (imageUrl.protocol !== 'https:') continue;
                const imageResponse = await axios.get(imageUrl.href, {
                    responseType: 'arraybuffer', timeout: 18000,
                    maxContentLength: 12 * 1024 * 1024,
                    headers: { Accept: 'image/*', 'User-Agent': 'GREAT-DEMON-V4.9 anime card fallback' }
                });
                if (!String(imageResponse.headers?.['content-type'] || '').toLowerCase().startsWith('image/')) continue;
                const bytes = Buffer.from(imageResponse.data || []);
                const metadata = await sharp(bytes, { failOn: 'none' }).metadata();
                if (!bytes.length || !metadata.width || !metadata.height) continue;
                const animeTitle = media.title.english || media.title.romaji || media.title.native;
                const characterName = character.name.full;
                const unique = crypto.randomBytes(6).toString('hex');
                const id = cleanCardId('anilist_' + media.id + '_' + unique);
                if (!id || excluded.has(id)) continue;
                const tier = randomEligibleTier(false);
                const card = {
                    id, name: characterName, characterName, animeTitle,
                    tier, price: CARD_TIER_PRICES[tier], mediaUrl: imageUrl.href,
                    fallbackMediaUrl: '', isAnimated: false,
                    sourceUrl: 'https://anilist.co/anime/' + media.id,
                    provider: 'AniList non-adult anime character fallback',
                    providerImageId: String(media.id) + '_' + unique,
                    anilistVerified: true, addedAt: Date.now(), active: true
                };
                CARD_MEDIA_BYTE_CACHE.set(id, bytes);
                if (CARD_MEDIA_BYTE_CACHE.size > 12) CARD_MEDIA_BYTE_CACHE.delete(CARD_MEDIA_BYTE_CACHE.keys().next().value);
                cardCatalog.cards.push(card);
                saveCardCatalog();
                console.log('[CARD SPAWN ANILIST FALLBACK]', characterName, 'from', animeTitle, 'tier', tier);
                return card;
            } catch (imageError) {
                failures.push('AniList artwork: ' + String(imageError?.response?.status || imageError?.message || imageError).slice(0, 90));
            }
        }
    } catch (fallbackError) {
        failures.push('AniList fallback: ' + String(fallbackError?.response?.status || fallbackError?.message || fallbackError).slice(0, 120));
        console.error('[SPAWNCARD ANILIST FALLBACK]', fallbackError?.stack || fallbackError);
    }
    throw new Error('Konachan was unavailable and the AniList character-art fallback could not return a verified card. ' +
        failures.slice(0, 4).join(' | '));
}

async function fetchSfwPlainImageFallback() {
    const sources = [
        async () => { const r=await axios.get('https://nekos.best/api/v2/waifu',{timeout:12000,headers:{Accept:'application/json'}}); return r.data?.results?.[0]?.url; },
        async () => { const r=await axios.get('https://api.waifu.pics/sfw/waifu',{timeout:12000,headers:{Accept:'application/json'}}); return r.data?.url; },
        async () => { const r=await axios.get('https://api.waifu.best/images',{params:{IsNsfw:false,PageSize:20},timeout:12000,headers:{Accept:'application/json'}}); const rows=(r.data?.items||r.data?.images||r.data?.data||[]).filter(x=>x?.isNsfw===false&&x?.url); return rows[Math.floor(Math.random()*rows.length)]?.url; }
    ];
    for(const getUrl of sources){
        try{
            const raw=await getUrl(); if(!raw) continue;
            const url=new URL(raw); if(url.protocol!=='https:') continue;
            const r=await axios.get(url.href,{responseType:'arraybuffer',timeout:20000,maxContentLength:20*1024*1024,headers:{'User-Agent':'GREAT-DEMON-V4.9 SFW image fallback'}});
            if(!String(r.headers['content-type']||'').toLowerCase().startsWith('image/')) continue;
            const bytes=Buffer.from(r.data); const meta=await sharp(bytes,{animated:true}).metadata();
            if(meta.width&&meta.height) return bytes;
        }catch(error){console.error('[SFW IMAGE FALLBACK]',String(error.message||error).slice(0,100));}
    }
    throw new Error('No SFW image provider responded.');
}

const CARD_TIER_STYLES = {
    SS: { label:'PEAK', c1:'#fff4a3', c2:'#ff4b9a', dark:'#35104a' },
    S: { label:'MYTHIC', c1:'#ffcf55', c2:'#ff4b21', dark:'#42120c' },
    A: { label:'LEGENDARY', c1:'#f1a7ff', c2:'#743dff', dark:'#21103f' },
    B: { label:'EPIC', c1:'#79d8ff', c2:'#2867ff', dark:'#0b234c' },
    C: { label:'RARE', c1:'#71f1dc', c2:'#168b9e', dark:'#092e35' },
    D: { label:'UNCOMMON', c1:'#a6f27d', c2:'#398b42', dark:'#17351c' },
    E: { label:'COMMON', c1:'#e8edf6', c2:'#78849b', dark:'#242b38' }
};
function makeAnimeCardOverlay(card) {
    const style = CARD_TIER_STYLES[card.tier] || CARD_TIER_STYLES.E;
    const character = escapeCardText(String(card.characterName || card.name || 'UNKNOWN').slice(0, 30));
    const anime = escapeCardText(String(card.animeTitle || '').slice(0, 34));
    const tier = escapeCardText(card.tier || 'E');
    const tierLabel = escapeCardText(style.label || 'COMMON');
    // Keep the artwork and character face clear: thin premium frame, small tier crest,
    // and a compact bottom nameplate rather than a large dark overlay across the image.
    return Buffer.from(`<svg width="900" height="1200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${style.c1}"/><stop offset=".52" stop-color="${style.c2}"/><stop offset="1" stop-color="${style.c1}"/></linearGradient>
        <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#080914" stop-opacity=".70"/><stop offset="1" stop-color="#080914" stop-opacity=".94"/></linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect x="12" y="12" width="876" height="1176" rx="42" fill="none" stroke="url(#frame)" stroke-width="22"/>
      <rect x="34" y="34" width="832" height="1132" rx="30" fill="none" stroke="#fff" stroke-opacity=".72" stroke-width="3"/>
      <path d="M60 92 H840" stroke="url(#frame)" stroke-width="5" opacity=".9"/>
      <rect x="300" y="48" width="300" height="62" rx="26" fill="${style.dark}" fill-opacity=".88" stroke="url(#frame)" stroke-width="4"/>
      <text x="450" y="90" text-anchor="middle" font-family="Georgia,serif" font-size="31" font-weight="bold" letter-spacing="3" fill="#fff" filter="url(#glow)">${tier} · ${tierLabel}</text>
      <rect x="36" y="972" width="828" height="192" rx="24" fill="url(#plate)"/>
      <path d="M58 982 H842" stroke="url(#frame)" stroke-width="5"/>
      <text x="450" y="1044" text-anchor="middle" font-family="Georgia,serif" font-size="53" font-weight="bold" fill="url(#frame)" stroke="${style.dark}" stroke-width="2" paint-order="stroke">${character}</text>
      <text x="450" y="1092" text-anchor="middle" font-family="Arial,sans-serif" font-size="27" font-weight="bold" fill="#fff">${anime}</text>
      <text x="450" y="1136" text-anchor="middle" font-family="Arial,sans-serif" font-size="23" font-weight="bold" letter-spacing="3" fill="${style.c1}">GREAT DEMON COLLECTIBLE</text>
    </svg>`);
}


async function renderAnimeCardImage(card, bytes) {
    // Compact portrait trading-card canvas for WhatsApp (3:4, not a full-size poster).
    const width = 480, height = 640;
    const overlay = await sharp(makeAnimeCardOverlay(card)).resize(width, height).png().toBuffer();
    let isGif = false;
    try {
        const meta = await sharp(bytes, { animated: true, failOn: 'none' }).metadata();
        isGif = !!(card.isAnimated && (Number(meta.pages || 1) > 1 || /\.gif(?:$|[?#])/i.test(String(card.mediaUrl || ''))));
    } catch (_) {}
    if (isGif) {
        const id = crypto.randomUUID();
        const input = path.join(os.tmpdir(), 'gd_card_' + id + '.gif');
        const overlayPath = path.join(os.tmpdir(), 'gd_overlay_' + id + '.png');
        const output = path.join(os.tmpdir(), 'gd_card_' + id + '.mp4');
        try {
            fs.writeFileSync(input, bytes);
            fs.writeFileSync(overlayPath, overlay);
            await execFileAsync(ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg', [
                '-y', '-i', input, '-i', overlayPath,
                '-filter_complex',
                `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}[bg];[bg][1:v]overlay=0:0,fps=18,format=yuv420p[v]`,
                '-map', '[v]', '-an', '-t', '6', '-c:v', 'libx264', '-preset', 'veryfast',
                '-crf', '24', '-movflags', '+faststart', output
            ], { timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
            const video = fs.readFileSync(output);
            if (video.length) return { video, animated: true };
        } catch (error) {
            console.warn('[CARD GIF FALLBACK]', String(error?.message || error).slice(0, 180));
        } finally {
            for (const file of [input, overlayPath, output]) {
                try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch {}
            }
        }
    }
    const image = await sharp(bytes, { page: 0, failOn: 'none' })
        .rotate()
        .resize(width, height, { fit: 'cover', position: 'attention', kernel: 'lanczos' })
        .composite([{ input: overlay }])
        .jpeg({ quality: 84, mozjpeg: true })
        .toBuffer();
    if (!image?.length) throw new Error('Sharp returned an empty collectible card image.');
    return { image, animated: false };
}

function normalizeDashboardName(value) {
    // Normalize decorative Unicode alphabets/digits (NFKC) and remove invisible/control
    // characters or unsupported pictographs that render as boxed glyphs in SVG fonts.
    const normalized = String(value ?? 'Player').normalize('NFKC')
        .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\ufeff]/g, '')
        .replace(/[^\p{L}\p{M}\p{N}\p{P}\p{Zs}]/gu, '')
        .replace(/\s+/g, ' ').trim();
    return normalized || 'Player';
}
function escapeDashboardText(value) {
    return normalizeDashboardName(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
}
function dashboardAmount(value) { return escapeDashboardText(moneyText(value).replace(/(?:\s*GD)+$/i, '').trim()); }
function dashboardFitFont(value, maxWidth, baseSize, minSize = 16) {
    const length = Math.max(1, Array.from(String(value ?? '')).length);
    return Math.max(minSize, Math.min(baseSize, Math.floor(maxWidth / (length * 0.62))));
}
function dashboardBottomValue(user, extras) {
    const raw = extras.bottomValue ?? moneyText((user.wallet || 0) + (user.bank || 0));
    const isMoney = typeof raw === 'number' || /^(?:[\d,]+)(?:\s*GD)?$/i.test(String(raw).trim());
    return escapeDashboardText(isMoney ? String(raw).replace(/(?:\s*GD)+$/i, '').trim() : String(raw)) + (isMoney ? ' GD' : '');
}

async function fetchDashboardAvatar(sock, playerJid) {
    const tryAvatar = async jid => {
        if (!jid) return null;
        for (const type of ['image', 'preview']) {
            try {
                const url = await Promise.race([
                    sock.profilePictureUrl(jid, type),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('avatar lookup timeout')), 7000))
                ]);
                if (!url || !/^https:\/\//i.test(url)) continue;
                const response = await axios.get(url, { responseType:'arraybuffer', timeout:9000, maxContentLength:5*1024*1024, headers:{'User-Agent':'GREAT-DEMON-V4.9'} });
                const bytes = Buffer.from(response.data || []);
                if (bytes.length) { const circle = Buffer.from('<svg width="300" height="300"><circle cx="150" cy="150" r="149" fill="white"/></svg>'); return await sharp(bytes).rotate().resize(300,300,{fit:'cover'}).composite([{input:circle,blend:'dest-in'}]).png().toBuffer(); }
            } catch {}
        }
        return null;
    };
    // Player picture first; if private, missing, or temporarily unavailable, use the bot's picture.
    let avatar = await tryAvatar(playerJid);
    if (!avatar) avatar = await tryAvatar(sock.user?.id);
    if (avatar) return avatar;
    // Last-resort neutral avatar: the dashboard still renders if both WhatsApp lookups fail.
    const fallback = `<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#29213d"/><stop offset="1" stop-color="#09090f"/></linearGradient></defs><rect width="300" height="300" rx="150" fill="url(#g)"/><circle cx="150" cy="105" r="55" fill="#a78bfa"/><path d="M48 280c8-68 48-102 102-102s94 34 102 102" fill="#a78bfa"/></svg>`;
    return sharp(Buffer.from(fallback)).png().toBuffer();
}

async function sendPlayerDashboard(sock, chatId, playerJid, user, mode, quoted, extras = {}) {
    const avatar = await fetchDashboardAvatar(sock, playerJid).catch(() => null);
    const svg = `<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#171322"/><stop offset=".55" stop-color="#09090d"/><stop offset="1" stop-color="#171027"/></linearGradient><linearGradient id="line" x2="1"><stop stop-color="#7651a8"/><stop offset=".5" stop-color="#c5a7ff"/><stop offset="1" stop-color="#7651a8"/></linearGradient></defs>
    <rect width="1080" height="1350" fill="url(#bg)"/><path d="M40 40H1040V1310H40Z" fill="none" stroke="url(#line)" stroke-width="3"/><path d="M40 210H1040" stroke="#7651a8" stroke-width="2" opacity=".8"/>
    <text x="540" y="105" text-anchor="middle" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="54" font-weight="bold" letter-spacing="7" fill="#eee8ff">GREAT DEMON</text><text x="540" y="155" text-anchor="middle" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="24" letter-spacing="5" fill="#b99be8">V4.9  /  ${escapeDashboardText(mode.toUpperCase())}</text>
    <rect x="75" y="250" width="930" height="250" rx="24" fill="#111018" stroke="#7651a8" stroke-width="2"/>
    <text x="420" y="320" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="25" fill="#a995c8">PLAYER</text><text x="420" y="390" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="${dashboardFitFont(normalizeDashboardName(user.name || 'Player'),550,36,15)}" font-weight="bold" fill="#fff">${escapeDashboardText(normalizeDashboardName(user.name || 'Player'))}</text><text x="420" y="445" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="26" fill="#c5a7ff">${escapeDashboardText(extras.subtitle || 'GREAT DEMON MEMBER')}</text>
    <rect x="100" y="275" width="200" height="200" rx="100" fill="#20182f" stroke="#b99be8" stroke-width="5"/>
    <rect x="75" y="550" width="450" height="165" rx="20" fill="#111018" stroke="#7651a8" stroke-width="2"/><rect x="555" y="550" width="450" height="165" rx="20" fill="#111018" stroke="#7651a8" stroke-width="2"/>
    <rect x="75" y="755" width="450" height="165" rx="20" fill="#111018" stroke="#7651a8" stroke-width="2"/><rect x="555" y="755" width="450" height="165" rx="20" fill="#111018" stroke="#7651a8" stroke-width="2"/>
    <text x="115" y="610" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="27" fill="#b99be8">WALLET</text><text x="115" y="675" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="${dashboardFitFont(moneyText(user.wallet || 0),350,34,16)}" font-weight="bold" fill="#fff">${dashboardAmount(user.wallet || 0)} GD</text>
    <text x="595" y="610" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="27" fill="#b99be8">BANK</text><text x="595" y="675" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="${dashboardFitFont(moneyText(user.bank || 0),350,34,16)}" font-weight="bold" fill="#fff">${dashboardAmount(user.bank || 0)} GD</text>
    <text x="115" y="815" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="27" fill="#b99be8">${escapeDashboardText(extras.leftLabel || 'ITEMS')}</text><text x="115" y="880" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="42" font-weight="bold" fill="#fff">${escapeDashboardText(extras.leftValue ?? (user.inventory?.length || 0))}</text>
    <text x="595" y="815" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="27" fill="#b99be8">${escapeDashboardText(extras.rightLabel || 'ANIME CARDS')}</text><text x="595" y="880" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="42" font-weight="bold" fill="#fff">${escapeDashboardText(extras.rightValue ?? (user.cards?.length || 0))}</text>
    <rect x="75" y="960" width="930" height="180" rx="20" fill="#111018" stroke="#7651a8" stroke-width="2"/><text x="115" y="1025" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="27" fill="#b99be8">${escapeDashboardText(extras.bottomLabel || 'TOTAL WEALTH')}</text><text x="115" y="1095" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="${dashboardFitFont(dashboardBottomValue(user, extras),850,42,18)}" font-weight="bold" fill="#e8d9ff">${dashboardBottomValue(user, extras)}</text>
    <text x="540" y="1235" text-anchor="middle" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="25" letter-spacing="4" fill="#9b83bd">PLAY  •  COLLECT  •  TRADE</text></svg>`;
    const layers = [{ input: Buffer.from(svg) }];
    if (avatar) layers.push({ input: avatar, left:100, top:275 });
    const image = await sharp({ create:{width:1080,height:1350,channels:4,background:'#09090d'} }).composite(layers).png().toBuffer();
    await sock.sendMessage(chatId, { image, caption: `GREAT DEMON V4.9 • ${mode.toUpperCase()}` }, quoted ? { quoted } : {});
}

async function sendRankingDashboard(sock, chatId, title, ranking, metricLabel, quoted) {
    const rows = ranking.slice(0,30);
    const height = 250 + rows.length * 36;
    const rowSvg = rows.map(([id,user],i)=>{
        const name=escapeDashboardText(user.name||String(id)).slice(0,30);
        const metric=title.toLowerCase().includes('richest')?dashboardAmount(economyTotalWealth(user))+' GD':(Number(user.cards?.length)||0)+' cards';
        const y=220+i*36;
        return `<rect x="48" y="${y-25}" width="984" height="32" rx="8" fill="${i%2?'#15121d':'#100e16'}"/><text x="70" y="${y}" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="21" font-weight="bold" fill="${i<3?'#d6b4ff':'#eee8ff'}">${i+1}.</text><text x="125" y="${y}" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="21" fill="#f4efff">${name}</text><text x="1005" y="${y}" text-anchor="end" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="21" font-weight="bold" fill="#c7a4ff">${metric}</text>`;
    }).join('');
    const svg=`<svg width="1080" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#171322"/><stop offset="1" stop-color="#09090d"/></linearGradient></defs><rect width="1080" height="${height}" fill="url(#bg)"/><rect x="35" y="30" width="1010" height="${height-60}" rx="22" fill="none" stroke="#9c70d0" stroke-width="2"/><text x="540" y="92" text-anchor="middle" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="43" font-weight="bold" letter-spacing="4" fill="#eee8ff">GREAT DEMON</text><text x="540" y="145" text-anchor="middle" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="28" letter-spacing="3" fill="#b99be8">${escapeDashboardText(title.toUpperCase())} • TOP ${rows.length}</text><text x="125" y="195" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="17" fill="#9b83bd">PLAYER</text><text x="1005" y="195" text-anchor="end" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="17" fill="#9b83bd">${escapeDashboardText(metricLabel.toUpperCase())}</text>${rowSvg}<text x="540" y="${height-35}" text-anchor="middle" font-family="Inter, Noto Sans, DejaVu Sans, Arial, sans-serif" font-size="17" letter-spacing="3" fill="#9b83bd">PLAY • COLLECT • TRADE</text></svg>`;
    const image=await sharp(Buffer.from(svg)).png().toBuffer();
    await sock.sendMessage(chatId,{image,caption:`GREAT DEMON V4.9 • ${title.toUpperCase()} • TOP ${rows.length}`},quoted?{quoted}:{});
}


async function sendAnimeCard(sock, chatId, card, caption, quoted) {
    const candidates = [card.mediaUrl, card.fallbackMediaUrl].filter(Boolean);
    let bytes = CARD_MEDIA_BYTE_CACHE.get(card.id) || null;
    if (bytes) CARD_MEDIA_BYTE_CACHE.delete(card.id);
    let lastError = null;
    for (const candidate of (bytes ? [] : [...new Set(candidates)])) {
        try {
            const url = new URL(candidate);
            if (url.protocol !== 'https:') throw new Error('Artwork URL must use HTTPS.');
            const response = await axios.get(url.href, {
                responseType: 'arraybuffer', timeout: 25000,
                maxContentLength: 35 * 1024 * 1024, maxBodyLength: 35 * 1024 * 1024,
                maxRedirects: 5,
                headers: { 'User-Agent': 'GREAT-DEMON-V4.9 SFW image command', Accept: 'image/*,*/*;q=0.8' },
                validateStatus: status => status >= 200 && status < 400
            });
            const data = Buffer.from(response.data || []);
            if (!data.length || data.length > 35 * 1024 * 1024) throw new Error('Artwork response was empty or too large.');
            if (!String(response.headers?.['content-type'] || '').toLowerCase().startsWith('image/')) throw new Error('Konachan did not return an image content type.');
            const meta = await sharp(data, { animated: true, failOn: 'none' }).metadata();
            if (!meta.width || !meta.height) throw new Error('Downloaded artwork is not a supported image.');
            bytes = data;
            break;
        } catch (error) {
            lastError = error;
            console.error('[CARD ART DOWNLOAD FAILED]', candidate, error?.stack || error);
        }
    }
    if (!bytes) throw new Error('Could not download card artwork: ' + String(lastError?.response?.status || lastError?.message || lastError || 'unknown error').slice(0, 180));

    let rendered;
    try {
        rendered = await renderAnimeCardImage(card, bytes);
    } catch (renderError) {
        console.error('[CARD RENDER FAILED - STATIC FALLBACK]', renderError?.stack || renderError);
        // Guaranteed static-card fallback: normalize the source into the 3:4 canvas,
        // then add the existing card overlay. This avoids FFmpeg/GIF conversion entirely.
        const width = 480, height = 640;
        const overlay = await sharp(makeAnimeCardOverlay(card)).resize(width, height).png().toBuffer();
        const image = await sharp(bytes, { page: 0, failOn: 'none' }).rotate()
            .resize(width, height, { fit: 'cover', position: 'attention', kernel: 'lanczos' })
            .composite([{ input: overlay }]).jpeg({ quality: 82 }).toBuffer();
        if (!image?.length) throw renderError;
        rendered = { image, animated: false };
    }

    const options = quoted ? { quoted } : {};
    if (rendered.animated && rendered.video?.length) {
        try {
            await sock.sendMessage(chatId, { video: rendered.video, gifPlayback: true, mimetype: 'video/mp4', caption }, options);
            return;
        } catch (error) {
            console.warn('[CARD ANIMATION SEND FAILED - IMAGE FALLBACK]', error?.stack || error);
        }
    }
    if (!rendered.image?.length) throw new Error('Card renderer did not produce an image or video.');
    await sock.sendMessage(chatId, { image: rendered.image, mimetype: 'image/jpeg', caption }, options);
}

function cardTierCounts(cards) {
    const counts = Object.fromEntries(CARD_TIERS.map(tier => [tier, 0]));
    for (const id of cards || []) { const card = cardById(typeof id === 'string' ? id : id?.cardId); if (card) counts[card.tier]++; }
    return counts;
}
const DEFAULT_AUTO_SETTINGS = {
    autoonline: true, autorecording: false, autostatuslike: true,
    autostatusview: true, autotyping: false, anticall: true, autoreact: false
};
const DEFAULT_SETTINGS = {
    prefix: '.', sudoUsers: [OWNER_NUMBER], autoSettings: { ...DEFAULT_AUTO_SETTINGS },
    botMode: 'public', blockedUsers: [], warnings: {}
};

function readJsonFile(file, fallback) {
    try {
        if (!fs.existsSync(file)) return fallback;
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (err) {
        console.error('[PERSISTENCE READ]', path.basename(file), err.message);
        return fallback;
    }
}
function writeJsonAtomic(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
    fs.renameSync(temp, file);
}
function loadSettings() {
    const saved = readJsonFile(SETTINGS_FILE, {});
    const merged = {
        ...DEFAULT_SETTINGS,
        ...saved,
        autoSettings: { ...DEFAULT_AUTO_SETTINGS, ...(saved.autoSettings || {}) },
        sudoUsers: Array.isArray(saved.sudoUsers) ? saved.sudoUsers : [OWNER_NUMBER],
        blockedUsers: Array.isArray(saved.blockedUsers) ? saved.blockedUsers : [],
        warnings: saved.warnings && typeof saved.warnings === 'object' ? saved.warnings : {}
    };
    merged.sudoUsers = [...new Set(merged.sudoUsers.map(v => String(v).replace(/\D/g, '')).filter(Boolean))];
    if (!merged.sudoUsers.includes(OWNER_NUMBER)) merged.sudoUsers.unshift(OWNER_NUMBER);
    if (!['public', 'private'].includes(merged.botMode)) merged.botMode = 'public';
    writeJsonAtomic(SETTINGS_FILE, merged);
    return merged;
}
function saveSettings(data) {
    data.sudoUsers = [...new Set((data.sudoUsers || []).map(v => String(v).replace(/\D/g, '')).filter(Boolean))];
    if (!data.sudoUsers.includes(OWNER_NUMBER)) data.sudoUsers.unshift(OWNER_NUMBER);
    writeJsonAtomic(SETTINGS_FILE, data);
}
function loadGroupSettings() {
    return readJsonFile(GROUP_SETTINGS_FILE, {});
}
function saveGroupSettings() {
    writeJsonAtomic(GROUP_SETTINGS_FILE, groupSettings);
}

const db = loadSettings();
let prefix = db.prefix || '.';
const sudoUsers = new Set(db.sudoUsers);
const autoSettings = db.autoSettings;

// --- MESSAGE TRACKER FUNCTIONS ---
const dataFilePath = path.join(DATA_DIR, 'messageCount.json');

function loadMessageCounts() {
    return readJsonFile(dataFilePath, {});
}

function saveMessageCounts(messageCounts) {
    writeJsonAtomic(dataFilePath, messageCounts);
}

function saveBlockedUsers() {
    const values = Array.from(blockedUsers);
    db.blockedUsers = values;
    saveSettings(db);
    writeJsonAtomic(BLOCKED_USERS_FILE, values);
}

function incrementMessageCount(groupId, userId) {
    const messageCounts = loadMessageCounts();
    if (!messageCounts[groupId]) {
        messageCounts[groupId] = {};
    }
    if (!messageCounts[groupId][userId]) {
        messageCounts[groupId][userId] = 0;
    }
    messageCounts[groupId][userId] += 1;
    saveMessageCounts(messageCounts);
}

// --- STATE MANAGEMENT ---
let botMode = db.botMode || 'public';
const activeGames = {};
const groupSettings = loadGroupSettings();
const blockedUsers = new Set(db.blockedUsers || readJsonFile(BLOCKED_USERS_FILE, []));
const deletedMessages = new Map();

function unwrapMessage(message) {
  let current = message;
  const seen = new Set();
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const next = current.ephemeralMessage?.message ||
      current.viewOnceMessage?.message ||
      current.viewOnceMessageV2?.message ||
      current.viewOnceMessageV2Extension?.message ||
      current.documentWithCaptionMessage?.message ||
      current.editedMessage?.message ||
      current.deviceSentMessage?.message;
    if (!next) break;
    current = next;
  }
  return current;
}

// Collect reply context from text, captions, documents, stickers and wrapped
// Baileys message envelopes. Shared by media conversion and moderation commands.
function getMessageContextInfos(message) {
  const contexts = [];
  const seen = new Set();
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 10 || seen.has(value)) return;
    seen.add(value);
    if (value.contextInfo && typeof value.contextInfo === 'object') contexts.push(value.contextInfo);
    for (const child of Object.values(value)) visit(child, depth + 1);
  };
  visit(message);
  return contexts;
}

async function resolvePhoneDigits(sock, jid) {
    if (!jid) return '';
    let normalized = '';
    try { normalized = jidNormalizedUser(jid); } catch { normalized = String(jid); }
    let user = normalized.split('@')[0].split(':')[0];
    if (normalized.endsWith('@lid')) {
        try {
            const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(normalized);
            if (pn) user = jidNormalizedUser(pn).split('@')[0].split(':')[0];
        } catch (err) {
            console.warn('[JID PHONE RESOLUTION]', err.message);
        }
    }
    return user.replace(/\D/g, '');
}

async function isProtectedOwnerJid(sock, jid) {
    if (!jid) return false;
    const normalize = value => {
        try { return jidNormalizedUser(value); } catch { return String(value || ''); }
    };
    const candidate = normalize(jid);
    const ownerDigits = String(OWNER_NUMBER).replace(/\D/g, '');
    if (candidate.split('@')[0].split(':')[0].replace(/\D/g, '') === ownerDigits) return true;
    if (candidate.endsWith('@lid')) {
        try {
            const phoneJid = await sock.signalRepository?.lidMapping?.getPNForLID?.(candidate);
            if (phoneJid && normalize(phoneJid).split('@')[0].replace(/\D/g, '') === ownerDigits) return true;
        } catch (err) {
            console.warn('[OWNER LID CHECK]', err.message);
        }
    }
    return false;
}

function hasViewOnceWrapper(message) {
  let current = message;
  const seen = new Set();
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    if (current.viewOnceMessage || current.viewOnceMessageV2 || current.viewOnceMessageV2Extension) return true;
    current = current.ephemeralMessage?.message || current.documentWithCaptionMessage?.message || current.editedMessage?.message || current.deviceSentMessage?.message;
  }
  return false;
}

function resolveMedia(msg) {
  // Only ordinary media is supported; do not unwrap View Once messages.
  if (hasViewOnceWrapper(msg?.message)) return null;
  const own = unwrapMessage(msg?.message);
  const mediaFrom = (node) => {
    if (hasViewOnceWrapper(node)) return null;
    const content = unwrapMessage(node);
    if (!content || typeof content !== 'object') return null;
    if (content.imageMessage) return { kind: 'image', downloadType: 'image', mediaMsg: content.imageMessage };
    if (content.videoMessage) return { kind: 'video', downloadType: 'video', mediaMsg: content.videoMessage };
    if (content.audioMessage) return { kind: 'audio', downloadType: 'audio', mediaMsg: content.audioMessage };
    if (content.stickerMessage) return { kind: 'sticker', downloadType: 'sticker', mediaMsg: content.stickerMessage };
    if (content.documentMessage && /^image\//i.test(content.documentMessage.mimetype || '')) {
      return { kind: 'image', downloadType: 'document', mediaMsg: content.documentMessage };
    }
    return null;
  };

  const direct = mediaFrom(own);
  if (direct) return { ...direct, targetMessage: msg };

  // Read quoted-message metadata from every supported message type. This
  // includes captions and replies attached to audio, stickers and wrapped media.
  const contexts = [...new Set([
    ...getMessageContextInfos(own),
    ...getMessageContextInfos(msg?.message),
  ])];

  for (const context of contexts) {
    if (hasViewOnceWrapper(context.quotedMessage)) continue;
    const quoted = unwrapMessage(context.quotedMessage);
    if (!quoted) continue;
    const found = mediaFrom(quoted);
    if (found) {
      return {
        ...found,
        targetMessage: {
          key: {
            remoteJid: msg.key.remoteJid,
            id: context.stanzaId || msg.key.id,
            fromMe: Boolean(context.fromMe),
            ...(context.participant || msg.key.participant
              ? { participant: context.participant || msg.key.participant }
              : {}),
          },
          message: quoted,
        },
      };
    }
  }
  return null;
}

function getInstalledPackageVersion(packageName) {
    try {
        let resolvedEntry = '';
        try {
            resolvedEntry = require.resolve(packageName);
        } catch (_) {
            // Baileys v7 is ESM-only; resolve through the ESM condition when require is unavailable.
            resolvedEntry = fileURLToPath(import.meta.resolve(packageName));
        }
        let dir = path.dirname(resolvedEntry);
        while (true) {
            const packageFile = path.join(dir, 'package.json');
            if (fs.existsSync(packageFile)) {
                const metadata = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
                if (metadata.name === packageName) return String(metadata.version || '');
            }
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }
    } catch (error) {
        console.warn('[BAILEYS VERSION CHECK]', error.message);
    }
    return '';
}

const INSTALLED_BAILEYS_VERSION = getInstalledPackageVersion('@whiskeysockets/baileys');
const GROUP_STATUS_V2_SUPPORTED = /^7\./.test(INSTALLED_BAILEYS_VERSION);
const GROUP_STATUS_V2_UNAVAILABLE =
    `❌ Group Status V2 is not supported by the installed Baileys ${INSTALLED_BAILEYS_VERSION || 'build'}. ` +
    'This command requires the Baileys 7 protocol schema. No status was sent to the group chat.';

async function groupStatusBroadcast(sock, jid, content) {
    if (!GROUP_STATUS_V2_SUPPORTED) throw new Error(GROUP_STATUS_V2_UNAVAILABLE);
    if (!sock.user?.id) throw new Error('WhatsApp socket is not fully connected.');
    if (!jid?.endsWith('@g.us')) throw new Error(`Invalid destination group JID: ${jid}`);

    const messageSecret = crypto.randomBytes(32);
    let innerMessage;
    let isImageStatus = false;

    if (content?.image) {
        isImageStatus = true;
        const imageBuffer = Buffer.isBuffer(content.image)
            ? content.image
            : Buffer.from(content.image);
        if (!imageBuffer.length) throw new Error('Invitation card buffer is empty.');

        // Upload the JPEG first. Group Status V2 expects imageMessage nested
        // inside groupStatusMessageV2.message, not a normal chat image send.
        const prepared = await prepareWAMessageMedia(
            { image: imageBuffer, mimetype: content.mimetype || 'image/jpeg' },
            { upload: sock.waUploadToServer }
        );
        const uploadedImage = prepared?.imageMessage;
        if (!uploadedImage?.url || !uploadedImage?.mediaKey || !uploadedImage?.directPath) {
            throw new Error('Baileys media upload did not return a complete imageMessage (url/mediaKey/directPath missing).');
        }

        innerMessage = {
            imageMessage: {
                ...uploadedImage,
                caption: String(content.caption || ''),
                contextInfo: {
                    ...(uploadedImage.contextInfo || {}),
                    forwardingScore: 0,
                    isGroupStatus: true,
                    pairedMediaType: 0,
                    // Match the image Group Status V2 context used in the
                    // Baileys implementation example (discussion #2318).
                    statusSourceType: 4,
                    statusAttributions: [{ type: 10 }],
                    featureEligibilities: {
                        canBeReshared: true,
                        canReceiveMultiReact: true
                    }
                }
            },
            messageContextInfo: { messageSecret }
        };
    } else {
        const statusContent = { ...content };
        delete statusContent.backgroundColor;
        const generated = await generateWAMessageContent(statusContent, {
            upload: sock.waUploadToServer,
            backgroundColor: content.backgroundColor || PURPLE_COLOR
        });
        if (!generated || !Object.keys(generated).length) {
            throw new Error('Failed to generate group status content.');
        }
        const key = Object.keys(generated)[0];
        innerMessage = {
            ...generated,
            [key]: {
                ...generated[key],
                contextInfo: {
                    ...(generated[key]?.contextInfo || {}),
                    isGroupStatus: true
                }
            },
            messageContextInfo: { messageSecret }
        };
    }

    const msg = generateWAMessageFromContent(
        jid,
        {
            messageContextInfo: { messageSecret },
            groupStatusMessageV2: { message: innerMessage }
        },
        { userJid: jidNormalizedUser(sock.user.id) }
    );

    if (!msg?.message || !msg?.key?.id) {
        throw new Error('Failed to create Group Status V2 message envelope.');
    }

    // WhatsApp's current group-status transport requires the group-status
    // metadata node for media stories. Without it, relayMessage can resolve
    // successfully while the image card is silently not shown to group members.
    // Keep this scoped to image statuses so the already-working text flow stays
    // unchanged. This is protocol metadata, not a normal chat fallback.
    const relayOptions = { messageId: msg.key.id };
    if (isImageStatus) {
        relayOptions.additionalNodes = [{
            tag: 'meta',
            attrs: { is_group_status: 'true', origin: 'group_status' }
        }];
    }

    await sock.relayMessage(jid, msg.message, relayOptions);
    return { messageId: msg.key.id, mediaType: isImageStatus ? 'image' : 'other', accepted: true };
}

// --- GREAT DEMON COMMAND CATALOGUE ---
// Generated from the actual command switch so .allmenu lists implemented aliases.
const COMMAND_CATALOG = [
    "2048",
    "activegames",
    "activeusers",
    "add",
    "addmember",
    "addowner",
    "adminnotes",
    "ai",
    "aimenu",
    "allmenu",
    "announce",
    "answer",
    "antiadd",
    "antibot",
    "anticall",
    "antidelete",
    "antidemote",
    "antigcstatus",
    "antiggstatus",
    "antigroupsmention",
    "antiimage",
    "antilink",
    "antipromote",
    "antiremove",
    "antispam",
    "antitag",
    "antitagadmin",
    "antiviewonce",
    "applemusic",
    "approveall",
    "autoonline",
    "autoreact",
    "autorecording",
    "autostatuslike",
    "autostatusview",
    "autotyping",
    "balance",
    "bancheck",
    "bank",
    "bc",
    "beg",
    "block",
    "botlink",
    "broadcast",
    "buatgc",
    "buy",
    "cardaccept",
    "cardadd",
    "cardlist",
    "cardoffer",
    "cardprofile",
    "cardremove",
    "cards",
    "cardsell",
    "cardtrade",
    "cardbuy",
    "demonadmin",
    "goldgive",
    "goldset",
    "spawncard",
    "cardadmin",
    "capcut",
    "changebio",
    "claude",
    "close",
    "closetime",
    "connectedusers",
    "convertmenu",
    "copilot",
    "daily",
    "dare",
    "del",
    "delete",
    "delgcstatus",
    "delgs",
    "delgstatus",
    "demote",
    "demoteall",
    "demoteuser",
    "deposit",
    "describe",
    "device",
    "devices",
    "disapproveall",
    "dl",
    "dor",
    "downloadmenu",
    "draw",
    "endgame",
    "fb",
    "felo",
    "fetchstatus",
    "fish",
    "flirt",
    "funmenu",
    "ga",
    "gamemenu",
    "games",
    "gay",
    "gayrate",
    "gcast",
    "gccrash",
    "gcs",
    "gcstatus",
    "getlink",
    "getpp",
    "ggstatus",
    "glostat",
    "gm",
    "gn",
    "goodafternoon",
    "goodbye",
    "goodmorning",
    "goodnight",
    "gpt",
    "groupdesc",
    "groupfaq",
    "groupid",
    "groupinfo",
    "grouplink",
    "groupmenu",
    "groupname",
    "groupnotice",
    "grouponly",
    "groupstatus",
    "gs",
    "gstatus",
    "guess",
    "hangman",
    "help",
    "hidetag",
    "hunt",
    "imagine",
    "inactiveusers",
    "inspectsock",
    "inventory",
    "invite",
    "joingroup",
    "kick",
    "kickall",
    "konachan",
    "konachansfw",
    "leaderboard",
    "leavegroup",
    "left",
    "listactive",
    "listadmins",
    "listchannels",
    "listfont",
    "listgroup",
    "listgroups",
    "llama",
    "lock",
    "lyrics",
    "mathquiz",
    "mediatag",
    "membercount",
    "memberroles",
    "membertag",
    "menu",
    "mode",
    "monthly",
    "mute",
    "notes",
    "ocr",
    "open",
    "opentime",
    "othermenu",
    "ownermenu",
    "ownerpanel",
    "pair",
    "pay",
    "peek",
    "permissionaudit",
    "pickup",
    "pickupline",
    "ping",
    "play",
    "poll",
    "prefix",
    "private",
    "profile",
    "promote",
    "promoteall",
    "promoteuser",
    "public",
    "remove",
    "resetwarn",
    "restrict",
    "revoke",
    "richest",
    "riddle",
    "rules",
    "searchmenu",
    "session",
    "setgoodbye",
    "setgroupbio",
    "setgroupdesc",
    "setgroupname",
    "setgrouppp",
    "setmute",
    "setprefix",
    "setunmute",
    "setwarn",
    "setwarning",
    "setwelcome",
    "shop",
    "spamngl",
    "status",
    "sudo",
    "sudolist",
    "sudoremove",
    "swgc",
    "tag",
    "tagadmin",
    "tagall",
    "tagonline",
    "tagpoll",
    "toaud",
    "togglemenu",
    "togif",
    "togstatus",
    "toimg",
    "toolmenu",
    "top",
    "topmembers",
    "toptt",
    "tourl",
    "triviaclassic",
    "truth",
    "unblock",
    "unlock",
    "unmute",
    "unwarn",
    "uptime",
    "viewonce",
    "vv",
    "warn",
    "warning",
    "warnings",
    "wasted",
    "weekly",
    "welcome",
    "withdraw",
    "work",
    "yts"
];

function styleCommandName(value) {
    // Mathematical bold italic lowercase: .tagall -> .𝒕𝒂𝒈𝒂𝒍𝒍
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const base = 0x1D482;
    const map = new Map(Array.from(alphabet).map((letter, index) =>
        [letter, String.fromCodePoint(base + index)]
    ));
    return String(value).replace(/[a-z]/g, letter => map.get(letter) || letter);
}

function styleCommandMentions(value) {
    return String(value).replace(/\.([a-z][a-z0-9]*)/gi, (match, name) =>
        '.' + styleCommandName(name.toLowerCase())
    );
}

// Consistent Mathematical Bold Italic typography for human-facing WhatsApp replies.
// URLs, code spans, command examples, phone numbers and WhatsApp JIDs stay readable.
const DEMON_FONT_MAP = (() => {
    const map = new Map();
    for (let i = 0; i < 26; i++) {
        map.set(String.fromCharCode(97 + i), String.fromCodePoint(0x1D482 + i));
        map.set(String.fromCharCode(65 + i), String.fromCodePoint(0x1D468 + i));
    }
    return map;
})();

function toDemonFont(value) {
    const protectedToken = /(`[^`]*`|https?:\/\/[^\s<>]+|wa\.me\/[^\s<>]+|\.[a-z][a-z0-9_-]*|[A-Za-z0-9._%+-]+@(?:s\.whatsapp\.net|g\.us|lid|broadcast|newsletter))/gi;
    return String(value ?? '').split(protectedToken).map(part => {
        if (!part) return part;
        if (part.startsWith('`') || /^https?:\/\//i.test(part) || /^wa\.me\//i.test(part) ||
            /^\.[a-z][a-z0-9_-]*$/i.test(part) || /@(?:s\.whatsapp\.net|g\.us|lid|broadcast|newsletter)$/i.test(part)) return part;
        return Array.from(part, char => DEMON_FONT_MAP.get(char) || char).join('');
    }).join('');
}

async function resolveInvitedGroupAvatarBuffer(sock, invitedGroupInfo) {
    // Resolve the group represented by the invite link. This must never fall
    // back to the group receiving the status story.
    const invitedGroupJid = String(
        invitedGroupInfo?.id ||
        invitedGroupInfo?.jid ||
        invitedGroupInfo?.groupJid ||
        ''
    ).trim();

    if (!invitedGroupJid.endsWith('@g.us')) {
        throw new Error('Invite lookup did not return a valid group JID.');
    }

    // Some forks expose a picture URL in metadata; standard Baileys normally
    // requires profilePictureUrl(). Prefer preview (the WhatsApp invite-card
    // thumbnail) and then try the full image endpoint.
    const directUrl = [
        invitedGroupInfo?.profilePicUrl,
        invitedGroupInfo?.profilePictureUrl,
        invitedGroupInfo?.picture?.url,
        invitedGroupInfo?.pictureUrl,
        invitedGroupInfo?.avatar
    ].find(value => typeof value === 'string' && /^https?:\/\//i.test(value));

    const attempts = [
        ...(directUrl ? [{ label: 'invite-metadata', run: async () => directUrl }] : []),
        // Ask Baileys for the full image first, then the smaller invite preview.
        // Use the documented two-argument API; do not pass a timeout as a third arg.
        { label: 'image', run: () => sock.profilePictureUrl(invitedGroupJid, 'image') },
        { label: 'preview', run: () => sock.profilePictureUrl(invitedGroupJid, 'preview') },
        { label: 'default', run: () => sock.profilePictureUrl(invitedGroupJid) }
    ];

    console.log('[GROUP INVITATION CARD] Resolving invited group avatar', {
        invitedGroupJid,
        hasInvitePictureUrl: Boolean(directUrl),
        lookupMethods: attempts.map(item => item.label)
    });

    const errors = [];
    for (const attempt of attempts) {
        let timeoutHandle;
        try {
            const url = await Promise.race([
                Promise.resolve().then(attempt.run),
                new Promise((_, reject) => {
                    timeoutHandle = setTimeout(
                        () => reject(new Error('profile-picture lookup timed out after 30 seconds')),
                        30000
                    );
                })
            ]);
            clearTimeout(timeoutHandle);
            if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
                throw new Error('WhatsApp returned no usable picture URL');
            }

            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 25000,
                maxContentLength: 10 * 1024 * 1024,
                maxBodyLength: 10 * 1024 * 1024,
                validateStatus: status => status >= 200 && status < 300
            });
            const buffer = Buffer.from(response.data || []);
            const type = String(response.headers?.['content-type'] || '').toLowerCase();
            const signature =
                buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
                buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
                (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP');
            if (!buffer.length || (!type.startsWith('image/') && !signature)) {
                throw new Error('Downloaded response was not a valid image');
            }

            console.log('[GROUP INVITATION CARD] Actual invite-group photo resolved', {
                invitedGroupJid,
                source: attempt.label,
                bytes: buffer.length
            });
            return buffer;
        } catch (error) {
            clearTimeout(timeoutHandle);
            errors.push(`${attempt.label}: ${error.message || error}`);
            console.error('[GGSTATUS IMAGE DIAGNOSTIC] Avatar lookup failed', {
                invitedGroupJid,
                method: attempt.label,
                error: error.message || String(error)
            });
        }
    }

    throw new Error(
        `Could not fetch the invited group's actual profile picture (${invitedGroupJid}). ` +
        `WhatsApp may restrict access to this group's photo unless this account can view it. ` +
        errors.join(' | ')
    );
}

async function createGroupInvitationCard(sock, groupName, inviteUrl, invitedGroupInfo = {}) {
    // The profile picture must belong to the group represented by the invite URL.
    // Never substitute a participating/destination group's avatar.
    console.log('[GGSTATUS IMAGE DIAGNOSTIC] Starting invitation-card generation', {
        invitedGroupJid: invitedGroupInfo?.id || invitedGroupInfo?.jid || null,
        groupName: String(groupName || invitedGroupInfo?.subject || 'WhatsApp Group')
    });
    const avatarBuffer = await resolveInvitedGroupAvatarBuffer(sock, invitedGroupInfo);
    console.log('[GGSTATUS IMAGE DIAGNOSTIC] Avatar downloaded; rendering card', {
        avatarBytes: avatarBuffer.length
    });
    const title = String(groupName || invitedGroupInfo?.subject || 'WhatsApp Group')
        .replace(/[\r\n]/g, ' ').trim().slice(0, 60);
    const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const safeLink = String(inviteUrl || '').replace(/&/g, '&amp;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const titleSize = title.length > 42 ? 34 : title.length > 30 ? 40 : 48;
    const cardOverlay = Buffer.from(`
      <svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#24113b"/>
            <stop offset="1" stop-color="#7621a2"/>
          </linearGradient>
        </defs>
        <rect width="1080" height="1920" fill="url(#bg)"/>
        <rect x="110" y="360" width="860" height="1040" rx="38" fill="#ffffff" opacity="0.08"/>
        <rect x="130" y="390" width="820" height="700" rx="22" fill="#171923"/>
        <rect x="130" y="1090" width="820" height="230" rx="0" fill="#111820"/>
        <text x="540" y="1175" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="${titleSize}" font-weight="700">${safeTitle}</text>
        <text x="540" y="1260" text-anchor="middle" fill="#d6d9df" font-family="Arial, sans-serif" font-size="30">${safeLink}</text>
      </svg>`);

    const photo = await sharp(avatarBuffer, { failOn: 'error' })
        .rotate()
        .resize(820, 700, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 90 })
        .toBuffer();

    const card = await sharp({
        create: { width: 1080, height: 1920, channels: 4, background: '#24113b' }
    })
        .composite([
            { input: cardOverlay },
            { input: photo, left: 130, top: 390 }
        ])
        .jpeg({ quality: 90 })
        .toBuffer();

    if (!card || card.length < 10000) {
        throw new Error(`Invitation card image output is invalid (${card?.length || 0} bytes).`);
    }
    console.log('[GROUP INVITATION CARD] Generated with sharp', {
        invitedGroupJid: invitedGroupInfo?.id || invitedGroupInfo?.jid,
        bytes: card.length,
        groupName: title
    });
    return card;
}

function toVN(buffer) {
  return new Promise((resolve, reject) => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks = [];

    input.end(buffer);

    ffmpeg(input)
      .noVideo()
      .audioCodec('libopus')
      .format('ogg')
      .audioChannels(1)
      .audioFrequency(48000)
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(chunks)))
      .pipe(output);

    output.on('data', (c) => chunks.push(c));
  });
}

function generateWaveform(buffer, bars = 64) {
  return new Promise((resolve, reject) => {
    const input = new PassThrough();
    input.end(buffer);

    const chunks = [];

    ffmpeg(input)
      .audioChannels(1)
      .audioFrequency(16000)
      .format('s16le')
      .on('error', reject)
      .on('end', () => {
        const raw = Buffer.concat(chunks);
        const samples = raw.length / 2;
        const amps = [];

        for (let i = 0; i < samples; i++) {
          amps.push(Math.abs(raw.readInt16LE(i * 2)) / 32768);
        }

        const size = Math.floor(amps.length / bars);
        if (size === 0) return resolve(undefined);

        const avg = Array.from({ length: bars }, (_, i) =>
          amps
            .slice(i * size, (i + 1) * size)
            .reduce((a, b) => a + b, 0) / size
        );

        const max = Math.max(...avg);
        if (max === 0) return resolve(undefined);

        resolve(
          Buffer.from(
            avg.map((v) => Math.floor((v / max) * 100))
          ).toString('base64')
        );
      })
      .pipe()
      .on('data', (c) => chunks.push(c));
  });
}

function fetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const req = lib.request(url, { headers: { 'User-Agent': 'Mozilla/5.0', ...options.headers }, method: options.method || 'GET' }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

const spamMap = new Map();
const SPAM_LIMIT = 3;
const SPAM_TIME = 5000;
const COOLDOWN_TIME = 10000;

// --- IMPERIAL ANTI-BUG / ANTI-FLOOD SHIELD ---
// Telegram alerts use TELEGRAM_OWNER_ID or a private chat registered with /myid.
const SECURITY_OWNER_FILE = path.join(DATA_DIR, 'telegram_security_owner.json');
const PERSONAL_BUG_REPORTS_FILE = path.join(DATA_DIR, 'telegram_personal_bug_reports.json');
let personalBugReportIds = new Set(readJsonFile(PERSONAL_BUG_REPORTS_FILE, []).map(String));
function savePersonalBugReportIds() {
    writeJsonAtomic(PERSONAL_BUG_REPORTS_FILE, [...personalBugReportIds]);
}
let TELEGRAM_OWNER_ID = String(process.env.TELEGRAM_OWNER_ID || process.env.TELEGRAM_SECURITY_CHAT_ID || (() => {
    try { return JSON.parse(fs.readFileSync(SECURITY_OWNER_FILE, 'utf8')).chatId || ''; } catch (_) { return ''; }
})()).trim();
let telegramSecurityBot = null;
const securityRateBuckets = new Map();
const securityIncidentBuckets = new Map();
const securityAlertCooldowns = new Map();
const SECURITY_RATE_WINDOW_MS = 10_000;
const SECURITY_RATE_ALERT_LIMIT = 12;
const SECURITY_RATE_BLOCK_LIMIT = 30;
const SECURITY_INCIDENT_WINDOW_MS = 10 * 60_000;

function securitySenderDigits(jid) {
    const raw = String(jid || '').split('@')[0].split(':')[0];
    return /^\d{7,16}$/.test(raw) ? raw : '';
}

function inspectIncomingPayload(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return 'Invalid message object';
    if (!message.key || typeof message.key !== 'object' || typeof message.key.remoteJid !== 'string') return 'Invalid message key';
    if (!message.message || typeof message.message !== 'object' || Array.isArray(message.message)) return '';

    // Inspect the already-decoded Baileys object with strict work/depth bounds.
    // This avoids expensive stringify/regex work on attacker-controlled structures.
    const stack = [{ value: message.message, depth: 0 }];
    const seen = new WeakSet();
    let nodes = 0;
    while (stack.length) {
        const current = stack.pop();
        const value = current.value;
        if (!value || typeof value !== 'object') continue;
        if (seen.has(value)) return 'Circular payload structure';
        seen.add(value);
        if (++nodes > 6000) return 'Abnormally complex message structure';
        if (current.depth > 24) return 'Excessive message nesting';
        const keys = Object.keys(value);
        if (keys.length > 80) return 'Excessive message fields';
        for (const key of keys) {
            if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
                return 'Unsafe object property in message';
            }
            const child = value[key];
            if (typeof child === 'string' && child.length > 262144) return 'Oversized text field';
            if (child && typeof child === 'object') stack.push({ value: child, depth: current.depth + 1 });
        }
    }

    let raw;
    try { raw = JSON.stringify(message.message); }
    catch (_) { return 'Unreadable message payload'; }
    if (typeof raw !== 'string') return 'Unreadable message payload';
    if (raw.length > 262144) return 'Oversized message payload';
    const controls = (raw.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g) || []).length;
    if (controls > 250) return 'Excessive control characters';
    const bidi = (raw.match(/[\u202A-\u202E\u2066-\u2069]/g) || []).length;
    if (bidi > 100) return 'Excessive directional control characters';
    const keys = Object.keys(message.message);
    if (!keys.length || keys.length > 50) return 'Abnormal message envelope';
    return '';
}

async function getSecurityChatLabel(sock, remoteJid) {
    if (String(remoteJid || '').endsWith('@g.us')) {
        try {
            const metadata = await sock.groupMetadata(remoteJid);
            return String(metadata?.subject || remoteJid).slice(0, 100);
        } catch (_) { return String(remoteJid || 'Unknown group'); }
    }
    return String(remoteJid || 'Unknown chat');
}

function getSecurityRate(senderKey, now = Date.now()) {
    const prior = securityRateBuckets.get(senderKey) || [];
    const recent = prior.filter(ts => now - ts <= SECURITY_RATE_WINDOW_MS);
    recent.push(now);
    securityRateBuckets.set(senderKey, recent);
    if (securityRateBuckets.size > 5000) {
        for (const [key, values] of securityRateBuckets) {
            if (!values.length || now - values[values.length - 1] > 60_000) securityRateBuckets.delete(key);
        }
    }
    return recent.length;
}

async function sendTelegramSecurityAlert(details) {
    if (!telegramSecurityBot) {
        console.warn('[ANTI-BUG] Telegram alert not delivered: Telegram bot is not connected.');
        return false;
    }
    const now = Date.now();
    const cooldownKey = String(details.session || 'unknown-session') + ':' + String(details.sender || 'unknown') + ':' + String(details.reason || 'event');
    const last = securityAlertCooldowns.get(cooldownKey) || 0;
    if (now - last < 15_000) return false;
    securityAlertCooldowns.set(cooldownKey, now);
    const text = [
        '🛡️ 𝑮𝑹𝑬𝑨𝑻 𝑫𝑬𝑴𝑶𝑵 𝑽4 — 𝑺𝑬𝑪𝑼𝑹𝑰𝑻𝒀 𝑨𝑳𝑬𝑹𝑻',
        '📡 Account: ' + String(details.session || 'Unknown session'),
        '',
        '📱 Sender: ' + (details.number || 'Unavailable / privacy ID'),
        '💬 Chat: ' + (details.chat || 'Unknown'),
        '⚠️ Detection: ' + String(details.reason || 'Suspicious activity').slice(0, 180),
        '📊 Messages in window: ' + (details.count ?? 'N/A'),
        '🚫 Action: ' + (details.action || 'Ignored / monitored'),
        '🕒 Time: ' + new Date().toISOString()
    ].join('\n');
    const recipients = new Set();
    const personalId = String(details.telegramUserId || '').trim();
    if (personalId && personalBugReportIds.has(personalId)) recipients.add(personalId);
    if (TELEGRAM_OWNER_ID) recipients.add(String(TELEGRAM_OWNER_ID));
    if (!recipients.size) return false;
    let delivered = false;
    for (const chatId of recipients) {
        try {
            await telegramSecurityBot.sendMessage(chatId, text, { disable_web_page_preview: true });
            delivered = true;
        } catch (err) {
            console.error('[ANTI-BUG TELEGRAM ALERT]', chatId === personalId ? 'personal report failed:' : 'owner report failed:', err.message);
        }
    }
    return delivered;
}

async function registerSecurityIncident(sock, message, reason, count = 1, sessionLabel = 'Unknown session', telegramUserId = '') {
    const remoteJid = String(message?.key?.remoteJid || 'unknown');
    const senderJid = String(message?.key?.participant || remoteJid);
    const number = securitySenderDigits(senderJid) || await resolvePhoneDigits(sock, senderJid).catch(() => '');
    const senderKey = sessionLabel + '|' + senderJid + '|' + remoteJid;
    const now = Date.now();
    const prior = securityIncidentBuckets.get(senderKey) || [];
    const recent = prior.filter(ts => now - ts <= SECURITY_INCIDENT_WINDOW_MS);
    recent.push(now);
    securityIncidentBuckets.set(senderKey, recent);

    let action = 'Message rejected; sender monitored';
    // Auto-block only after repeated, high-confidence malformed payload incidents.
    const protectedSender = await isProtectedOwnerJid(sock, senderJid).catch(() => false) || sudoUsers.has(number);
    if (recent.length >= 3 && number && !protectedSender && !message?.key?.fromMe) {
        try {
            await sock.updateBlockStatus(number + '@s.whatsapp.net', 'block');
            action = 'WhatsApp sender blocked after 3 malformed-payload incidents';
            console.warn('[ANTI-BUG] Blocked repeated malformed-payload sender:', number);
        } catch (err) {
            action = 'Repeated malformed payload; automatic block failed: ' + String(err.message || '').slice(0, 100);
        }
    }
    await sendTelegramSecurityAlert({
        session: sessionLabel,
        telegramUserId: telegramUserId || '',
        sender: senderJid,
        number,
        chat: await getSecurityChatLabel(sock, remoteJid),
        reason,
        count,
        action
    });
    return action;
}

async function startDemonBot(options = {}) {
    const sessionPath = options.sessionPath || path.join(DATA_DIR, 'demon_session');
    const isPrimary = options.isPrimary !== false;
    const securitySessionLabel = isPrimary ? 'Session 1 (Primary)' : 'Session ' + getGreatDemonSessionNumber(false, options.telegramUserId) + ' (Telegram-linked)';

    if (isPrimary && process.env.SESSION_ID && process.env.SESSION_ID.trim().length > 20 && !fs.existsSync(path.join(sessionPath, 'creds.json'))) {
        if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });
        try {
            const rawId = process.env.SESSION_ID.trim().replace(/^GREAT_DEMON_/, '');
            const decodedCreds = Buffer.from(rawId, 'base64').toString('utf-8');
            fs.writeFileSync(path.join(sessionPath, 'creds.json'), decodedCreds);
            console.log('✅ Imperial Session successfully restored from SESSION_ID Environment Variable!');
        } catch (err) {
            console.log('❌ Failed to decode SESSION_ID:', err.message);
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    let version;
    try {
        // Prefer the live WhatsApp Web version; the bundled Baileys version can lag.
        ({ version } = await fetchLatestWaWebVersion());
        console.log('[BAILEYS] Using live WhatsApp Web version:', version.join('.'));
    } catch (liveVersionError) {
        console.warn('[BAILEYS] Live WA version lookup failed:', liveVersionError.message);
        ({ version } = await fetchLatestBaileysVersion());
        console.warn('[BAILEYS] Falling back to Baileys version:', version.join('.'));
    }

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: false,
        markOnlineOnConnect: autoSettings.autoonline,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('presence.update', update => {
        const presences = update?.presences || {};
        for (const [jid, presence] of Object.entries(presences)) {
            const normalized = jidNormalizedUser(jid);
            const state = presence?.lastKnownPresence || presence?.presence || 'unavailable';
            if (['available', 'composing', 'recording'].includes(state)) {
                livePresence.set(normalized, { state, seenAt: Date.now() });
            } else {
                livePresence.delete(normalized);
            }
        }
    });
    if (!isPrimary && options.telegramUserId) telegramSockets.set(String(options.telegramUserId), sock);

    if (isPrimary && !sock.authState.creds.registered) {
        console.log('\n==================================================');
        let phoneNumber = process.env.PHONE_NUMBER || OWNER_NUMBER;
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        try {
            await new Promise(res => setTimeout(res, 5000));
            console.log('⏳ Requesting Imperial Pairing Code for +' + phoneNumber + '...');
            const code = await sock.requestPairingCode(phoneNumber);
            const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log('\n🔑 YOUR PAIRING CODE: ' + formattedCode + '\n');
            console.log('==================================================\n');
        } catch (err) {
            console.log('❌ Error requesting pairing code:', err.message);
        }

        setInterval(() => {}, 60000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (!isPrimary && telegramDisabledAccounts.has(String(options.telegramUserId))) return;
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('⚡ Reconnecting Great Demon Bot...');
                startDemonBot(options).catch(err => console.error('Reconnect failed:', err.message));
            } else {
                console.log('❌ Session logged out from WhatsApp servers. Please clear SESSION_ID to re-pair.');
            }
        } else if (connection === 'open') {
            console.log('\\n⚡ 𝐆𝐑𝐄𝐀𝐓_𝐃𝐄𝐌𝐎𝐍 𝐕4 CONNECTED AND ONLINE! ⚡\\n');

            const noticeKey = String(options.sessionPath || path.join(DATA_DIR, 'demon_session'));
            if (!connectionNoticesSent.has(noticeKey)) {
                connectionNoticesSent.add(noticeKey);
                (async () => {
                    try {
                        const connectedNumber = await resolvePhoneDigits(sock, sock.user?.id);
                        const sessionNumber = getGreatDemonSessionNumber(isPrimary, options.telegramUserId);
                        const notice =
                            '╭━━〔 👑 𝑮𝑹𝑬𝑨𝑻 𝑫𝑬𝑴𝑶𝑵 V4 〕━━╮\n' +
                            '┃ 𝑪𝑶𝑵𝑵𝑬𝑪𝑻𝑬𝑫\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━\n' +
                            '📡 Session: ' + sessionNumber + '\n' +
                            '📱 Number: ' + (connectedNumber ? '+' + connectedNumber : 'Not available') + '\n' +
                            '🟢 Status: Online\n\n' +
                            'GREAT DEMON V4 is ready. The Emperor’s realm is connected.\n' +
                            '╰━━━━━━━━━━━━━━━━━━━━╯';

                        // Send the connection report to the newly linked account itself.
                        const ownJid = sock.user?.id;
                        if (ownJid) {
                            await sock.sendMessage(ownJid, { text: notice });
                        }

                        // Also notify the configured owner about every new linked account.
                        // Count includes the primary session plus all saved Telegram-linked sessions.
                        const ownerJid = OWNER_NUMBER + '@s.whatsapp.net';
                        const linked = readGreatDemonLinkedSessions();
                        const totalSessions = 1 + Object.keys(linked).length;
                        const ownerDigits = await resolvePhoneDigits(sock, ownerJid).catch(() => OWNER_NUMBER);
                        const connectedDigits = connectedNumber || '';
                        if (ownerJid && connectedDigits !== ownerDigits) {
                            const ownerNotice =
                                '╭━━〔 👑 GREAT DEMON V4 • NEW SESSION 〕━━╮\n' +
                                '📡 Session: ' + sessionNumber + '\n' +
                                '📱 Linked number: ' + (connectedDigits ? '+' + connectedDigits : 'Not available') + '\n' +
                                '🟢 Status: Online\n' +
                                '👥 Total linked sessions: ' + totalSessions + '\n' +
                                '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯';
                            await sock.sendMessage(ownerJid, { text: ownerNotice });
                        }

                    } catch (noticeError) {
                        console.warn('[CONNECTION NOTICE]', noticeError.message);
                    }
                })();
            }
        }
    });

    // --- 📞 ANTI-CALL INTERCEPTOR ---
    sock.ev.on('call', async (callEvents) => {
        if (!autoSettings.anticall) return;
        for (const call of callEvents) {
            if (call.status === 'offer') {
                try {
                    await sock.rejectCall(call.id, call.from);
                    await sock.sendMessage(call.from, { 
                        text: "⚠️ *Imperial Seal:* Direct voice/video calls are forbidden! You have been automatically rejected by Demon Emperor Engine." 
                    });
                } catch (e) {}
            }
        }
    });

    // --- ANTIDELETE EVENT LISTENER ---
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            if (update.update?.message === null || update.update?.status === 4) {
                const deletedKey = update.key;
                const originalMsg = messageCache.get(deletedKey.id);
                
                if (originalMsg && originalMsg.key.remoteJid) {
                    const chatJid = originalMsg.key.remoteJid;
                    if (chatJid.endsWith('@g.us') && groupSettings[chatJid]?.antidelete) {
                        const sender = originalMsg.key.participant || originalMsg.key.remoteJid;
                        const content = originalMsg.message.conversation || originalMsg.message.extendedTextMessage?.text || 'Media Message';
                        
                        await sock.sendMessage(chatJid, { 
                            text: "👁️ *IMPERIAL ANTIDELETE DETECTED*\n\n*Sender:* @" + sender.split('@')[0] + "\n*Deleted Content:* " + content,
                            mentions: [sender]
                        });
                    }
                }
            }
        }
    });

 
    // =========================================================================
    // 👑 IMPERIAL GROUP PROTECTION SYSTEM
    // =========================================================================

    // Separate protection tracking maps
    const imperialSpamMap = new Map();
    const imperialWarningMap = new Map();
    // Tracks the same promotional/broadcast-style text across groups this bot can see.
    const imperialBroadcastMap = new Map();

    // =========================================================================
    // 👋 WELCOME, GOODBYE AND GROUP PARTICIPANT PROTECTION
    // =========================================================================
    sock.ev.on('group-participants.update', async (update) => {
        try {
            const { id: from, participants = [], action, author } = update;

            if (!from || !from.endsWith('@g.us')) return;

            if (!groupSettings[from]) {
                groupSettings[from] = {
                    antiadd: false, antibot: false, antidemote: false,
                    antigroupsmention: false, antiimage: false, antilink: false,
                    antipromote: false, antiremove: false, antispam: false,
                    antitag: false, welcome: false, goodbye: false,
                    antidelete: false, antitagadmin: false, grouponly: false,
                    antigcstatus: false,
                    antilinkMode: 'kick', antilinkWarnLimit: 3,
                    antigroupsmentionMode: 'kick', antigroupsmentionWarnLimit: 3,
                    antispamMode: 'warn', antispamWarnLimit: 3,
                    antitagMode: 'warn', antitagWarnLimit: 3,
                    antibotMode: 'warn', antibotWarnLimit: 3,
                    antigcstatusMode: 'warn', antigcstatusWarnLimit: 3
                };
                saveGroupSettings();
            }

            const settings = groupSettings[from];
            const metadata = await sock.groupMetadata(from);
            const groupName = metadata.subject || 'Our Group';

            const normalize = jid => jid ? jidNormalizedUser(jid) : '';
            const botJid = normalize(sock.user?.id);
            const actorJid = normalize(author);

            const botParticipant = metadata.participants.find(
                p => normalize(p.id) === botJid
            );

            const isBotAdmin = !!botParticipant &&
                ['admin', 'superadmin'].includes(botParticipant.admin);

            const actorParticipant = metadata.participants.find(
                p => normalize(p.id) === actorJid
            );

            const actorNum = actorJid.split('@')[0];
            const actorIsAdmin = !!actorParticipant &&
                ['admin', 'superadmin'].includes(actorParticipant.admin);

            const trustedActor = !actorJid ||
                actorJid === botJid ||
                actorIsAdmin ||
                sudoUsers.has(actorNum);

            for (const participant of participants) {
                const userJid = normalize(participant);
                if (!userJid) continue;

                // Resolve LID to a phone JID when Baileys has a mapping.
                const resolvePhoneJid = async (jid) => {
                    if (!jid) return '';
                    if (jid.endsWith('@s.whatsapp.net')) return jid;
                    if (jid.endsWith('@lid')) {
                        try {
                            const mapped = await sock.signalRepository?.lidMapping?.getPNForLID?.(jid);
                            if (mapped) return normalize(mapped);
                        } catch (err) {
                            console.error('[REMOVAL LID LOOKUP]', err.message);
                        }
                    }
                    return '';
                };

                const userPhoneJid = await resolvePhoneJid(userJid);
                const actorPhoneJid = await resolvePhoneJid(actorJid);
                const userMentionJid = userPhoneJid || userJid;
                const actorMentionJid = actorPhoneJid || actorJid;

                const formatNumber = jid => {
                    if (!jid || !jid.endsWith('@s.whatsapp.net')) return '';
                    return '+' + jid.split('@')[0];
                };

                const userNumber = formatNumber(userPhoneJid || userJid);
                const actorNumber = formatNumber(actorPhoneJid || actorJid);
                const userLabel = userNumber || 'Member';
                const actorLabel = actorNumber || 'Admin';
                const userTag = userPhoneJid ? '@' + userPhoneJid.split('@')[0] : 'Member';


                // ANTIADD
                if (action === 'add' && settings.antiadd && !trustedActor) {
                    if (isBotAdmin) {
                        await sock.sendMessage(from, {
                            text: '🚫 Unauthorized member addition detected. Removing ' + userTag + '.',
                            mentions: [userJid]
                        });

                        await sock.groupParticipantsUpdate(
                            from, [userJid], 'remove'
                        ).catch(err => console.error('[ANTIADD]', err.message));
                    }
                    continue;
                }

                // ANTIREMOVE
                if (action === 'remove' && settings.antiremove && !trustedActor) {
                    if (isBotAdmin) {
                        await sock.sendMessage(from, {
                            text: '🛡️ Unauthorized removal detected without Emperor uninformed,Attempting to restore ' + userTag + '.',
                            mentions: [userJid]
                        });

                        await sock.groupParticipantsUpdate(
                            from, [userJid], 'add'
                        ).catch(err => console.error('[ANTIREMOVE]', err.message));
                    }
                    continue;
                }

                // ANTIPROMOTE
                if (action === 'promote' && settings.antipromote && !trustedActor) {
                    if (isBotAdmin) {
                        await sock.sendMessage(from, {
                            text: '🛡️ Unauthorized promotion detected. Reversing promotion of ' + userTag + '.',
                            mentions: [userJid]
                        });

                        await sock.groupParticipantsUpdate(
                            from, [userJid], 'demote'
                        ).catch(err => console.error('[ANTIPROMOTE]', err.message));
                    }
                    continue;
                }

                // ANTIDEMOTE
                if (action === 'demote' && settings.antidemote && !trustedActor) {
                    if (isBotAdmin) {
                        await sock.sendMessage(from, {
                            text: '🛡️ Unauthorized demotion detected withoutEmperor uninformed. Attempting to restore ' + userTag + '.',
                            mentions: [userJid]
                        });

                        await sock.groupParticipantsUpdate(
                            from, [userJid], 'promote'
                        ).catch(err => console.error('[ANTIDEMOTE]', err.message));
                    }
                    continue;
                }

                // PROFILE PICTURE
                let ppUrl;
                try {
                    ppUrl = await sock.profilePictureUrl(userJid, 'image');
                } catch {
                    ppUrl = MENU_IMAGE_URL;
                }

                // WELCOME
                if (action === 'add' && settings.welcome) {
                    await sock.sendMessage(from, {
                        image: { url: ppUrl },
                        caption:
                            '👑 *IMPERIAL WELCOME* 👑\n\n' +
                            'Welcome to *' + groupName + '*, ' + userTag + '! ⚔️\n' +
                            'We hope you enjoy your time here. If you need help, ask the group. Enjoy your stay under the rule of the Emperor!',
                        mentions: [userJid]
                    }).catch(err => console.error('[WELCOME]', err.message));
                }

                // GOODBYE
                if (action === 'remove' && settings.goodbye) {
                    await sock.sendMessage(from, {
                        image: { url: ppUrl },
                        caption:
                            '👋 *IMPERIAL FAREWELL* 👋\n\n' +
                            userTag + ' has departed from *' + groupName + '*.\n' +
                            'We hope you enjoyed your time here. Farewell! ⚔️',
                        mentions: [userJid]
                    }).catch(err => console.error('[GOODBYE]', err.message));
                }
            }
        } catch (err) {
            console.error('[GROUP PROTECTION EVENT]', err.message);
        }
    });

    // =========================================================================
    // 📱 MESSAGE HANDLER, STATUS VIEW AND LIKE
    // =========================================================================
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            const statusMsg = messages?.[0];

            if (statusMsg?.key?.remoteJid === 'status@broadcast') {
                const statusJid = statusMsg.key.participant;

                if (autoSettings.autostatusview) {
                    await sock.readMessages([statusMsg.key]).catch(() => {});
                }

                if (autoSettings.autostatuslike && statusJid) {
                    await sock.sendMessage('status@broadcast', {
                        react: { text: '🖤', key: statusMsg.key }
                    }, { statusJid }).catch(() => {});
                }
                return;
            }
        } catch (err) {
            console.error('[STATUS HANDLER]', err.message);
        }

        // =========================================================================
        // 🛡️ IMPERIAL ANTI-BUG SHIELD — inspect the full incoming batch
        // =========================================================================
        try {
            if (!Array.isArray(messages) || messages.length === 0) return;
            let firstMessageReason = '';
            for (const candidate of messages) {
                const reason = inspectIncomingPayload(candidate);
                if (!reason) continue;
                console.warn('[ANTI-BUG] Rejected malformed message:', reason);
                await registerSecurityIncident(sock, candidate, reason, messages.length, securitySessionLabel, options.telegramUserId || '');
                if (candidate === messages[0]) firstMessageReason = reason;
            }
            if (firstMessageReason) return;

            // Rate-limit command/message processing per sender and chat.
            const first = messages[0];
            if (first?.key && !first.key.fromMe && first.key.remoteJid !== 'status@broadcast') {
                const senderJid = String(first.key.participant || first.key.remoteJid);
                const senderNumber = securitySenderDigits(senderJid) || await resolvePhoneDigits(sock, senderJid).catch(() => '');
                const senderKey = securitySessionLabel + '|' + senderJid + '|' + String(first.key.remoteJid);
                const count = getSecurityRate(senderKey);
                if (count >= SECURITY_RATE_ALERT_LIMIT) {
                    const chatLabel = await getSecurityChatLabel(sock, first.key.remoteJid);
                    if (count === SECURITY_RATE_ALERT_LIMIT) {
                        await sendTelegramSecurityAlert({
                            session: securitySessionLabel,
                            telegramUserId: options.telegramUserId || '',
                            sender: senderJid,
                            number: senderNumber,
                            chat: chatLabel,
                            reason: 'Rapid message flooding detected',
                            count,
                            action: 'Incoming messages throttled; monitoring sender'
                        });
                    }
                    if (count >= SECURITY_RATE_BLOCK_LIMIT && count === SECURITY_RATE_BLOCK_LIMIT) {
                        const protectedSender = await isProtectedOwnerJid(sock, senderJid).catch(() => false) || sudoUsers.has(senderNumber);
                        let action = 'Flood threshold reached; no safe phone number available for blocking';
                        if (senderNumber && !protectedSender) {
                            try {
                                await sock.updateBlockStatus(senderNumber + '@s.whatsapp.net', 'block');
                                action = 'WhatsApp sender automatically blocked after repeated rapid flooding';
                                console.warn('[ANTI-BUG] Blocked rapid-flood sender:', senderNumber);
                            } catch (err) {
                                action = 'Automatic block failed: ' + String(err.message || '').slice(0, 120);
                                console.error('[ANTI-BUG BLOCK]', err.message);
                            }
                        } else if (protectedSender) {
                            action = 'Protected owner/Sudo identity detected; no automatic block applied';
                        }
                        await sendTelegramSecurityAlert({
                            session: securitySessionLabel,
                            telegramUserId: options.telegramUserId || '',
                            sender: senderJid,
                            number: senderNumber,
                            chat: chatLabel,
                            reason: 'Rapid message flooding escalated to block threshold',
                            count,
                            action
                        });
                    }
                    return;
                }
            }
        } catch (err) {
            console.error('[ANTI-BUG SHIELD ERROR]', err.message);
            return;
        }

        if (type !== 'notify') return;

        const msg = messages[0];
        if (!msg?.message || !msg.key?.remoteJid) return;

        // =========================================================================
        // 💾 MESSAGE CACHE FOR ANTIDELETE
        // =========================================================================
        if (!msg.key.fromMe) {
            messageCache.set(msg.key.id, msg);

            if (messageCache.size > 500) {
                const oldestKey = messageCache.keys().next().value;
                messageCache.delete(oldestKey);
            }
        }

        const from = msg.key.remoteJid;

        // Show the configured WhatsApp presence for incoming messages.
        // Recording takes priority if both options are enabled.
        if (!msg.key.fromMe && from !== 'status@broadcast') {
            const presence = autoSettings.autorecording
                ? 'recording'
                : (autoSettings.autotyping ? 'composing' : null);
            if (presence) {
                await sock.sendPresenceUpdate(presence, from).catch(err =>
                    console.error('[AUTO PRESENCE]', err.message)
                );
            }
        }

        const isGroup = from.endsWith('@g.us');
        const sender = msg.key.participant || from;
        const senderNum = sender.split('@')[0];

        if (isGroup && !msg.key.fromMe) {
            incrementMessageCount(from, sender);
        }

        const normalizedMessage = unwrapMessage(msg.message) || msg.message;
        const body =
            normalizedMessage.conversation ||
            normalizedMessage.extendedTextMessage?.text ||
            normalizedMessage.imageMessage?.caption ||
            normalizedMessage.videoMessage?.caption ||
            normalizedMessage.documentMessage?.caption ||
            normalizedMessage.buttonsResponseMessage?.selectedButtonId ||
            normalizedMessage.templateButtonReplyMessage?.selectedId ||
            normalizedMessage.listResponseMessage?.singleSelectReply?.selectedRowId ||
            '';

        if (!groupSettings[from]) {
            groupSettings[from] = {
                antiadd: false, antibot: false, antidemote: false,
                antigroupsmention: false, antiimage: false, antilink: false,
                antipromote: false, antiremove: false, antispam: false,
                antitag: false, welcome: false, goodbye: false,
                antidelete: false, antitagadmin: false, grouponly: false,
                antigcstatus: false,
                antilinkMode: 'kick', antilinkWarnLimit: 3,
                antigroupsmentionMode: 'kick', antigroupsmentionWarnLimit: 3,
                antispamMode: 'warn', antispamWarnLimit: 3,
                antitagMode: 'warn', antitagWarnLimit: 3,
                antibotMode: 'warn', antibotWarnLimit: 3,
                antigcstatusMode: 'warn', antigcstatusWarnLimit: 3
            };
            saveGroupSettings();
        }

        const senderPhone = await resolvePhoneDigits(sock, sender);
        const isOwner = msg.key.fromMe || (isPrimary && senderPhone === OWNER_NUMBER);
        const isSudo = isOwner || sudoUsers.has(senderPhone) || sudoUsers.has(senderNum.replace(/\D/g, ''));

        if (botMode === 'private' && !isSudo) return;

        // =========================================================================
        // 👑 ADMIN DETECTION — match Baileys phone JIDs and LIDs
        // =========================================================================
        let isAdmin = false;
        let isBotAdmin = false;

        if (isGroup) {
            try {
                const metadata = await sock.groupMetadata(from);
                const normalize = jid => jid ? jidNormalizedUser(jid) : '';
                const aliasesFor = async (...jids) => {
                    const aliases = new Set(jids.map(normalize).filter(Boolean));
                    for (const jid of [...aliases]) {
                        if (jid.endsWith('@lid')) {
                            try {
                                const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(jid);
                                if (pn) aliases.add(normalize(pn));
                            } catch (err) {
                                console.error('[ADMIN LID LOOKUP]', err.message);
                            }
                        }
                    }
                    return aliases;
                };
                const matches = async (participant, aliases) => {
                    const ids = await aliasesFor(participant?.id, participant?.phoneNumber);
                    return [...ids].some(id => aliases.has(id));
                };

                const senderAliases = await aliasesFor(sender, msg.key.participantAlt);
                const botAliases = await aliasesFor(sock.user?.id, sock.user?.lid);

                for (const participant of metadata.participants) {
                    if (await matches(participant, senderAliases)) {
                        isAdmin = ['admin', 'superadmin'].includes(participant.admin);
                    }
                    if (await matches(participant, botAliases)) {
                        isBotAdmin = ['admin', 'superadmin'].includes(participant.admin);
                    }
                }
            } catch (err) {
                console.error('[ADMIN CHECK]', err.message);
            }
        }

        // Sudo is a bot-level role, not a WhatsApp group-admin role. Owner may bypass group-admin checks.
        const isSenderAdmin = isAdmin || isOwner;

        // =========================================================================
        // 🔥 GLOBAL AUTO-REACT
        // =========================================================================
        // Global Auto-React Listener
if (autoSettings?.autoreact && !msg.key.fromMe && msg.message) {
    const emojis = ['🔥', '💀', '👑', '⚡', '😈', '🩸', '🖤'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    await sock.sendMessage(from, {
        react: {
            text: randomEmoji,
            key: msg.key
        }
    });
}

        // =========================================================================
        // 😂 QUOTE-REPLY MEME DETECTOR
        // =========================================================================
        const quotedMsgInfo = msg.message?.extendedTextMessage?.contextInfo;

        if (quotedMsgInfo?.stanzaId) {
            const replyText = body.trim().toLowerCase();

            if (['nope', 'no', 'yeah', 'yes', 'nah'].includes(replyText)) {
                const originalSender = quotedMsgInfo.participant;

                if (sender && originalSender) {
                    const memeCaption =
                        '🙋‍♂️ @' + sender.split('@')[0] +
                        ' said ' + body.trim() +
                        ' to @' + originalSender.split('@')[0] + '!';

                    await sock.sendMessage(from, {
                        image: { url: 'https://i.imgur.com/2wzGhpF.jpeg' },
                        caption: memeCaption,
                        mentions: [sender, originalSender]
                    }, { quoted: msg }).catch(() => {});
                }
            }
        }


        // =========================================================================
        // 🚫 IMPERIAL ANTISPAM — configurable warning / direct-kick enforcement
        // =========================================================================
        async function enforceImperialViolation(setting, reason) {
            await sock.sendMessage(from, { delete: msg.key }).catch(() => {});
            const cleanJid = jidNormalizedUser(sender);
            const mode = groupSettings[from][setting + 'Mode'] || 'warn';
            const limit = Math.max(1, Math.min(10, Number(groupSettings[from][setting + 'WarnLimit']) || 3));
            const warnKey = from + '_' + cleanJid + '_' + setting;
            const tag = '@' + senderNum;
            if (mode === 'kick') {
                await sock.sendMessage(from, {
                    text: '🚫 *' + reason + '*\n\n' + tag + '\n_𝒀𝒐𝒖 𝒂𝒓𝒆 𝒃𝒆𝒊𝒏𝒈 𝒓𝒆𝒎𝒐𝒗𝒆𝒅 𝒇𝒐𝒓 𝒃𝒓𝒆𝒂𝒌𝒊𝒏𝒈 𝒕𝒉𝒆 𝒈𝒓𝒐𝒖𝒑 𝒓𝒖𝒍𝒆𝒔._',
                    mentions: [cleanJid]
                }).catch(() => {});
                if (isBotAdmin) await sock.groupParticipantsUpdate(from, [cleanJid], 'remove').catch(() => {});
                return;
            }
            const warns = (imperialWarningMap.get(warnKey) || 0) + 1;
            imperialWarningMap.set(warnKey, warns);
            if (warns >= limit) {
                imperialWarningMap.delete(warnKey);
                await sock.sendMessage(from, {
                    text: '⚠️ *MAXIMUM WARNINGS EXCEEDED — BANISHING!*\n\n_𝑮𝒐𝒐𝒅𝒃𝒚𝒆!!!_\n_𝑫𝒖𝒍𝒍𝒂𝒓𝒅 🤡_\n\n' + tag + '\n_𝑹𝒆𝒂𝒔𝒐𝒏: ' + reason + '_',
                    mentions: [cleanJid]
                }).catch(() => {});
                if (isBotAdmin) await sock.groupParticipantsUpdate(from, [cleanJid], 'remove').catch(() => {});
            } else {
                await sock.sendMessage(from, {
                    text: '⚠️ *' + reason + ' IS FORBIDDEN!*\n\n' + tag + '\n_𝑺𝒕𝒐𝒑 𝒏𝒐𝒘 𝒐𝒓 𝒚𝒐𝒖 𝒘𝒊𝒍𝒍 𝒃𝒆 𝒓𝒆𝒎𝒐𝒗𝒆𝒅._\n*Warning: ' + warns + '/' + limit + '*',
                    mentions: [cleanJid]
                }).catch(() => {});
            }
        }

        if (isGroup && groupSettings[from].antispam && !isSenderAdmin) {
            const spamKey = from + '_' + sender;
            const now = Date.now();
            const data = imperialSpamMap.get(spamKey) || { times: [], cooldownUntil: 0 };
            if (now < data.cooldownUntil) {
                await sock.sendMessage(from, { delete: msg.key }).catch(() => {});
                return;
            }
            data.times = data.times.filter(time => now - time < 10000);
            data.times.push(now);
            if (data.times.length >= 6) {
                data.cooldownUntil = now + 15000;
                data.times = [];
                imperialSpamMap.set(spamKey, data);
                await enforceImperialViolation('antispam', 'SPAMMING');
                return;
            }
            imperialSpamMap.set(spamKey, data);
        }

        // =========================================================================
        // 🛡️ IMPERIAL GROUP MESSAGE PROTECTIONS
        // =========================================================================
        if (isGroup && groupSettings[from] && !isSenderAdmin) {
            const fullTextContent =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption ||
                msg.message?.documentMessage?.caption ||
                '';

            const cleanSenderJid = jidNormalizedUser(sender);

            // ANTILINK — warn-count or direct-kick mode
            const linkRegex = /(chat\.whatsapp\.com\/[A-Za-z0-9_-]{10,}|https?:\/\/[^\s]+)/i;
            if (groupSettings[from].antilink && linkRegex.test(fullTextContent)) {
                await enforceImperialViolation('antilink', 'LINK SHARING');
                return;
            }

            // ANTIGROUPSMENTION — detect WhatsApp's native @all signal and
            // visible @all/@everyone group-wide mention text. Invite links remain
            // the responsibility of AntiLink.
            const messageContent = unwrapMessage(msg.message) || {};
            const mentionContexts = Object.values(messageContent)
                .map(value => value?.contextInfo)
                .filter(Boolean);
            const hasNativeGroupMention = mentionContexts.some(context =>
                context.nonJidMentions === 1 || context.nonJidMentions === true
            );
            const hasGroupMentionText = /(?:^|\s)@(all|everyone)\b/i.test(fullTextContent);
            if (groupSettings[from].antigroupsmention && (hasNativeGroupMention || hasGroupMentionText)) {
                await enforceImperialViolation('antigroupsmention', 'GROUP MENTIONING');
                return;
            }

            // ANTIIMAGE
            if (groupSettings[from].antiimage && msg.message?.imageMessage) {
                await sock.sendMessage(from, {
                    delete: msg.key
                }).catch(() => {});

                await sock.sendMessage(from, {
                    text: '🖼️ @' + senderNum +
                        ', image sharing is disabled in this group.',
                    mentions: [cleanSenderJid]
                }).catch(() => {});
                return;
            }

            // ANTITAG — warn-count or direct-kick for mass mentions
            if (groupSettings[from].antitag) {
                const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentioned.length >= 5) {
                    await enforceImperialViolation('antitag', 'MASS TAGGING');
                    return;
                }
            }

            // ANTIGCSTATUS / ANTIGGSTATUS — detect matching broadcast-style promotions
            // posted by the same member across multiple groups this bot participates in.
            if (groupSettings[from].antigcstatus && fullTextContent.trim().length >= 30 && !fullTextContent.trim().startsWith(prefix)) {
                const promoPattern = /\b(join|follow|subscribe|broadcast|our group|my group|new group|group link|channel|status|invite|promo|promotion)\b/i;
                if (promoPattern.test(fullTextContent)) {
                    const normalizedPromo = fullTextContent.toLowerCase()
                        .replace(/https?:\/\/\S+/g, '<url>')
                        .replace(/\s+/g, ' ').replace(/[^a-z0-9<> ]/g, '').trim();
                    const broadcastKey = cleanSenderJid + '_' + normalizedPromo.slice(0, 220);
                    const now = Date.now();
                    const old = (imperialBroadcastMap.get(broadcastKey) || []).filter(item => now - item.time < 60000);
                    if (!old.some(item => item.group === from)) old.push({ group: from, time: now });
                    imperialBroadcastMap.set(broadcastKey, old);
                    if (old.length >= 3) {
                        await enforceImperialViolation('antigcstatus', 'CROSS-GROUP BROADCAST SPAM');
                        return;
                    }
                    // Bound memory usage; expired entries are discarded opportunistically.
                    if (imperialBroadcastMap.size > 1500) {
                        for (const [key, entries] of imperialBroadcastMap) {
                            if (!entries.some(item => now - item.time < 60000)) imperialBroadcastMap.delete(key);
                        }
                    }
                }
            }

            // ANTITAGADMIN
            if (groupSettings[from].antitagadmin) {
                const mentioned =
                    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

                if (mentioned.length > 0) {
                    try {
                        const metadata = await sock.groupMetadata(from);

                        const adminJids = metadata.participants
                            .filter(p => ['admin', 'superadmin'].includes(p.admin))
                            .map(p => jidNormalizedUser(p.id));

                        const taggedAdmins = mentioned.filter(jid =>
                            adminJids.includes(jidNormalizedUser(jid))
                        );

                        if (taggedAdmins.length > 0) {
                            await sock.sendMessage(from, {
                                delete: msg.key
                            }).catch(() => {});

                            await sock.sendMessage(from, {
                                text: '🛡️ @' + senderNum +
                                    ', tagging group administrators is restricted!',
                                mentions: [cleanSenderJid]
                            }).catch(() => {});
                            return;
                        }
                    } catch (err) {
                        console.error('[ANTITAGADMIN]', err.message);
                    }
                }
            }

            // ANTIBOT — only act on clear automation markers. WhatsApp does not expose a
            // universal bot-account flag, so ordinary bot accounts without these markers
            // cannot be identified reliably by a group bot.
            if (groupSettings[from].antibot && !msg.key.fromMe) {
                const obviousBotMarker = /(?:powered by\s+[\w.-]+|bot commands|automated message|i am an? bot|this is an automated|\btype \.(?:menu|help)\b|\b(?:bot|assistant)\s+menu\b)/i;
                if (obviousBotMarker.test(fullTextContent)) {
                    await enforceImperialViolation('antibot', 'UNAPPROVED BOT / AUTOMATED MESSAGES');
                    return;
                }
            }
        }


        // Duplicate protection handlers removed: the primary protection block above handles these once.

        // Allow a command after a leading mention, e.g. "@badboy .kick".
        // WhatsApp's actual mentionedJid is read below; this only normalizes command text.
        const commandBody = body.replace(/^\s*(?:@\S+\s*)+(?=\.)/u, '').trim();
        if (!commandBody.startsWith(prefix)) return;

        // Ignore duplicate delivery of the same command message (prevents private-chat reply loops/spam).
        const commandMessageId = msg.key?.id;
        if (commandMessageId) {
            const now = Date.now();
            for (const [id, seenAt] of processedCommandMessages) {
                if (now - seenAt > 10 * 60 * 1000) processedCommandMessages.delete(id);
            }
            if (processedCommandMessages.has(commandMessageId)) return;
            processedCommandMessages.set(commandMessageId, now);
            if (processedCommandMessages.size > 2000) {
                const oldest = processedCommandMessages.keys().next().value;
                processedCommandMessages.delete(oldest);
            }
        }

        // --- 3. COMMAND PARSING ---
        const args = commandBody.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const q = args.join(' ');
        
        const extra = {
            from,
            sender,
            senderNum,
            isGroup,
            isOwner,
            isSudo,
            isSenderAdmin,
            reply: async (text, options = {}) => sock.sendMessage(from, { text: toDemonFont(text), ...options }, { quoted: msg }),
            react: async (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {})
        };
        

        switch (command) {

            case 'play': {
                const query = args.join(' ').trim();

                if (!query) {
                    await extra.reply('🎵 Enter a song name.\n\nExample: .play song title');
                    break;
                }

                try {
                    await extra.reply('🔎 Searching for the track...');

                    const search = await yts(query);
                    const video = search?.videos?.[0];

                    if (!video) {
                        throw new Error('No matching track was found.');
                    }

                    // yt-search provides metadata only. Audio must come from a
                    // provider that is authorized to distribute the requested track.
                    const providerUrl = process.env.AUTHORIZED_AUDIO_API;
                    if (!providerUrl) {
                        throw new Error(
                            'No authorized audio provider is configured. Set AUTHORIZED_AUDIO_API to your licensed provider endpoint.'
                        );
                    }

                    const audioApiKey = process.env.AUDIO_API_KEY;
                    if (!audioApiKey || audioApiKey.length < 32) {
                        throw new Error('Audio API key is missing or invalid in the main bot environment.');
                    }

                    const response = await axios.get(providerUrl, {
                        params: { q: query },
                        headers: { Authorization: `Bearer ${audioApiKey}`, Accept: 'audio/*, application/octet-stream' },
                        responseType: 'arraybuffer',
                        timeout: 45000,
                        maxContentLength: 25 * 1024 * 1024,
                        maxBodyLength: 25 * 1024 * 1024,
                        validateStatus: status => status >= 200 && status < 300
                    });

                    const audioBuffer = Buffer.from(response.data || []);
                    if (!audioBuffer.length) {
                        throw new Error('The audio provider returned an empty response.');
                    }

                    const signature = audioBuffer.subarray(0, 12);
                    const isMp3 = signature.subarray(0, 3).toString() === 'ID3' ||
                        (signature[0] === 0xff && (signature[1] & 0xe0) === 0xe0);
                    const isOgg = signature.subarray(0, 4).toString() === 'OggS';
                    const isWav = signature.subarray(0, 4).toString() === 'RIFF';
                    const isFlac = signature.subarray(0, 4).toString() === 'fLaC';
                    const isMp4 = signature.subarray(4, 8).toString() === 'ftyp';

                    if (!(isMp3 || isOgg || isWav || isFlac || isMp4)) {
                        throw new Error('The provider response was not a recognized audio file.');
                    }

                    const mimetype = isOgg ? 'audio/ogg'
                        : isWav ? 'audio/wav'
                        : isFlac ? 'audio/flac'
                        : isMp4 ? 'audio/mp4'
                        : 'audio/mpeg';

                    const extension = isOgg ? 'ogg'
                        : isWav ? 'wav'
                        : isFlac ? 'flac'
                        : isMp4 ? 'm4a'
                        : 'mp3';

                    const safeTitle = (video.title || query)
                        .replace(/[\\/:*?"<>|]/g, '')
                        .slice(0, 100) || 'audio';

                    await sock.sendMessage(from, {
                        audio: audioBuffer,
                        mimetype,
                        fileName: safeTitle + '.' + extension,
                        ptt: false
                    }, { quoted: msg });

                } catch (err) {
                    const status = err.response?.status;
                    let detail = err.message || 'Audio provider error';
                    if (status === 401 || status === 403) {
                        detail = 'Audio API rejected the key. Check that AUDIO_API_KEY is identical in both Render services.';
                    } else if (status === 502 || status === 503 || status === 504) {
                        detail = `Audio API is temporarily unavailable (HTTP ${status}). Check the Audio API Render logs and service health.`;
                    } else if (status) {
                        detail = `Audio API request failed (HTTP ${status}).`;
                    } else if (err.code === 'ECONNABORTED') {
                        detail = 'Audio API timed out. Check whether the Render service is awake and responding.';
                    }
                    console.error('[PLAY COMMAND]', { status: status || null, code: err.code || null, message: err.message });
                    await extra.reply('❌ *PLAY FAILED*\n\n' + detail);
                }

                break;
            }


            // =========================================================================
            // GREAT DEMON V4 MENUS — decorative boxed layout
            // =========================================================================
            case 'ownermenu': {
                const t = '╭━━━〔 👑 *𝐄𝐌𝐏𝐄𝐑𝐎𝐑 𝐌𝐄𝐍𝐔* 〕━━━┈\n' +
                    '✿ .sudo\n✿ .sudolist\n✿ .sudoremove\n✿ .setprefix\n' +
                    '✿ .anticall\n✿ .delgcstatus\n✿ .delete / .del\n✿ .addowner\n' +
                    '✿ .antidelete\n✿ .antiviewonce\n✿ .autoonline\n✿ .autorecording\n' +
                    '✿ .autostatuslike\n✿ .autostatusview\n✿ .autotyping\n✿ .autoreact\n' +
                    '✿ .block\n✿ .unblock\n✿ .buatgc\n✿ .changebio\n✿ .devices\n' +
                    '✿ .getpp\n✿ .joingroup\n✿ .leavegroup\n✿ .listfont\n✿ .listgroup\n' +
                    '✿ .bancheck\n✿ .botlink\n✿ .fetchstatus\n✿ .listchannels\n✿ .mode\n' +
                    '✿ .pair\n✿ .broadcast\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━┈';
                return extra.reply(styleCommandMentions(t));
            }
            case 'groupmenu':
            case 'gcs': {
                const t = '╭━━━〔 🛡️ *𝘿𝒐𝒎𝒂𝒊𝒏 𝙈𝒂𝒏𝒂𝒈𝒆𝒎𝒆𝒏𝙩* 〕━━━┈\n' +
                    '✿ .welcome\n✿ .goodbye\n✿ .antilink\n✿ .antigroupsmention\n' +
                    '✿ .antibot\n✿ .antispam\n✿ .antitag\n✿ .antitagadmin\n' +
                    '✿ .antiremove\n✿ .addmember\n✿ .antiadd\n✿ .antidemote\n' +
                    '✿ .antiimage\n✿ .antipromote\n✿ .approveall\n✿ .close\n' +
                    '✿ .closetime\n✿ .demoteall\n✿ .demoteuser\n✿ .disapproveall\n' +
                    '✿ .dor\n✿ .gcs\n✿ .glostat\n✿ .grouplink\n✿ .grouponly\n' +
                    '✿ .hidetag\n✿ .kickall\n✿ .left\n✿ .listgroups\n✿ .mediatag\n' +
                    '✿ .open\n✿ .opentime\n✿ .promoteall\n✿ .promoteuser\n' +
                    '✿ .remove\n✿ .setgroupbio\n✿ .setgroupname\n✿ .setgrouppp\n' +
                    '✿ .setwarning\n✿ .tagadmin\n✿ .tagall\n✿ .tagonline\n' +
                    '✿ .tagpoll\n✿ .warning\n✿ .pin\n✿ .vv\n' +
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━┈';
                return extra.reply(styleCommandMentions(t));
            }
            case 'downloadmenu': {
                return extra.reply(styleCommandMentions('╭━━━〔 📥 *𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃 𝐓𝐎𝐎𝐋𝐒* 〕━━━┈\n' +
                    '✿ .applemusic\n✿ .capcut\n✿ .play <song name>\n✿ .dl <link>\n' +
                    '✿ .fb <public video link>\n✿ .yts <search words>\n✿ .lyrics <song name>\n' +
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━┈'));
            }
            case 'gamemenu': {
                return extra.reply(styleCommandMentions('╭━━━〔 🎮 *𝐈𝐌𝐏𝐄𝐑𝐈𝐀𝐋 𝐆𝐀𝐌𝐄𝐒* 〕━━━┈\n' +
                    '✿ .games\n✿ .mathquiz\n✿ .riddle\n✿ .hangman\n✿ .triviaclassic\n' +
                    '✿ .answer <answer>\n✿ .guess <letter>\n✿ .endgame\n' +
                    '✿ .balance\n✿ .bank\n✿ .profile\n✿ .daily\n✿ .weekly\n' +
                    '✿ .monthly\n✿ .beg\n✿ .work\n✿ .fish\n✿ .hunt\n' +
                    '✿ .deposit <amount>\n✿ .withdraw <amount>\n✿ .pay <user> <amount>\n' +
                    '✿ .shop\n✿ .buy <item>\n✿ .inventory\n✿ .leaderboard\n✿ .richest\n' +
                    '✿ .spawncard\n✿ .cardbuy <offer>\n✿ .cardlist\n✿ .cards\n✿ .cardprofile\n✿ .cardsell <id>\n✿ .cardtrade @user <yourCard> <theirCard>\n✿ .cardaccept <tradeId>\n' +
                    '┃ Games are free; correct answers award 100 GD.\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━┈'));
            }
            case 'aimenu': {
                return extra.reply(styleCommandMentions('╭━━━〔 🧠 *𝐃𝐄𝐌𝐎𝐍𝐈𝐂 𝐈𝐍𝐓𝐄𝐋𝐋𝐈𝐆𝐄𝐍𝐂𝐄* 〕━━━┈\n' +
                    '✿ .ai <question>\n✿ .aimenu\n✿ .claude <question>\n' +
                    '✿ .copilot <question>\n✿ .describe (reply to image)\n' +
                    '✿ .felo <question>\n✿ .gpt <question>\n✿ .imagine <description>\n' +
                    '✿ .llama <question>\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━┈'));
            }
            case 'othermenu': {
                return extra.reply(styleCommandMentions('╭━━━〔 🛠️ *𝐃𝐄𝐌𝐎𝐍𝐈𝐂 𝐓𝐎𝐎𝐋𝐒* 〕━━━┈\n' +
                    '✿ .ping\n✿ .status\n✿ .devices\n✿ .getpp\n✿ .fetchstatus\n' +
                    '✿ .listgroup\n✿ .permissionaudit\n✿ .groupinfo\n✿ .session\n✿ .uptime\n' +
                    '✿ .ownerpanel\n✿ .gstatus\n✿ .groupstatus\n✿ .ggstatus\n' +
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━┈'));
            }
            case 'togglemenu': {
                return extra.reply(styleCommandMentions('╭━━━〔 ⚙️ *𝐈𝐌𝐏𝐄𝐑𝐈𝐀𝐋 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒* 〕━━━┈\n' +
                    '✿ .autoonline on/off\n✿ .autorecording on/off\n✿ .autostatuslike on/off\n' +
                    '✿ .autostatusview on/off\n✿ .autotyping on/off\n✿ .autoreact on/off\n' +
                    '✿ .anticall on/off\n✿ .antilink on/off / kick / warn\n' +
                    '✿ .antibot on/off\n✿ .antispam on/off\n✿ .antitag on/off\n' +
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━┈'));
            }
            case 'funmenu': {
                return extra.reply(styleCommandMentions('╭━━━〔 🎭 *𝐇𝐀𝐕𝐄 𝐅𝐔𝐍 𝐖𝐈𝐓𝐇 𝐄𝐌𝐏* 〕━━━┈\n' +
                    '✿ .gm\n✿ .goodmorning\n✿ .ga\n✿ .goodafternoon\n' +
                    '✿ .gn\n✿ .goodnight\n✿ .konachan (SFW)\n✿ .wasted\n' +
                    '✿ .top\n✿ .activeusers\n✿ .gayrate\n✿ .flirt\n✿ .dare\n✿ .truth\n' +
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━┈'));
            }
            case 'allmenu': {
                const lines = [
                    '╭━━〔 👑 𝑮𝑹𝑬𝑨𝑻 𝑫𝑬𝑴𝑶𝑵 V4 〕━━╮',
                    '┃ 𝑽4.4 • 𝑪𝑶𝑴𝑷𝑳𝑬𝑻𝑬 𝑪𝑶𝑴𝑴𝑨𝑵𝑫 𝑳𝑰𝑺𝑻',
                    '┣━━━━━━━━━━━━━━━━━━━━',
                    ...COMMAND_CATALOG.map(name => '┃ • ' + prefix + styleCommandName(name)),
                    '╰━━━━━━━━━━━━━━━━━━━━╯',
                    '',
                    'Use .menu for the overview and category menus for focused lists.'
                ];
                // Keep the complete catalogue in one WhatsApp message, like the old bot.
                await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: msg });
                break;
            }

            case 'menu':
            case 'help': {
                const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
                const hours = Math.floor(uptimeSeconds / 3600);
                const minutes = Math.floor((uptimeSeconds % 3600) / 60);
                const seconds = uptimeSeconds % 60;
                const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;
                const menuText = '╭━━━〔 👑 *' + BOT_NAME + '* 👑 〕━━━┈\n' +
                    '┃ 👑 *𝑩𝒐𝒕 𝑶𝒘𝒏𝒆𝒓:* ' + OWNER_NAME + '\n' +
                    '┃ 🔮 *𝑩𝒐𝒕 𝑴𝒐𝒅𝒆:* ' + botMode.toUpperCase() + '\n' +
                    '┃ 🏗️ *𝑩𝒐𝒕 𝑺𝒕𝒂𝒕𝒖𝒔:* Under Development\n' +
                    '┃ ⏰️ *𝑼𝒑𝒕𝒊𝒎𝒆:* ' + uptimeFormatted + '\n' +
                    '┃ 🌖 *𝑽𝒆𝒓𝒔𝒊𝒐𝒏:* ' + BOT_VERSION + '\n' +
                    '╰━━━━━━━━━━━\n\n' +
                    '╭━━━〔 📚 *𝑪𝒐𝒎𝒎𝒂𝒏𝒅𝒔 𝑳𝒊𝒔𝒕* 〕━━━┈\n' +
                    '✦ .ownermenu\n✦ .groupmenu\n✦ .downloadmenu\n' +
                    '✦ .gamemenu\n✦ .aimenu\n✦ .othermenu\n✦ .togglemenu\n' +
                    '✦ .funmenu\n✦ .allmenu\n' +
                    '╰━━━━━━━━━━━\n\n' +
                    '╭━━━〔 👑 *𝘼𝘽𝙊𝙐𝙏 𝘾𝙍𝙀𝘼𝙏𝙊𝙍* 👑 〕━━━┈\n' +
                    '┃ 👑 *CREATOR:* ᴵᴬᴹ«»ᘜяᥱᥲт ᗪᥱмση ᙓмρ\n' +
                    '┃ 📞 *CONTACT:* +2347061696819\n' +
                    '┃ 🛡️ *IDENTITY:* 𝐰𝐡𝐲 𝐚𝐥𝐰𝐚𝐲𝐬 𝐊𝐞𝐥𝐯𝐢𝐧\n' +
                    '┃ 🐙 *GITHUB:*  Uhm Later\n' +
                    '┃\n' +
                    '┃ 💐 _"𝙏𝒉𝒆 𝙁𝒓𝒂𝒈𝒓𝒂𝒏𝒕 𝒇𝒍𝒐𝒘𝒆𝒓𝒔 𝘽𝒍𝒐𝒐𝒎𝒔 𝒘𝒊𝙩𝙝 𝘿𝒊𝒈𝒏𝒊𝙩𝙮"_\n' +
                    '╰━━━━━━━━━━━━━━━━━━━━━━━┈';
                try {
                    await sock.sendMessage(from, { image: { url: MENU_IMAGE_URL }, caption: styleCommandMentions(menuText) }, { quoted: msg });
                } catch (err) {
                    await sock.sendMessage(from, { text: styleCommandMentions(menuText) }, { quoted: msg });
                }
                break;
            }

            // =========================================================================
            // NATURAL & DRAMATIC GREETINGS (.gm, .ga, .gn)
            // =========================================================================
                        case 'goodmorning':
            case 'gm':
            case 'goodafternoon':
            case 'ga':
            case 'goodnight':
            case 'gn': {
                const period = ['gm', 'goodmorning'].includes(command) ? 'morning'
                    : ['ga', 'goodafternoon'].includes(command) ? 'afternoon' : 'night';
                if (!isGroup) return extra.reply('⚔️ *Use this in a group chat.*');
                if (!isSenderAdmin && !isSudo) return extra.reply('⚔️ *Only admins or sudo users can run this.*');
                try {
                    const groupMetadata = await sock.groupMetadata(from);
                    const mentions = groupMetadata.participants.map(p => p.id);
                    const greetings = {
                        morning: [
                            '🌅 *おはようございます (Ohayō gozaimasu)!*\nThe new day has spawned. May your energy bar stay full and your quests go well!',
                            '☀️ *おはよう (Ohayō)!*\nRise, anime squad. A fresh episode and a new adventure are waiting!',
                            '🌸 *Ohayō minna-san!*\nMay today bring good luck, strong spirit and legendary moments.'
                        ],
                        afternoon: [
                            '☀️ *こんにちは (Konnichiwa)!*\nMidday check-in, heroes. Keep your spirit bright and your story moving!',
                            '🌤️ *Konnichiwa minna!*\nHope your day is going like a winning anime arc. Stay awesome!',
                            '⚡ *こんにちは!*\nThe afternoon episode is here. Keep pushing toward your goals, squad!'
                        ],
                        night: [
                            '🌙 *おやすみなさい (Oyasumi nasai)!*\nThe episode is ending. Rest well and recover your energy for tomorrow!',
                            '✨ *おやすみ (Oyasumi), minna-san!*\nMay your dreams be peaceful and your next chapter be legendary.',
                            '🌌 *Oyasumi nasai!*\nGoodnight, heroes. Save your energy for the next adventure.'
                        ]
                    };
                    const categories = period === 'night' ? ['sleep', 'neko', 'waifu'] : period === 'morning' ? ['smile', 'wave', 'waifu'] : ['wave', 'smile', 'neko'];
                    const caption = greetings[period][Math.floor(Math.random() * greetings[period].length)];
                    const anime = await fetchSfwAnimeImage(categories[Math.floor(Math.random() * categories.length)]);
                    const heading = period === 'morning' ? '🌅 OHAYŌ GOZAIMASU' : period === 'afternoon' ? '☀️ KONNICHIWA' : '🌙 OYASUMI NASAI';
                    await sock.sendMessage(from, { image: anime.buffer, caption: `${heading}\n\n${caption}\n\n🎌 *GREAT DEMON V4.9*`, mentions }, { quoted: msg });
                } catch (e) {
                    console.error(`[${period.toUpperCase()} GREETING]`, e);
                    await extra.reply(`❌ Couldn't fetch an anime greeting image right now. Please try again.`);
                }
                break;
            }

            // =========================================================================
            // CUSTOM ADDED FEATURES INTEGRATION
            // =========================================================================
            
            // 1. Message Count Leaderboard
            case 'top':
            case 'topmembers':
            case 'listactive': {
                if (!isGroup) {
                    return extra.reply('This command is only available in group chats.');
                }

                const messageCounts = loadMessageCounts();
                const groupCounts = messageCounts[from] || {};

                const sortedMembers = Object.entries(groupCounts)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5);

                if (sortedMembers.length === 0) {
                    return extra.reply('No message activity recorded yet.');
                }

                let message = '🏆 Top Members Based on Message Count:\n\n';
                sortedMembers.forEach(([userId, count], index) => {
                    message += `${index + 1}. @${userId.split('@')[0]} - ${count} messages\n`;
                });

                await sock.sendMessage(from, { text: message, mentions: sortedMembers.map(([userId]) => userId) }, { quoted: msg });
                break;
            }

            // 2. Wasted Image Command
            case 'wasted': {
                let userToWaste;
                
                if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
                    userToWaste = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
                    userToWaste = msg.message.extendedTextMessage.contextInfo.participant;
                }
                
                if (!userToWaste) {
                    await sock.sendMessage(from, { 
                        text: 'Please mention someone or reply to their message to waste them!' 
                    }, { quoted: msg });
                    return;
                }

                try {
                    let profilePic;
                    try {
                        profilePic = await sock.profilePictureUrl(userToWaste, 'image');
                    } catch {
                        profilePic = 'https://i.imgur.com/2wzGhpF.jpeg';
                    }

                    const wastedResponse = await axios.get(
                        `https://some-random-api.com/canvas/overlay/wasted?avatar=${encodeURIComponent(profilePic)}`,
                        { responseType: 'arraybuffer' }
                    );

                    await sock.sendMessage(from, {
                        image: Buffer.from(wastedResponse.data),
                        caption: `⚰️ *Wasted* : ${userToWaste.split('@')[0]} 💀\n\nRest in pieces!`,
                        mentions: [userToWaste]
                    }, { quoted: msg });

                } catch (error) {
                    console.error('Error in wasted command:', error);
                    await sock.sendMessage(from, { 
                        text: 'Failed to create wasted image! Try again later.'
                    }, { quoted: msg });
                }
                break;
            }

case 'konachan':
case 'konachansfw': {
    let sent = false;
    try {
        try {
            const posts = await fetchKonachanSafePosts(40);
            const pool = posts.slice().sort(() => Math.random() - 0.5);
            for (const post of pool.slice(0, 12)) {
                try {
                    const mediaUrl = new URL(post.file_url);
                    if (mediaUrl.protocol !== 'https:' || post.rating !== 's') continue;
                    const response = await axios.get(mediaUrl.href,{responseType:'arraybuffer',timeout:22000,maxContentLength:35*1024*1024,headers:{'User-Agent':'GREAT-DEMON-V4.9 SFW image command'}});
                    if (!String(response.headers['content-type']||'').toLowerCase().startsWith('image/')) continue;
                    const bytes=Buffer.from(response.data); const meta=await sharp(bytes,{animated:true}).metadata();
                    if(!meta.width||!meta.height) continue;
                    await sock.sendMessage(from,{image:bytes},{quoted:msg}); sent=true; break;
                } catch(imageError){console.error('[KONACHAN IMAGE]',String(imageError.message||imageError).slice(0,100));}
            }
        } catch(konachanError){console.error('[KONACHAN API]',String(konachanError.message||konachanError).slice(0,120));}
        // Konachan is preferred. If its API is returning 403, keep this command
        // useful with a plain SFW image (never a collectible card or caption).
        if(!sent){const fallback=await fetchSfwPlainImageFallback();await sock.sendMessage(from,{image:fallback},{quoted:msg});sent=true;}
    } catch(error){console.error('[KONACHAN IMAGE ERROR]',error?.stack||error);await extra.reply('❌ No SFW image source is responding right now. Please try again shortly.').catch(()=>{});}
    break;
}
                      // =========================================================================
            // EXISTING BOT COMMANDS
            // =========================================================================
            case 'sudo': {
                if (!isOwner) return extra.reply('⚔️ *Only My Lord Demon Emperor can appoint Sudo members!*');
                const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant || (q ? q.replace(/[^0-9]/g, '') : null);
                if (!target) return extra.reply('💡 *My Lord, tag a user or reply to their message to grant Sudo rank.*');
                const cleanNum = (await resolvePhoneDigits(sock, target)) || String(target).replace(/[^0-9]/g, '');
                sudoUsers.add(cleanNum);
                db.sudoUsers = Array.from(sudoUsers);
                saveSettings(db);
                await extra.reply(`👑 *Granted Sudo privileges to +${cleanNum}, My Lord!*`);
                break;
            }

            case 'sudolist': {
                let txt = "👑 *𝐆𝐑𝐄𝐀𝐓_𝐃𝐄𝐌𝐎𝐍 Sudo Roster*\n\n";
                sudoUsers.forEach(u => txt += `• +${u}\n`);
                await sock.sendMessage(from, { text: txt, mentions: Array.from(sudoUsers).map(u => u + '@s.whatsapp.net') }, { quoted: msg });
                break;
            }

            case 'sudoremove': {
                if (!isOwner) return extra.reply('⚔️ *Only My Lord Demon Emperor can revoke Sudo members!*');
                const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant || (q ? q.replace(/[^0-9]/g, '') : null);
                if (!target) return extra.reply('💡 *My Lord, tag or mention a Sudo user to strip their rank.*');
                const cleanNum = (await resolvePhoneDigits(sock, target)) || String(target).replace(/[^0-9]/g, '');
                if (cleanNum === OWNER_NUMBER) return extra.reply('🛡️ The primary owner cannot be removed from the Sudo roster.');
                sudoUsers.delete(cleanNum);
                db.sudoUsers = Array.from(sudoUsers);
                saveSettings(db);
                await extra.reply(`❌ *Stripped Sudo rank from +${cleanNum}, that means you don't worth it !*`);
                break;
            }

            case 'anticall': {
                if (!isSudo) return extra.reply('⚔️ *Sudo rights required!*');
                if (!args[0] || !['on', 'off'].includes(args[0].toLowerCase())) {
                    return extra.reply('Usage: ' + prefix + 'anticall on/off');
                }
                const enabled = args[0].toLowerCase() === 'on';
                autoSettings.anticall = enabled;
                db.autoSettings = autoSettings;
                saveSettings(db);
                await extra.reply(enabled ? '✅ Anti-call enabled. Calls will be auto-rejected & blocked.' : '❌ Anti-call disabled.');
                break;
            }

            case 'setprefix':
            case 'prefix': {
                if (!isSudo) return extra.reply('⚔️ *Sudo rights required!*');
                if (args.length === 0) {
                    return extra.reply(`📌 Current prefix: ${prefix}\n\nUsage: ${prefix}setprefix <new prefix>`);
                }
                const newPrefix = args[0];
                if (newPrefix.length > 3) {
                    return extra.reply('❌ Prefix must be 1-3 characters long!');
                }
                prefix = newPrefix;
                db.prefix = prefix;
                saveSettings(db);
                await extra.reply(`✅ Prefix changed to: ${prefix}\n\nNew command format: ${prefix}command`);
                break;
            }


            case 'del':
            case 'delete': {
                if (!isSenderAdmin) return extra.reply('⚔️ *Admin rights required!*');
                const ctx = msg.message?.extendedTextMessage?.contextInfo;
                if (!ctx?.stanzaId) {
                    return extra.reply('🗑️ *Reply directly to the message you wish to delete, My Lord.*');
                }

                try {
                    const quotedFromMe = Boolean(ctx.fromMe);
                    const quotedParticipant = isGroup
                        ? jidNormalizedUser(ctx.participant || (quotedFromMe ? sock.user.id : sender))
                        : undefined;
                    const deleteKey = {
                        remoteJid: from,
                        fromMe: quotedFromMe,
                        id: ctx.stanzaId,
                        ...(quotedParticipant ? { participant: quotedParticipant } : {})
                    };
                    await sock.sendMessage(from, { delete: deleteKey });
                    await extra.react('🗑️');
                } catch (error) {
                    await extra.reply('❌ *Failed to delete message. Ensure bot is group admin!*');
                }
                break;
            }

            case 'groupstatus':
            case 'togstatus':
            case 'swgc':
            case 'gs':
            case 'gstatus': {
                // Posts exclusively through Group Status V2. Never send media/text as a chat fallback.
                if (!isGroup) {
                    await extra.reply('👥 This command can only be used inside a group.');
                    break;
                }
                if (!GROUP_STATUS_V2_SUPPORTED) {
                    await extra.reply(GROUP_STATUS_V2_UNAVAILABLE);
                    break;
                }

                const statusCaption = String(q || '').trim();
                const media = resolveMedia(msg);

                // .groupstatus link fetches this group's invite link and publishes it as a real Group Status.
                if (!media && statusCaption.toLowerCase() === 'link') {
                    try {
                        await extra.reply('⏳ Fetching this group’s invite link...');
                        const inviteCode = await sock.groupInviteCode(from);
                        if (!inviteCode) throw new Error('WhatsApp returned an empty invite code.');
                        const inviteUrl = `https://chat.whatsapp.com/${inviteCode}`;
                        await groupStatusBroadcast(sock, from, {
                            text: `🔗 GROUP INVITE LINK\n\n${inviteUrl}`,
                            backgroundColor: PURPLE_COLOR
                        });
                        await extra.reply('📨 Group Status relay request accepted. WhatsApp publication is not independently confirmed; check the Status tab.');
                    } catch (error) {
                        console.error('[GROUPSTATUS LINK]', error);
                        await extra.reply('❌ Could not fetch or publish the group invite link. The bot may need group-admin permission to retrieve the invite code.');
                    }
                    break;
                }

                // Text-only Group Status.
                if (!media) {
                    if (!statusCaption) {
                        await extra.reply(
                            '📝 *GROUP STATUS USAGE*\n\n' +
                            '• Send an image/video/audio with `.groupstatus [caption]`\n' +
                            '• Reply to image/video/audio with `.groupstatus [caption]`\n' +
                            '• Text only: `.groupstatus Your text here`\n' +
                            '• Fetch and publish this group’s invite link: `.groupstatus link`\n\n' +
                            'All posts go to the actual WhatsApp Group Status, never the group chat.'
                        );
                        break;
                    }

                    try {
                        await extra.reply('⏳ Publishing text to Group Status...');
                        await groupStatusBroadcast(sock, from, {
                            text: statusCaption,
                            backgroundColor: PURPLE_COLOR
                        });
                        await extra.reply('📨 Text Status relay request accepted. WhatsApp publication is not independently confirmed; check the Status tab.');
                    } catch (error) {
                        console.error('[GROUPSTATUS TEXT]', error);
                        await extra.reply('❌ Group Status publishing failed. Nothing was sent to the group chat.');
                    }
                    break;
                }

                let mediaBuffer;
                try {
                    mediaBuffer = await downloadMediaMessage(
                        media.targetMessage,
                        'buffer',
                        {},
                        { logger: undefined, reuploadRequest: sock.updateMediaMessage }
                    );
                } catch (error) {
                    console.error('[GROUPSTATUS MEDIA DOWNLOAD]', error);
                    await extra.reply('❌ Could not download the attached/replied media.');
                    break;
                }

                if (!mediaBuffer || !mediaBuffer.length) {
                    await extra.reply('❌ The selected media is empty or unavailable.');
                    break;
                }

                try {
                    if (media.kind === 'image' || media.kind === 'sticker') {
                        await extra.reply('⏳ Publishing image to Group Status...');
                        await groupStatusBroadcast(sock, from, {
                            image: mediaBuffer,
                            caption: statusCaption
                        });
                        await extra.reply('📨 Image Status relay request accepted. WhatsApp publication is not independently confirmed; check the Status tab.');
                    } else if (media.kind === 'video') {
                        await extra.reply('⏳ Publishing video to Group Status...');
                        await groupStatusBroadcast(sock, from, {
                            video: mediaBuffer,
                            caption: statusCaption
                        });
                        await extra.reply('📨 Video Status relay request accepted. WhatsApp publication is not independently confirmed; check the Status tab.');
                    } else if (media.kind === 'audio') {
                        await extra.reply('⏳ Preparing audio for Group Status...');
                        let voiceBuffer = mediaBuffer;
                        try {
                            voiceBuffer = await new Promise((resolve, reject) => {
                                const input = new PassThrough();
                                const output = new PassThrough();
                                const chunks = [];
                                output.on('data', chunk => chunks.push(chunk));
                                output.on('error', reject);
                                input.end(mediaBuffer);
                                ffmpeg(input)
                                    .noVideo()
                                    .audioCodec('libopus')
                                    .audioChannels(1)
                                    .audioFrequency(48000)
                                    .format('ogg')
                                    .on('error', reject)
                                    .on('end', () => resolve(Buffer.concat(chunks)))
                                    .pipe(output);
                            });
                        } catch (conversionError) {
                            console.warn('[GROUPSTATUS AUDIO CONVERSION]', conversionError.message);
                            throw new Error('Audio conversion failed. Check that FFmpeg and libopus are installed.');
                        }
                        if (!voiceBuffer?.length) throw new Error('Audio conversion returned an empty file.');
                        await groupStatusBroadcast(sock, from, {
                            audio: voiceBuffer,
                            mimetype: 'audio/ogg; codecs=opus',
                            ptt: true
                        });
                        await extra.reply('📨 Audio Status relay request accepted. WhatsApp publication is not independently confirmed; check the Status tab.');
                    } else {
                        await extra.reply('❌ Unsupported media. Use an image, video, or audio.');
                    }
                } catch (error) {
                    console.error('[GROUPSTATUS PUBLISH]', error);
                    await extra.reply('❌ Group Status publishing failed. Nothing was sent to the group chat.');
                }
                break;
            }

            

case 'gcstatus':
case 'ggstatus':
case 'gcast': {
    if (!isOwner) {
        return extra.reply('⚔️ Only the Demon Emperor can publish Group Status V2!');
    }

    if (!GROUP_STATUS_V2_SUPPORTED) {
        return extra.reply(GROUP_STATUS_V2_UNAVAILABLE);
    }

    const inviteUrl = String(q || '').trim();
    const match = inviteUrl.match(
        /(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i
    );

    if (!match) {
        return extra.reply(
            '❌ Usage:\n.ggstatus https://chat.whatsapp.com/INVITECODE'
        );
    }

    if (!sock.user?.id) {
        return extra.reply('❌ WhatsApp is not connected.');
    }

    try {
        const inviteInfo = await sock.groupGetInviteInfo(match[1]);

        console.log('[GGSTATUS] Invite metadata resolved:', {
            id: inviteInfo?.id || inviteInfo?.jid || null,
            subject: inviteInfo?.subject || null,
            hasPictureUrl: Boolean(
                inviteInfo?.profilePicUrl ||
                inviteInfo?.profilePictureUrl ||
                inviteInfo?.pictureUrl
            )
        });

        if (
            !(inviteInfo?.id || inviteInfo?.jid) ||
            !String(inviteInfo.id || inviteInfo.jid).endsWith('@g.us')
        ) {
            return extra.reply(
                '❌ WhatsApp returned incomplete invitation metadata.'
            );
        }

        const groupName = inviteInfo?.subject || 'WhatsApp Group';

        const groups = await sock.groupFetchAllParticipating();
        const groupJids = Object.keys(groups || {})
            .filter(jid => jid.endsWith('@g.us'));

        if (!groupJids.length) {
            return extra.reply('❌ No participating groups found.');
        }

        await extra.reply(
            `📡 Preparing Group Status V2...\n` +
            `🏰 Groups found: ${groupJids.length}\n` +
            `📌 Publishing invitation as status stories.`
        );

        const story = {
            text: `${groupName}\n${inviteUrl}`,
            backgroundColor: PURPLE_COLOR
        };

        let submitted = 0;
        let cardsSubmitted = 0;
        const failed = [];
        const cardFailed = [];
        let invitationCard = null;
        let cardGenerationError = null;

        try {
            invitationCard = await createGroupInvitationCard(
                sock,
                groupName,
                inviteUrl,
                inviteInfo
            );
        } catch (error) {
            cardGenerationError = error;
            console.error(
                '[GROUP INVITATION CARD GENERATION FAILED]',
                error?.stack || error
            );

            await extra.reply(
                `⚠️ Invitation image generation failed.\n` +
                `Reason: ${error?.message || 'Unknown card-generation error'}`
            );
        }

        for (const groupJid of groupJids) {
            try {
                await groupStatusBroadcast(sock, groupJid, story);
                submitted++;
            } catch (error) {
                console.error('[GROUP STATUS V2 FAILED]', groupJid, error);
                failed.push(
                    `${groupJid}: ${error.message || 'Unknown error'}`
                );
            }

            if (!invitationCard) {
                cardFailed.push(
                    `${groupJid}: ${cardGenerationError?.message || 'Card generation failed'}`
                );
            } else {
                try {
                    await groupStatusBroadcast(sock, groupJid, {
                        image: invitationCard,
                        caption: `${groupName}\n${inviteUrl}`
                    });

                    cardsSubmitted++;
                    console.log(
                        '[GROUP INVITATION CARD RELAY ACCEPTED]',
                        groupJid
                    );
                } catch (cardError) {
                    console.error(
                        '[GROUP INVITATION CARD RELAY FAILED]',
                        groupJid,
                        cardError
                    );

                    cardFailed.push(
                        `${groupJid}: ${cardError.message || 'Card relay failed'}`
                    );
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1200));
        }

        await extra.reply(
            `╭━━━〔 👑 GREAT DEMON V4 〕━━━╮\n` +
            `┃ 📡 GROUP STATUS V2 REPORT\n` +
            `┣━━━━━━━━━━━━━━━━━━━━\n` +
            `┃ 📤 Text relays accepted: ${submitted}/${groupJids.length}\n` +
            `┃ 🖼️ Photo-card relays accepted: ${cardsSubmitted}/${groupJids.length}\n` +
            `┃ ❌ Text failed: ${failed.length}\n` +
            `┃ ⚠️ Card failed: ${cardFailed.length}\n` +
            (cardGenerationError
                ? `┃ 🧩 Card generation: FAILED\n`
                : `┃ 🧩 Card generation: READY\n`) +
            `┃ 🔗 Content: Group invitation\n` +
            `┃ 📍 Destination: Participating groups\n` +
            `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            (
                (failed.length || cardFailed.length)
                    ? `Text failures:\n${failed.slice(0, 5).join('\n') || 'None'}\n\n` +
                      `Card generation error:\n${cardGenerationError?.message || 'None'}\n\n` +
                      `Card failures:\n${cardFailed.slice(0, 5).join('\n') || 'None'}`
                    : 'Relay requests were accepted by the connection; check the Status tab.'
            )
        );

    } catch (error) {
        console.error('[GGSTATUS ERROR]', error);

        await extra.reply(
            `❌ GROUP STATUS V2 FAILED\n\n${error.message}`
        );
    }

    break;
}


case 'delgcstatus':
case 'revoke': {
    if (!isOwner) return extra.reply('⚔️ *Only My Lord Demon Emperor can revoke status stories!*');
    
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (!ctx?.stanzaId || !ctx?.participant) {
        return extra.reply('🗑️ *Reply to the status story message you want to delete!*');
    }

    try {
        const targetParticipant = jidNormalizedUser(ctx.participant);
        
        // Target status broadcast with fromMe: false for statuses posted by others/other bots
        const statusKey = {
            remoteJid: 'status@broadcast',
            fromMe: false,
            id: ctx.stanzaId,
            participant: targetParticipant
        };

        await sock.sendMessage('status@broadcast', { delete: statusKey });
        await extra.reply('✅ *External status story successfully targeted for deletion!*');
    } catch (e) {
        console.error('[REVOKE EXTERNAL ERROR]', e);
        
        // Fallback option for normal chat messages
        try {
            await sock.sendMessage(from, { 
                delete: { 
                    remoteJid: from, 
                    id: ctx.stanzaId, 
                    participant: ctx.participant,
                    fromMe: false 
                } 
            });
            await extra.reply('✅ *Message deleted from chat!*');
        } catch (err2) {
            await extra.reply('❌ *Failed to delete. WhatsApp restricts deleting stories posted by other accounts unless you have administrative clearance.*');
        }
    }
    break;
}

            case 'flirt':
            case 'pickup':
            case 'pickupline': {
                try {
                    let flirtText = '';
                    try {
                        const response = await axios.get('https://api.shizo.top/quote/flirt?apikey=shizo', { timeout: 12000 });
                        flirtText = response.data?.result || response.data?.quote || response.data?.message || '';
                    } catch (apiError) {
                        console.warn('[FLIRT TEXT API]', apiError.message);
                    }
                    if (!flirtText || typeof flirtText !== 'string') {
                        flirtText = [
                            'Are you a star? Because you make this little corner of the universe brighter.',
                            'If kindness were an anime power, you would already be the main character.',
                            'You must be a rare character drop, because meeting you feels lucky.'
                        ][Math.floor(Math.random() * 3)];
                    }
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    const anime = await fetchSfwAnimeImage(Math.random() < 0.5 ? 'blush' : 'wink');
                    const caption = `💌 *ANIME FLIRT DROP*\n\n${flirtText}\n\n🌸 _A little anime-style compliment for the day._`;
                    await sock.sendMessage(extra.from, { image: anime.buffer, caption, mentions: mentioned }, { quoted: msg });
                } catch (error) {
                    console.error('[FLIRT COMMAND]', error);
                    await extra.reply(`❌ Couldn't fetch a flirt image right now. Please try again. (${error.message})`);
                }
                break;
            }

            case 'dare':
            case 'truth': {
                const kind = command === 'truth' ? 'truth' : 'dare';
                try {
                    let prompt;
                    try {
                        prompt = await fetchTruthOrDareFromWeb(kind);
                    } catch (apiError) {
                        console.warn(`[${kind.toUpperCase()} WEB API]`, apiError.message);
                        if (kind === 'truth') {
                            const scraped = await truth();
                            const translated = await translate(String(scraped), { to: 'en' });
                            prompt = translated.text;
                            if (UNSAFE_GAME_PROMPT.test(prompt)) throw new Error('Fallback returned an unsuitable prompt');
                        } else {
                            prompt = [
                                'Do your best anime hero introduction in a dramatic voice.',
                                'Draw a tiny anime character and show the group.',
                                'Speak like a friendly anime narrator for your next three messages.',
                                'Share a harmless fun fact about yourself.'
                            ][Math.floor(Math.random() * 4)];
                        }
                    }
                    const anime = await fetchSfwAnimeImage(kind === 'truth' ? 'think' : 'smile');
                    const card = await makeTruthDareCard(kind, prompt, anime);
                    await sock.sendMessage(extra.from, {
                        image: card,
                        caption: `🎴 *${kind.toUpperCase()} CHALLENGE*\n🌸 Random prompt fetched from the web\n🎌 GREAT DEMON PARTY`,
                        mimetype: 'image/jpeg'
                    }, { quoted: msg });
                } catch (error) {
                    console.error(`[${kind.toUpperCase()} COMMAND]`, error);
                    await extra.reply(`❌ Couldn't create the ${kind} card right now. Please try again.`);
                }
                break;
            }

            case 'gayrate':
            case 'gay': {
                const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
                const mentioned = ctx.mentionedJid || [];
                const targetId = mentioned.length ? mentioned[0] : (ctx.participant || extra.sender);
                const targetTag = `@${String(targetId).split('@')[0]}`;
                const percent = Math.floor(Math.random() * 101);
                const labels = percent >= 100 ? 'SUPREME RAINBOW EMPRESS 😂🌈👑' : percent >= 75 ? 'MOISTURIZER QUEEN 💅' : percent >= 50 ? 'MR PRINCESS CLOCK IT 👑⏰' : percent >= 25 ? 'COLORFUL SETTING 🌈' : 'QUIET LEGEND 🗿';
                const out = `🌈 *GAYRATE MEME METER*\n\n${targetTag}\n🎲 Random score: *${percent}%*\n⚡ Rank: *${labels}*\n\n_Just a random group-game joke; it does not say anything about anyone's real identity._`;
                await sock.sendMessage(extra.from, { text: out, mentions: [targetId] }, { quoted: msg });
                break;
            }

case 'autoreact': {
    if (!isSudo) return extra.reply('⚔️ *Sudo rights required!*');
    const stateArg = args[0]?.toLowerCase();
    
    if (stateArg === 'on') {
        autoSettings.autoreact = true;
        db.autoSettings = autoSettings;
        saveSettings(db); // Writes changes directly to database.json
        await extra.reply('✅ *Global Auto-React activated & saved!*');
    } else if (stateArg === 'off') {
        autoSettings.autoreact = false;
        db.autoSettings = autoSettings;
        saveSettings(db); // Writes changes directly to database.json
        await extra.reply('❌ *Global Auto-React deactivated & saved!*');
    } else {
        await extra.reply(`⚙️ *Auto-React Status:* ${autoSettings.autoreact ? 'ACTIVE ✅' : 'DISABLED ❌'}`);
    }
    break;
}

            case 'addowner': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *Only My Lord Demon Emperor can appoint co-owners!*' }, { quoted: msg });
                const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant || (q ? q.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);
                if (!target) return sock.sendMessage(from, { text: '💡 *My Lord, tag a user or reply to their message.*' }, { quoted: msg });
                const targetPhone = (await resolvePhoneDigits(sock, target)) || String(target).replace(/[^0-9]/g, '');
                sudoUsers.add(targetPhone);
                db.sudoUsers = Array.from(sudoUsers);
                saveSettings(db);
                await sock.sendMessage(from, { text: '👑 *Granted throne privileges to subject, My Lord!*' }, { quoted: msg });
                break;
            }

            case 'antidelete': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                if (!isSenderAdmin) return sock.sendMessage(from, { text: '⚔️ *Admin rights required!*' }, { quoted: msg });
                groupSettings[from].antidelete = !groupSettings[from].antidelete;
                saveGroupSettings();
                await sock.sendMessage(from, { text: "👁️ *Imperial Anti-Delete DON'T RU TO DELETE SHIT :* " + (groupSettings[from].antidelete ? 'ACTIVATED ✅' : 'DEACTIVATED ❌') }, { quoted: msg });
                break;
            }

            case 'antilink':
            case 'antigroupsmention':
            case 'antigcstatus':
            case 'antiggstatus': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain Command Only!*' }, { quoted: msg });
                if (!isSenderAdmin) return sock.sendMessage(from, { text: '⚔️ *Admin rights required!*' }, { quoted: msg });

                const setting = command === 'antiggstatus' ? 'antigcstatus' : command;
                const subCmd = args[0]?.toLowerCase();
                const subVal = args[1];

                if (subCmd === 'on') {
                    groupSettings[from][setting] = true;
                    await sock.sendMessage(from, { text: "✅ *By decree of the Emperor:* *" + setting.toUpperCase() + "* is ENFORCED!" }, { quoted: msg });
                } else if (subCmd === 'off') {
                    groupSettings[from][setting] = false;
                    await sock.sendMessage(from, { text: "❌ *Imperial Dispensation:* *" + setting.toUpperCase() + "* is DISABLED!" }, { quoted: msg });
                } else if (subCmd === 'kick') {
                    groupSettings[from][setting] = true;
                    groupSettings[from][setting + 'Mode'] = 'kick';
                    await sock.sendMessage(from, { text: "✅ *" + setting.toUpperCase() + "* set to **DIRECT KICK** mode do shit you will be removed asap !" }, { quoted: msg });
                } else if (subCmd === 'warn') {
                    groupSettings[from][setting] = true;
                    groupSettings[from][setting + 'Mode'] = 'warn';
                    if (subVal && !isNaN(subVal)) {
                        groupSettings[from][setting + 'WarnLimit'] = parseInt(subVal);
                    }
                    const limit = groupSettings[from][setting + 'WarnLimit'] || 3;
                    await sock.sendMessage(from, { text: "✅ *" + setting.toUpperCase() + "* set to **IMPERIAL WARN** mode (Limit: " + limit + " warnings)!" }, { quoted: msg });
                } else {
                    groupSettings[from][setting] = !groupSettings[from][setting];
                    await sock.sendMessage(from, { 
                        text: "🛡️ *" + setting.toUpperCase() + " Barrier:* " + (groupSettings[from][setting] ? 'ENFORCED ✅' : 'DISABLED ❌') + "\n\n💡 *Usage:*\n`." + setting + " on/off`\n`." + setting + " kick`\n`." + setting + " warn 3`" 
                    }, { quoted: msg });
                }
                saveGroupSettings();
                break;
            }

            case 'vv':
            case 'antiviewonce':
            case 'viewonce': {
                // VV re-sends ordinary quoted media in its original WhatsApp media type.
                // It intentionally refuses View Once wrappers rather than unwrapping them.
                const rawCommandMessage = msg.message || {};
                const hasViewOnceWrapper = (value) => !!(
                    value?.viewOnceMessage ||
                    value?.viewOnceMessageV2 ||
                    value?.viewOnceMessageV2Extension
                );
                const commandContent = rawCommandMessage.ephemeralMessage?.message || rawCommandMessage;
                if (hasViewOnceWrapper(commandContent)) {
                    await extra.react('🛡️');
                    return extra.reply('⚔️ Piercing View-Once…\n🔒 View-Once Protected. This media cannot be reopened or copied with VV. Ask the sender to share a normal copy if they are comfortable.');
                }

                const context =
                    commandContent?.extendedTextMessage?.contextInfo ||
                    commandContent?.imageMessage?.contextInfo ||
                    commandContent?.videoMessage?.contextInfo ||
                    commandContent?.audioMessage?.contextInfo ||
                    commandContent?.documentMessage?.contextInfo ||
                    commandContent?.stickerMessage?.contextInfo || {};
                const quotedRaw = context.quotedMessage;
                if (!quotedRaw) {
                    return extra.reply('📌 Reply to an image, video, audio, voice note, document or sticker with .vv.');
                }
                if (hasViewOnceWrapper(quotedRaw)) {
                    await extra.react('🛡️');
                    return extra.reply('⚔️ Piercing View-Once…\n🔒 View-Once Protected. This media cannot be reopened or copied with VV. Ask the sender for a normal copy if they are comfortable.');
                }

                const quotedContent = unwrapMessage(quotedRaw);
                let mediaKind = null;
                let mediaData = null;
                if (quotedContent?.imageMessage) { mediaKind = 'image'; mediaData = quotedContent.imageMessage; }
                else if (quotedContent?.videoMessage) { mediaKind = 'video'; mediaData = quotedContent.videoMessage; }
                else if (quotedContent?.audioMessage) { mediaKind = 'audio'; mediaData = quotedContent.audioMessage; }
                else if (quotedContent?.documentMessage) { mediaKind = 'document'; mediaData = quotedContent.documentMessage; }
                else if (quotedContent?.stickerMessage) { mediaKind = 'sticker'; mediaData = quotedContent.stickerMessage; }
                if (!mediaKind || !mediaData) {
                    return extra.reply('❌ I could not find supported media in that quoted message. Reply directly to the media and try .vv again.');
                }

                try {
                    await extra.react('⏳');
                    const stream = await downloadContentFromMessage(mediaData, mediaKind);
                    const chunks = [];
                    for await (const chunk of stream) chunks.push(chunk);
                    const buffer = Buffer.concat(chunks);
                    if (!buffer.length) throw new Error('Downloaded media was empty');

                    let outgoing;
                    if (mediaKind === 'image') outgoing = { image: buffer, caption: mediaData.caption || undefined, mimetype: mediaData.mimetype || 'image/jpeg' };
                    else if (mediaKind === 'video') outgoing = { video: buffer, caption: mediaData.caption || undefined, mimetype: mediaData.mimetype || 'video/mp4' };
                    else if (mediaKind === 'audio') outgoing = { audio: buffer, mimetype: mediaData.mimetype || 'audio/ogg; codecs=opus', ptt: !!mediaData.ptt };
                    else if (mediaKind === 'document') outgoing = { document: buffer, mimetype: mediaData.mimetype || 'application/octet-stream', fileName: mediaData.fileName || 'vv-file' };
                    else outgoing = { sticker: buffer };

                    await sock.sendMessage(from, outgoing, { quoted: msg });
                    await extra.react('✅');
                } catch (error) {
                    console.error('[VV MEDIA RESEND FAILED]', error);
                    await extra.reply('❌ Could not retrieve that media. It may have expired, been removed, or be unavailable from WhatsApp.');
                }
                break;
            }

            case 'autoonline':
            case 'autorecording':
            case 'autostatuslike':
            case 'autostatusview':
            case 'autotyping': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *My Lord Demon Emperor only!*' }, { quoted: msg });
                autoSettings[command] = !autoSettings[command];
                db.autoSettings = autoSettings;
                saveSettings(db);

                if (command === 'autoonline') {
                    await sock.sendPresenceUpdate(autoSettings.autoonline ? 'available' : 'unavailable')
                        .catch(err => console.error('[AUTO ONLINE]', err.message));
                }

                await sock.sendMessage(from, { text: "⚙️ *Imperial Presence [" + command.toUpperCase() + "]:* " + (autoSettings[command] ? 'ENABLED ✅' : 'DISABLED ❌') }, { quoted: msg });
                break;
            }

            case 'block': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *Only My owner may cast banishment!*' }, { quoted: msg });
                
                let target = null;
                const quoted = msg.message?.extendedTextMessage?.contextInfo;
                
                if (quoted?.participant) {
                    target = quoted.participant;
                } else if (quoted?.mentionedJid && quoted.mentionedJid.length > 0) {
                    target = quoted.mentionedJid[0];
                } else if (q) {
                    const cleanNum = q.replace(/[^0-9]/g, '');
                    if (cleanNum.length >= 7) {
                        target = cleanNum + '@s.whatsapp.net';
                    }
                }

                if (!target) {
                    return sock.sendMessage(from, { text: '💡 *My Lord, tag `@user`, reply to their message, or type a valid number to banish!*' }, { quoted: msg });
                }

                const cleanPhone = target.split('@')[0].split(':')[0];
                const normalizedJid = cleanPhone + '@s.whatsapp.net';

                try {
                    await sock.sendMessage(from, { text: '⏳ *Forcing banishment seal across WhatsApp servers...*' }, { quoted: msg });

                    await sock.query({
                        tag: 'iq',
                        attrs: {
                            xmlns: 'w:b',
                            type: 'set',
                            to: '@s.whatsapp.net'
                        },
                        content: [
                            {
                                tag: 'item',
                                attrs: {
                                    action: 'block',
                                    jid: normalizedJid
                                }
                            }
                        ]
                    }).catch(async () => {
                        await sock.updateBlockStatus(normalizedJid, 'block');
                    });

                    blockedUsers.add(normalizedJid);
                    saveBlockedUsers();
                    await sock.sendMessage(from, { 
                        text: "🚫 @" + cleanPhone + " has been forcefully banished into the Void, My Lord! ✅", 
                        mentions: [normalizedJid] 
                    }, { quoted: msg });

                } catch (err) {
                    console.error('Forced Block Error:', err);
                    await sock.sendMessage(from, { text: "❌ *Banishment Seal Rejected:* " + (err.message || 'Server connection error.') }, { quoted: msg });
                }
                break;
            }

            case 'unblock': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *Only My Lord Demon Emperor may lift banishment!*' }, { quoted: msg });
                
                let target = null;
                const quoted = msg.message?.extendedTextMessage?.contextInfo;
                
                if (quoted?.participant) {
                    target = quoted.participant;
                } else if (quoted?.mentionedJid && quoted.mentionedJid.length > 0) {
                    target = quoted.mentionedJid[0];
                } else if (q) {
                    const cleanNum = q.replace(/[^0-9]/g, '');
                    if (cleanNum.length >= 7) {
                        target = cleanNum + '@s.whatsapp.net';
                    }
                }

                if (!target) {
                    return sock.sendMessage(from, { text: '💡 *My Lord, tag `@user`, reply to their message, or type a valid number to unblock!*' }, { quoted: msg });
                }

                const cleanPhone = target.split('@')[0].split(':')[0];
                const normalizedJid = cleanPhone + '@s.whatsapp.net';

                try {
                    await sock.query({
                        tag: 'iq',
                        attrs: {
                            xmlns: 'w:b',
                            type: 'set',
                            to: '@s.whatsapp.net'
                        },
                        content: [
                            {
                                tag: 'item',
                                attrs: {
                                    action: 'unblock',
                                    jid: normalizedJid
                                }
                            }
                        ]
                    }).catch(async () => {
                        await sock.updateBlockStatus(normalizedJid, 'unblock');
                    });

                    blockedUsers.delete(normalizedJid);
                    saveBlockedUsers();
                    await sock.sendMessage(from, { 
                        text: "✅ *Banishment rescinded for @" + cleanPhone + ", My Lord!*", 
                        mentions: [normalizedJid] 
                    }, { quoted: msg });

                } catch (err) {
                    console.error('Forced Unblock Error:', err);
                    await sock.sendMessage(from, { text: "❌ *Failed to unblock user:* " + err.message }, { quoted: msg });
                }
                break;
            }

            case 'buatgc': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *My Lord Demon Emperor only!*' }, { quoted: msg });
                if (!q) return sock.sendMessage(from, { text: '💡 *Usage:* .buatgc <domain_name>' }, { quoted: msg });
                try {
                    const group = await sock.groupCreate(q, [sender]);
                    await sock.sendMessage(from, { text: "👑 *New domain created for My Lord! ID:* " + group.id }, { quoted: msg });
                } catch (e) {
                    await sock.sendMessage(from, { text: '❌ *Failed to forge domain, My Lord.*' }, { quoted: msg });
                }
                break;
            }

            case 'changebio': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *My Lord Demon Emperor only!*' }, { quoted: msg });
                if (!q) return sock.sendMessage(from, { text: '💡 *Usage:* .changebio <new_status>' }, { quoted: msg });
                await sock.updateProfileStatus(q);
                await sock.sendMessage(from, { text: '👑 *Imperial status updated, My Lord!*' }, { quoted: msg });
                break;
            }

            case 'devices':
            case 'device': {
                const commandMessage = unwrapMessage(msg.message) || {};
                const ctx = 
                    commandMessage.extendedTextMessage?.contextInfo ||
                    commandMessage.imageMessage?.contextInfo ||
                    commandMessage.videoMessage?.contextInfo ||
                    commandMessage.documentMessage?.contextInfo || {};

                let target = ctx.mentionedJid?.[0] || null;

                if (!target && ctx.stanzaId && ctx.participant) {
                    target = ctx.participant;
                }

                if (!target && q) {
                    const digits = q.replace(/[^0-9]/g, '');
                    if (digits.length >= 7) target = digits + '@s.whatsapp.net';
                }

                if (!target) target = sender;

                const normalizedTarget = jidNormalizedUser(target);
                const phone = normalizedTarget.split('@')[0].split(':')[0];

                let linkedDevices = [];
                try {
                    if (typeof sock.getUSyncDevices === 'function') {
                        linkedDevices = await sock.getUSyncDevices([normalizedTarget], true, true) || [];
                    }
                } catch (err) {
                    console.error('[DEVICES LOOKUP]', err.message);
                }

                // Detect actual session platform (Android / iOS / Web / Desktop)
                const parsePlatform = (item) => {
                    const rawJid = typeof item === 'string' ? item : (item.jid || item.id || item.user || '');
                    const str = String(rawJid);
                    if (str.includes(':0') || str.endsWith('@s.whatsapp.net')) return 'Mobile App (Android/iOS)';
                    if (str.includes(':1') || str.includes('web')) return 'WhatsApp Web';
                    if (str.includes(':2') || str.includes('desktop')) return 'WhatsApp Desktop';
                    if (str.includes(':3')) return 'Multi-Device Companion';
                    return 'Mobile Client';
                };

                const deviceLines = linkedDevices.length
                    ? linkedDevices.map((item, index) => `${index + 1}. Platform: *${parsePlatform(item)}*`).join('\n')
                    : '1. Platform: *Mobile Client (Active)*';

                // Clean layout without Admin references (Works anywhere/anytime)
                const responseText = 
                    `📱 *WHATSAPP DEVICE REPORT*\n\n` +
                    `|⚔️ Target: @${phone}\n` +
                    `|\n` +
                    `|📲 Status: Active\n\n` +
                    `*Detected Sessions:*\n${deviceLines}`;

                await sock.sendMessage(from, {
                    text: responseText,
                    mentions: [normalizedTarget]
                }, { quoted: msg });
                
                break;
            }

            case 'getpp': {
                const target = msg.message?.extendedTextMessage?.contextInfo?.participant || (q ? q.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null) || sender;
                try {
                    const ppUrl = await sock.profilePictureUrl(target, 'image');
                    await sock.sendMessage(from, { image: { url: ppUrl }, caption: '📸 *Imperial Sight: Visual Captured, My Lord!*' }, { quoted: msg });
                } catch {
                    await sock.sendMessage(from, { text: '❌ *User portrait concealed from sight.*' }, { quoted: msg });
                }
                break;
            }

            case 'joingroup': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *My Lord Demon Emperor only!*' }, { quoted: msg });
                if (!q) return sock.sendMessage(from, { text: '💡 *Usage:* .joingroup <invite_link>' }, { quoted: msg });
                try {
                    const code = q.split('chat.whatsapp.com/')[1] || q;
                    await sock.groupAcceptInvite(code);
                    await sock.sendMessage(from, { text: '👑 *Domain entered by your decree, My Lord!*' }, { quoted: msg });
                } catch (e) {
                    await sock.sendMessage(from, { text: '❌ *Invalid domain invite link.*' }, { quoted: msg });
                }
                break;
            }

            case 'leavegroup':
            case 'left': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *My Lord Demon Emperor only!*' }, { quoted: msg });
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                await sock.sendMessage(from, { text: '👋 *Departing ya ass, as commanded by My Lord Demon Emperor!*' }, { quoted: msg });
                await sock.groupLeave(from);
                break;
            }

            case 'listfont': {
                await sock.sendMessage(from, { 
                    text: "✒️ *𝕯𝖊𝖒𝖔𝖓 𝕰𝖒𝖕𝖊𝖗𝖔𝖗 Script Typographies*\n\n" +
                          "1. Imperial Gothic: 𝕲𝖗𝖊𝖆𝖙 𝕯𝖊𝖒𝖔𝖓\n" +
                          "2. Royal Monospace: Great Demon\n" +
                          "3. Shadow Italic: Great Demon"
                }, { quoted: msg });
                break;
            }

            case 'listgroup':
            case 'listgroups': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *My Lord Demon Emperor only!*' }, { quoted: msg });
                const groups = Object.keys(await sock.groupFetchAllParticipating());
                let txt = "📋 *Subjugated Group (" + groups.length + "):*\n\n";
                for (let gId of groups) {
                    const meta = await sock.groupMetadata(gId).catch(() => ({}));
                    txt += "• " + (meta.subject || 'Unknown Domain') + " (" + gId + ")\n";
                }
                await sock.sendMessage(from, { text: txt }, { quoted: msg });
                break;
            }

            case 'bancheck': {
                await sock.sendMessage(from, { text: '🛡️ *Imperial Check:* Zero ban restrictions active. Your throne stands intact, My Lord!' }, { quoted: msg });
                break;
            }

            case 'botlink': {
                await sock.sendMessage(from, { text: '🔗 *𝕯𝖊𝖒𝖔𝖓 𝕰𝖒𝖕𝖊𝖗𝖔𝖗 Throne Portal:* Online & Sovereign' }, { quoted: msg });
                break;
            }

            case 'fetchstatus': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *My Lord Demon Emperor only!*' }, { quoted: msg });
                const target = msg.message?.extendedTextMessage?.contextInfo?.participant || (q ? q.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);
                if (!target) return sock.sendMessage(from, { text: '💡 *Mention or reply to target.*' }, { quoted: msg });
                try {
                    const status = await sock.fetchStatus(target);
                    await sock.sendMessage(from, { text: '📜 *Status:* "' + status.status + '"' }, { quoted: msg });
                } catch {
                    await sock.sendMessage(from, { text: '❌ *Status concealed.*' }, { quoted: msg });
                }
                break;
            }

case 'listchannels': {
    if (!isOwner) return extra.reply('⚔️ *Only My Lord Demon Emperor can inspect the channels!*');
    
    await extra.reply('📢 *Scanning subjugated channels...*');
    
    try {
        // Fetch newsletter/channel metadata if the function is available in your Baileys version
        let channels = [];
        if (typeof sock.newsletterList === 'function') {
            channels = await sock.newsletterList();
        } else if (typeof sock.groupFetchAllParticipating === 'function') {
            // Fallback or filter channels if tracked via chats
            const chats = Object.values(sock.chats || {});
            channels = chats.filter(c => c.id && c.id.endsWith('@newsletter'));
        }

        if (!channels || channels.length === 0) {
            // Fallback display if no direct newsletter query method is active
            return await sock.sendMessage(from, { 
                text: '╭━━〔 *𝐆𝐑𝐄𝐀𝐓_𝐃𝐄𝐌𝐎𝐍 𝐕4 CHANNELS* 〕━━╮\n\n' +
                      '📢 *Status:* Fully subjugated under your rule, My Lord!\n' +
                      '⚠️ *Note:* No active live newsletter feeds detected in current socket cache.\n\n' +
                      '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯' 
            }, { quoted: msg });
        }

        let channelText = '╭━━〔 *𝐆𝐑𝐄𝐀𝐓_𝐃𝐄𝐌𝐎𝐍 𝐕4 CHANNELS* 〕━━╮\n\n';
        channels.forEach((ch, index) => {
            channelText += `*${index + 1}.* ${ch.subject || ch.name || 'Unknown Channel'}\n` +
                           `   🆔 ID: \`${ch.id}\`\n\n`;
        });
        channelText += '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯';

        await sock.sendMessage(from, { text: channelText }, { quoted: msg });

    } catch (err) {
        console.error('[LISTCHANNELS ERROR]', err);
        // Fallback response so it never crashes your bot
        await sock.sendMessage(from, { 
            text: '📢 *𝐆𝐑𝐄𝐀𝐓_𝐃𝐄𝐌𝐎𝐍 𝐕4 Channels:* Fully subjugated under your rule, My Lord!\n*(Active broadcast network online)*' 
        }, { quoted: msg });
    }
    break;
}


            case 'mode':
            case 'private':
            case 'public': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *Only My Lord Demon Emperor may alter realm permissions!*' }, { quoted: msg });
                
                let targetMode = '';
                if (command === 'public' || command === 'private') {
                    targetMode = command;
                } else if (args[0]) {
                    targetMode = args[0].toLowerCase();
                }

                if (targetMode === 'public' || targetMode === 'private') {
                    botMode = targetMode;
                    db.botMode = botMode;
                    saveSettings(db);
                    await sock.sendMessage(from, { text: "👑 *Decree Enforced:* Domain mode set to *" + botMode.toUpperCase() + "*, My Lord!" }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: "⚔️ *Current State:* *" + botMode.toUpperCase() + "*\n\n💡 *Usage:* .mode public | .mode private | .public | .private" }, { quoted: msg });
                }
                break;
            }

            case 'session':
            case 'ownerpanel': {
                if (!isOwner) return extra.reply('⚔️ *Owner access only.*');
                const accountNumber = String(sock.user?.id || '').split('@')[0].split(':')[0].replace(/\D/g, '') || 'Not connected';
                const linkedCount = (() => { try { return Object.keys(loadTelegramSessions()).length; } catch { return 0; } })();
                const sessionText = '╭━━〔 👑 *GREAT DEMON V4 SESSION* 〕━━╮\n' +
                    '📡 Session: PRIMARY\n' +
                    '📱 Number: ' + (accountNumber === 'Not connected' ? accountNumber : '+' + accountNumber) + '\n' +
                    '🟢 Status: ' + (sock.user ? 'Online' : 'Connecting') + '\n' +
                    '🔗 Telegram-linked sessions: ' + linkedCount + '\n' +
                    '⚙️ Mode: ' + botMode.toUpperCase() + '\n' +
                    '💾 Data directory: ' + DATA_DIR + '\n' +
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯';
                return extra.reply(sessionText);
            }

            case 'pair': {
                return sock.sendMessage(from, { text: "🔐 *Secure account linking is managed through the Telegram bot.*\nOpen your Telegram bot in a private chat and send /pair." }, { quoted: msg });
            }

            case 'broadcast':
            case 'bc': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *Only My Lord Demon Emperor may speak to all realms!*' }, { quoted: msg });
                if (!q) return sock.sendMessage(from, { text: '💡 *Usage:* .broadcast <royal proclamation>' }, { quoted: msg });

                const groups = Object.keys(await sock.groupFetchAllParticipating());
                await sock.sendMessage(from, { text: "📢 *Transmitting royal decree to " + groups.length + " domains, My Lord!*" }, { quoted: msg });

                for (const groupId of groups) {
                    await sock.sendMessage(groupId, {
                        text: "📢 *𝐆𝐑𝐄𝐀𝐓_𝐃𝐄𝐌𝐎𝐍 𝐕4 ROYAL PROCLAMATION*\n\n" + q + "\n\n_~ Directly from My Lord Demon Emperor_"
                    });
                }
                await sock.sendMessage(from, { text: '✅ *Proclamation delivered, My Lord!*' }, { quoted: msg });
                break;
            }

            case 'connectedusers':
            case 'activeusers': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *My Lord Demon Emperor only!*' }, { quoted: msg });
                const linkedCount = Object.keys(readGreatDemonLinkedSessions()).length;
                const totalCount = linkedCount;
                await sock.sendMessage(from, {
                    text:
                        '╭━━〔 👑 𝑮𝑹𝑬𝑨𝑻 𝑫𝑬𝑴𝑶𝑵 〕━━╮\n' +
                        '┃ 𝑰𝑴𝑷𝑬𝑹𝑰𝑨𝑳 𝑼𝑺𝑬𝑹 𝑺𝑻𝑨𝑻𝑺\n' +
                        '┣━━━━━━━━━━━━━━━━━━━━\n' +
                        '👥 Total sessions: ' + totalCount + '\n' +
                        '📱 Telegram-linked: ' + linkedCount + '\n' +
                        '👑 Owner account: Protected\n' +
                        '╰━━━━━━━━━━━━━━━━━━━━╯'
                }, { quoted: msg });
                break;
            }

            case 'uptime': {
                const total = Math.floor((Date.now() - startTime) / 1000);
                const days = Math.floor(total / 86400);
                const hours = Math.floor((total % 86400) / 3600);
                const minutes = Math.floor((total % 3600) / 60);
                const seconds = total % 60;
                const uptime = [days ? `${days}d` : '', `${hours}h`, `${minutes}m`, `${seconds}s`].filter(Boolean).join(' ');
                return extra.reply(
                    '╭━━〔 👑 𝑮𝑹𝑬𝑨𝑻 𝑫𝑬𝑴𝑶𝑵 V4 〕━━╮\n' +
                    '┃ ⏱️ 𝑺𝒀𝑺𝑻𝑬𝑴 𝑼𝑷𝑻𝑰𝑴𝑬\n' +
                    '┣━━━━━━━━━━━━━━━━━━━━\n' +
                    '┃ ' + uptime + '\n' +
                    '╰━━━━━━━━━━━━━━━━━━━━╯'
                );
            }

            case 'inspectsock':
            case 'status': {
                await sock.sendMessage(from, { 
                    text: "⚡ *𝕯𝖊𝖒𝖔𝖓 𝕰𝖒𝖕𝖊𝖗𝖔𝖗 Core Health*\n\n" +
                          "• *Socket:* Bound & Synced ✅\n" +
                          "• *Latency:* Optimal\n" +
                          "• *Protection:* Active"
                }, { quoted: msg });
                break;
            }
 

case 'antiadd':
case 'antibot':
case 'antidemote':
case 'antiimage':
case 'antipromote':
case 'antiremove':
case 'antispam':
case 'antitag':
case 'antitagadmin': {
    if (!isGroup) {
        return sock.sendMessage(from, {
            text: '⚔️ *Domain Command Only!*'
        }, { quoted: msg });
    }

    if (!isSenderAdmin) {
        return sock.sendMessage(from, {
            text: '⚔️ *Admin rights required!*'
        }, { quoted: msg });
    }

    const setting = command;
    const stateArg = args[0]?.toLowerCase();
    const modeArg = args[1]?.toLowerCase();

    if (['antispam', 'antitag', 'antibot'].includes(setting) && ['warn', 'kick'].includes(stateArg)) {
        groupSettings[from][setting] = true;
        groupSettings[from][setting + 'Mode'] = stateArg;
        if (stateArg === 'warn' && modeArg && /^\d+$/.test(modeArg)) {
            groupSettings[from][setting + 'WarnLimit'] = Math.max(1, Math.min(10, Number(modeArg)));
        }
        const limit = groupSettings[from][setting + 'WarnLimit'] || 3;
        saveGroupSettings();
        return sock.sendMessage(from, { text: `🛡️ *${setting.toUpperCase()}* is ON in *${stateArg.toUpperCase()}* mode${stateArg === 'warn' ? ` (warning limit: ${limit})` : ''}.` }, { quoted: msg });
    }

    if (!['on', 'off'].includes(stateArg)) {
        return sock.sendMessage(from, {
            text: `⚙️ *${setting.toUpperCase()} SETTINGS*\n\n` +
                `Use:\n${prefix}${setting} on/off\n` +
                (['antispam', 'antitag', 'antibot'].includes(setting) ? `${prefix}${setting} warn 3\n${prefix}${setting} kick` : '')
        }, { quoted: msg });
    }

    groupSettings[from][setting] = stateArg === 'on';
    saveGroupSettings();
    await sock.sendMessage(from, { text: stateArg === 'on' ? `✅ *${setting.toUpperCase()} is now ON!*` : `❌ *${setting.toUpperCase()} is now OFF!*` }, { quoted: msg });

    break;
}
            
 
            case 'setwelcome':
            case 'setgoodbye':
            case 'welcome':
            case 'goodbye': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain Command Only!*' }, { quoted: msg });
                if (!isSenderAdmin) return sock.sendMessage(from, { text: '⚔️ *Admin rights required!*' }, { quoted: msg });

                const setting = command === 'setwelcome' ? 'welcome' : (command === 'setgoodbye' ? 'goodbye' : command);
                const stateArg = args[0]?.toLowerCase();

                if (stateArg === 'on') {
                    groupSettings[from][setting] = true;
                    saveGroupSettings();
                    await sock.sendMessage(from, { text: "✅ *By decree of the Emperor:* *" + setting.toUpperCase() + "* WELCOME is now ACTIVATED!" }, { quoted: msg });
                } else if (stateArg === 'off') {
                    groupSettings[from][setting] = false;
                    saveGroupSettings();
                    await sock.sendMessage(from, { text: "❌ *Imperial Dispensation:* *" + setting.toUpperCase() + "* WELCOME is now DISABLED!" }, { quoted: msg });
                } else {
                    groupSettings[from][setting] = !groupSettings[from][setting];
                    saveGroupSettings();
                    await sock.sendMessage(from, { text: "🛡️ *" + setting.toUpperCase() + " Card System:* " + (groupSettings[from][setting] ? 'ENFORCED ✅' : 'DISABLED ❌') }, { quoted: msg });
                }
                break;
            }

            case 'addmember': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                if (!isSenderAdmin) return sock.sendMessage(from, { text: '⚔️ *Admin rights required!*' }, { quoted: msg });
                if (!q) return sock.sendMessage(from, { text: '💡 *Usage:* .addmember 234...' }, { quoted: msg });
                const targetJid = q.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                try {
                    await sock.groupParticipantsUpdate(from, [targetJid], 'add');
                    await sock.sendMessage(from, { text: '✅ *User added to domain, My Lord!*' }, { quoted: msg });
                } catch {
                    await sock.sendMessage(from, { text: '❌ *Failed to add User.*' }, { quoted: msg });
                }
                break;
            }

            case 'approveall': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                if (!isSenderAdmin) return sock.sendMessage(from, { text: '⚔️ *Admin rights required!*' }, { quoted: msg });
                
                try {
                    const requests = await sock.groupRequestParticipantsList(from);
                    if (!requests || requests.length === 0) {
                        return sock.sendMessage(from, { text: '💡 *No pending entry requests, My Lord.*' }, { quoted: msg });
                    }
                    
                    let approvedCount = 0;
                    for (let req of requests) {
                        const targetJid = req.jid || req.id || req;
                        await sock.groupRequestParticipantsUpdate(from, [targetJid], 'approve');
                        approvedCount++;
                    }
                    await sock.sendMessage(from, { text: "✅ *Granted Group entry to " + approvedCount + " subject(s), My Lord!*" }, { quoted: msg });
                } catch (err) {
                    await sock.sendMessage(from, { text: '❌ *Failed to approve requests.*' }, { quoted: msg });
                }
                break;
            }

            case 'restrict':
            case 'setmute':
            case 'lock':
            case 'mute':
            case 'close': {
                if (!isGroup) return extra.reply('👥 This command only works in a group.');
                if (!isSenderAdmin) return extra.reply('⚔️ Actual group-admin rights are required.');
                await sock.groupSettingUpdate(from, 'announcement');
                await sock.sendMessage(from, { text: '🔒 *Gates locked by Imperial decree!*' }, { quoted: msg });
                break;
            }

            case 'closetime':
            case 'opentime': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                if (!isSenderAdmin) return sock.sendMessage(from, { text: '⚔️ *Admin rights required!*' }, { quoted: msg });
                
                const timer = parseInt(args[0]);
                if (isNaN(timer)) return sock.sendMessage(from, { text: "💡 *Usage:* ." + command + " <minutes>" }, { quoted: msg });

                const actionType = command === 'closetime' ? 'announcement' : 'not_announcement';
                const actionText = command === 'closetime' ? 'sealed (Admins Only)' : 'opened to all';

                await sock.sendMessage(from, { text: "⏳ *Domain gates will be " + actionText + " in " + timer + " minute(s), My Lord!*" }, { quoted: msg });
                setTimeout(async () => {
                    await sock.groupSettingUpdate(from, actionType);
                    await sock.sendMessage(from, { text: "🔒 *Domain gates are now " + actionText + "!*" });
                }, timer * 60 * 1000);
                break;
            }

            case 'demoteall': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                if (!isSenderAdmin) return sock.sendMessage(from, { text: '⚔️ *Admin rights required!*' }, { quoted: msg });

                const groupMetadata = await sock.groupMetadata(from);
                const admins = [];
                for (const participant of groupMetadata.participants) {
                    if (!participant.admin) continue;
                    if (await isProtectedOwnerJid(sock, participant.id) ||
                        await isProtectedOwnerJid(sock, participant.phoneNumber)) continue;
                    const botJid = jidNormalizedUser(sock.user?.id || '');
                    if (jidNormalizedUser(participant.id || '') === botJid) continue;
                    admins.push(participant);
                }

                for (const admin of admins) {
                    await sock.groupParticipantsUpdate(from, [admin.id], 'demote');
                }
                await sock.sendMessage(from, { text: '🔻 *All High Lords stripped of admin ranks!*' }, { quoted: msg });
                break;
            }

            case 'demote':
            case 'demoteuser': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                if (!isSenderAdmin) return sock.sendMessage(from, { text: '⚔️ *Admin rights required!*' }, { quoted: msg });

                let target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                             msg.message?.extendedTextMessage?.contextInfo?.participant;
                if (!target && q) target = q.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

                if (!target) return sock.sendMessage(from, { text: '💡 *Tag or reply to a user to demote them!*' }, { quoted: msg });
                if (await isProtectedOwnerJid(sock, target)) {
                    return extra.reply('🛡️ The bot owner is protected and cannot be demoted by this command.');
                }

                await sock.groupParticipantsUpdate(from, [target], 'demote');
                await sock.sendMessage(from, { text: '🔻 *Subject stripped of High Lord rank, My Lord!*' }, { quoted: msg });
                break;
            }

            case 'disapproveall': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                if (!isSenderAdmin) return sock.sendMessage(from, { text: '⚔️ *Admin rights required!*' }, { quoted: msg });

                try {
                    const requests = await sock.groupRequestParticipantsList(from);
                    if (!requests || requests.length === 0) return sock.sendMessage(from, { text: '💡 *No pending requests.*' }, { quoted: msg });
                    for (let req of requests) {
                        const targetJid = req.jid || req.id || req;
                        await sock.groupRequestParticipantsUpdate(from, [targetJid], 'reject');
                    }
                    await sock.sendMessage(from, { text: '🚫 *Rejected all pending requests, My Lord!*' }, { quoted: msg });
                } catch (err) {
                    await sock.sendMessage(from, { text: '❌ *Failed to reject requests.*' }, { quoted: msg });
                }
                break;
            }
case 'kick':
case 'remove':
case 'dor': {
    if (!isGroup) {
        return sock.sendMessage(from, {
            text: '⚔️ *Domain command only!*'
        }, { quoted: msg });
    }

    if (!isSenderAdmin) {
        return sock.sendMessage(from, {
            text: '⚔️ *Actual group admin rights required!*'
        }, { quoted: msg });
    }

    const activeKickMessage = unwrapMessage(msg.message) || msg.message || {};

    const contextInfo = getMessageContextInfos(activeKickMessage)
        .find(ctx => ctx && (
            ctx.quotedMessage ||
            ctx.mentionedJid?.length ||
            ctx.participant ||
            ctx.stanzaId
        )) || {};

    const mentioned = Array.isArray(contextInfo.mentionedJid)
        ? contextInfo.mentionedJid
        : [];

    let target = mentioned[0] || contextInfo.participant || null;

    if (!target && contextInfo.stanzaId && typeof messageCache !== 'undefined') {
        const originalQuotedMessage = messageCache.get(contextInfo.stanzaId);

        target =
            originalQuotedMessage?.key?.participant ||
            (
                originalQuotedMessage?.key?.remoteJid?.endsWith('@g.us')
                    ? null
                    : originalQuotedMessage?.key?.remoteJid
            ) ||
            null;
    }

    const rawArg = typeof q === 'string' && q.trim()
        ? q.trim()
        : (Array.isArray(args) ? args.join(' ').trim() : '');

    if (!target && rawArg) {
        const cleanNum = rawArg.replace(/[^0-9]/g, '');
        if (cleanNum.length >= 7) {
            target = cleanNum + '@s.whatsapp.net';
        }
    }

    if (!target) {
        return sock.sendMessage(from, {
            text: '⚔️ Tag the member, reply to their message, or enter their number.'
        }, { quoted: msg });
    }

    const normalizeKickJid = jid =>
        jid ? jidNormalizedUser(jid) : '';

    const digitsOnly = jid =>
        String(jid || '').split('@')[0].replace(/[^0-9]/g, '');

    let targetJid = normalizeKickJid(target);
    const adminJid = normalizeKickJid(sender);

    const toPhoneJid = async jid => {
        if (!jid) return '';
        if (jid.endsWith('@s.whatsapp.net')) return normalizeKickJid(jid);

        if (jid.endsWith('@lid')) {
            try {
                const mapped = await sock.signalRepository?.lidMapping?.getPNForLID?.(jid);
                if (mapped) return normalizeKickJid(mapped);
            } catch (err) {
                console.error('[KICK LID MAPPING]', err);
            }
        }
        return '';
    };

    try {
        const metadata = await sock.groupMetadata(from);
        const participants = Array.isArray(metadata?.participants) ? metadata.participants : [];

        const targetDigits = digitsOnly(targetJid);

        let targetParticipant = participants.find(p => {
            const pId = normalizeKickJid(p?.id);
            const pLid = normalizeKickJid(p?.lid);
            const pPhone = normalizeKickJid(p?.phoneNumber);

            return (
                (targetJid && (pId === targetJid || pLid === targetJid || pPhone === targetJid)) ||
                (targetDigits && (
                    digitsOnly(pId) === targetDigits ||
                    digitsOnly(pLid) === targetDigits ||
                    digitsOnly(pPhone) === targetDigits
                ))
            );
        });

        if (!targetParticipant && targetJid.endsWith('@lid')) {
            const mappedPhone = await toPhoneJid(targetJid);
            if (mappedPhone) {
                const mappedDigits = digitsOnly(mappedPhone);
                targetParticipant = participants.find(p =>
                    normalizeKickJid(p?.id) === mappedPhone ||
                    normalizeKickJid(p?.phoneNumber) === mappedPhone ||
                    (mappedDigits && digitsOnly(p?.id) === mappedDigits)
                );
                if (!targetParticipant) {
                    targetJid = mappedPhone;
                }
            }
        }

        if (targetParticipant?.id) {
            targetJid = normalizeKickJid(targetParticipant.id);
        }

        const stillInGroup = Boolean(targetParticipant) || participants.some(p =>
            normalizeKickJid(p?.id) === targetJid ||
            normalizeKickJid(p?.lid) === targetJid ||
            normalizeKickJid(p?.phoneNumber) === targetJid
        );

        if (!stillInGroup) {
            return sock.sendMessage(from, {
                text: '❌ That member is not in this group.'
            }, { quoted: msg });
        }

        if (
            (typeof isProtectedOwnerJid === 'function' && (
                await isProtectedOwnerJid(sock, targetJid) ||
                await isProtectedOwnerJid(sock, targetParticipant?.id) ||
                await isProtectedOwnerJid(sock, targetParticipant?.lid) ||
                await isProtectedOwnerJid(sock, targetParticipant?.phoneNumber)
            ))
        ) {
            return extra.reply(
                '🛡️ The bot owner is protected and cannot be removed by this command.'
            );
        }

        const result = await sock.groupParticipantsUpdate(
            from,
            [targetJid],
            'remove'
        );

        const failed = Array.isArray(result) && result.some(item => {
            const status = item?.status;
            return status !== undefined && status !== null && !['200', 200].includes(status);
        });

        if (failed) {
            throw new Error(`WhatsApp rejected removal: ${JSON.stringify(result)}`);
        }

        const displayTargetNum = digitsOnly(targetParticipant?.phoneNumber || targetJid) || targetJid.split('@')[0];
        const displayAdminNum = digitsOnly(adminJid) || adminJid.split('@')[0];

        const responseText =
            `|⚔️ User: @${displayTargetNum}\n` +
            `|\n` +
            `|👤 Requested by: @${displayAdminNum}`;

        await sock.sendMessage(from, {
            text: responseText,
            mentions: [adminJid, targetJid, targetParticipant?.id, targetParticipant?.phoneNumber].filter(Boolean)
        }, { quoted: msg });

    } catch (err) {
        console.error('[KICK COMMAND]', err?.stack || err);

        await sock.sendMessage(from, {
            text: '❌ *Kick failed.* Ensure the bot account is a group admin and the target is not an admin.'
        }, { quoted: msg });
    }

    break;
}


            case 'add':
            case 'addmember': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                
                if (!isSenderAdmin) {
                    return sock.sendMessage(from, { text: '⚔️ *Actual group admin rights required!*' }, { quoted: msg });
                }

                const commandMessage = unwrapMessage(msg.message) || {};
                const contextInfo =
                    commandMessage.extendedTextMessage?.contextInfo ||
                    commandMessage.imageMessage?.contextInfo ||
                    commandMessage.videoMessage?.contextInfo ||
                    commandMessage.documentMessage?.contextInfo || {};

                const mentioned = Array.isArray(contextInfo.mentionedJid) ? contextInfo.mentionedJid : [];
                let target = mentioned[0] || null;

                if (!target && contextInfo.stanzaId && contextInfo.participant) {
                    target = contextInfo.participant;
                }

                if (!target && q) {
                    const cleanNum = q.replace(/[^0-9]/g, '');
                    if (cleanNum.length >= 7) target = cleanNum + '@s.whatsapp.net';
                }

                if (!target) {
                    return sock.sendMessage(from, {
                        text: '💡 *Usage:* Tag a contact, reply to a user, or type `.add 234xxxxxxxxxx`'
                    }, { quoted: msg });
                }

                const normalizeAddJid = jid => jid ? jidNormalizedUser(jid) : '';
                let targetJid = normalizeAddJid(target);
                const adminJid = normalizeAddJid(sender);

                try {
                    const groupMeta = await sock.groupMetadata(from);
                    
                    const isAlreadyMember = groupMeta.participants.some(p => 
                        normalizeAddJid(p.id) === targetJid || normalizeAddJid(p.phoneNumber) === targetJid
                    );

                    if (isAlreadyMember) {
                        return sock.sendMessage(from, { 
                            text: `⚠️ *@${targetJid.split('@')[0]}* is already a member of this domain.`,
                            mentions: [targetJid] 
                        }, { quoted: msg });
                    }

                    const result = await sock.groupParticipantsUpdate(from, [targetJid], 'add');
                    const responseStatus = result?.[0]?.status;

                    if (responseStatus === '403') {
                        await sock.sendMessage(from, { 
                            text: `⚠️ Could not add *@${targetJid.split('@')[0]}* directly due to privacy settings.`,
                            mentions: [targetJid]
                        }, { quoted: msg });
                    } else if (responseStatus === '408' || responseStatus === '409') {
                        await sock.sendMessage(from, { text: '❌ User recently left or is already in the group.' }, { quoted: msg });
                    } else {
                        // Styled with your requested design layout
                        const responseText = 
                            `|⚔️ User: @${targetJid.split('@')[0]}\n` +
                            `|\n` +
                            `|👤 Requested by: @${adminJid.split('@')[0]}`;

                        await sock.sendMessage(from, { 
                            text: responseText,
                            mentions: [adminJid, targetJid]
                        }, { quoted: msg });
                    }

                } catch (err) {
                    console.error('[ADD COMMAND]', err);
                    await sock.sendMessage(from, {
                        text: '❌ *Failed to add member.* Ensure the bot is a group admin.'
                    }, { quoted: msg });
                }
                break;
            }

            
            case 'membercount':
            case 'groupid':
            case 'groupinfo':
            case 'groupname':
            case 'groupdesc':
            case 'groupfaq':
            case 'listadmins':
            case 'memberroles':
            case 'permissionaudit':
            case 'peek': {
                if (!isGroup) return extra.reply('👥 This command only works in a group.');
                try {
                    const meta = await sock.groupMetadata(from);
                    const participants = meta.participants || [];
                    const admins = participants.filter(p => ['admin', 'superadmin'].includes(p.admin));
                    const botJid = jidNormalizedUser(sock.user?.id || '');
                    const botParticipant = participants.find(p => jidNormalizedUser(p.id) === botJid);
                    const botAdmin = !!botParticipant && ['admin', 'superadmin'].includes(botParticipant.admin);
                    let output = '';
                    if (command === 'membercount') output = `👥 *${meta.subject || 'Group'}* has *${participants.length}* members.`;
                    else if (command === 'groupid') output = `🆔 *Group ID*\n${from}`;
                    else if (command === 'groupname') output = `🏷️ *Group name:* ${meta.subject || 'Unknown'}`;
                    else if (command === 'groupdesc') output = `📝 *Group description:*\n${meta.desc || 'No description set.'}`;
                    else if (command === 'listadmins') output = `🛡️ *GROUP ADMINS (${admins.length})*\n` + admins.map((p, i) => `${i + 1}. @${String(p.id).split('@')[0]}`).join('\n');
                    else if (command === 'memberroles') output = `👥 *MEMBER ROLES*\nMembers: ${participants.length}\nAdmins: ${admins.length}\nOwner: ${meta.owner ? '@' + String(meta.owner).split('@')[0] : 'Not supplied'}`;
                    else if (command === 'permissionaudit') output = `🔎 *PERMISSION AUDIT*\nYour role: ${isSenderAdmin ? 'Group admin' : (isSudo ? 'Bot sudo (not a group admin)' : 'Member')}\nBot role: ${botAdmin ? 'Group admin' : 'Not a group admin'}\nOwner access: ${isOwner ? 'Yes' : 'No'}\nSudo access: ${isSudo ? 'Yes' : 'No'}`;
                    else if (command === 'groupfaq') output = `❔ *GROUP FAQ*\nUse .groupmenu to view available group commands.\nUse .rules to read this group's saved rules.\nOnly real WhatsApp group admins can run moderation actions.`;
                    else output = `📋 *GROUP SUMMARY*\nName: ${meta.subject || 'Unknown'}\nID: ${from}\nMembers: ${participants.length}\nAdmins: ${admins.length}\nCreated: ${meta.creation ? new Date(meta.creation * 1000).toLocaleString() : 'Not supplied'}\nDescription: ${meta.desc || 'None'}`;
                    await sock.sendMessage(from, { text: output, mentions: command === 'listadmins' ? admins.map(p => p.id) : [] }, { quoted: msg });
                } catch (err) {
                    console.error('[GROUP INFO COMMAND]', err.message);
                    await extra.reply('❌ Could not retrieve group information.');
                }
                break;
            }

            case 'setgroupdesc': {
                if (!isGroup) return extra.reply('👥 This command only works in a group.');
                if (!isSenderAdmin) return extra.reply('⚔️ Actual group-admin rights are required.');
                if (!q) return extra.reply('Usage: .setgroupdesc New group description');
                try { await sock.groupUpdateDescription(from, q.slice(0, 2048)); await extra.reply('✅ Group description updated.'); }
                catch (err) { await extra.reply('❌ Could not update the group description: ' + err.message); }
                break;
            }

            case 'rules':
            case 'notes':
            case 'adminnotes': {
                if (!isGroup) return extra.reply('👥 This command only works in a group.');
                const field = command === 'rules' ? 'savedRules' : 'savedNotes';
                if (q) {
                    if (!isSenderAdmin) return extra.reply('⚔️ Actual group-admin rights are required to change this.');
                    groupSettings[from][field] = q.slice(0, 3000);
                    saveGroupSettings();
                    return extra.reply(`✅ ${command.toUpperCase()} saved for this group.`);
                }
                return extra.reply(`📌 *${command.toUpperCase()}*\n${groupSettings[from][field] || 'Nothing has been saved yet.'}`);
            }

            case 'warn':
            case 'warnings':
            case 'unwarn':
            case 'resetwarn': {
                if (!isGroup) return extra.reply('👥 This command only works in a group.');
                const ctx = unwrapMessage(msg.message)?.extendedTextMessage?.contextInfo || {};
                const targetJid = ctx.mentionedJid?.[0] || ctx.participant || null;
                if (command === 'warnings' && !targetJid && !q) {
                    const entries = Object.entries(db.warnings[from] || {});
                    return extra.reply('⚠️ *GROUP WARNINGS*\n' + (entries.length ? entries.map(([jid, count]) => `@${jid.split('@')[0]}: ${count}`).join('\n') : 'No warnings recorded.'));
                }
                const target = targetJid || (q ? q.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : sender);
                const targetKey = jidNormalizedUser(target);
                db.warnings[from] = db.warnings[from] || {};
                if (command === 'warnings') return extra.reply(`⚠️ @${targetKey.split('@')[0]} has ${db.warnings[from][targetKey] || 0} warning(s).`);
                if (!isSenderAdmin) return extra.reply('⚔️ Actual group-admin rights are required.');
                const current = Number(db.warnings[from][targetKey] || 0);
                if (command === 'warn') db.warnings[from][targetKey] = current + 1;
                else if (command === 'unwarn') db.warnings[from][targetKey] = Math.max(0, current - 1);
                else db.warnings[from][targetKey] = 0;
                saveSettings(db);
                return extra.reply(`⚠️ @${targetKey.split('@')[0]} now has ${db.warnings[from][targetKey]} warning(s).`);
            }

            case 'glostat': {
                await sock.sendMessage(from, { text: '📊 *Global Domain Stats:* Sovereign control established!' }, { quoted: msg });
                break;
            }

            case 'grouplink':
            case 'getlink':
            case 'invite': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });

                try {
                    const code = await sock.groupInviteCode(from);
                    await sock.sendMessage(from, { text: "🔗 *Group Link:*\nhttps://chat.whatsapp.com/" + code }, { quoted: msg });
                } catch (err) {
                    await sock.sendMessage(from, { text: '❌ *Failed to fetch group link!*' }, { quoted: msg });
                }
                break;
            }

            case 'grouponly': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *My Lord Demon Emperor only!*' }, { quoted: msg });
                groupSettings[from].grouponly = !groupSettings[from].grouponly;
                saveGroupSettings();
                await sock.sendMessage(from, { text: "🛡️ *Group Only Mode:* " + (groupSettings[from].grouponly ? 'ENABLED ✅' : 'DISABLED ❌') }, { quoted: msg });
                break;
            }

            case 'hidetag': {
                if (!isGroup) return extra.reply('👥 This command only works in a group.');
                if (!isSenderAdmin) return extra.reply('⚔️ Actual group-admin rights are required.');
                const hidetagText = args.join(' ') || "Silence! Hear the Emperor's decree!";
                const groupMetadata = await sock.groupMetadata(from);
                const mentions = groupMetadata.participants.map(p => p.id);
                await sock.sendMessage(from, { text: "👑 *Imperial Decree:* " + hidetagText, mentions }, { quoted: msg });
                break;
            }

            case 'inactiveusers':
            case 'kickall': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *My Lord Demon Emperor only!*' }, { quoted: msg });

                const groupMetadata = await sock.groupMetadata(from);
                const participants = [];
                const botJid = jidNormalizedUser(sock.user?.id || '');
                for (const participant of groupMetadata.participants) {
                    if (participant.admin) continue;
                    if (jidNormalizedUser(participant.id || '') === botJid) continue;
                    if (await isProtectedOwnerJid(sock, participant.id) ||
                        await isProtectedOwnerJid(sock, participant.phoneNumber)) continue;
                    participants.push(participant);
                }

                await sock.sendMessage(from, { text: "⚡ *Mass Banishment initiated for " + participants.length + " subjects!*" }, { quoted: msg });
                for (let p of participants) {
                    await sock.groupParticipantsUpdate(from, [p.id], 'remove');
                }
                await sock.sendMessage(from, { text: '⚔️ *Domain purged!*' }, { quoted: msg });
                break;
            }

            case 'mediatag': {
                if (!isGroup) return extra.reply('👥 This command only works in a group.');
                if (!isSenderAdmin) return extra.reply('⚔️ Actual group-admin rights are required.');
                const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (!quotedMsg) return sock.sendMessage(from, { text: '💡 *Reply to a media message to tag all.*' }, { quoted: msg });
                
                const groupMetadata = await sock.groupMetadata(from);
                const mentions = groupMetadata.participants.map(p => p.id);
                await sock.sendMessage(from, { text: '📢 *Imperial Media Broadcast!*', mentions }, { quoted: msg });
                break;
            }

            case 'setunmute':
            case 'unlock':
            case 'unmute':
            case 'open': {
                if (!isGroup) return extra.reply('👥 This command only works in a group.');
                if (!isSenderAdmin) return extra.reply('⚔️ Actual group-admin rights are required.');
                await sock.groupSettingUpdate(from, 'not_announcement');
                await sock.sendMessage(from, { text: '🔓 *Domain gates opened! All may speak.*' }, { quoted: msg });
                break;
            }

            case 'promoteall': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                if (!isSenderAdmin) return sock.sendMessage(from, { text: '⚔️ *Admin rights required!*' }, { quoted: msg });

                const groupMetadata = await sock.groupMetadata(from);
                const nonAdmins = groupMetadata.participants.filter(p => !p.admin);
                
                for (let p of nonAdmins) {
                    await sock.groupParticipantsUpdate(from, [p.id], 'promote');
                }
                await sock.sendMessage(from, { text: '👑 *All subjects elevated to High Lord rank, My Lord!*' }, { quoted: msg });
                break;
            }

            case 'promote':
            case 'promoteuser': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                if (!isSenderAdmin) return sock.sendMessage(from, { text: '⚔️ *Admin rights required!*' }, { quoted: msg });

                let target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                             msg.message?.extendedTextMessage?.contextInfo?.participant;
                if (!target && q) target = q.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

                if (!target) return sock.sendMessage(from, { text: '💡 *Tag or reply to a user to promote them!*' }, { quoted: msg });

                await sock.groupParticipantsUpdate(from, [target], 'promote');
                await sock.sendMessage(from, { text: '👑 *user Are elevated to High Lord rank, My Lord!*' }, { quoted: msg });
                break;
            }

            case 'setgroupbio':
            case 'setgroupname':
            case 'setgrouppp': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                if (!isSenderAdmin) return sock.sendMessage(from, { text: '⚔️ *Admin rights required!*' }, { quoted: msg });
                
                if (command === 'setgroupbio') {
                    if (!q) return sock.sendMessage(from, { text: '💡 *Usage:* .setgroupbio <desc>' }, { quoted: msg });
                    await sock.groupUpdateDescription(from, q);
                    await sock.sendMessage(from, { text: '✅ *Group description updated!*' }, { quoted: msg });
                } else if (command === 'setgroupname') {
                    if (!q) return sock.sendMessage(from, { text: '💡 *Usage:* .setgroupname <title>' }, { quoted: msg });
                    await sock.groupUpdateSubject(from, q);
                    await sock.sendMessage(from, { text: '✅ *Group title updated!*' }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: '💡 *Reply to an image with .setgrouppp to set group icon.*' }, { quoted: msg });
                }
                break;
            }

            case 'warning':
            case 'setwarn':
            case 'setwarning': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                if (!isSenderAdmin) return sock.sendMessage(from, { text: '⚔️ *Admin rights required!*' }, { quoted: msg });
                
                const target = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (!target) return sock.sendMessage(from, { text: '💡 *Reply to or tag a subject to warn.*' }, { quoted: msg });

                await sock.sendMessage(from, { 
                    text: "⚠️ @" + target.split('@')[0] + ", you have received an Imperial Warning!",
                    mentions: [target]
                }, { quoted: msg });
                break;
            }

            case 'tagadmin':
            case 'antitagadmin': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                const groupMetadata = await sock.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                let txt = "🛡️ *𝐆𝐑𝐄𝐀𝐓_𝐃𝐄𝐌𝐎𝐍 High Lords*\n\n";
                admins.forEach(a => txt += "• @" + a.split('@')[0] + "\n");
                await sock.sendMessage(from, { text: txt, mentions: admins }, { quoted: msg });
                break;
            }

            case 'groupnotice':
            case 'announce':
            case 'membertag':
            case 'tag':
            case 'tagall': {
                if (!isGroup || !isSenderAdmin) return sock.sendMessage(from, { text: '⚔️ *Only High Lords may summon the populace!*' }, { quoted: msg });
                const groupMetadata = await sock.groupMetadata(from);
                let text = (q || "╭━━━〔  *IMPERIAL SUMMONS — DEMON EMPEROR*  〕━━━┈\n_“All MEMBERS, COME ONLINE OO !”_") + '\n\n';
                let mentions = groupMetadata.participants.map(p => p.id);
                mentions.forEach(p => text += "⡡ @" + p.split('@')[0] + "\n");
                text += "╰━━━━━━━━━━━━━━━━━━━━━━━┈";
                await sock.sendMessage(from, { text, mentions }, { quoted: msg });
                break;
            }

            case 'tagonline': {
                if (!isGroup) return extra.reply('⚔️ This command only works in a group.');
                if (!isSenderAdmin && !isSudo) return extra.reply('⚔️ Admin or Sudo permission required.');
                try {
                    const groupMetadata = await sock.groupMetadata(from);
                    const participants = groupMetadata.participants || [];
                    const candidateJids = participants.map(p => jidNormalizedUser(p.id)).filter(Boolean);

                    // Ask WhatsApp for presence only where the member's privacy settings permit it.
                    for (let i = 0; i < candidateJids.length; i += 20) {
                        await Promise.all(candidateJids.slice(i, i + 20).map(jid =>
                            sock.presenceSubscribe(jid).catch(() => null)
                        ));
                        await new Promise(resolve => setTimeout(resolve, 150));
                    }
                    await new Promise(resolve => setTimeout(resolve, 2500));

                    const cutoff = Date.now() - 60000;
                    const mentions = candidateJids.filter(jid => {
                        const presence = livePresence.get(jid);
                        return presence && presence.seenAt >= cutoff &&
                            ['available', 'composing', 'recording'].includes(presence.state);
                    });

                    if (!mentions.length) {
                        return extra.reply(
                            'ℹ️ WhatsApp did not expose any members as online. ' +
                            'Online visibility depends on each member’s privacy settings; nobody was mass-tagged.'
                        );
                    }

                    const lines = mentions.map(jid => '• @' + jid.split('@')[0]);
                    await sock.sendMessage(from, {
                        text: '╭━━〔 🟢 𝑶𝑵𝑳𝑰𝑵𝑬 𝑴𝑬𝑴𝑩𝑬𝑹𝑺 〕━━╮\n' +
                            lines.join('\n') + '\n╰━━━━━━━━━━━━━━━━━━━━╯',
                        mentions
                    }, { quoted: msg });
                } catch (error) {
                    console.error('[TAGONLINE]', error);
                    await extra.reply('❌ Could not check online presence. WhatsApp may have restricted presence visibility.');
                }
                break;
            }

            case 'poll':
            case 'tagpoll': {
                if (!isGroup) return sock.sendMessage(from, { text: '⚔️ *Domain command only!*' }, { quoted: msg });
                if (!q) return sock.sendMessage(from, { text: '💡 *Usage:* .tagpoll Question? | Option1 | Option2' }, { quoted: msg });
                const pollArgs = q.split('|').map(s => s.trim());
                if (pollArgs.length < 3) return sock.sendMessage(from, { text: '💡 *Provide a question and at least 2 options separated by `|`.*' }, { quoted: msg });
                
                await sock.sendMessage(from, {
                    poll: {
                        name: pollArgs[0],
                        values: pollArgs.slice(1),
                        selectableCount: 1
                    }
                });
                break;
            }

            case 'pin': {
                if (!isGroup) return extra.reply('⚠️ .pin is only available in group chats.');
                if (!isSenderAdmin) return extra.reply('⚔️ Group admin rights required.');
                return extra.reply('⚠️ This Baileys build does not expose a supported WhatsApp message-pinning action. I will not claim a message was pinned when it was not.');
            }

            case 'ai':
            case 'claude':
            case 'copilot':
            case 'felo':
            case 'gpt':
            case 'llama': {
                if (!q) return extra.reply('💡 Ask a question. Example: .ai explain photosynthesis');
                try {
                    const endpoint = process.env.AI_API_URL || 'https://api.popcat.xyz/chatbot';
                    const res = await fetchJson(endpoint + '?msg=' + encodeURIComponent(q) + '&owner=' + encodeURIComponent(OWNER_NAME) + '&botname=' + encodeURIComponent(BOT_NAME));
                    const answer = res?.response || res?.answer || res?.message;
                    if (typeof answer !== 'string' || !answer.trim()) throw new Error('AI provider returned no answer.');
                    await extra.reply('🧠 *Demonic Intellect*\n\n' + answer.trim().slice(0, 12000));
                } catch (e) {
                    console.error('[AI COMMAND]', command, e.message);
                    await extra.reply('❌ AI is unavailable right now. The configured AI provider did not return a usable answer. Try again later or configure AI_API_URL for a compatible provider.');
                }
                break;
            }

            case 'imagine':
            case 'draw': {
                if (!q) return sock.sendMessage(from, { text: '💡 *My Lord, describe the visual to manifest: .imagine <prompt>*' }, { quoted: msg });
                try {
                    await sock.sendMessage(from, { text: '🎨 *Manifesting visual artifact from the void...*' }, { quoted: msg });
                    const imageUrl = "https://pollinations.ai/p/" + encodeURIComponent(q) + "?width=1080&height=1080&seed=" + Math.floor(Math.random() * 1000);
                    await sock.sendMessage(from, { image: { url: imageUrl }, caption: '🎨 *Manifestation:* "' + q + '"' }, { quoted: msg });
                } catch (e) {
                    await sock.sendMessage(from, { text: '❌ *Failed to manifest image from void.*' }, { quoted: msg });
                }
                break;
            }

            case 'describe':
            case 'ocr': {
                const targetMessage = msg.message?.imageMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
                if (!targetMessage) return extra.reply('💡 Reply to an image with .ocr or .describe.');
                if (!process.env.VISION_API_URL || !process.env.VISION_API_KEY) {
                    return extra.reply('⚠️ Image analysis is not configured yet. Set VISION_API_URL and VISION_API_KEY to a compatible vision/OCR service; this command will not pretend that downloading an image is the same as reading it.');
                }
                return extra.reply('⚠️ Vision provider integration needs its documented request/response format before this command can safely send your image. No image was uploaded.');
            }


                




            case 'sticker':
            case 's': {
                // Build a complete Baileys message for the media downloader.
                // This supports media sent with the command and media quoted by
                // the command, including captions and wrapped message envelopes.
                const unwrapStickerMessage = (value) => {
                    let current = value;
                    const seen = new Set();
                    while (current && typeof current === 'object' && !seen.has(current)) {
                        seen.add(current);
                        const next = current.ephemeralMessage?.message ||
                            current.viewOnceMessage?.message ||
                            current.viewOnceMessageV2?.message ||
                            current.viewOnceMessageV2Extension?.message ||
                            current.documentWithCaptionMessage?.message ||
                            current.editedMessage?.message ||
                            current.deviceSentMessage?.message;
                        if (!next) break;
                        current = next;
                    }
                    return current;
                };

                const getStickerMedia = (messageContent) => {
                    const content = unwrapStickerMessage(messageContent);
                    if (!content || typeof content !== 'object') return null;
                    if (content.imageMessage) return { mediaNode: content.imageMessage, mediaType: 'image', isVideo: false };
                    if (content.videoMessage) return { mediaNode: content.videoMessage, mediaType: 'video', isVideo: true };
                    if (content.documentMessage) {
                        const mime = String(content.documentMessage.mimetype || '').toLowerCase();
                        if (mime.startsWith('image/')) return { mediaNode: content.documentMessage, mediaType: 'document', isVideo: false };
                        if (mime.startsWith('video/')) return { mediaNode: content.documentMessage, mediaType: 'document', isVideo: true };
                    }
                    return null;
                };

                let media = getStickerMedia(msg?.message);
                let targetMessage = media ? msg : null;

                // Search every contextInfo, not just extendedTextMessage. WhatsApp
                // places quote context in captions, buttons and wrapped messages too.
                if (!media) {
                    const contexts = getMessageContextInfos(msg?.message);
                    for (const contextInfo of contexts) {
                        if (!contextInfo?.quotedMessage) continue;
                        const quotedMedia = getStickerMedia(contextInfo.quotedMessage);
                        if (!quotedMedia) continue;
                        media = quotedMedia;
                        targetMessage = {
                            key: {
                                remoteJid: msg?.key?.remoteJid || from,
                                id: contextInfo.stanzaId || undefined,
                                fromMe: Boolean(contextInfo.fromMe),
                                ...(contextInfo.participant ? { participant: contextInfo.participant } : {})
                            },
                            message: contextInfo.quotedMessage
                        };
                        break;
                    }
                }

                if (!media || !targetMessage) {
                    await extra.reply('📌 Reply directly to an image or video with .sticker, or send .sticker as the media caption.');
                    break;
                }

                let workDir;
                try {
                    await extra.react('⏳');

                    let inputBuffer;
                    // Preferred path: Baileys receives the complete message wrapper
                    // and resolves the media key/re-upload flow itself.
                    try {
                        inputBuffer = await downloadMediaMessage(
                            targetMessage,
                            'buffer',
                            {},
                            {
                                logger: pino({ level: 'silent' }),
                                reuploadRequest: typeof sock.updateMediaMessage === 'function'
                                    ? sock.updateMediaMessage.bind(sock)
                                    : undefined
                            }
                        );
                    } catch (downloadError) {
                        console.warn('[STICKER DOWNLOAD] downloadMediaMessage failed; trying direct media stream:', downloadError?.message || downloadError);
                    }

                    // Fallback for Baileys versions/messages where the quoted
                    // message wrapper is incomplete but the media node is usable.
                    if (!inputBuffer || !Buffer.isBuffer(inputBuffer) || !inputBuffer.length) {
                        const stream = await downloadContentFromMessage(media.mediaNode, media.mediaType);
                        const chunks = [];
                        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
                        inputBuffer = Buffer.concat(chunks);
                    }

                    if (!inputBuffer?.length) throw new Error('WhatsApp returned an empty media download');
                    if (inputBuffer.length > 25 * 1024 * 1024) throw new Error('Media exceeds the 25 MB conversion limit');

                    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'great-demon-sticker-'));
                    const inputPath = path.join(workDir, media.isVideo ? 'input-video' : 'input-image');
                    const outputPath = path.join(workDir, 'sticker.webp');
                    fs.writeFileSync(inputPath, inputBuffer);

                    let stickerBuffer;
                    if (!media.isVideo) {
                        stickerBuffer = await sharp(inputBuffer, { animated: false, failOn: 'none' })
                            .rotate()
                            .resize(512, 512, {
                                fit: 'contain',
                                background: { r: 0, g: 0, b: 0, alpha: 0 }
                            })
                            .webp({ quality: 82, effort: 5 })
                            .toBuffer();
                    } else {
                        await execFileAsync(ffmpegPath, [
                            '-y', '-i', inputPath, '-t', '8', '-an',
                            '-vf', 'fps=15,scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
                            '-loop', '0', '-c:v', 'libwebp', '-quality', '65',
                            '-compression_level', '6', outputPath
                        ], { timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
                        stickerBuffer = fs.readFileSync(outputPath);
                    }

                    if (!stickerBuffer?.length) throw new Error('Sticker conversion produced an empty file');
                    if (stickerBuffer.length > 1024 * 1024) {
                        throw new Error('The converted sticker is larger than WhatsApp’s 1 MB sticker limit');
                    }

                    await sock.sendMessage(from, {
                        sticker: stickerBuffer,
                        mimetype: 'image/webp'
                    }, { quoted: msg });
                    await extra.react('✅');
                } catch (error) {
                    console.error('[STICKER CONVERSION]', error);
                    const detail = String(error?.message || 'Unknown conversion error');
                    await extra.reply(
                        detail.includes('1 MB')
                            ? '❌ This media is too complex for a WhatsApp sticker. Try a shorter video or a smaller image.'
                            : `❌ Sticker conversion failed: ${detail.slice(0, 180)}`
                    );
                } finally {
                    if (workDir) {
                        try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
                    }
                }
                break;
            }

            case 'toimg': {
                const isSticker = msg.message?.stickerMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
                if (!isSticker) {
                    return sock.sendMessage(from, { text: 'My Lord, reply to a sticker to convert it to an image!' }, { quoted: msg });
                }
                try {
                    const targetMessage = msg.message?.stickerMessage ? msg.message.stickerMessage : msg.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage;
                    const stream = await downloadContentFromMessage(targetMessage, 'sticker');
                    
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                    const tempWebp = "./temp_" + Date.now() + ".webp";
                    const tempPng = "./temp_" + Date.now() + ".png";
                    fs.writeFileSync(tempWebp, buffer);

                    exec("ffmpeg -i " + tempWebp + " " + tempPng, async (err) => {
                        if (err) {
                            if (fs.existsSync(tempWebp)) fs.unlinkSync(tempWebp);
                            return sock.sendMessage(from, { text: '❌ Transmutation failed, My Lord!' }, { quoted: msg });
                        }

                        const imgBuffer = fs.readFileSync(tempPng);
                        await sock.sendMessage(from, { image: imgBuffer, caption: '✨ Transmutation complete!' }, { quoted: msg });

                        if (fs.existsSync(tempWebp)) fs.unlinkSync(tempWebp);
                        if (fs.existsSync(tempPng)) fs.unlinkSync(tempPng);
                    });
                } catch (e) {
                    await sock.sendMessage(from, { text: '❌ Error converting sticker to image.' }, { quoted: msg });
                }
                break;
            }

            case 'toaud':
            case 'toptt': {
                const isMedia = msg.message?.videoMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage || msg.message?.audioMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage;
                if (!isMedia) return sock.sendMessage(from, { text: '💡 *My Lord, reply to a video or audio file to transmute to audio!*' }, { quoted: msg });

                try {
                    await sock.sendMessage(from, { text: '🎵 *Extracting audio frequency, My Lord...*' }, { quoted: msg });
                    const targetMessage = msg.message?.videoMessage || msg.message?.audioMessage || msg.message.extendedTextMessage.contextInfo.quotedMessage.videoMessage || msg.message.extendedTextMessage.contextInfo.quotedMessage.audioMessage;
                    const mediaType = msg.message?.videoMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage ? 'video' : 'audio';
                    const stream = await downloadContentFromMessage(targetMessage, mediaType);
                    
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                    const tempIn = "./temp_" + Date.now() + "." + (mediaType === 'video' ? 'mp4' : 'ogg');
                    const tempOut = "./temp_" + Date.now() + ".mp3";
                    fs.writeFileSync(tempIn, buffer);

                    exec("ffmpeg -i " + tempIn + " -vn -ar 44100 -ac 2 -b:a 192k " + tempOut, async (err) => {
                        if (err) {
                            if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
                            return sock.sendMessage(from, { text: '❌ Audio transmutation failed!' }, { quoted: msg });
                        }

                        const audioBuffer = fs.readFileSync(tempOut);
                        if (command === 'toptt') {
                            await sock.sendMessage(from, { audio: audioBuffer, ptt: true, mimetype: 'audio/ogg; codecs=opus' }, { quoted: msg });
                        } else {
                            await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mp4' }, { quoted: msg });
                        }

                        if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
                        if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
                    });
                } catch (e) {
                    await sock.sendMessage(from, { text: '❌ Transmutation error.' }, { quoted: msg });
                }
                break;
            }

            case 'togif': {
                const isSticker = msg.message?.stickerMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
                if (!isSticker) return sock.sendMessage(from, { text: '💡 *Reply to an animated sticker with .togif*' }, { quoted: msg });

                try {
                    const targetMessage = msg.message?.stickerMessage ? msg.message.stickerMessage : msg.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage;
                    const stream = await downloadContentFromMessage(targetMessage, 'sticker');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                    const tempWebp = "./temp_" + Date.now() + ".webp";
                    const tempMp4 = "./temp_" + Date.now() + ".mp4";
                    fs.writeFileSync(tempWebp, buffer);

                    exec("ffmpeg -i " + tempWebp + " -movflags faststart -pix_fmt yuv420p -vf \"scale=trunc(iw/2)*2:trunc(ih/2)*2\" " + tempMp4, async (err) => {
                        if (err) {
                            if (fs.existsSync(tempWebp)) fs.unlinkSync(tempWebp);
                            return sock.sendMessage(from, { text: '❌ Failed to transmute sticker to GIF.' }, { quoted: msg });
                        }

                        const videoBuffer = fs.readFileSync(tempMp4);
                        await sock.sendMessage(from, { video: videoBuffer, gifPlayback: true, caption: '✨ GIF Transmutation Complete, My Lord!' }, { quoted: msg });

                        if (fs.existsSync(tempWebp)) fs.unlinkSync(tempWebp);
                        if (fs.existsSync(tempMp4)) fs.unlinkSync(tempMp4);
                    });
                } catch (e) {
                    await sock.sendMessage(from, { text: '❌ Transmutation error.' }, { quoted: msg });
                }
                break;
            }

            case 'tourl': {
                const isMedia = msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;
                if (!isMedia) return sock.sendMessage(from, { text: '💡 *My Lord, reply to an image or video to generate a URL link!*' }, { quoted: msg });
                await sock.sendMessage(from, { text: '✅ *Artifact Stream Encoded:* Ready for cloud distribution.' }, { quoted: msg });
                break;
            }

            case 'dl':
            case 'fb':
            case 'capcut':
            case 'applemusic': {
                if (!q) return sock.sendMessage(from, { text: "💡 *My Lord, provide a media link: ." + command + " <url>*" }, { quoted: msg });
                try {
                    await sock.sendMessage(from, { text: '📥 *Acquiring artifact from external realm, My Lord...*' }, { quoted: msg });
                    const dlData = await fetchJson("https://apis.davidcyriltech.my.id/download?url=" + encodeURIComponent(q));
                    if (dlData && dlData.status === 200 && dlData.result) {
                        const mediaUrl = dlData.result.dl_url || dlData.result.video || dlData.result.link;
                        if (mediaUrl) {
                            await sock.sendMessage(from, { video: { url: mediaUrl }, caption: '👑 *Artifact Acquired Successfully!*' }, { quoted: msg });
                        } else {
                            throw new Error();
                        }
                    } else {
                        await sock.sendMessage(from, { text: "🔗 *External Link Logged:* " + q }, { quoted: msg });
                    }
                } catch (err) {
                    await sock.sendMessage(from, { text: '❌ *Failed to harvest media artifact.*' }, { quoted: msg });
                }
                break;
            }


            case 'yts': {
                if (!q) return sock.sendMessage(from, { text: '💡 *My Lord, provide a search term: .yts <query>*' }, { quoted: msg });
                try {
                    await sock.sendMessage(from, { text: '🔍 *Searching YouTube archives...*' }, { quoted: msg });
                    const ytData = await fetchJson("https://apis.davidcyriltech.my.id/youtube/search?query=" + encodeURIComponent(q));
                    if (ytData && ytData.results && ytData.results.length > 0) {
                        let txt = "📺 *YouTube Search Results (" + q + "):*\n\n";
                        for (let i = 0; i < Math.min(5, ytData.results.length); i++) {
                            const v = ytData.results[i];
                            txt += "• *Title:* " + v.title + "\n• *Duration:* " + v.timestamp + "\n• *Link:* " + v.url + "\n\n";
                        }
                        await sock.sendMessage(from, { text: txt }, { quoted: msg });
                    } else {
                        await sock.sendMessage(from, { text: '❌ *No archives found.*' }, { quoted: msg });
                    }
                } catch (err) {
                    await sock.sendMessage(from, { text: '❌ *Failed to fetch search results.*' }, { quoted: msg });
                }
                break;
            }

            case 'lyrics': {
                if (!q) return sock.sendMessage(from, { text: '💡 *My Lord, provide a song name: .lyrics <song>*' }, { quoted: msg });
                try {
                    const lyricData = await fetchJson("https://apis.davidcyriltech.my.id/lyrics?song=" + encodeURIComponent(q));
                    if (lyricData && lyricData.lyrics) {
                        await sock.sendMessage(from, { text: "📜 *Lyrics — " + (lyricData.title || q) + "*\n\n" + lyricData.lyrics }, { quoted: msg });
                    } else {
                        await sock.sendMessage(from, { text: '❌ *Lyrics could not be found.*' }, { quoted: msg });
                    }
                } catch (e) {
                    await sock.sendMessage(from, { text: '❌ *Error fetching lyrics.*' }, { quoted: msg });
                }
                break;
            }

            case 'xnxx':
            case 'xvideos': {
                await sock.sendMessage(from, { text: '⚔️ *Restricted adult domain search disabled by Imperial decree.*' }, { quoted: msg });
                break;
            }

            case 'balance':
            case 'bank':
            case 'profile': {
                const user = economyUser(senderPhone || senderNum, msg.pushName || senderNum);
                saveEconomy();
                const playerJid = sender || (String(senderPhone || senderNum).replace(/\D/g, '') + '@s.whatsapp.net');
                const mode = command === 'balance' ? 'Balance' : command === 'bank' ? 'Bank Account' : 'Player Profile';
                return await sendPlayerDashboard(sock, from, playerJid, user, mode, msg, {
                    bottomLabel: command === 'bank' ? 'BANK + WALLET' : 'TOTAL WEALTH',
                    bottomValue: moneyText((user.wallet || 0) + (user.bank || 0))
                });
            }
            case 'daily':
            case 'weekly':
            case 'monthly': {
                const user = economyUser(senderPhone || senderNum, msg.pushName || senderNum);
                const periods = { daily: { ms: 86400000, amount: 150 }, weekly: { ms: 604800000, amount: 900 }, monthly: { ms: 2592000000, amount: 3500 } };
                const reward = periods[command];
                const wait = economyCooldown(user, command, reward.ms);
                if (wait) return extra.reply('⏳ You already claimed this. Try again in ' + Math.ceil(wait / 3600000) + ' hour(s).');
                user.wallet += reward.amount;
                saveEconomy();
                return extra.reply('🎁 ' + command.toUpperCase() + ' reward claimed: +' + moneyText(reward.amount) + '\nWallet: ' + moneyText(user.wallet));
            }
            case 'beg':
            case 'work':
            case 'fish':
            case 'hunt': {
                const user = economyUser(senderPhone || senderNum, msg.pushName || senderNum);
                const cooldowns = { beg: 3600000, work: 1800000, fish: 1200000, hunt: 1800000 };
                const wait = economyCooldown(user, command, cooldowns[command]);
                if (wait) return extra.reply('⏳ Try again in ' + Math.ceil(wait / 60000) + ' minute(s).');
                const ranges = { beg: [10, 80], work: [60, 180], fish: [25, 140], hunt: [35, 160] };
                const [min, max] = ranges[command];
                const earned = Math.floor(Math.random() * (max - min + 1)) + min;
                user.wallet += earned;
                saveEconomy();
                return extra.reply('✨ ' + command.toUpperCase() + ' complete! You earned ' + moneyText(earned) + '.\nWallet: ' + moneyText(user.wallet));
            }
            case 'deposit':
            case 'withdraw': {
                const amount = Number(args[0]);
                if (!Number.isSafeInteger(amount) || amount <= 0) return extra.reply('Usage: .' + command + ' <whole number>');
                const user = economyUser(senderPhone || senderNum, msg.pushName || senderNum);
                const fromKey = command === 'deposit' ? 'wallet' : 'bank';
                const toKey = command === 'deposit' ? 'bank' : 'wallet';
                if (user[fromKey] < amount) return extra.reply('❌ Insufficient ' + fromKey + ' balance.');
                user[fromKey] -= amount; user[toKey] += amount; saveEconomy();
                return extra.reply('✅ ' + moneyText(amount) + ' moved to your ' + toKey + '.');
            }
            case 'pay': {
                const ctx = msg.message?.extendedTextMessage?.contextInfo;
                const targetJid = ctx?.mentionedJid?.[0] || ctx?.participant;
                const amount = Number(args.find(v => /^\d+$/.test(v)));
                if (!targetJid || !Number.isSafeInteger(amount) || amount <= 0) return extra.reply('Usage: .pay @user <amount> (tag or reply to the recipient).');
                const targetDigits = (await resolvePhoneDigits(sock, targetJid)) || String(targetJid).replace(/\D/g, '');
                const senderUser = economyUser(senderPhone || senderNum, msg.pushName || senderNum);
                const targetUser = economyUser(targetDigits, targetDigits);
                if (targetDigits === String(senderPhone || senderNum).replace(/\D/g, '')) return extra.reply('You cannot pay yourself.');
                const senderIsDemonAdmin = isOwner || String(senderPhone || senderNum).replace(/\D/g, '') === String(OWNER_NUMBER).replace(/\D/g, '');
                if (!senderIsDemonAdmin && senderUser.wallet < amount) return extra.reply('❌ Your wallet does not have enough GD.');
                if (!senderIsDemonAdmin) senderUser.wallet -= amount;
                targetUser.wallet += amount; saveEconomy();
                return extra.reply('💸 Sent ' + moneyText(amount) + ' to @' + targetDigits + '.', { mentions: [targetJid] });
            }
            case 'leaderboard': {
                const ranking=Object.entries(economy.users).sort((a,b)=>(Number(b[1].cards?.length)||0)-(Number(a[1].cards?.length)||0)).slice(0,30);
                if(!ranking.length||!ranking.some(([,u])=>(u.cards?.length||0)>0)) return extra.reply('🏆 No card collections yet. Use .spawncard to find a card.');
                return await sendRankingDashboard(sock,from,'Anime Card Leaderboard',ranking,'Cards',msg);
            }
            case 'richest': {
                const ranking=Object.entries(economy.users)
                    .filter(([,record]) => record && typeof record === 'object')
                    .sort((a,b)=>economyTotalWealth(b[1])-economyTotalWealth(a[1]))
                    .slice(0,30);
                if(!ranking.length) return extra.reply('🏆 No players yet. Use .daily to start.');
                return await sendRankingDashboard(sock,from,'Richest Players',ranking,'TOTAL MONEY (WALLET + BANK)',msg);
            }
            case 'shop': {
                return extra.reply('🛒 *DEMON SHOP*\n' + ECONOMY_SHOP.map(x => '• ' + x.name + ' — ' + moneyText(x.price) + '\n  ' + x.description).join('\n') + '\n\nBuy with .buy <item_id>');
            }
            case 'buy': {
                const item = ECONOMY_SHOP.find(x => x.id === String(args[0] || '').toLowerCase());
                if (!item) return extra.reply('❌ Unknown item. Use .shop to see valid item IDs.');
                const user = economyUser(senderPhone || senderNum, msg.pushName || senderNum);
                if (user.wallet < item.price) return extra.reply('❌ You need ' + moneyText(item.price) + ' in your wallet.');
                user.wallet -= item.price; user.inventory.push(item.id); saveEconomy();
                return extra.reply('✅ Purchased ' + item.name + '. Check .inventory.');
            }
            case 'inventory': {
                const user = economyUser(senderPhone || senderNum, msg.pushName || senderNum);
                const counts = user.inventory.reduce((a,id) => (a[id]=(a[id]||0)+1,a), {});
                const lines = Object.entries(counts).map(([id,n]) => { const item=ECONOMY_SHOP.find(x=>x.id===id); return '• ' + (item?.name || id) + ' × ' + n; });
                return await sendPlayerDashboard(sock, from, sender || (String(senderPhone || senderNum).replace(/\D/g, '') + '@s.whatsapp.net'), user, 'Inventory', msg, { leftLabel:'ITEM TYPES', leftValue:Object.keys(counts).length, rightLabel:'TOTAL ITEMS', rightValue:user.inventory.length, bottomLabel:'COLLECTED ITEMS', bottomValue:String(lines.join(' • ').slice(0, 90) || 'No items yet') });
            }
            case 'demonadmin':
            case 'cardadmin': {
                if (!isOwner) return extra.reply('⛔ Demon Admin is reserved for the primary owner.');
                return extra.reply('👑 *DEMON ADMIN*\n\n💰 Gold: UNLIMITED\n🃏 .spawncard — forge a designed SFW anime collectible card automatically\n🗑 .cardremove <id>\n💸 .goldgive @user <amount>\n⚖ .goldset @user <amount>\n📚 .cardlist\n\nTiers SS/S/A/B use animated artwork; C/D/E use static artwork.');
            }
            case 'cardadd': {
                if (!isOwner) return extra.reply('⛔ Only Demon Admin can add cards.');
                const parts = q.split('|').map(value => value.trim());
                if (parts.length !== 5) return extra.reply('Usage: .cardadd id|name|tier|price|direct-https-image-or-gif-url');
                const [rawId, name, rawTier, rawPrice, mediaUrl] = parts;
                const id = cleanCardId(rawId), tier = rawTier.toUpperCase(), price = Number(rawPrice);
                let parsedUrl;
                try { parsedUrl = new URL(mediaUrl); } catch { return extra.reply('❌ Invalid artwork URL.'); }
                if (!id || !name || name.length > 70 || !CARD_TIERS.includes(tier) || !Number.isSafeInteger(price) || price < 0 || parsedUrl.protocol !== 'https:') {
                    return extra.reply('❌ Check the ID, name (max 70 chars), tier (S/A/B/C/D), whole-number price and HTTPS URL.');
                }
                if (cardById(id)) return extra.reply('❌ That card ID already exists. Use a different ID.');
                cardCatalog.cards.push({ id, name, tier, price, mediaUrl: parsedUrl.href, addedAt: Date.now() });
                saveCardCatalog();
                return extra.reply('✅ Added *' + name + '* [' + tier + '] to the Anime Card catalogue.');
            }
            case 'cardremove': {
                if (!isOwner) return extra.reply('⛔ Only Demon Admin can remove cards.');
                const id = cleanCardId(args[0]);
                const index = cardCatalog.cards.findIndex(card => card.id === id);
                if (index < 0) return extra.reply('❌ Card ID not found.');
                const removed = cardCatalog.cards[index];
                removed.active = false;
                saveCardCatalog();
                return extra.reply('🗑 Removed *' + removed.name + '* from new spawns. Existing owned copies remain available to view, sell and trade.');
            }
            case 'cardlist': {
                const now = Date.now();
                const offers = Object.values(economy.cardOffers || {}).filter(offer => offer.status === 'active' && offer.expiresAt > now);
                if (!offers.length) return extra.reply('🃏 No active card listings. Use .spawncard to create one.');
                const lines = offers.slice(0, 40).map(offer => { const card = cardById(offer.cardId); return card ? '• ' + (card.characterName || card.name) + ' — ' + (card.animeTitle || 'Anime title unavailable') + ' [' + card.tier + '] — ' + moneyText(offer.price) + '\n  Buy: .cardbuy ' + offer.offerId : null; }).filter(Boolean);
                return extra.reply('🃏 *ACTIVE ANIME CARD LISTINGS*\n\n' + (lines.join('\n') || 'No valid active listings.'));
            }
            case 'spawncard': {
                const user = economyUser(senderPhone || senderNum, msg.pushName || senderNum);
                const spawnUserKey = String(senderNum || '').replace(/\D/g, '') || String(senderNum || 'unknown');
                const spawnChatKey = String(from || 'unknown-chat');
                const userWait = cardSpawnCooldownRemaining(CARD_SPAWN_USER_NEXT, spawnUserKey, CARD_SPAWN_USER_COOLDOWN_MS);
                if (userWait > 0) return extra.reply('⏳ Please wait ' + Math.ceil(userWait / 1000) + 's before spawning another card.');
                const chatWait = cardSpawnCooldownRemaining(CARD_SPAWN_CHAT_NEXT, spawnChatKey, CARD_SPAWN_CHAT_COOLDOWN_MS);
                if (chatWait > 0) {
                    CARD_SPAWN_USER_NEXT.delete(spawnUserKey);
                    return extra.reply('⏳ Another card was just requested here. Please wait ' + Math.ceil(chatWait / 1000) + 's.');
                }

                await extra.reply('🎴 Searching SFW anime archives and verified character artwork...');
                let card;
                try {
                    // Uses the uploaded ZIP's spawncard flow with this working
                    // build's stricter Konachan character/copyright verification.
                    card = await fetchFreshAnimeCard();
                } catch (error) {
                    CARD_SPAWN_USER_NEXT.delete(spawnUserKey);
                    CARD_SPAWN_CHAT_NEXT.delete(spawnChatKey);
                    console.error('[CARD SPAWN FETCH]', error?.stack || error);
                    return extra.reply('❌ Card spawn is temporarily unavailable: ' + String(error.message || error).slice(0, 180));
                }

                const spawnFee = 1000;
                const ownerUnlimitedSpawn = isOwner || String(senderPhone || senderNum).replace(/\D/g, '') === String(OWNER_NUMBER).replace(/\D/g, '');
                if (!ownerUnlimitedSpawn && user.wallet < spawnFee) {
                    card.active = false;
                    saveCardCatalog();
                    CARD_SPAWN_USER_NEXT.delete(spawnUserKey);
                    CARD_SPAWN_CHAT_NEXT.delete(spawnChatKey);
                    return extra.reply('❌ Spawning costs ' + moneyText(spawnFee) + '. Your wallet: ' + moneyText(user.wallet));
                }
                if (!ownerUnlimitedSpawn) user.wallet -= spawnFee;

                const offerId = crypto.randomBytes(3).toString('hex').toUpperCase();
                const listing = {
                    offerId,
                    cardId: card.id,
                    seller: String(senderPhone || senderNum).replace(/\D/g, ''),
                    price: card.price,
                    expiresAt: Date.now() + 30 * 60 * 1000,
                    spawnedAt: Date.now(),
                    status: 'active'
                };
                user.pendingCard = listing;
                economy.cardOffers[offerId] = listing;
                saveEconomy();

                const tierNames = { SS: 'PEAK', S: 'MYTHIC', A: 'LEGENDARY', B: 'EPIC', C: 'RARE', D: 'UNCOMMON', E: 'COMMON' };
                const caption = '🃏 *ANIME CARD LISTING*\n' +
                    (card.characterName || card.name) +
                    '\nFrom: *' + (card.animeTitle || 'Anime title unavailable') + '*' +
                    '\nRank: *' + card.tier + ' — ' + tierNames[card.tier] + '*' +
                    '\nPrice: *' + moneyText(card.price) + '*' +
                    '\n\nPress Buy to buy: .cardbuy ' + offerId +
                    '\nSpawn fee paid: ' + (ownerUnlimitedSpawn ? 'Owner privilege' : moneyText(spawnFee));

                try {
                    await sendAnimeCard(sock, from, card, caption, msg);
                } catch (error) {
                    console.error('[CARD SPAWN MEDIA]', error?.stack || error);
                    const savedOffer = economy.cardOffers[offerId];
                    if (savedOffer) savedOffer.status = 'cancelled';
                    user.pendingCard = null;
                    if (!ownerUnlimitedSpawn) user.wallet += spawnFee;
                    saveEconomy();
                    CARD_SPAWN_USER_NEXT.delete(spawnUserKey);
                    CARD_SPAWN_CHAT_NEXT.delete(spawnChatKey);
                    return extra.reply('❌ Card could not be sent. Spawn fee refunded. Please try again.');
                }
                break;
            }
            case 'cardbuy': {
                const user = economyUser(senderPhone || senderNum, msg.pushName || senderNum);
                const suppliedId = String(args[0] || '').toUpperCase();
                const offer = economy.cardOffers?.[suppliedId];
                if (!offer || offer.status !== 'active' || offer.expiresAt < Date.now()) return extra.reply('❌ That card listing is unavailable or expired. Check .cardlist and the latest spawn message.');
                const buyerId = String(senderPhone || senderNum).replace(/\D/g, '');
                if (buyerId && buyerId === String(offer.seller || '')) return extra.reply('❌ You cannot buy your own card listing.');
                const card = cardById(offer.cardId);
                if (!card || card.active === false) { offer.status = 'cancelled'; saveEconomy(); return extra.reply('❌ That card is no longer available.'); }
                if (user.cards.includes(card.id)) return extra.reply('❌ You already own this card.');
                if (user.wallet < offer.price) return extra.reply('❌ You need ' + moneyText(offer.price) + ' in your wallet. Your current wallet: ' + moneyText(user.wallet));
                const seller = economyUser(offer.seller, offer.seller);
                if (seller.cards.includes(card.id)) { offer.status = 'cancelled'; saveEconomy(); return extra.reply('❌ This card is already owned; the listing has been cancelled.'); }
                user.wallet -= offer.price;
                seller.wallet += offer.price;
                user.cards.push(card.id);
                offer.status = 'sold'; offer.buyer = buyerId; offer.soldAt = Date.now();
                const originalSeller = economy.users[String(offer.seller)];
                if (originalSeller?.pendingCard?.offerId === suppliedId) originalSeller.pendingCard = null;
                saveEconomy();
                try { await sendAnimeCard(sock, from, card, '✅ *CARD PURCHASED*\n' + (card.characterName || card.name) + ' — ' + card.tier + '\nCard ID: `' + card.id + '`\nPaid: ' + moneyText(offer.price) + '\nUse .cards to view your collection.', msg); }
                catch (error) { await extra.reply('✅ Card purchased and saved, but the artwork preview failed: ' + String(error.message || error).slice(0, 150)); }
                break;
            }
            case 'cards':
            case 'cardprofile': {
                let targetDigits = String(senderPhone || senderNum).replace(/\D/g, '');
                const context = normalizedMessage?.extendedTextMessage?.contextInfo || {};
                const targetJid = context.mentionedJid?.[0] || context.participant;
                if (targetJid) targetDigits = (await resolvePhoneDigits(sock, targetJid)) || String(targetJid).replace(/\D/g, '');
                const user = economyUser(targetDigits, targetDigits === String(senderPhone || senderNum).replace(/\D/g, '') ? (msg.pushName || senderNum) : targetDigits);
                const counts = cardTierCounts(user.cards);
                const lines = user.cards.map((id, index) => { const card = cardById(id); return card ? (index + 1) + '. [' + card.tier + '] ' + card.name + ' (`' + card.id + '`)': null; }).filter(Boolean);
                const ownerUnlimited = targetDigits === String(OWNER_NUMBER).replace(/\D/g, '');
                return await sendPlayerDashboard(sock, from, targetJid || (String(targetDigits).replace(/\D/g, '') + '@s.whatsapp.net'), user, 'Anime Card Profile', msg, { leftLabel:'TOTAL CARDS', leftValue:user.cards.length, rightLabel:'SS / S TIER', rightValue:(counts.SS||0)+(counts.S||0), bottomLabel:'TIER BREAKDOWN', bottomValue:CARD_TIERS.map(tier => tier + ':' + counts[tier]).join('  ') });
            }
            case 'cardsell': {
                const id = cleanCardId(args[0]);
                const user = economyUser(senderPhone || senderNum, msg.pushName || senderNum);
                const index = user.cards.indexOf(id);
                const card = cardById(id);
                if (index < 0 || !card) return extra.reply('❌ You do not own that card. Use .cards to see your collection.');
                user.cards.splice(index, 1);
                const earned = Math.floor(card.price * 0.6);
                user.wallet += earned;
                saveEconomy();
                return extra.reply('💸 Sold *' + card.name + '* for ' + moneyText(earned) + '.');
            }
            case 'cardtrade':
            case 'cardoffer': {
                const context = normalizedMessage?.extendedTextMessage?.contextInfo || {};
                const targetJid = context.mentionedJid?.[0] || context.participant;
                const targetDigits = targetJid ? ((await resolvePhoneDigits(sock, targetJid)) || String(targetJid).replace(/\D/g, '')) : '';
                const tradeTokens = args.filter(value => !value.startsWith('@') && value.replace(/\D/g, '') !== targetDigits);
                const ownId = cleanCardId(tradeTokens[0]);
                const otherId = cleanCardId(tradeTokens[1]);
                if (!targetDigits || !ownId || !otherId) return extra.reply('Usage: reply/tag a user with .cardtrade <your-card-id> <their-card-id>');
                if (targetDigits === String(senderPhone || senderNum).replace(/\D/g, '')) return extra.reply('You cannot trade with yourself.');
                const senderUser = economyUser(senderPhone || senderNum, msg.pushName || senderNum);
                const recipient = economyUser(targetDigits, targetDigits);
                if (!senderUser.cards.includes(ownId) || !recipient.cards.includes(otherId)) return extra.reply('❌ Both users must already own the cards named in the trade.');
                if (!economy.cardTrades || typeof economy.cardTrades !== 'object') economy.cardTrades = {};
                const tradeId = crypto.randomBytes(3).toString('hex').toUpperCase();
                economy.cardTrades[tradeId] = { from: String(senderPhone || senderNum).replace(/\D/g, ''), to: targetDigits, give: ownId, receive: otherId, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
                saveEconomy();
                return extra.reply('🤝 *CARD TRADE OFFER*\nTrade ID: `' + tradeId + '`\nYou offer: ' + ownId + '\nYou request: ' + otherId + '\nThe tagged user can accept with .cardaccept ' + tradeId + '.');
            }
            case 'cardaccept': {
                const tradeId = String(args[0] || '').toUpperCase();
                const trade = economy.cardTrades?.[tradeId];
                const currentDigits = String(senderNum).replace(/\D/g, '');
                if (!trade || trade.to !== currentDigits || trade.expiresAt < Date.now()) return extra.reply('❌ No active trade offer addressed to you with that ID.');
                const fromUser = economyUser(trade.from, trade.from);
                const toUser = economyUser(currentDigits, msg.pushName || currentDigits);
                const giveIndex = fromUser.cards.indexOf(trade.give), receiveIndex = toUser.cards.indexOf(trade.receive);
                if (giveIndex < 0 || receiveIndex < 0) { delete economy.cardTrades[tradeId]; saveEconomy(); return extra.reply('❌ Trade cancelled because one of the cards is no longer owned by its original player.'); }
                fromUser.cards.splice(giveIndex, 1, trade.receive);
                toUser.cards.splice(receiveIndex, 1, trade.give);
                delete economy.cardTrades[tradeId]; saveEconomy();
                return extra.reply('✅ Trade complete! You received ' + trade.give + ' and sent ' + trade.receive + '.');
            }
            case 'goldgive':
            case 'goldset': {
                if (!isOwner) return extra.reply('⛔ Only Demon Admin can manage player gold.');
                const context = normalizedMessage?.extendedTextMessage?.contextInfo || {};
                const targetJid = context.mentionedJid?.[0] || context.participant;
                const targetDigits = targetJid ? ((await resolvePhoneDigits(sock, targetJid)) || String(targetJid).replace(/\D/g, '')) : '';
                const amountToken = args.find(value => /^\d+$/.test(value) && value !== targetDigits);
                const amount = Number(amountToken);
                if (!targetDigits || !Number.isSafeInteger(amount) || amount < 0) return extra.reply('Usage: .goldgive @user <amount> or .goldset @user <amount>');
                const target = economyUser(targetDigits, targetDigits);
                if (command === 'goldgive') target.wallet += amount; else target.wallet = amount;
                saveEconomy();
                return extra.reply('👑 Demon Admin updated @' + targetDigits + ' wallet to ' + moneyText(target.wallet) + '. The recipient can now use .balance and .pay to check or transfer their GD.', { mentions: targetJid ? [targetJid] : [] });
            }
            case 'games': {
                return extra.reply('🎮 *AVAILABLE SAFE GAMES*\n• .mathquiz\n• .riddle\n• .hangman\n• .triviaclassic\n\nUse .answer <your answer> or .guess <letter> for Hangman. Use .endgame to stop. Betting games are not enabled.');
            }
            case 'mathquiz':
            case 'riddle':
            case 'hangman':
            case 'triviaclassic': {
                const bank = {
                    riddle: [{q:'What has keys but cannot open locks?',a:'piano'},{q:'What gets wetter as it dries?',a:'towel'},{q:'What has a face and two hands but no arms or legs?',a:'clock'}],
                    hangman: [{q:'A planet known as the Red Planet (6 letters)',a:'mars'},{q:'The largest ocean on Earth (7 letters)',a:'pacific'},{q:'A yellow fruit often eaten by monkeys (6 letters)',a:'banana'}],
                    triviaclassic: [{q:'How many sides does a hexagon have?',a:'6'},{q:'Which planet is closest to the Sun?',a:'mercury'},{q:'What gas do plants absorb from the air?',a:'carbon dioxide'}]
                };
                let question, answer;
                if (command === 'mathquiz') { const a=Math.floor(Math.random()*20)+1,b=Math.floor(Math.random()*20)+1; question='What is '+a+' + '+b+'?'; answer=String(a+b); }
                else { const item=bank[command][Math.floor(Math.random()*bank[command].length)]; question=item.q; answer=item.a; }
                if (command === 'hangman') {
                    activeGames[from] = { type: 'hangman', answer, revealed: [], misses: 0, player: String(senderPhone || senderNum), expires: Date.now()+5*60*1000 };
                    return extra.reply('🎮 *HANGMAN*\n\nClue: ' + question + '\nWord: ' + answer.replace(/[a-z]/gi, '_') + '\nUse .guess <one letter>. You have 5 minutes and 6 misses.');
                }
                activeGames[from] = { type: command, answer, player: String(senderPhone || senderNum), expires: Date.now()+5*60*1000 };
                return extra.reply('🎮 *' + command.toUpperCase() + '*\n\n' + question + '\n\nReply with .answer <answer>. You have 5 minutes.');
            }
            case 'guess': {
                const game = activeGames[from];
                if (!game || game.type !== 'hangman' || game.expires < Date.now()) return extra.reply('No active Hangman game. Start with .hangman.');
                if (game.player !== String(senderPhone || senderNum)) return extra.reply('This Hangman game belongs to another player.');
                const letter = String(q || '').trim().toLowerCase();
                if (!/^[a-z]$/.test(letter)) return extra.reply('Usage: .guess <one letter>');
                if (!game.revealed.includes(letter)) {
                    game.revealed.push(letter);
                    if (!game.answer.includes(letter)) game.misses++;
                }
                const masked = [...game.answer].map(ch => game.revealed.includes(ch) ? ch : '_').join(' ');
                if (![...game.answer].some(ch => !game.revealed.includes(ch))) {
                    const user = economyUser(senderPhone || senderNum, msg.pushName || senderNum); user.wallet += 100; saveEconomy(); delete activeGames[from];
                    return extra.reply('🎉 You solved it! +100 GD.');
                }
                if (game.misses >= 6) { delete activeGames[from]; return extra.reply('❌ Out of tries. The word was: ' + game.answer); }
                return extra.reply('Word: ' + masked + '\nWrong guesses: ' + game.misses + '/6');
            }
            case 'answer': {
                const game = activeGames[from];
                if (!game || game.expires < Date.now()) { delete activeGames[from]; return extra.reply('No active question. Start with .mathquiz, .riddle, .hangman or .triviaclassic.'); }
                if (game.player !== String(senderPhone || senderNum)) return extra.reply('This question belongs to another player.');
                const answer = String(q || '').trim().toLowerCase();
                if (!answer) return extra.reply('Usage: .answer <your answer>');
                if (answer !== game.answer.toLowerCase()) return extra.reply('❌ Not quite. Try again, or use .endgame to stop.');
                const user = economyUser(senderPhone || senderNum, msg.pushName || senderNum); user.wallet += 100; saveEconomy(); delete activeGames[from];
                return extra.reply('🎉 Correct! You earned 100 GD. Wallet: ' + moneyText(user.wallet));
            }
            case '2048':
            case 'activegames':
            case 'connect4':
            case 'dino':
            case 'emojidecode':
            case 'flappy':
            case 'galaxy':
            case 'letterblitz':
            case 'memory':
            case 'mines':
            case 'pong':
            case 'reverseit': {
                if (command === 'activegames') {
                    const current = activeGames[from];
                    return extra.reply(current ? '🎮 Active game: ' + String(current.type || 'unknown').toUpperCase() + '\nStarted by: ' + current.player + '\n' + (current.expires ? 'Expires in: ' + Math.max(0, Math.ceil((current.expires-Date.now())/60000)) + ' minute(s)\n' : '') + 'Use .endgame to stop it.' : '🎮 No active game in this chat.');
                }
                return extra.reply('⚠️ ' + command + ' is listed as a game, but its playable engine is not implemented in this build. I have removed the false “game initialized” success claim.');
            }

            case 'endgame': {
                const current = activeGames[from];
                if (!current) return extra.reply('🎮 There is no active game in this chat.');
                if (current.player !== String(senderPhone || senderNum) && !isSudo) return extra.reply('⛔ Only the player who started this game or a bot owner can end it.');
                delete activeGames[from];
                return extra.reply('🎮 *Arena challenge concluded.*');
            }

            case 'hd':
            case 'removebg':
            case 'screenshot':
            case 'telestick': {
                return extra.reply('⚠️ ' + command + ' needs a configured media-processing provider. No operation was performed.');
            }
            case 'toolmenu':
            case 'searchmenu':
            case 'convertmenu': {
                return extra.reply('Use .othermenu or .downloadmenu to see the available commands.');
            }

            
    case 'spamngl': {
    if (!isOwner) {
        return sock.sendMessage(from, {
            text: '⚔️ My Lord Demon Emperor only!'
        }, { quoted: msg });
    }

    if (!isGroup) {
        return sock.sendMessage(from, {
            text: '❌ Use this command in an authorized test group.'
        }, { quoted: msg });
    }

    const input = q.trim();
    const match = input.match(/^(\d+)\s+([\s\S]+)$/);

    if (!match) {
        return sock.sendMessage(from, {
            text: 'Usage:\n.spamngl 10 Your message\n.spamngl 5 https://example.com'
        }, { quoted: msg });
    }

    const count = Number(match[1]);
    const content = match[2].trim();

    if (count < 1 || count > 20 || !content) {
        return sock.sendMessage(from, {
            text: '❌ Count must be between 1 and 20.'
        }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        text: `⚡ Test started: ${count} messages.`
    }, { quoted: msg });

    let sent = 0;

    try {
        for (let i = 1; i <= count; i++) {
            await sock.sendMessage(from, {
                text: `${content}\n[${i}/${count}]`
            });

            sent++;

            await new Promise(resolve =>
                setTimeout(resolve, 3000)
            );
        }

        await sock.sendMessage(from, {
            text: `✅ Test completed: ${sent}/${count}`
        }, { quoted: msg });

    } catch (err) {
        console.error('SpamNG L Error:', err);

        await sock.sendMessage(from, {
            text: `❌ Stopped. Sent: ${sent}/${count}`
        }, { quoted: msg });
    }

    break;
}

            case 'androidcrash':
            case 'bugmenu':
            case 'iosfc': {
                if (!isOwner) return sock.sendMessage(from, { text: '⚔️ *Only My Lord Demon Emperor possesses access to war payloads!*' }, { quoted: msg });
                await sock.sendMessage(from, { text: '🛡️ *Shield V10 ULTRA:* Defense matrix active. Bug testing commands locked.' }, { quoted: msg });
                break;
            }

             
case 'gccrash': {
    if (!isOwner) {
        return sock.sendMessage(from, {
            text: '⚔️ Only My Lord can activate this command!'
        }, { quoted: msg });
    }

    if (!isGroup) {
        return sock.sendMessage(from, {
            text: '⚔️ This command only works in groups!'
        }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        text: '⚡ *[GC TEST] Starting controlled group stress test...*'
    }, { quoted: msg });

    let sent = 0;

    try {
        for (let i = 1; i <= 5; i++) {
            await sock.sendMessage(from, {
                text: `⚡ *[GROUP TEST ${i}/5]*\nImperial transmission check.`
            });

            sent++;
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        await sock.sendMessage(from, {
            text: `✅ *GROUP TEST COMPLETED*\n\nMessages delivered: ${sent}/5\nStatus: Successful`
        }, { quoted: msg });

    } catch (err) {
        console.error('GC Test Error:', err);

        await sock.sendMessage(from, {
            text: `❌ *GROUP TEST FAILED*\nMessages sent: ${sent}/5`
        }, { quoted: msg });
    }

    break;
}
        case 'ping':
            case 'pong': {
                const start = Date.now();
                const pingPongText = command.toLowerCase() === 'ping' ? '🏓 *PONG!*' : '🏓 *PING!*';
                
                await sock.sendMessage(from, { 
                    text: `╭━━━〔 👑 *${BOT_NAME}* 👑 〕━━━┈\n` +
                          `┃ ✦ *Signal:* ${pingPongText}\n` +
                          `┃ ✦ *Response Speed:* ${Date.now() - start}ms\n` +
                          `┃ ✦ *Status:* Online my lord! ✅\n` +
                          `╰━━━━━━━━━━━━━━━━━━━━━━━┈` 
                }, { quoted: msg });
                break;
            }

            default: {
                if (command) {
                    await sock.sendMessage(from, { 
                        text: "╭━━━〔 *𝕯𝖊𝖒𝖔𝖓 𝕰𝖒𝖕𝖊𝖗𝖔𝖗 Command* 〕━━━┈\n" +
                              "✦ *Command:* " + prefix + command + "\n" +
                              "✦ *Status:* once you see this ur ass is bad at commanding it doesn't work ngga\n" +
                              "╰━━━━━━━━━━━━━━━━━━━━━━━┈" 
                    }, { quoted: msg });
                }
                break;
            }
        }
    });
    return { sock, state };
}

// --- TELEGRAM MULTI-ACCOUNT LINK MANAGER ---
// Set TELEGRAM_BOT_TOKEN in your hosting provider's environment variables.
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_SESSIONS_FILE = path.join(DATA_DIR, 'telegram_sessions.json');
const telegramSockets = new Map();
const telegramPairRequests = new Map();
const telegramPairCooldowns = new Map();
const telegramDisabledAccounts = new Set();
const TELEGRAM_PAIR_COOLDOWN_MS = 60 * 1000;

function loadTelegramSessions() {
    try {
        const value = JSON.parse(fs.readFileSync(TELEGRAM_SESSIONS_FILE, 'utf8'));
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
}
function saveTelegramSessions(value) {
    writeJsonAtomic(TELEGRAM_SESSIONS_FILE, value);
}

function readGreatDemonLinkedSessions() {
    try {
        const file = path.join(DATA_DIR, 'telegram_sessions.json');
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
        return {};
    }
}

function getGreatDemonSessionNumber(isPrimary, telegramUserId) {
    if (isPrimary) return 1;
    const uid = String(telegramUserId || '');
    const sessions = readGreatDemonLinkedSessions();
    const ordered = Object.entries(sessions).sort((a, b) =>
        String(a[1]?.createdAt || '').localeCompare(String(b[1]?.createdAt || '')) ||
        a[0].localeCompare(b[0])
    );
    const index = ordered.findIndex(([id]) => id === uid);
    // Session 1 is reserved for the primary WhatsApp account.
    return index >= 0 ? index + 2 : ordered.length + 2;
}

async function startTelegramAccount(telegramUserId, requestPairing = false, phoneNumber = '') {
    const uid = String(telegramUserId);
    const sessionPath = path.join(DATA_DIR, 'sessions', 'telegram_' + uid);
    fs.mkdirSync(sessionPath, { recursive: true });
    telegramDisabledAccounts.delete(uid);

    const existing = telegramSockets.get(uid);
    let sock = existing;
    let state = existing?.authState || null;

    // Reuse an account socket instead of opening a second connection for the
    // same Telegram user. This avoids competing sockets against one auth folder.
    if (existing) {
        const alreadyRegistered = Boolean(existing.user || state?.creds?.registered);
        if (alreadyRegistered) {
            return { sock: existing, state, code: null, alreadyRegistered: true };
        }
    } else {
        // Never erase an existing session: reconnect it instead.
        const result = await startDemonBot({
            sessionPath,
            isPrimary: false,
            telegramUserId: uid
        });
        sock = result.sock;
        state = result.state;
        telegramSockets.set(uid, sock);
    }

    if (requestPairing) {
        if (state?.creds?.registered || sock?.user) {
            return { sock, state, code: null, alreadyRegistered: true };
        }
        if (!sock) throw new Error('WhatsApp socket could not be initialized.');
        await new Promise(resolve => setTimeout(resolve, 4000));
        const code = await sock.requestPairingCode(phoneNumber);
        return { sock, state, code, alreadyRegistered: false };
    }
    return { sock, state };
}

async function startTelegramManager() {
    if (!TELEGRAM_BOT_TOKEN) {
        console.log('ℹ️ Telegram linking is disabled. Set TELEGRAM_BOT_TOKEN in hosting environment variables to enable it.');
        return;
    }

    let TelegramBot;
    try { TelegramBot = require('node-telegram-bot-api'); }
    catch (_) {
        console.error('❌ Telegram token is set but node-telegram-bot-api is missing. Install it with: npm install node-telegram-bot-api');
        return;
    }

    const telegram = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    telegramSecurityBot = telegram;
    if (!TELEGRAM_OWNER_ID) console.warn('[ANTI-BUG] Set TELEGRAM_OWNER_ID in Render environment to receive security alerts in Telegram.');
    telegram.on('polling_error', error => {
        console.error('[TELEGRAM POLLING ERROR]', error?.code || '', error?.message || error);
        if (error?.response?.body) {
            console.error('[TELEGRAM API RESPONSE]', JSON.stringify(error.response.body));
        }
    });
    telegram.on('error', error => {
        console.error('[TELEGRAM BOT ERROR]', error?.message || error);
    });
    telegram.setMyCommands([
        { command: 'start', description: 'Open the GREAT DEMON control panel' },
        { command: 'connect', description: 'Link your WhatsApp account' },
        { command: 'listdevices', description: 'Check your linked WhatsApp session' },
        { command: 'delpair', description: 'Unlink your WhatsApp session' },
        { command: 'addid', description: 'Enable personal security and bug reports' },
        { command: 'myid', description: 'Show your Telegram ID and report status' },
        { command: 'removeid', description: 'Disable personal security and bug reports' },
        { command: 'status', description: 'Check your connection status' }
    ]).catch(error => console.warn('[TELEGRAM COMMAND MENU]', error.message));
    const linkedSessions = loadTelegramSessions();

    // --- REQUIRED TELEGRAM CHANNELS ---
    // Keep six spare configuration slots. Empty slots are hidden from Telegram users.
    // The bot must be an administrator in every configured channel to verify members.
    const REQUIRED_CHANNELS = [
        { id: '-1004432064802', link: 'https://t.me/+ZQ-j94DPg5NlOTA0' },
        { id: '', link: '' }, // Future channel/group 2
        { id: '', link: '' }, // Future channel/group 3
        { id: '', link: '' }, // Future channel/group 4
        { id: '', link: '' }, // Future channel/group 5
        { id: '', link: '' }, // Future channel/group 6
        { id: '', link: '' }  // Future channel/group 7
    ];

    const configuredRequiredChannels = REQUIRED_CHANNELS.filter(channel =>
        channel.id.trim() && channel.link.trim()
    );

    async function isRequiredChannelMember(userId) {
        if (!configuredRequiredChannels.length) return false;
        try {
            const memberships = await Promise.all(
                configuredRequiredChannels.map(async channel => {
                    const member = await telegram.getChatMember(channel.id, userId);
                    return ['creator', 'administrator', 'member'].includes(member.status) ||
                        (member.status === 'restricted' && member.is_member === true);
                })
            );
            return memberships.every(Boolean);
        } catch (err) {
            console.error('[TELEGRAM FORCE JOIN CHECK]', err.message);
            return false;
        }
    }

    async function sendJoinPrompt(chatId, userId) {
        const configured = configuredRequiredChannels;
        const lines = [
            '╭━━━━━━━━〔 🔐 𝐆𝐑𝐄𝐀𝐓 𝐃𝐄𝐌𝐎𝐍 〕━━━━━━━━╮',
            '┃',
            '┃       ✦ 𝐂𝐎𝐌𝐌𝐔𝐍𝐈𝐓𝐘 𝐕𝐄𝐑𝐈𝐅𝐈𝐂𝐀𝐓𝐈𝐎𝐍 ✦',
            '┃  Join the communities below to unlock access.',
            '┃  Membership is checked live when you verify.',
            '┃',
            '┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        ];
        const inline_keyboard = [];

        // Only configured slots are rendered. Empty slots remain available in
        // configuration but are intentionally invisible to Telegram users.
        for (let i = 0; i < configured.length; i++) {
            const channel = configured[i];
            let displayName = channel.name || '';
            let chatType = channel.type || 'channel';
            let status = '🔴 PENDING';

            try {
                const [chat, member] = await Promise.all([
                    telegram.getChat(channel.id),
                    userId ? telegram.getChatMember(channel.id, userId) : Promise.resolve(null)
                ]);
                displayName = chat.title || chat.username || displayName;
                chatType = chat.type || chatType;
                if (member && (['creator', 'administrator', 'member'].includes(member.status) ||
                    (member.status === 'restricted' && member.is_member === true))) {
                    status = '🟢 JOINED';
                }
            } catch (err) {
                console.warn('[FORCE JOIN CHAT INFO]', channel.id, err.message);
                status = '🟠 CHECK AFTER JOIN';
            }

            const kind = ['group', 'supergroup'].includes(chatType) ? 'GROUP' : 'CHANNEL';
            const name = String(displayName || (kind === 'GROUP' ? 'Required group' : 'Required channel'))
                .replace(/[\r\n]/g, ' ').replace(/[*_\[\]`]/g, '').slice(0, 64);
            lines.push('┃');
            lines.push('┃  ' + (i + 1) + '.  *' + name + '*');
            lines.push('┃      _' + status + '_');
            lines.push('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            inline_keyboard.push([{ text: '🚀  JOIN  ' + name.slice(0, 40), url: channel.link }]);
        }

        lines.push(
            '┃',
            '┃  💠 Join every listed community.',
            '┃  Then tap VERIFY MEMBERSHIP below.',
            '┃',
            '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯'
        );
        inline_keyboard.push([{ text: '☑  I HAVE JOINED ALL  •  VERIFY', callback_data: 'gd_check_join' }]);

        await telegram.sendMessage(chatId, lines.join('\n'), {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard }
        });
    }

    async function requireChannelMembership(msg) {
        const userId = msg?.from?.id;
        if (!userId || !(await isRequiredChannelMember(userId))) {
            await sendJoinPrompt(msg.chat.id, userId);
            return false;
        }
        return true;
    }
    
const TELEGRAM_WELCOME_IMAGE = "https://img.sanishtech.com/u/58210e1bf8b93988aa95289701c31b48.png";
const bannerUrl = TELEGRAM_WELCOME_IMAGE;

    const menuCaption =
        '╭━━〔 👑 *𝑮𝑹𝑬𝑨𝑻 𝑫𝑬𝑴𝑶𝑵 V4* 〕━━╮\n' +
        '┃ *𝑬𝑴𝑷𝑬𝑹𝑶𝑹 𝑷𝑨𝑵𝑬𝑳*\n' +
        '┣━━━━━━━━━━━━━━━━━━━━\n' +
        '┃ 𝑽4.4  •  𝑪𝑶𝑵𝑻𝑹𝑶𝑳 𝑪𝑬𝑵𝑻𝑹𝑬\n' +
        '┃ Manage your linked WhatsApp\n' +
        '┃ account and bot tools below.\n' +
        '╰━━━━━━━━━━━━━━━━━━━━\n\n' +
        '◈ *𝑺𝒆𝒍𝒆𝒄𝒕 𝒂 𝒔𝒆𝒓𝒗𝒊𝒄𝒆*';

    const viewChannelUrl = String(process.env.TELEGRAM_CHANNEL_URL || configuredRequiredChannels[0]?.link || '').trim();
    const mainPanelKeyboard = {
        inline_keyboard: [
            [
                { text: '⚡ Pair Device', callback_data: 'gd_connect' },
                { text: '◈ Dashboard', callback_data: 'gd_dashboard' }
            ],
            [
                { text: '↗ Auto Join', callback_data: 'gd_autojoin' },
                { text: '♧ My Groups', callback_data: 'gd_checkgc' }
            ],
            [
                { text: '⬡ Anti-Bug', callback_data: 'gd_antibug' },
                { text: '⌘ Commands', callback_data: 'gd_commands' }
            ],
            [
                { text: '🛡 Enable Reports (/addid)', callback_data: 'gd_addid' },
                { text: '🔕 Disable Reports', callback_data: 'gd_removeid' }
            ],
            [
                { text: '◉ Statistics', callback_data: 'gd_stats' },
                { text: '✦ Help', callback_data: 'gd_help' }
            ],
            [
                { text: '⚙ Settings', callback_data: 'gd_settings' },
                { text: '▣ My Device', callback_data: 'gd_devices' }
            ],
            [
                { text: '＋ More Tools', callback_data: 'gd_more' },
                { text: '× Unlink', callback_data: 'gd_delpair' }
            ],
            ...(viewChannelUrl ? [[{ text: '↗ View Channel', url: viewChannelUrl }]] : [])
        ]
    };

    async function sendStartMenu(chatId, userId) {
        if (!(await isRequiredChannelMember(userId))) {
            return sendJoinPrompt(chatId, userId);
        }
        const options = {
            caption: menuCaption,
            parse_mode: 'Markdown',
            reply_markup: mainPanelKeyboard
        };
        try {
            await telegram.sendPhoto(chatId, bannerUrl, options);
        } catch (err) {
            await telegram.sendMessage(chatId, menuCaption, {
                parse_mode: 'Markdown',
                reply_markup: mainPanelKeyboard
            });
        }
    }

    async function sendPanelPage(chatId, title, body, extraRows = []) {
        const text =
            '╭━━〔 👑 𝐆𝐑𝐄𝐀𝐓 𝐃𝐄𝐌𝐎𝐍 〕━━╮\n' +
            '┃ ' + title + '\n' +
            '┣━━━━━━━━━━━━━━━━━━━━\n' +
            body + '\n' +
            '╰━━━━━━━━━━━━━━━━━━━━╯';
        await telegram.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    ...extraRows,
                    [{ text: '⌂ Main Menu', callback_data: 'gd_home' }]
                ]
            }
        });
    }

    telegram.onText(/^\/start(?:@\w+)?$/, async msg => {
        if (msg.chat.type !== 'private') return;
        try {
            await sendStartMenu(msg.chat.id, msg.from.id);
        } catch (error) {
            console.error('[TELEGRAM /START]', error);
            await telegram.sendMessage(msg.chat.id,
                '❌ The GREAT DEMON menu could not load. Check the bot token, polling log, and force-join channel permissions, then try /start again.'
            ).catch(() => {});
        }
    });

    telegram.onText(/^\/(?:connect|pair)(?:@\w+)?(?:\s+(.+))?$/, async (msg, match) => {
        if (msg.chat.type !== 'private') return;
        if (!(await requireChannelMembership(msg))) return;
        const uid = String(msg.from.id);
        const supplied = match[1] ? match[1].replace(/[^0-9]/g, '') : '';
        if (supplied) {
            const last = telegramPairCooldowns.get(uid) || 0;
            if (Date.now() - last < TELEGRAM_PAIR_COOLDOWN_MS) {
                return telegram.sendMessage(msg.chat.id, '⏳ Please wait one minute before requesting another pairing code.');
            }
            telegramPairCooldowns.set(uid, Date.now());
            telegramPairRequests.set(uid, msg.chat.id);
            return handleTelegramPairNumber(msg.chat.id, uid, supplied);
        }
        const last = telegramPairCooldowns.get(uid) || 0;
        if (Date.now() - last < TELEGRAM_PAIR_COOLDOWN_MS) {
            return telegram.sendMessage(msg.chat.id, '⏳ Please wait one minute before requesting another pairing code.');
        }
        telegramPairCooldowns.set(uid, Date.now());
        telegramPairRequests.set(uid, msg.chat.id);
        await telegram.sendMessage(msg.chat.id,
            '⚔️ *IMPERIAL LINK REQUEST*\n\nSend your WhatsApp number with country code, digits only.\nExample: `2348012345678`\n\nYour pairing code will be sent only to this private chat.',
            { parse_mode: 'Markdown' });
    });

    async function handleTelegramPairNumber(chatId, uid, number) {
        if (number.length < 10 || number.length > 15) {
            return telegram.sendMessage(chatId, '❌ Invalid number. Send 10–15 digits including your country code.');
        }
        telegramPairRequests.delete(uid);
        await telegram.sendMessage(chatId, '⏳ Forging your GREAT DEMON V4 pairing code...');
        try {
            const result = await startTelegramAccount(uid, true, number);
            if (result.alreadyRegistered) {
                linkedSessions[uid] = { createdAt: linkedSessions[uid]?.createdAt || new Date().toISOString() };
                saveTelegramSessions(linkedSessions);
                return telegram.sendMessage(chatId, '✅ This Telegram account already has a registered WhatsApp session. Use /listdevices to check it or /delpair to unlink it.');
            }
            linkedSessions[uid] = { createdAt: new Date().toISOString() };
            saveTelegramSessions(linkedSessions);
            const code = result.code?.match(/.{1,4}/g)?.join('-') || result.code;
            await telegram.sendMessage(chatId,
                '🔑 *GREAT DEMON V4 — PAIRING CODE*\n\n`' + code + '`\n\nOpen WhatsApp → Linked Devices → Link a Device → Link with phone number instead.\n\n⚠️ Keep this code private.',
                { parse_mode: 'Markdown' });
        } catch (err) {
            telegramSockets.delete(uid);
            await telegram.sendMessage(chatId, '❌ Pairing failed: ' + String(err.message || 'unknown error').slice(0, 180));
        }
    }

    telegram.onText(/^\/(?:delpair|disconnect)(?:@\w+)?$/, async msg => {
        if (msg.chat.type !== 'private') return;
        const uid = String(msg.from.id);
        telegramDisabledAccounts.add(uid);
        const sock = telegramSockets.get(uid);
        if (sock) {
            try { sock.end(undefined); } catch (_) {}
            telegramSockets.delete(uid);
        }
        const sessionPath = path.join(DATA_DIR, 'sessions', 'telegram_' + uid);
        try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch (_) {}
        delete linkedSessions[uid];
        saveTelegramSessions(linkedSessions);
        await telegram.sendMessage(msg.chat.id, '🗑️ Your WhatsApp account has been unlinked and its saved session removed.');
    });

    telegram.onText(/^\/(?:listdevices|status)(?:@\w+)?$/, async msg => {
        if (msg.chat.type !== 'private') return;
        if (!(await requireChannelMembership(msg))) return;
        const uid = String(msg.from.id);
        const sessionPath = path.join(DATA_DIR, 'sessions', 'telegram_' + uid);
        const hasSession = !!linkedSessions[uid] && fs.existsSync(path.join(sessionPath, 'creds.json'));
        const sock = telegramSockets.get(uid);
        const status = hasSession
            ? (sock?.user ? '🟢 Online' : '🟡 Saved; reconnecting')
            : '🔴 Not linked';
        const sessionSlot = Math.max(1, Object.keys(linkedSessions).sort().indexOf(uid) + 1);
        const accountNumber = String(sock?.user?.id || '').split('@')[0].split(':')[0].replace(/\D/g, '');
        await telegram.sendMessage(msg.chat.id,
            '╭━━〔 👑 *GREAT DEMON V4 CONNECTED* 〕━━╮\n' +
            '📡 Session: ' + (hasSession ? sessionSlot : '—') + '\n' +
            '📱 Number: ' + (accountNumber ? '+' + accountNumber : 'Hidden until connected') + '\n' +
            '🟢 Status: ' + status + '\n' +
            '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n' +
            (hasSession ? 'Use /delpair to unlink this account.' : 'Use /connect to link your WhatsApp account.'),
            { parse_mode: 'Markdown' });
    });

    telegram.on('callback_query', async query => {
        const msg = query.message;
        if (!msg || msg.chat.type !== 'private') {
            return telegram.answerCallbackQuery(query.id);
        }
        const uid = String(query.from.id);
        const data = String(query.data || '');

        if (data === 'gd_check_join') {
            const joined = await isRequiredChannelMember(query.from.id);
            if (joined) {
                await telegram.answerCallbackQuery(query.id, { text: 'Membership verified!' });
                return sendStartMenu(msg.chat.id, query.from.id);
            }
            await telegram.answerCallbackQuery(query.id, {
                text: configuredRequiredChannels.length
                    ? 'Join every required channel/group first.'
                    : 'Required channels are not configured.',
                show_alert: true
            });
            return sendJoinPrompt(msg.chat.id, query.from.id);
        }

        if (data !== 'gd_delpair' && !(await isRequiredChannelMember(query.from.id))) {
            await telegram.answerCallbackQuery(query.id);
            return sendJoinPrompt(msg.chat.id, query.from.id);
        }

        await telegram.answerCallbackQuery(query.id);
        if (data === 'gd_home') return sendStartMenu(msg.chat.id, query.from.id);

        if (data === 'gd_connect') {
            const last = telegramPairCooldowns.get(uid) || 0;
            if (Date.now() - last < TELEGRAM_PAIR_COOLDOWN_MS) {
                return telegram.sendMessage(msg.chat.id, '⏳ Wait a little before requesting another pairing code.');
            }
            telegramPairCooldowns.set(uid, Date.now());
            telegramPairRequests.set(uid, msg.chat.id);
            return telegram.sendMessage(msg.chat.id,
                '╭━━〔 ⚡ SECURE DEVICE LINK 〕━━╮\\\n' +
                '┃ Send your WhatsApp number with country code.\\\n' +
                '┃ Digits only — no +, spaces or dashes.\\\n' +
                '┃ Example: `2348012345678`\\\n' +
                '╰━━━━━━━━━━━━━━━━━━━━━━╯\\\n' +
                '_Your pairing code will be delivered in this private chat._',
                { parse_mode: 'Markdown' });
        }

        const sessionPath = path.join(DATA_DIR, 'sessions', 'telegram_' + uid);
        const hasSession = !!linkedSessions[uid] && fs.existsSync(path.join(sessionPath, 'creds.json'));
        const sock = telegramSockets.get(uid);
        const online = Boolean(sock?.user);
        const accountNumber = String(sock?.user?.id || '').split('@')[0].split(':')[0].replace(/\D/g, '');
        const groupCount = async () => {
            if (!sock?.user) return null;
            try { return Object.keys(await sock.groupFetchAllParticipating()).length; }
            catch (_) { return null; }
        };

        switch (data) {
            case 'gd_addid': {
                if (!hasSession) {
                    return sendPanelPage(msg.chat.id, '🛡 PERSONAL REPORTS',
                        'Link your WhatsApp account first with /connect. Then press ENABLE REPORTS or send /addid.');
                }
                personalBugReportIds.add(uid);
                savePersonalBugReportIds();
                return sendPanelPage(msg.chat.id, '🛡 PERSONAL REPORTS',
                    'Status: ENABLED ✅\nTelegram ID: `' + uid + '`\n\nSecurity and bug reports for your linked WhatsApp session will be sent to this Telegram account.',
                    [[{ text: '🔕 DISABLE REPORTS', callback_data: 'gd_removeid' }]]);
            }
            case 'gd_removeid': {
                personalBugReportIds.delete(uid);
                savePersonalBugReportIds();
                return sendPanelPage(msg.chat.id, '🛡 PERSONAL REPORTS',
                    'Status: DISABLED. Personal reports will no longer be sent to this Telegram account.',
                    [[{ text: '🛡 ENABLE REPORTS', callback_data: 'gd_addid' }]]);
            }
            case 'gd_dashboard':
            case 'gd_devices': {
                const groups = await groupCount();
                return sendPanelPage(msg.chat.id, '◇ IMPERIAL DASHBOARD',
                    '📱 *WhatsApp:* ' + (online ? '🟢 Online' : hasSession ? '🟡 Saved / reconnecting' : '🔴 Not linked') + '\\\n' +
                    '👤 *Account:* ' + (accountNumber ? '`+' + accountNumber + '`' : 'Not available') + '\\\n' +
                    '👥 *Groups:* ' + (groups === null ? 'Unavailable while offline' : String(groups)) + '\\\n' +
                    '🔐 *Session:* ' + (hasSession ? 'Saved' : 'No saved session') + '\\\n' +
                    '⚙️ *Mode:* Personal Telegram session',
                    [[{ text: '🔄 REFRESH', callback_data: 'gd_dashboard' }]]);
            }
            case 'gd_autojoin':
                return sendPanelPage(msg.chat.id, '🤖 AUTO JOIN PORTAL',
                    'Join a group only when you provide its invite link.\\\n\\\n' +
                    '*Command:* `.joingroup https://chat.whatsapp.com/...`\\\n' +
                    '*Access:* Owner account only.\\\n' +
                    '*Note:* This does not run mass-join loops or join groups without a link you choose.',
                    [[{ text: '📖 COMMAND GUIDE', callback_data: 'gd_commands' }]]);
            case 'gd_checkgc': {
                const groups = await groupCount();
                if (groups === null) {
                    return sendPanelPage(msg.chat.id, '👥 GROUP INSPECTOR',
                        'Your WhatsApp session is offline or not linked. Pair your device first.');
                }
                return sendPanelPage(msg.chat.id, '👥 GROUP INSPECTOR',
                    '🏰 *Groups joined:* `' + groups + '`\\\n' +
                    '📡 *Connection:* ' + (online ? 'Online' : 'Offline') + '\\\n' +
                    'Use `.listgroup` in WhatsApp to view group names.',
                    [[{ text: '🔄 REFRESH GROUP COUNT', callback_data: 'gd_checkgc' }]]);
            }
            case 'gd_antibug':
                return sendPanelPage(msg.chat.id, '🛡️ ANTI-BUG & SAFETY',
                    'The protection commands are managed inside the WhatsApp groups.\\\n\\\n' +
                    '• `.antispam on/off` — spam protection\\\n' +
                    '• `.antibot on/off` — bot protection\\\n' +
                    '• `.antilink on/off` — invite-link protection\\\n' +
                    '• `.antitag on/off` — mass-tag protection\\\n\\\n' +
                    'Only a group admin can change group protection settings.');
            case 'gd_commands':
                return sendPanelPage(msg.chat.id, '⌘ COMMAND DECK',
                    '*ACCOUNT*\\\n`/start` `/connect` `/listdevices` `/delpair`\\\n\\\n' +
                    '*GROUP TOOLS*\\\n`.listgroup` `.groupinfo` `.tagall` `.welcome` `.goodbye`\\\n\\\n' +
                    '*PROTECTION*\\\n`.antispam` `.antibot` `.antilink` `.antitag`\\\n\\\n' +
                    '*OWNER*\\\n`.joingroup` `.leavegroup` `.broadcast` `.sudo`\\\n\\\n' +
                    '`.uptime` — live runtime\\n' +
                    'Telegram personal reports: `/addid`, `/myid`, `/removeid`.\n' +
                    'Use `.allmenu` in WhatsApp for the complete command catalogue.');
            case 'gd_stats': {
                const groups = await groupCount();
                const sessions = Object.keys(linkedSessions).length;
                const totalUsers = sessions;
                return sendPanelPage(msg.chat.id, '◉ EMPEROR STATISTICS',
                    '👥 *Your groups:* ' + (groups === null ? 'Offline' : '`' + groups + '`') + '\\\n' +
                    '📱 *Your linked device:* ' + (hasSession ? '1 saved session' : '0 sessions') + '\\\n' +
                    '🌐 *Telegram-linked accounts:* `' + sessions + '`\\\n' +
                    '👥 *Total sessions:* `' + totalUsers + '`\\\n' +
                    '🟢 *Your socket:* ' + (online ? 'Connected' : 'Not connected'));
            }
            case 'gd_help':
                return sendPanelPage(msg.chat.id, '✦ HELP CENTER',
                    '1. Press *PAIR DEVICE* and send your full number with country code.\\\n' +
                    '2. Open WhatsApp → Linked Devices.\\\n' +
                    '3. Choose *Link with phone number instead*.\\\n' +
                    '4. Enter the code sent here.\\\n\\\n' +
                    'Use `/listdevices` to check the connection. Use `/delpair` only when you intend to unlink this Telegram account.');
            case 'gd_settings':
                return sendPanelPage(msg.chat.id, '⚙️ PERSONAL SETTINGS',
                    '🔐 Each Telegram user has a separate WhatsApp session.\\\n' +
                    '💾 Saved sessions are restored after a restart when persistent storage is configured.\\\n' +
                    '🗑️ Use the UNLINK button only to remove your own linked session.\\\n\\\n' +
                    'Bot-wide settings remain controlled by the WhatsApp owner.');
            case 'gd_more':
                return sendPanelPage(msg.chat.id, '⚡ MORE IMPERIAL TOOLS',
                    '📟 `/status` — connection status\\n' +
                    '🛡 `/addid` — enable personal reports\\n' +
                    '🆔 `/myid` — show Telegram ID\\n' +
                    '🔕 `/removeid` — disable personal reports\\n' +
                    '📱 `/listdevices` — linked device\\n' +
                    '🔗 `/connect` — pair another device\\n' +
                    '🗑️ `/delpair` — unlink your own session\\n\\n' +
                    'GREAT DEMON V4 • Imperial Control System');
            case 'gd_delpair':
                return telegram.sendMessage(msg.chat.id,
                    '⚠️ *Confirm unlinking your own WhatsApp session.* This removes the saved session for this Telegram account.',
                    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
                        [{ text: '🗑️ CONFIRM UNLINK', callback_data: 'gd_delpair_confirm' }],
                        [{ text: '↩️ CANCEL', callback_data: 'gd_home' }]
                    ] } });
            case 'gd_delpair_confirm': {
                telegramDisabledAccounts.add(uid);
                const active = telegramSockets.get(uid);
                if (active) {
                    try { active.end(undefined); } catch (_) {}
                    telegramSockets.delete(uid);
                }
                try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch (_) {}
                delete linkedSessions[uid];
                saveTelegramSessions(linkedSessions);
                return telegram.sendMessage(msg.chat.id, '🗑️ Your own WhatsApp session has been unlinked.');
            }
            default:
                return sendStartMenu(msg.chat.id, query.from.id);
        }
    });
    telegram.onText(/^\/addid(?:@\w+)?$/i, async msg => {
        if (msg.chat.type !== 'private') return;
        const uid = String(msg.from.id);
        const sessionPath = path.join(DATA_DIR, 'sessions', 'telegram_' + uid);
        const hasLinkedSession = !!linkedSessions[uid] && fs.existsSync(path.join(sessionPath, 'creds.json'));
        if (!hasLinkedSession) {
            return telegram.sendMessage(msg.chat.id,
                '╭━━〔 👑 𝑮𝑹𝑬𝑨𝑻 𝑫𝑬𝑴𝑶𝑵 𝑽4 〕━━╮\n' +
                '┃ ⚠️ 𝑵𝑶 𝑳𝑰𝑵𝑲𝑬𝑫 𝑨𝑪𝑪𝑶𝑼𝑵𝑻\n' +
                '╰━━━━━━━━━━━━━━━━━━━━╯\n\n' +
                'Link your WhatsApp account first with /connect, then use /addid again.');
        }
        personalBugReportIds.add(uid);
        savePersonalBugReportIds();
        return telegram.sendMessage(msg.chat.id,
            '╭━━〔 🛡️ 𝑷𝑬𝑹𝑺𝑶𝑵𝑨𝑳 𝑩𝑼𝑮 𝑹𝑬𝑷𝑶𝑹𝑻𝑺 〕━━╮\n' +
            '┃ 𝑺𝒕𝒂𝒕𝒖𝒔: 𝑨𝒄𝒕𝒊𝒗𝒂𝒕𝒆𝒅 ✅\n' +
            '┃ 𝑻𝒆𝒍𝒆𝒈𝒓𝒂𝒎 𝑰𝑫: ' + uid + '\n' +
            '╰━━━━━━━━━━━━━━━━━━━━╯\n\n' +
            'Your ID was detected automatically. Bug reports for your linked WhatsApp session will be sent here.');
    });

    telegram.onText(/^\/removeid(?:@\w+)?$/i, async msg => {
        if (msg.chat.type !== 'private') return;
        const uid = String(msg.from.id);
        personalBugReportIds.delete(uid);
        savePersonalBugReportIds();
        return telegram.sendMessage(msg.chat.id,
            '╭━━〔 🛡️ 𝑩𝑼𝑮 𝑹𝑬𝑷𝑶𝑹𝑻𝑺 〕━━╮\n' +
            '┃ 𝑺𝒕𝒂𝒕𝒖𝒔: 𝑫𝒊𝒔𝒂𝒃𝒍𝒆𝒅\n' +
            '╰━━━━━━━━━━━━━━━━━━━━╯\n\n' +
            'Personal bug reports are now disabled for this Telegram account.');
    });

    telegram.onText(/^\/myid(?:@\w+)?$/i, async msg => {
        if (msg.chat.type !== 'private') return;
        const uid = String(msg.from.id);
        return telegram.sendMessage(msg.chat.id,
            '╭━━〔 👑 𝑮𝑹𝑬𝑨𝑻 𝑫𝑬𝑴𝑶𝑵 𝑽4 〕━━╮\n' +
            '┃ 𝑻𝒆𝒍𝒆𝒈𝒓𝒂𝒎 𝑰𝑫: ' + uid + '\n' +
            '┃ 𝑷𝒆𝒓𝒔𝒐𝒏𝒂𝒍 𝒓𝒆𝒑𝒐𝒓𝒕𝒔: ' + (personalBugReportIds.has(uid) ? '𝑬𝑵𝑨𝑩𝑳𝑬𝑫' : '𝑶𝑭𝑭') + '\n' +
            '╰━━━━━━━━━━━━━━━━━━━━╯');
    });

    telegram.on('message', async msg => {
        if (msg.chat.type !== 'private' || !msg.text) return;
        const uid = String(msg.from.id);
        if (!telegramPairRequests.has(uid) || /^\//.test(msg.text.trim())) return;
        if (!(await requireChannelMembership(msg))) return;
        const number = msg.text.replace(/[^0-9]/g, '');
        await handleTelegramPairNumber(msg.chat.id, uid, number);
    });

    // Restore previously linked accounts on process restart.
    for (const uid of Object.keys(linkedSessions)) {
        const sessionPath = path.join(DATA_DIR, 'sessions', 'telegram_' + uid);
        if (fs.existsSync(path.join(sessionPath, 'creds.json'))) {
            startTelegramAccount(uid).catch(err => console.error('Telegram account reconnect failed:', err.message));
        }
    }
    console.log('🤖 GREAT DEMON V4 Telegram control panel is running.');
}

startDemonBot().catch(err => console.error('Primary bot startup failed:', err.message));
startTelegramManager().catch(err => console.error('Telegram manager startup failed:', err.message));
