const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    makeCacheableSignalKeyStore,
    makeInMemoryStore,
    jidDecode,
    proto,
    Browsers,
     getContentType,
    getAggregateVotesInPollMessage,
    PHONENUMBER_MCC
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const _ = require('lodash')
const {
Boom
} = require('@hapi/boom')
const PhoneNumber = require('awesome-phonenumber')
let phoneNumber = "2348093017755";
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");
const readline = require("readline");
const pino = require('pino')
const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const {  isUrl, generateMessageTag, getBuffer, getSizeMedia, fetchJson, sleep } = require('../system/storage.js');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid, addExif } = require('../system/exif.js');
const rl = readline.createInterface({input: process.stdin,output: process.stdout});
const createToxxicStore = require('./richstore'); // 
const store = createToxxicStore('./store', {
    maxMessagesPerChat: 100,
    memoryOnly: false
});
let msgRetryCounterCache;
const autoLoadPairs = async () => {
  console.log(chalk.yellow('🔄 Auto-loading all paired users...'));

  const pairingDir = './lib2/pairing/';
  if (!fs.existsSync(pairingDir)) {
    console.log(chalk.red('❌ Pairing directory not found.'));
    return;
  }

  const pairUsers = fs.readdirSync(pairingDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => name.endsWith('@s.whatsapp.net'));

  if (pairUsers.length === 0) {
    console.log(chalk.yellow('No paired users found.'));
    return;
  }

  console.log(chalk.green(`✅ Found ${pairUsers.length} users. Starting connections...`));

  for (const user of pairUsers) {
    try {
      await startpairing(user);
      console.log(chalk.green(`✅ Connected: ${user}`));
    } catch (e) {
      console.log(chalk.red(`❌ Failed for ${user}: ${e.message}`));
    }
  }

  console.log(chalk.green('✅ All paired users processed.'));
};

autoLoadPairs(); 
function deleteFolderRecursive(folderPath) {
if (fs.existsSync(folderPath)) {
fs.readdirSync(folderPath).forEach(file => {
const curPath = path.join(folderPath, file);
fs.lstatSync(curPath).isDirectory() ? deleteFolderRecursive(curPath) : fs.unlinkSync(curPath);
});
fs.rmdirSync(folderPath);
}
}

async function startpairing(xeonNumber) {

const {
state,
saveCreds
} = await useMultiFileAuthState('./lib2/pairing/' + xeonNumber);

const bad = makeWASocket({
    logger: pino({ level: "silent" }),
       printQRInTerminal: false,
        auth: state,
         version: [2, 3000, 1017531287],
           browser: Browsers.ubuntu("Edge"),
            getMessage: async key => {
            const jid = jidNormalizedUser(key.remoteJid);
            const msg = await store.loadMessage(jid, key.id);
            return msg?.message || '';
           },
        shouldSyncHistoryMessage: msg => {
            console.log(`\x1b[32mLoading Chat [${msg.progress}%]\x1b[39m`);
            return !!msg.syncType;
        },
      }, store)

store.bind(bad.ev);

if (pairingCode && !state.creds.registered) {
if (useMobile) {
throw new Error('Cannot use pairing code with mobile API');
}

let phoneNumber = xeonNumber.replace(/[^0-9]/g, '');
/*if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
process.exit(0);
}*/
setTimeout(async () => {
let code = await bad.requestPairingCode(phoneNumber, "IAMDEATH");
code = code?.match(/.{1,4}/g)?.join("-") || code;

fs.writeFile(
  './lib2/pairing/pairing.json',  // Path of the file where it will be saved
  JSON.stringify({"code": code}, null, 2),  // Transforms the object into a JSON formatted string
  'utf8',
  (err) => {
      if (err) {
      } else {
      }
  }
);


}, 1703);

}

bad.decodeJid = (jid) => {
if (!jid) return jid;
if (/:\d+@/gi.test(jid)) {
let decode = jidDecode(jid) || {};
return decode.user && decode.server && `${decode.user}@${decode.server}` || jid;
} else {
return jid;
}
};
bad.ev.on('messages.upsert', async chatUpdate => {
try {
const xeonjid = chatUpdate.messages[0];
if (!xeonjid.message) return;
xeonjid.message = (Object.keys(xeonjid.message)[0] === 'ephemeralMessage') ? xeonjid.message.ephemeralMessage.message : xeonjid.message;
if (xeonjid.key && xeonjid.key.remoteJid === 'status@broadcast') return;
if (!bad.public && !xeonjid.key.fromMe && chatUpdate.type === 'notify') return;
if (xeonjid.key.id.startsWith('BAE5') && xeonjid.key.id.length === 16) return;
XeonyConnect = bad
mek = smsg(XeonyConnect, xeonjid, store);
require("./response")(XeonyConnect, mek, chatUpdate, store);
} catch (err) {
console.log(err);
}
});

bad.ev.on("connection.update", async (update) => {
const {
connection,
lastDisconnect
} = update;
if (connection === "close") {
let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
console.log(reason)
if (reason === DisconnectReason.badSession) {
console.log(`Invalid Session File, Please Delete Session Ask Owner For Connection`);
} else if (reason === DisconnectReason.connectionClosed) {
console.log("Connection closed, reconnecting....");
startpairing(xeonNumber)
} else if (reason === DisconnectReason.connectionLost) {
console.log("Server Connection Lost, Reconnecting...");
startpairing(xeonNumber)
} else if (reason === DisconnectReason.connectionReplaced) {
} else if (reason === DisconnectReason.loggedOut) {
deleteFolderRecursive('./lib2/pairing/' + xeonNumber);
console.log(chalk.bgRed(`${xeonNumber} disconnected from using rentbot`));
} else if (reason === DisconnectReason.restartRequired) {
startpairing(xeonNumber)
} else if (reason === DisconnectReason.timedOut) {
startpairing(xeonNumber)
} else if (reason === '405') {
console.log('error 405 detected raising new pairing')
await startpairing(xeonNumber)
} else {
console.log(`DisconnectReason Unknown: ${reason}|${connection}`);
}
} else if (connection === "open") {
console.log(chalk.bgBlue(`Oblivion bot is active in ${xeonNumber}`));
}
});
bad.sendText = (jid, text, quoted = '', options) => bad.sendMessage(jid, { text: text, ...options }, { quoted })
//=========================================\\
bad.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
    try {
        // Validate input parameters
        if (!message || (!message.msg && !message.mimetype)) {
            throw new Error('Invalid message object provided');
        }

        if (typeof filename !== 'string' || filename.trim() === '') {
            throw new Error('Invalid filename provided');
        }

        // Extract message content and type
        const quoted = message.msg || message;
        const mime = quoted.mimetype || '';
        const messageType = message.mtype 
            ? message.mtype.replace(/Message/gi, '') 
            : mime.split('/')[0];

        if (!messageType) {
            throw new Error('Could not determine message type');
        }

        // Create directory if it doesn't exist
        const stickerDir = './sticker';
        if (!fs.existsSync(stickerDir)) {
            fs.mkdirSync(stickerDir, { recursive: true });
        }

        // Download the media content
        const stream = await downloadContentFromMessage(quoted, messageType);
        let buffer = Buffer.from([]);

        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        if (buffer.length === 0) {
            throw new Error('Downloaded media is empty');
        }

        // Determine file extension
        const type = await FileType.fromBuffer(buffer);
        if (!type && attachExtension) {
            throw new Error('Could not determine file type');
        }

        // Construct file path
        const fileExt = attachExtension ? `.${type.ext}` : '';
        const trueFileName = path.join(stickerDir, `${filename}${fileExt}`);

        // Save to file
        await fs.promises.writeFile(trueFileName, buffer);

        return {
            success: true,
            filePath: trueFileName,
            size: buffer.length,
            mimeType: type?.mime || mime
        };
    } catch (error) {
        console.error('Error in downloadAndSaveMediaMessage:', error);
        throw new Error(`Failed to download and save media: ${error.message}`);
    }
};
//=========================================\\
// Enhanced file handling methods for WhatsApp bot
bad.getFile = async (PATH, save = false) => {
    try {
        let res, data, filename;
        
        // Handle different input types
        if (Buffer.isBuffer(PATH)) {
            data = PATH;
        } else if (/^data:.*?\/.*?;base64,/i.test(PATH)) {
            data = Buffer.from(PATH.split`,`[1], 'base64');
        } else if (/^https?:\/\//.test(PATH)) {
            res = await getBuffer(PATH);
            data = res;
        } else if (fs.existsSync(PATH)) {
            filename = PATH;
            data = await fs.promises.readFile(PATH);
        } else if (typeof PATH === 'string') {
            data = Buffer.from(PATH);
        } else {
            data = Buffer.alloc(0);
        }

        // Detect file type
        const type = await FileType.fromBuffer(data) || {
            mime: 'application/octet-stream',
            ext: '.bin'
        };

        // Generate filename if not provided
        filename = filename || path.join(
            path.dirname(__filename), 
            '../src/', 
            `${Date.now()}.${type.ext}`
        );

        // Save file if requested
        if (save && data.length > 0) {
            await fs.promises.mkdir(path.dirname(filename), { recursive: true });
            await fs.promises.writeFile(filename, data);
        }

        return {
            success: true,
            res,
            filename,
            size: data.length,
            ...type,
            data
        };
    } catch (error) {
        console.error('Error in getFile:', error);
        throw new Error(`Failed to process file: ${error.message}`);
    }
};

bad.sendFile = async (jid, filePath, filename = '', caption = '', quoted, ptt = false, options = {}) => {
    try {
        const type = await bad.getFile(filePath, true);
        let { data: file, filename: pathFile } = type;

        // Handle HTTP response errors
        if (type.res && type.res.status !== 200) {
            throw new Error(`HTTP Error: ${type.res.status}`);
        }

        if (file.length <= 65536) {
            throw new Error('File too small or invalid');
        }

        const opt = {
            filename: filename || path.basename(pathFile),
            ...(quoted && { quoted })
        };

        // Determine message type
        let mtype, mimetype = type.mime;
        let convertedFile;

        if (/webp/.test(mimetype) || (/image/.test(mimetype) && options.asSticker)) {
            mtype = 'sticker';
        } else if (/image/.test(mimetype) || (/webp/.test(mimetype) && options.asImage)) {
            mtype = 'image';
        } else if (/video/.test(mimetype)) {
            mtype = 'video';
        } else if (/audio/.test(mimetype)) {
            const convertFunc = ptt ? toPTT : toAudio;
            convertedFile = await convertFunc(file, type.ext);
            file = convertedFile.data;
            pathFile = convertedFile.filename;
            mtype = 'audio';
            mimetype = 'audio/ogg; codecs=opus';
        } else {
            mtype = 'document';
        }

        // Handle document override
        if (options.asDocument) mtype = 'document';

        // Clean up options
        const cleanOptions = { ...options };
        ['asSticker', 'asLocation', 'asVideo', 'asDocument', 'asImage'].forEach(opt => {
            delete cleanOptions[opt];
        });

        // Prepare message
        const message = { 
            ...cleanOptions, 
            caption, 
            ptt, 
            [mtype]: { url: pathFile }, 
            mimetype 
        };

        // Try sending with URL first, fallback to file data
        try {
            return await bad.sendMessage(jid, message, opt);
        } catch (e) {
            console.warn('URL send failed, trying with file data');
            return await bad.sendMessage(jid, { 
                ...message, 
                [mtype]: file 
            }, opt);
        }
    } catch (error) {
        console.error('Error in sendFile:', error);
        throw new Error(`Failed to send file: ${error.message}`);
    }
};

// Text message with mentions
bad.sendTextWithMentions = async (jid, text, quoted, options = {}) => {
    const mentions = [...text.matchAll(/@(\d{0,16})/g)]
        .map(v => v[1] + '@s.whatsapp.net');
    
    return bad.sendMessage(jid, { 
        text, 
        mentions, 
        ...options 
    }, { quoted });
};

// Media message downloaders
bad.downloadMediaMessage = async (message) => {
    try {
        const mime = (message.msg || message).mimetype || '';
        const messageType = message.mtype 
            ? message.mtype.replace(/Message/gi, '') 
            : mime.split('/')[0];

        const stream = await downloadContentFromMessage(message, messageType);
        let buffer = Buffer.from([]);

        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        if (buffer.length === 0) {
            throw new Error('Downloaded media is empty');
        }

        return buffer;
    } catch (error) {
        console.error('Error in downloadMediaMessage:', error);
        throw new Error(`Failed to download media: ${error.message}`);
    }
};

bad.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
    try {
        const quoted = message.msg || message;
        const mime = quoted.mimetype || '';
        const messageType = message.mtype 
            ? message.mtype.replace(/Message/gi, '') 
            : mime.split('/')[0];

        // Download the media
        const buffer = await bad.downloadMediaMessage(message);
        
        // Detect file type
        const type = await FileType.fromBuffer(buffer);
        if (!type && attachExtension) {
            throw new Error('Could not determine file type');
        }

        // Ensure directory exists
        const dir = './sticker';
        await fs.promises.mkdir(dir, { recursive: true });

        // Create filename
        const ext = attachExtension ? `.${type.ext}` : '';
        const trueFileName = path.join(dir, `${filename}${ext}`);

        // Save file
        await fs.promises.writeFile(trueFileName, buffer);

        return {
            success: true,
            filePath: trueFileName,
            size: buffer.length,
            mimeType: type?.mime || mime
        };
    } catch (error) {
        console.error('Error in downloadAndSaveMediaMessage:', error);
        throw new Error(`Failed to save media: ${error.message}`);
    }
};

// Sticker creation functions
bad.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
    try {
        let buffer;
        if (Buffer.isBuffer(path)) {
            buffer = path;
        } else if (/^data:.*?\/.*?;base64,/i.test(path)) {
            buffer = Buffer.from(path.split`,`[1], 'base64');
        } else if (/^https?:\/\//.test(path)) {
            buffer = await getBuffer(path);
        } else if (fs.existsSync(path)) {
            buffer = await fs.promises.readFile(path);
        } else {
            buffer = Buffer.alloc(0);
        }

        if (buffer.length === 0) {
            throw new Error('Invalid image data');
        }

        const stickerBuffer = (options.packname || options.author) 
            ? await writeExifImg(buffer, options) 
            : await imageToWebp(buffer);

        return bad.sendMessage(jid, { 
            sticker: { url: stickerBuffer }, 
            ...options 
        }, { quoted });
    } catch (error) {
        console.error('Error in sendImageAsSticker:', error);
        throw new Error(`Failed to send sticker: ${error.message}`);
    }
};

bad.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
    try {
        let buffer;
        if (Buffer.isBuffer(path)) {
            buffer = path;
        } else if (/^data:.*?\/.*?;base64,/i.test(path)) {
            buffer = Buffer.from(path.split`,`[1], 'base64');
        } else if (/^https?:\/\//.test(path)) {
            buffer = await getBuffer(path);
        } else if (fs.existsSync(path)) {
            buffer = await fs.promises.readFile(path);
        } else {
            buffer = Buffer.alloc(0);
        }

        if (buffer.length === 0) {
            throw new Error('Invalid video data');
        }

        const stickerBuffer = (options.packname || options.author) 
            ? await writeExifVid(buffer, options) 
            : await videoToWebp(buffer);

        return bad.sendMessage(jid, { 
            sticker: { url: stickerBuffer }, 
            ...options 
        }, { quoted });
    } catch (error) {
        console.error('Error in sendVideoAsSticker:', error);
        throw new Error(`Failed to send video sticker: ${error.message}`);
    }
};
    
    bad.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
        let quoted = message.msg ? message.msg : message;
        let mime = (message.msg || message).mimetype || '';
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
        const stream = await downloadContentFromMessage(quoted, messageType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        let type = await FileType.fromBuffer(buffer);
        let trueFileName = attachExtension ? (filename + '.' + type.ext) : filename;
        await fs.writeFileSync(trueFileName, buffer);
        return trueFileName;
    };
    bad.sendTextWithMentions = async (jid, text, quoted, options = {}) => bad.sendMessage(jid, { text: text, mentions: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net'), ...options }, { quoted })
//=========================================\\

bad.downloadMediaMessage = async (message) => {
    let mime = (message.msg || message).mimetype || ''
    let messageType = message.mtype 
        ? message.mtype.replace(/Message/gi, '') 
        : mime.split('/')[0]

    const stream = await downloadContentFromMessage(message, messageType)
    let buffer = Buffer.from([])

    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
    }

    return buffer
}

bad.ev.on('creds.update', saveCreds);
}

module.exports = startpairing

function smsg(bad, m, store) {
if (!m) return m
let M = proto.WebMessageInfo
if (m.key) {
m.id = m.key.id
m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16
m.chat = m.key.remoteJid
m.fromMe = m.key.fromMe
m.isGroup = m.chat.endsWith('@g.us')
m.sender = bad.decodeJid(m.fromMe && bad.user.id || m.participant || m.key.participant || m.chat || '')
if (m.isGroup) m.participant = bad.decodeJid(m.key.participant) || ''
}
if (m.message) {
    m.mtype = getContentType(m.message);
    m.msg = (m.mtype == 'viewOnceMessage' ? 
        m.message[m.mtype]?.message?.[getContentType(m.message[m.mtype].message)] : 
        m.message[m.mtype]);
    
    m.body = m?.message?.conversation || 
        m?.msg?.caption || 
        m?.msg?.text || 
        (m?.mtype === 'listResponseMessage' && m?.msg?.singleSelectReply?.selectedRowId) || 
        (m?.mtype === 'buttonsResponseMessage' && m?.msg?.selectedButtonId) || 
        (m?.mtype === 'viewOnceMessage' && m?.msg?.caption) || 
        m?.text || 
        '';
    
    let quoted = m.quoted = m.msg?.contextInfo?.quotedMessage || null;
    m.mentionedJid = m.msg?.contextInfo?.mentionedJid || [];
    
    if (m.quoted) {
        let type = getContentType(quoted);
        m.quoted = m.quoted[type] || m.quoted;
        
        if (['productMessage'].includes(type)) {
            type = getContentType(m.quoted);
            m.quoted = m.quoted[type] || m.quoted;
        }
        
        if (typeof m.quoted === 'string') {
            m.quoted = { text: m.quoted };
        }
        
        m.quoted.mtype = type;
        m.quoted.id = m.msg?.contextInfo?.stanzaId || '';
        m.quoted.chat = m.msg?.contextInfo?.remoteJid || m.chat;
        m.quoted.isBaileys = m.quoted.id ? m.quoted.id.startsWith('BAE5') && m.quoted.id.length === 16 : false;
        m.quoted.sender = bad.decodeJid(m.msg?.contextInfo?.participant || '');
        m.quoted.fromMe = m.quoted.sender === bad.decodeJid(bad.user?.id || '');
        m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || 
                        m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || '';
        m.quoted.mentionedJid = m.msg?.contextInfo?.mentionedJid || [];
        
        m.getQuotedObj = m.getQuotedMessage = async () => {
            if (!m.quoted.id) return false;
            let q = await store.loadMessage(m.chat, m.quoted.id, conn);
            return exports.smsg(conn, q, store);
        };
        
        let vM = m.quoted.fakeObj = M.fromObject({
            key: {
                remoteJid: m.quoted.chat,
                fromMe: m.quoted.fromMe,
                id: m.quoted.id
            },
            message: quoted,
            ...(m.isGroup ? { participant: m.quoted.sender } : {})
        });
        
        m.quoted.delete = () => bad.sendMessage(m.quoted.chat, { delete: vM.key });
        m.quoted.copyNForward = (jid, forceForward = false, options = {}) => 
            bad.copyNForward(jid, vM, forceForward, options);
        m.quoted.download = () => bad.downloadMediaMessage(m.quoted);
    }
}
if (m.msg.url) m.download = () => bad.downloadMediaMessage(m.msg)
m.text = m.msg.text || m.msg.caption || m.message.conversation || m.msg.contentText || m.msg.selectedDisplayText || m.msg.title || ''
m.reply = (text, chatId = m.chat, options = {}) => Buffer.isBuffer(text) ? bad.sendMedia(chatId, text, 'file', '', m, { ...options }) : bad.sendText(chatId, text, m, { ...options })
m.copy = () => exports.smsg(conn, M.fromObject(M.toObject(m)))
m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => bad.copyNForward(jid, m, forceForward, options)

return m
}

let file = require.resolve(__filename)
fs.watchFile(file, () => {
fs.unwatchFile(file)
console.log(chalk.redBright(`Update= '${__filename}'`))
delete require.cache[file]
require(file)
})