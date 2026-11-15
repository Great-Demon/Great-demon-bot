
const axios = require('axios');

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const TIMEOUT = 45000;

function inspectAudio(buffer, contentType = '') {
    if (!Buffer.isBuffer(buffer) || buffer.length < 2048) {
        return null;
    }

    const header = buffer.subarray(0, 16);

    if (header.subarray(0, 3).toString() === 'ID3') {
        return { ext: 'mp3', mime: 'audio/mpeg' };
    }

    if (
        header[0] === 0xFF &&
        (header[1] & 0xE0) === 0xE0
    ) {
        return { ext: 'mp3', mime: 'audio/mpeg' };
    }

    if (header.subarray(0, 4).toString() === 'OggS') {
        return { ext: 'ogg', mime: 'audio/ogg' };
    }

    if (header.subarray(0, 4).toString() === 'RIFF') {
        return { ext: 'wav', mime: 'audio/wav' };
    }

    if (header.subarray(0, 4).toString() === 'fLaC') {
        return { ext: 'flac', mime: 'audio/flac' };
    }

    if (
        header.subarray(4, 8).toString() === 'ftyp'
    ) {
        return { ext: 'm4a', mime: 'audio/mp4' };
    }

    if (
        contentType.toLowerCase().startsWith('audio/') &&
        buffer.length > 2048
    ) {
        const subtype = contentType
            .split(';')[0]
            .split('/')[1]
            .toLowerCase();

        const formats = {
            mpeg: ['mp3', 'audio/mpeg'],
            mp3: ['mp3', 'audio/mpeg'],
            ogg: ['ogg', 'audio/ogg'],
            wav: ['wav', 'audio/wav'],
            flac: ['flac', 'audio/flac'],
            mp4: ['m4a', 'audio/mp4'],
            aac: ['aac', 'audio/aac']
        };

        if (formats[subtype]) {
            return {
                ext: formats[subtype][0],
                mime: formats[subtype][1]
            };
        }
    }

    return null;
}

async function fetchAuthorizedAudio(query) {
    if (!query || typeof query !== 'string') {
        throw new Error('A valid song search query is required.');
    }

    const providers = [];

    for (let i = 1; i <= 5; i++) {
        const suffix = i === 1 ? '' : `_${i}`;
        const url = process.env[`AUTHORIZED_AUDIO_API${suffix}`];
        const key =
            process.env[`AUDIO_API_KEY${suffix}`] ||
            process.env.AUDIO_API_KEY;

        if (url && key) {
            providers.push({ url, key, number: i });
        }
    }

    if (providers.length === 0) {
        throw new Error(
            'No authorized audio API is configured. Add AUTHORIZED_AUDIO_API and AUDIO_API_KEY to Render.'
        );
    }

    const errors = [];

    for (const provider of providers) {
        try {
            if (!provider.url.startsWith('https://')) {
                throw new Error('Provider URL must use HTTPS.');
            }

            const response = await axios.get(provider.url, {
                params: { q: query },
                headers: {
                    Authorization: `Bearer ${provider.key}`,
                    Accept: 'audio/*, application/octet-stream'
                },
                responseType: 'arraybuffer',
                timeout: TIMEOUT,
                maxContentLength: MAX_FILE_SIZE,
                maxBodyLength: MAX_FILE_SIZE,
                validateStatus: status =>
                    status >= 200 && status < 300
            });

            const buffer = Buffer.from(response.data);
            const contentType =
                response.headers['content-type'] || '';

            const audioInfo = inspectAudio(buffer, contentType);

            if (!audioInfo) {
                throw new Error('Provider returned invalid audio data.');
            }

            return {
                buffer,
                ext: audioInfo.ext,
                mime: audioInfo.mime,
                provider: provider.number
            };

        } catch (error) {
            const message =
                error.response?.status
                    ? `HTTP ${error.response.status}`
                    : error.message;

            errors.push(`Provider ${provider.number}: ${message}`);

            console.error(
                `[AUDIO API] Provider ${provider.number} failed:`,
                message
            );
        }
    }

    throw new Error(
        `All configured audio providers failed.\n${errors.join('\n')}`
    );
}

module.exports = {
    fetchAuthorizedAudio,
    inspectAudio
};
