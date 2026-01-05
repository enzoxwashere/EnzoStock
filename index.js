require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Database
const dbPath = path.join(__dirname, 'database.json');
const config = require('./config.json');

function loadDatabase() {
    if (!fs.existsSync(dbPath)) {
        const defaultDb = { categories: {}, products: {} };
        fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
        return defaultDb;
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveDatabase(db) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

global.db = loadDatabase();
global.shopOpen = true;

// نظام قفل لمنع البيع المتزامن
global.purchaseLocks = new Map(); // categoryId -> Set of userIds
global.pendingPurchases = new Map(); // `userId_categoryId` -> timestamp

// Load Slash Commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        client.commands.set(command.data.name, command);
        console.log(`✅ ${command.data.name}`);
    }
}

// Ready
client.once('ready', () => {
    console.log(`🟢 ${client.user.tag} Online!`);
    client.user.setActivity('Enzo Stock');
});

// Slash Commands Handler
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: '❌ خطأ!', ephemeral: true }).catch(() => { });
            } else {
                await interaction.reply({ content: '❌ خطأ!', ephemeral: true }).catch(() => { });
            }
        }
    }

    // Add Product Select Menu
    if (interaction.isStringSelectMenu() && interaction.customId === 'add_product_select') {
        const db = loadDatabase();
        const categoryId = interaction.values[0];
        const category = db.categories[categoryId];

        const modal = new ModalBuilder()
            .setCustomId(`add_product_modal_${categoryId}`)
            .setTitle(`إضافة منتج - ${category.name}`);

        const input = new TextInputBuilder()
            .setCustomId('product_data')
            .setLabel('بيانات المنتج (كل سطر = منتج)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('account1@email.com:pass123\naccount2@email.com:pass456\naccount3@email.com:pass789')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    // Add Product Modal Submit
    if (interaction.isModalSubmit() && interaction.customId.startsWith('add_product_modal_')) {
        const categoryId = interaction.customId.replace('add_product_modal_', '');
        const productData = interaction.fields.getTextInputValue('product_data');
        const db = loadDatabase();

        if (!db.products[categoryId]) db.products[categoryId] = [];

        // كل سطر = منتج منفصل
        const products = productData.split('\n').map(p => p.trim()).filter(p => p.length > 0);
        products.forEach(p => db.products[categoryId].push(p));
        saveDatabase(db);

        const category = db.categories[categoryId];
        const embed = new EmbedBuilder()
            .setTitle('✅ تمت الإضافة')
            .setDescription(
                `**${category.name}**\n\n` +
                `تمت إضافة: **${products.length}** منتج\n` +
                `العدد الإجمالي: **${db.products[categoryId].length}**\n` +
                `السعر: **${category.price}** ${config.creditEmoji}`
            )
            .setColor('#57F287');

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

// ============ PREFIX COMMANDS ($) ============
client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith('$')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    const db = loadDatabase();
    const isOwner = message.author.id === process.env.OWNER_ID;

    // ======= $stock =======
    if (cmd === 'stock') {
        const categories = Object.entries(db.categories);

        let description = '';
        if (categories.length === 0) {
            description = '```\n❌ لا توجد منتجات حالياً\n```';
        } else {
            description = categories.map(([id, cat]) => {
                const count = db.products[id]?.length || 0;
                return `**${cat.name}**\nالسعر : \`${cat.price}\` ${config.creditEmoji}\nالكمية : \`${count}\`\nللشراء اكتب: \`$buy\``;
            }).join('\n\n━━━━━━━━━━━━━━━\n\n');
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: config.shopName, iconURL: message.client.user.displayAvatarURL() })
            .setTitle('المتجر')
            .setDescription(description)
            .setColor('#5865F2')
            .setThumbnail(message.client.user.displayAvatarURL({ size: 256 }))
            .setFooter({ text: config.shopName })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }

    // ======= $buy =======
    else if (cmd === 'buy') {
        // تحقق إذا عنده عملية شراء جارية
        const hasActivePurchase = [...global.pendingPurchases.keys()].some(key => key.startsWith(message.author.id + '_'));
        if (hasActivePurchase) {
            return message.reply('⏳ لديك عملية شراء جارية! انتظر حتى تنتهي.');
        }

        const options = [];
        for (const [id, category] of Object.entries(db.categories)) {
            const count = db.products[id]?.length || 0;
            if (count > 0) {
                options.push(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(category.name)
                        .setDescription(`السعر: ${category.price} - متوفر: ${count}`)
                        .setValue(id)
                        .setEmoji(category.emoji)
                );
            }
        }

        if (options.length === 0) {
            return message.reply('❌ لا يوجد منتجات في الوقت الحالي');
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('prefix_buy_select')
            .setPlaceholder('اختر المنتج')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);
        const embed = new EmbedBuilder().setTitle('🛒 اختر المنتج').setColor('#5865F2');
        const msg = await message.reply({ embeds: [embed], components: [row] });

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id && i.customId === 'prefix_buy_select',
            time: 60000,
            max: 1
        });

        collector.on('collect', async selectInteraction => {
            const categoryId = selectInteraction.values[0];
            const lockKey = `${message.author.id}_${categoryId}`;

            // تحقق من القفل - منع السبام
            if (global.pendingPurchases.has(lockKey)) {
                return selectInteraction.reply({ content: '⏳ لديك عملية شراء جارية! انتظر حتى تنتهي.' });
            }

            // قفل العملية
            global.pendingPurchases.set(lockKey, Date.now());

            const currentDb = loadDatabase();
            const category = currentDb.categories[categoryId];

            if (!currentDb.products[categoryId] || currentDb.products[categoryId].length === 0) {
                global.pendingPurchases.delete(lockKey);
                return selectInteraction.reply({ content: '❌ نفذ المخزون!' });
            }

            const price = category.price;
            const priceWithTax = Math.floor(price * (20 / 19) + 1);

            const payEmbed = new EmbedBuilder()
                .setTitle('💳 إتمام الشراء')
                .setDescription(
                    `**${category.name}**\n\n` +
                    `💰 **السعر:** \`${price}\` ${config.creditEmoji}\n\n` +
                    `📋 **قم بتحويل:**\n\`\`\`\n#credit <@${config.recipient}> ${priceWithTax}\n\`\`\`\n` +
                    `⏱️ الوقت: دقيقتين`
                )
                .setColor('#FEE75C')
                .setFooter({ text: '⚠️ تأكد من أن الخاص مفتوح' });

            await selectInteraction.reply({ embeds: [payEmbed] });

            console.log(`\n[BUY] Buyer: ${message.author.username} | Product: ${category.name} | Price: ${price}`);

            const filter = (m) => {
                if (m.author.id !== config.probotId) return false;
                const buyerUsername = message.author.username.toLowerCase().replace(/[.,\s]/g, '');
                const messageContent = m.content.toLowerCase().replace(/[.,\s]/g, '');
                const mentionsBuyer = messageContent.includes(buyerUsername);
                const mentionsRecipient = m.mentions.users.has(config.recipient) || m.content.includes(config.recipient);
                if (!mentionsBuyer || !mentionsRecipient) return false;
                const match = m.content.match(/transferred\s+[`']?\$?(\d+)/i) || m.content.match(/[`']\$(\d+)/);
                return match && parseInt(match[1]) === price;
            };

            const msgCollector = message.channel.createMessageCollector({ filter, time: 120000, max: 1 });

            msgCollector.on('collect', async () => {
                const finalDb = loadDatabase();
                const products = finalDb.products[categoryId];

                if (!products || products.length === 0) {
                    return message.channel.send('❌ نفذ المخزون!');
                }

                const randomIndex = Math.floor(Math.random() * products.length);
                const product = products[randomIndex];
                products.splice(randomIndex, 1);
                saveDatabase(finalDb);

                const successEmbed = new EmbedBuilder()
                    .setAuthor({ name: config.shopName, iconURL: message.client.user.displayAvatarURL() })
                    .setTitle('✅ تمت عملية الشراء!')
                    .setThumbnail(message.client.user.displayAvatarURL({ size: 256 }))
                    .setDescription(
                        `**📦 المنتج :** \`${category.name}\`\n` +
                        `**💰 السعر :** \`${price}\` ${config.creditEmoji}\n\n` +
                        `**🔑 البيانات :**\n\`\`\`\n${product}\n\`\`\`\n` +
                        `الرجاء تقييمنا في <#${config.feedbackChannel}>`
                    )
                    .setColor('#57F287')
                    .setFooter({ text: config.shopName, iconURL: message.client.user.displayAvatarURL() })
                    .setTimestamp();

                const channelEmbed = new EmbedBuilder()
                    .setTitle('تم إرسال المنتج في الخاص!')
                    .setColor('#57F287');

                try {
                    await message.author.send({ embeds: [successEmbed] });
                    await message.channel.send({ embeds: [channelEmbed] });
                    console.log(`[BUY] ✅ Success - ${message.author.username}`);
                } catch {
                    products.push(product);
                    saveDatabase(finalDb);
                    message.channel.send('❌ افتح خاصك!');
                }

                // إزالة القفل
                global.pendingPurchases.delete(lockKey);
            });

            msgCollector.on('end', collected => {
                // إزالة القفل
                global.pendingPurchases.delete(lockKey);

                if (collected.size === 0) message.channel.send('⏱️ انتهى الوقت!');
            });
        });
    }

    // ======= $add-category =======
    else if (cmd === 'add-category' && isOwner) {
        if (args.length < 4) return message.reply('❌ `$add-category <id> <name> <emoji> <price>`');
        const [id, name, emoji, price] = args;
        if (db.categories[id]) return message.reply('❌ موجود!');
        db.categories[id] = { emoji, emojiDisplay: emoji, name, price: parseInt(price) };
        db.products[id] = [];
        saveDatabase(db);
        message.reply(`✅ **${name}** ${emoji} - ${price} ${config.creditEmoji}`);
    }

    // ======= $delete-category =======
    else if (cmd === 'delete-category' && isOwner) {
        const id = args[0];
        if (!db.categories[id]) return message.reply('❌ غير موجود!');
        const cat = db.categories[id];
        delete db.categories[id];
        delete db.products[id];
        saveDatabase(db);
        message.reply(`✅ تم حذف **${cat.name}**`);
    }

    // ======= $set-price =======
    else if (cmd === 'set-price' && isOwner) {
        const [id, price] = args;
        if (!db.categories[id]) return message.reply('❌ غير موجود!');
        const old = db.categories[id].price;
        db.categories[id].price = parseInt(price);
        saveDatabase(db);
        message.reply(`✅ ${db.categories[id].emoji} ~~${old}~~ → **${price}** ${config.creditEmoji}`);
    }

    // ======= $add-product =======
    else if (cmd === 'add-product' && isOwner) {
        const id = args[0];
        const product = args.slice(1).join(' ');
        if (!id || !product) return message.reply('❌ `$add-product <id> <product>`');
        if (!db.categories[id]) return message.reply('❌ الفئة غير موجودة!');
        if (!db.products[id]) db.products[id] = [];
        db.products[id].push(product);
        saveDatabase(db);
        message.reply(`✅ ${db.categories[id].emoji} العدد: ${db.products[id].length}`);
    }

    // ======= $help =======
    else if (cmd === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('📋 الأوامر')
            .setDescription(
                '**للجميع:**\n' +
                '`$stock` - عرض المخزون\n' +
                '`$buy` - شراء منتج\n' +
                (isOwner ? '\n**للمالك:**\n' +
                    '`$add-category <id> <name> <emoji> <price>`\n' +
                    '`$delete-category <id>`\n' +
                    '`$set-price <id> <price>`\n' +
                    '`$add-product <id> <product>`' : '')
            )
            .setColor('#5865F2');
        message.reply({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN);
