const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');
const { BOT_TOKEN } = require('./token');
const startpairing = require('./start/rentbot');

// Constants
const adminFilePath = './adminID.json';
const bannedPath = './lib2/pairing/banned.json';
const userStore = './lib2/pairing/users.json';
const premium_file = './premium.json';
const ITEMS_PER_PAGE = 60;
const OWNER_ID = '7092629860';
const OWNER_NAME = '@Vortex_Shadow2563';
const pagedListPairs = {}; // In-memory cache for pagination

// Initialize bot
const bot = new Telegraf(BOT_TOKEN);
const botStartTime = Date.now();
let premiumUsers = [];

// Load admin IDs and premium users
const adminIDs = JSON.parse(fs.readFileSync(adminFilePath, 'utf8'));
try {
  premiumUsers = JSON.parse(fs.readFileSync(premium_file, 'utf-8'));
} catch (error) {
  console.error('Failed to load premium users:', error);
}

// Helper functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatRuntime(seconds) {
  const pad = (s) => (s < 10 ? '0' + s : s);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`;
}

function formatInternationalNumber(number) {
  return '+' + number.replace(/(\d{3})(?=\d)/g, '$1 ');
}

function trackUser(id) {
  const users = JSON.parse(fs.readFileSync(userStore));
  if (!users.includes(id)) {
    users.push(id);
    fs.writeFileSync(userStore, JSON.stringify(users, null, 2));
  }
}

function getPushName(ctx) {
  return ctx.from.first_name || ctx.from.username || "User";
}

// Pagination functions
async function sendListPairPage(ctx, userID, pageIndex) {
  try {
    const pairedDevices = pagedListPairs[userID] || [];
    const totalPages = Math.ceil(pairedDevices.length / ITEMS_PER_PAGE);
    const start = pageIndex * ITEMS_PER_PAGE;
    const currentPage = pairedDevices.slice(start, start + ITEMS_PER_PAGE);

    const pageText = currentPage.map((id, i) =>
      `*${start + i + 1}.* \`${id}\``
    ).join('\n');

    const navButtons = [];
    if (pageIndex > 0) navButtons.push({ text: '⬅️ Back', callback_data: `listpair_page_${pageIndex - 1}` });
    if (pageIndex < totalPages - 1) navButtons.push({ text: '➡️ Next', callback_data: `listpair_page_${pageIndex + 1}` });

    // Try to edit the message, if fails, send a new one
    try {
      await ctx.editMessageText(
        `*Paired Devices (Page ${pageIndex + 1}/${totalPages}):*\n\n${pageText}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: navButtons.length ? [navButtons] : []
          }
        }
      );
    } catch (editError) {
      // If editing fails, send a new message
      const newMessage = await ctx.reply(
        `*Paired Devices (Page ${pageIndex + 1}/${totalPages}):*\n\n${pageText}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: navButtons.length ? [navButtons] : []
          }
        }
      );
      // Store the new message ID for future edits if needed
    }

    // Only answer callback query if it's available
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery().catch(() => {}); // Silent catch for answerCbQuery errors
    }
  } catch (error) {
    console.error('Error sending list page:', error);
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('❌ Failed to load page', { show_alert: true }).catch(() => {});
    }
  }
}
async function sendDelPairPage(ctx, userID, pageIndex) {
  try {
    const pairedDevices = pagedListPairs[userID] || [];
    const totalPages = Math.ceil(pairedDevices.length / ITEMS_PER_PAGE);
    const start = pageIndex * ITEMS_PER_PAGE;
    const currentPage = pairedDevices.slice(start, start + ITEMS_PER_PAGE);

    const keyboard = currentPage.map(id => [
      { 
        text: `🗑️ ${id.replace('@s.whatsapp.net', '')}`, 
        callback_data: `delpair_${encodeURIComponent(id)}` 
      }
    ]);

    const navButtons = [];
    if (pageIndex > 0) navButtons.push({ 
      text: '◀ Previous', 
      callback_data: `delpair_page_${pageIndex - 1}` 
    });
    if (pageIndex < totalPages - 1) navButtons.push({ 
      text: 'Next ▶', 
      callback_data: `delpair_page_${pageIndex + 1}` 
    });

    if (navButtons.length) keyboard.push(navButtons);

    // Add a back button to main menu if needed
    keyboard.push([{ text: '🔙 Back to Main Menu', callback_data: 'main_menu' }]);

    const messageContent = {
      text: `📋 *Active Sessions Management*\n\n` +
            `Page ${pageIndex + 1}/${totalPages}\n` +
            `Total sessions: ${pairedDevices.length}\n\n` +
            `Select a session to delete:`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    };

    // Try to edit, if fails send new message
    try {
      await ctx.editMessageText(messageContent.text, {
        parse_mode: messageContent.parse_mode,
        reply_markup: messageContent.reply_markup
      });
    } catch (editError) {
      await ctx.reply(messageContent.text, {
        parse_mode: messageContent.parse_mode,
        reply_markup: messageContent.reply_markup
      });
    }

    // Acknowledge callback query if exists
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery().catch(() => {});
    }

  } catch (error) {
    console.error('Error sending delete page:', error);
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('❌ Failed to load page', { show_alert: true })
        .catch(() => {});
    }
  }
}

// Bot commands
bot.start((ctx) => {
  const userId = ctx.from.id;
  trackUser(userId);

  ctx.replyWithPhoto('https://files.catbox.moe/5ydrgs.jpeg', {
    caption: 
'*⟢ WELCOME TO OBLIVION VIP BOT ⚠️*\n\n' +
'⟜ *System:* _LINUX CORE_\n' +
'⟜ *Commander:* _@Vortex\\_Shadow2563_\n' +
'⟜ *Prefix:* _\\[ / \\]_\n\n' +
'You stand at the edge of silence\\.  \n' +
'Press *START* to descend into the void\\.',
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [
        [{ text: '𝑺𝑻𝑨𝑹𝑻', callback_data: 'start_bot' }],
        [{ text: '𝕺𝕭𝕷𝕴𝖁𝕴𝕺𝕹 𝕮𝕳𝕬𝕹𝕹𝕰𝕷 ⚠️', url: 'https://t.me/Shadow_Syndicate2' }],
        [{ text: '⟢ 𝔒𝔅𝔏ℑ𝔙ℑ𝔒𝔑 𝔒𝔓𝔈ℜ𝔄𝔗ℑ𝔒𝔑𝔖 ℌ𝔘𝔅 ⚔️', url: 'https://t.me/+L7oP75Zz-C0wZDc8' }]
      ]
    }
  });
});

bot.action('start_bot', (ctx) => {
  const pushname = getPushName(ctx);

  ctx.replyWithPhoto('https://files.catbox.moe/5ydrgs.jpeg', {
    caption: `\`\`\`
☬ 👨‍💻 ᴅᴇᴠᴇʟᴏᴘᴇʀ: @Vortex_Shadow2563
☬ /pair 234xxxx
☬ /delpair 234xxxx
☬ /listpair
☬ /runtime
☬ /broadcast 
☬ /addprem id
☬ /delprem id
☬ /ban id\`\`\``,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '𝕺𝕭�𝕴𝖁𝕴𝕺� 𝕮𝕳𝕬𝕹𝕹𝕰𝕷 ⚠️', url: 'https://t.me/Shadow_Syndicate2' }],
        [{ text: '⟢ 𝔒𝔅𝔏ℑ𝔙ℑ𝔒𝔑 𝔒𝔓𝔈ℜ𝔄𝔗ℑ𝔒𝔑𝔖 ℌ𝔘𝔅 ⚔️', url: 'https://t.me/+L7oP75Zz-C0wZDc8' }],
        [{ text: '𝐈𝐍𝐅𝐎', callback_data: 'info_bot' }]
      ]
    }
  });
});

bot.action('info_bot', (ctx) => {
  ctx.reply(
    '*🌑 OBLIVION*\n\n' +
    'This is a Telegram pair bot forged by *𝕍ø𝕣𝕥ë𝕩\\_𝕊𝕙ä𝕕ø𝕨 軎*\n' +
    'Unleash chaos using the `/pair` command above\\.\n\n' +
    '📡 *Support Channel:*\n' +
    '🔗 https://t\\.me/Shadow\\_Syndicate2\n\n' +
    '_Enter the void\\.\\.\\._ ❤️‍',
    { parse_mode: 'MarkdownV2' }
  );
});

bot.command('runtime', async (ctx) => {
  const uptime = Math.floor((Date.now() - botStartTime) / 1000);
  ctx.reply(`⚡ Bot has been running for: *${formatRuntime(uptime)}*`, {
    parse_mode: 'Markdown'
  });
});

bot.command('hello', async (ctx) => {
  const pushname = getPushName(ctx);
  ctx.reply(`Hi, ${pushname}!`);
});

bot.command('pair', async (ctx) => {
  try {
    const userId = ctx.from.id;
    // Ban check
    const banned = JSON.parse(fs.readFileSync(bannedPath, 'utf-8'));
    if (banned.includes(userId)) {
      return ctx.reply('⛔ *Access Denied:*\nYou are *banned* from using this service.', { 
        parse_mode: 'Markdown' 
      });
    }

    // Phone Number Validation
    const text = ctx.message.text.split(' ')[1]?.trim();
    if (!text) {
      return ctx.reply(
        `❗ *Usage:* \`/pair [country_code][number]\`\n\n` +
        `Examples:\n` +
        `• \`/pair 14151234567\` (US/Canada)\n` +
        `• \`/pair 447812345678\` (UK)\n` +
        `• \`/pair 918123456789\` (India)\n` +
        `• With PIN: \`/pair 14151234567|1234\``,
        { parse_mode: 'Markdown' }
      );
    }

    if (/[^0-9|]/.test(text)) {
      return ctx.reply(
        '❌ Invalid characters. Only numbers and | (for PIN) are allowed.'
      );
    }

    const numberParts = text.split('|');
    let phoneNumber = numberParts[0];
    const pin = numberParts[1] || '';

    // Validate international number format
    if (!/^[1-9]\d{4,14}$/.test(phoneNumber)) {
      return ctx.reply(
        `❌ *Invalid International Number Format*\n\n` +
        `Must be 5-15 digits starting with country code\n` +
        `Examples:\n` +
        `• US/Canada: \`14151234567\`\n` +
        `• UK: \`447812345678\`\n` +
        `• India: \`918123456789\``,
        { parse_mode: 'Markdown' }
      );
    }

    if (pin && !/^\d{1,10}$/.test(pin)) {
      return ctx.reply(
        '❌ Invalid PIN format. PIN must be 1-10 digits after | character.'
      );
    }

    // Pairing Limit Check
    try {
      const pairingFolder = './lib2/pairing';
      if (!fs.existsSync(pairingFolder)) {
        fs.mkdirSync(pairingFolder, { recursive: true });
      }

      const pairedCount = fs.readdirSync(pairingFolder)
        .filter(file => file.endsWith('@s.whatsapp.net')).length;
      
      if (pairedCount >= 53) {
        return ctx.reply(
          '⚠️ *Pairing limit reached!*\n\n' +
          'Our bot is currently at full capacity.\n\n' +
          'You can make use of this one @Oblivion2_bugbot',
          { parse_mode: 'Markdown' }
        );
      }
    } catch (err) {
      console.error('Error checking pairing limit:', err);
      return ctx.reply('❌ System error checking pairing availability. Please try again later.');
    }

    // Start Pairing Process
    const whatsappNumber = phoneNumber + "@s.whatsapp.net";
    
    try {
      await startpairing(whatsappNumber);
      await sleep(4000); // Wait for pairing to complete

      const pairingObj = JSON.parse(fs.readFileSync('./lib2/pairing/pairing.json', 'utf-8'));
      if (!pairingObj?.code) {
        throw new Error('No pairing code generated');
      }

      // Format number for display
      const formattedNumber = formatInternationalNumber(phoneNumber);

      // Send Pairing Instructions
      const message = await ctx.replyWithHTML(
        `✅ <b>WhatsApp Pairing Successful!</b>\n\n` +
        `🌍 <b>Number:</b> <code>${formattedNumber}</code>\n` +
        `🔢 <b>Pairing Link:</b> <a href="https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=otp${pairingObj.code}">Click here to pair</a>\n\n` +
        `▸ Or use code manually in WhatsApp > Linked Devices\n\n` +
        `⚠️ <i>Code expires in 5 minutes</i>`
      );

      // Set Expiry Notification
      const expiryTimer = setTimeout(async () => {
        try {
          await ctx.reply(
            '⌛ The pairing code has expired. Generate a new one with /pair if needed.',
            { reply_to_message_id: message.message_id }
          );
          
          // Clear the timer from session after expiry
          if (ctx.session?.pairingTimers) {
            ctx.session.pairingTimers = ctx.session.pairingTimers.filter(t => t !== expiryTimer);
          }
        } catch (err) {
          console.error('Error sending expiry message:', err);
        }
      }, 5 * 60 * 1000);

      // Initialize session if it doesn't exist
      if (!ctx.session) {
        ctx.session = {};
      }
      if (!ctx.session.pairingTimers) {
        ctx.session.pairingTimers = [];
      }
      ctx.session.pairingTimers.push(expiryTimer);

      // Add listener for connection success
      const onConnected = async () => {
        try {
          // Clear the expiry timer since connection was successful
          clearTimeout(expiryTimer);
          
          // Remove timer from session
          if (ctx.session?.pairingTimers) {
            ctx.session.pairingTimers = ctx.session.pairingTimers.filter(t => t !== expiryTimer);
          }

          await ctx.replyWithHTML(
            `📱 <b>WhatsApp Connected Successfully!</b>\n\n` +
            `✅ <b>Number:</b> <code>${formattedNumber}</code>\n` +
            `🔗 <b>Status:</b> Online and ready to use\n\n` +
            `You can now use the bot features with this number.`
          );
          
          // Remove this listener to avoid duplicate messages
          bot.removeListener('connection_success', onConnected);
        } catch (err) {
          console.error('Error sending connection success message:', err);
        }
      };

      // Listen for connection success event
      bot.on('connection_success', onConnected);

    } catch (error) {
      console.error('Error in pairing process:', error);
      
      // Clear any existing timers on error
      if (ctx.session?.pairingTimers) {
        ctx.session.pairingTimers.forEach(timer => clearTimeout(timer));
        ctx.session.pairingTimers = [];
      }

      await ctx.reply(
        '❌ Failed to complete pairing process. Please try again.\n' +
        'If the problem persists, contact @Vortex_Shadow2563'
      );
    }
  } catch (error) {
    console.error('Error in /pair command:', error);
    await ctx.reply(
      '❌ An unexpected error occurred. Please try again later.'
    );
  }
});

bot.command('listpair', async (ctx) => {
  const userID = ctx.from.id.toString();

  if (!adminIDs.includes(userID)) {
    return ctx.reply(`❌ You are not authorized to use this command.\nOnly ${OWNER_NAME} can access this.`);
  }

  const pairingPath = './lib2/pairing';
  if (!fs.existsSync(pairingPath)) return ctx.reply('⚠️ No paired devices found.');

  const entries = fs.readdirSync(pairingPath, { withFileTypes: true });
  const pairedDevices = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);

  if (pairedDevices.length === 0) return ctx.reply('⚠️ No paired devices found.');

  pagedListPairs[userID] = pairedDevices;
  sendListPairPage(ctx, userID, 0);
});

bot.command('delpair', async (ctx) => {
  try {
    // 1. Input Validation
    const text = ctx.message.text.trim();
    const args = text.split(' ').slice(1);

    if (args.length === 0) {
      return ctx.reply(
        '❌ *Usage:* `/delpair [country_code][number]`\n\n' +
        'Examples:\n' +
        '• `/delpair 14151234567` (US/Canada)\n' +
        '• `/delpair 447812345678` (UK)\n' +
        '• `/delpair 918123456789` (India)',
        { parse_mode: 'Markdown' }
      );
    }

    // 2. Number Formatting and Validation
    const inputNumber = args[0].replace(/\D/g, '');
    
    if (!/^[1-9]\d{4,14}$/.test(inputNumber)) {
      return ctx.reply(
        '❌ *Invalid International Number Format*\n\n' +
        'Must be 5-15 digits starting with country code\n' +
        'Examples:\n' +
        '• US/Canada: `14151234567`\n' +
        '• UK: `447812345678`\n' +
        '• India: `918123456789`',
        { parse_mode: 'Markdown' }
      );
    }

    const jidSuffix = `${inputNumber}@s.whatsapp.net`;
    const pairingPath = './lib2/pairing';

    // 3. Directory Check
    if (!fs.existsSync(pairingPath)) {
      return ctx.reply('⚠️ No paired devices directory found.');
    }

    // 4. Find Matching Device
    const entries = fs.readdirSync(pairingPath, { withFileTypes: true });
    const matched = entries.find(entry => 
      entry.isDirectory() && entry.name.endsWith(jidSuffix)
    );

    if (!matched) {
      return ctx.reply(
        `❌ No paired device found for:\n\`${formatInternationalNumber(inputNumber)}\``,
        { parse_mode: 'Markdown' }
      );
    }

    // 5. Deletion Process
    const targetPath = path.join(pairingPath, matched.name);
    
    // Additional safety check before deletion
    if (!fs.existsSync(targetPath)) {
      return ctx.reply('⚠️ Device directory not found - may have been already deleted');
    }

    fs.rmSync(targetPath, { recursive: true, force: true });

    // 6. Success Response
    await ctx.reply(
      `✅ *Successfully unpaired:*\n\n` +
      `• *Number:* \`${formatInternationalNumber(inputNumber)}\`\n` +
      `• *WhatsApp ID:* \`${matched.name}\``,
      { parse_mode: 'Markdown' }
    );

    // 7. Log the action
    console.log(`User ${ctx.from.id} unpaired: ${matched.name}`);

  } catch (error) {
    console.error('Error in delpair command:', error);
    await ctx.reply(
      '❌ Failed to complete unpairing process.\n' +
      'Please try again or contact support.'
    );
  }
});

bot.on('callback_query', async (ctx) => {
  try {
    const userID = ctx.from.id.toString();
    const data = ctx.callbackQuery.data;

    // 1. Authorization Check
    if (!adminIDs.includes(userID)) {
      return ctx.answerCbQuery('⛔ Unauthorized access', { show_alert: true });
    }

    // 2. Handle Pagination Requests
    if (data.startsWith('listpair_page_') || data.startsWith('delpair_page_')) {
      const page = parseInt(data.split('_')[2]);
      await ctx.answerCbQuery(); // Acknowledge callback
      
      // Validate page number
      if (isNaN(page) || page < 0) {
        return ctx.answerCbQuery('⚠️ Invalid page number', { show_alert: true });
      }

      return data.startsWith('listpair_page_') 
        ? sendListPairPage(ctx, userID, page)
        : sendDelPairPage(ctx, userID, page);
    }

    // 3. Handle Delete Actions
    if (data.startsWith('delpair_')) {
      const idToDelete = data.replace('delpair_', '');
      const targetPath = path.join('./lib2/pairing', idToDelete);

      // Validation checks
      if (!idToDelete || !idToDelete.endsWith('@s.whatsapp.net')) {
        return ctx.answerCbQuery('❌ Invalid ID format', { show_alert: true });
      }

      if (!fs.existsSync(targetPath)) {
        return ctx.answerCbQuery('❌ Session not found', { show_alert: true });
      }

      // Perform deletion
      fs.rmSync(targetPath, { recursive: true, force: true });

      // Update cached list
      if (pagedListPairs[userID]) {
        pagedListPairs[userID] = pagedListPairs[userID].filter(id => id !== idToDelete);
      }

      await ctx.answerCbQuery('✅ Successfully deleted', { show_alert: true });
      return sendDelPairPage(ctx, userID, 0); // Refresh to page 0
    }

    // 4. Unknown callback
    await ctx.answerCbQuery('⚠️ Unknown action', { show_alert: true });

  } catch (error) {
    console.error('Callback handler error:', error);
    
    try {
      await ctx.answerCbQuery('❌ System error occurred', { show_alert: true });
    } catch (e) {
      console.error('Failed to send error response:', e);
    }
  }
});

bot.command('broadcast', async (ctx) => {
  const senderId = ctx.from.id;
  const message = ctx.message.text.split(' ').slice(1).join(' ');

  if (!adminIDs.includes(senderId.toString())) {
    return ctx.reply('❌ You are not authorized to use this command.');
  }

  if (!message) {
    return ctx.reply('⚠️ Please provide a message to broadcast.\nUsage: /broadcast Hello users!');
  }

  const users = JSON.parse(fs.readFileSync('./lib2/pairing/users.json'));

  let success = 0;
  let failed = 0;

  for (const userId of users) {
    try {
      await ctx.telegram.sendMessage(userId, `*Broadcast Message:*\n\n${message}`, {
        parse_mode: 'Markdown'
      });
      success++;
    } catch {
      failed++;
    }
  }

  ctx.reply(`✅ Broadcast complete.\n\nSuccess: ${success}\nFailed: ${failed}`);
});

bot.command('addprem', async (ctx) => {
  if (!adminIDs.includes(ctx.from.id.toString())) {
    return ctx.reply(`❌ You are not authorized to use this command.\nContact ${OWNER_NAME} for premium access.`);
  }

  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply("⚠️ Please provide the user ID to add as a premium user.\n\nUsage: `/addprem <user_id>`", {
      parse_mode: "Markdown"
    });
  }

  const userID = args[1];
  if (premiumUsers.includes(userID)) {
    return ctx.reply("⚠️ This user is already a premium user.");
  }

  try {
    premiumUsers.push(userID);
    fs.writeFileSync(premium_file, JSON.stringify(premiumUsers, null, 2));
    ctx.reply(`✅ User *${userID}* has been added as a premium user.`, { parse_mode: "Markdown" });
  } catch (error) {
    console.error('Error adding premium user:', error);
    ctx.reply('❌ Error adding user as premium.');
  }
});

bot.command('delprem', async (ctx) => {
  if (!adminIDs.includes(ctx.from.id.toString())) {
    return ctx.reply(`❌ You are not authorized to use this command.\nContact ${OWNER_NAME} for support.`);
  }

  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply("⚠️ Please provide the user ID to remove.\n\nUsage: `/delprem <user_id>`", {
      parse_mode: "Markdown"
    });
  }

  const userID = args[1];
  if (!premiumUsers.includes(userID)) {
    return ctx.reply("⚠️ This user is not in the premium list.");
  }

  try {
    premiumUsers = premiumUsers.filter((id) => id !== userID);
    fs.writeFileSync(premium_file, JSON.stringify(premiumUsers, null, 2));
    ctx.reply(`✅ User *${userID}* has been removed from premium users.`, { parse_mode: "Markdown" });
  } catch (error) {
    console.error('Error removing premium user:', error);
    ctx.reply('❌ Error removing user from premium list.');
  }
});

bot.command('ban', async (ctx) => {
  const senderId = ctx.from.id;
  const reply = ctx.message.reply_to_message;
  const args = ctx.message.text.split(' ');
  const targetId = reply?.from?.id || args[1];

  if (senderId.toString() !== OWNER_ID) {
    return ctx.reply('❌ You are not authorized to use this command.');
  }

  if (!targetId || isNaN(targetId)) {
    return ctx.reply('⚠️ Please reply to a user or provide a valid user ID.');
  }

  const banned = JSON.parse(fs.readFileSync(bannedPath, 'utf-8'));

  if (banned.includes(Number(targetId))) {
    return ctx.reply('⚠️ User is already banned.');
  }

  banned.push(Number(targetId));
  fs.writeFileSync(bannedPath, JSON.stringify(banned, null, 2));

  return ctx.reply(`✅ User \`${targetId}\` has been banned from pairing.`, {
    parse_mode: 'Markdown'
  });
});

bot.command('unban', async (ctx) => {
  const senderId = ctx.from.id;
  const targetId = ctx.message.reply_to_message?.from?.id || ctx.message.text.split(' ')[1];

  if (senderId.toString() !== OWNER_ID) return ctx.reply('❌ You are not authorized to use this command.');

  if (!targetId) return ctx.reply('⚠️ Please reply to a user or provide their ID to unban.');

  let banned = JSON.parse(fs.readFileSync(bannedPath));
  if (!banned.includes(Number(targetId))) return ctx.reply('User is not banned.');

  banned = banned.filter(id => id !== Number(targetId));
  fs.writeFileSync(bannedPath, JSON.stringify(banned, null, 2));
  ctx.reply(`✅ User ${targetId} has been unbanned.`);
});

bot.command('script', (ctx) => { 
  ctx.reply("The script to this bot will never be available. Click the link below to use it:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Telegram', url: "https://t.me/Oblivion_bugbot" }]
      ]
    }
  });
});

bot.launch()
  .then(() => console.log('Oblivion Telegram Bot Is Running'))
  .catch(err => console.error('Error while running bot:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;