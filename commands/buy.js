const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');

function loadDatabase() {
    const dbPath = path.join(__dirname, '..', 'database.json');
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveDatabase(db) {
    const dbPath = path.join(__dirname, '..', 'database.json');
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('شراء منتج'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
        } catch (e) {
            console.log('[BUY] Defer failed:', e.message);
            return;
        }

        // تحقق إذا عنده عملية شراء جارية
        const hasActivePurchase = [...global.pendingPurchases.keys()].some(key => key.startsWith(interaction.user.id + '_'));
        if (hasActivePurchase) {
            return interaction.editReply({ content: '⏳ لديك عملية شراء جارية! انتظر حتى تنتهي.' });
        }

        if (!global.shopOpen) {
            return interaction.editReply({ content: '❌ المتجر مغلق حالياً' });
        }

        const db = loadDatabase();

        const options = [];
        for (const [id, category] of Object.entries(db.categories)) {
            const count = db.products[id]?.length || 0;
            if (count > 0) {
                options.push(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(category.name)
                        .setDescription(`السعر: ${category.price} كريديت - متوفر: ${count}`)
                        .setValue(id)
                        .setEmoji(category.emoji)
                );
            }
        }

        if (options.length === 0) {
            return interaction.editReply({ content: '❌ لا يوجد منتجات في الوقت الحالي' });
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('buy_select')
            .setPlaceholder('اختر المنتج')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);

        const embed = new EmbedBuilder()
            .setTitle('🛒 اختر المنتج')
            .setColor(config.colors.primary);

        await interaction.editReply({ embeds: [embed], components: [row] });

        const selectCollector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.customId === 'buy_select',
            time: config.timeouts.selection,
            max: 1
        });

        selectCollector.on('collect', async selectInteraction => {
            const categoryId = selectInteraction.values[0];
            const lockKey = `${interaction.user.id}_${categoryId}`;

            // تحقق من القفل
            if (global.pendingPurchases.has(lockKey)) {
                return selectInteraction.reply({ content: '⏳ لديك عملية شراء جارية! انتظر حتى تنتهي.', ephemeral: true });
            }

            // قفل العملية
            global.pendingPurchases.set(lockKey, Date.now());

            const currentDb = loadDatabase();
            const category = currentDb.categories[categoryId];

            if (!currentDb.products[categoryId] || currentDb.products[categoryId].length === 0) {
                global.pendingPurchases.delete(lockKey);
                return selectInteraction.reply({ content: '❌ نفذ المخزون!', ephemeral: true });
            }

            const price = category.price;
            const priceWithTax = Math.floor(price * (20 / 19) + 1);
            const emoji = category.emojiDisplay || category.emoji;

            const payEmbed = new EmbedBuilder()
                .setTitle('💳 إتمام الشراء')
                .setDescription(
                    `**${category.name}**\n\n` +
                    `💰 **السعر:** \`${price}\` ${config.creditEmoji}\n\n` +
                    `📋 **قم بتحويل:**\n` +
                    `\`\`\`\n#credit <@${config.recipient}> ${priceWithTax}\n\`\`\`\n` +
                    `⏱️ الوقت: دقيقتين`
                )
                .setColor(config.colors.warning)
                .setFooter({ text: '⚠️ الرجاء التأكد من ان الخاص مفتوح • سيتم إرسال المنتج تلقائياً بعد التحويل' });

            await selectInteraction.reply({ embeds: [payEmbed] });

            console.log(`\n[BUY] New purchase`);
            console.log(`[BUY] Buyer: ${interaction.user.username} (${interaction.user.id})`);
            console.log(`[BUY] Product: ${category.name}`);
            console.log(`[BUY] Base price: ${price} credits`);
            console.log(`[BUY] Recipient: ${config.recipient}`);
            console.log(`[BUY] ProBot ID: ${config.probotId}`);
            console.log(`[BUY] Waiting for payment...\n`);

            const debugListener = (m) => {
                if (m.channel.id === interaction.channel.id) {
                    console.log(`\n[DEBUG] New message:`);
                    console.log(`  Sender: ${m.author.tag} (${m.author.id})`);
                    console.log(`  Content: ${m.content}`);
                    console.log(`  Is Bot: ${m.author.bot}`);
                    if (m.mentions.users.size > 0) {
                        console.log(`  Mentions: ${m.mentions.users.map(u => u.tag).join(', ')}`);
                    }
                }
            };

            interaction.client.on('messageCreate', debugListener);

            setTimeout(() => {
                interaction.client.off('messageCreate', debugListener);
            }, config.timeouts.payment);

            const filter = (m) => {
                if (m.author.id !== config.probotId) {
                    return false;
                }

                const buyerUsername = interaction.user.username.toLowerCase().replace(/[.,\s]/g, '');
                const messageContent = m.content.toLowerCase().replace(/[.,\s]/g, '');

                const mentionsBuyer = messageContent.includes(buyerUsername);
                const mentionsRecipient = m.mentions.users.has(config.recipient) ||
                    m.content.includes(config.recipient);

                if (!mentionsBuyer || !mentionsRecipient) {
                    console.log(`[FILTER] ProBot message but buyer/recipient not found`);
                    return false;
                }

                let transferredAmount = 0;

                const patterns = [
                    /transferred\s+[`']?\$?(\d+)[`']?/i,
                    /حول\s+[`']?\$?(\d+)[`']?/i,
                    /[`']\$(\d+)[`']/,
                    /Amount\s*:\s*[`']?\$?(\d+)[`']?/i
                ];

                for (const pattern of patterns) {
                    const match = m.content.match(pattern);
                    if (match) {
                        transferredAmount = parseInt(match[1]);
                        break;
                    }
                }

                const amountMatches = transferredAmount === price;

                console.log(`\n[FILTER] ProBot message:`);
                console.log(`  ✅ From ProBot: Yes`);
                console.log(`  ✅ Mentions buyer (${buyerUsername}): ${mentionsBuyer ? 'Yes' : 'No'}`);
                console.log(`  ✅ Mentions recipient: ${mentionsRecipient ? 'Yes' : 'No'}`);
                console.log(`  💰 Transferred amount: ${transferredAmount} credits`);
                console.log(`  💰 Base price: ${price} credits`);
                console.log(`  ${amountMatches ? '✅' : '❌'} Amount ${amountMatches ? 'correct' : 'incorrect'} (needed: ${price})`);

                if (!amountMatches && transferredAmount > 0) {
                    console.log(`  ⚠️ Wrong amount! Rejected\n`);
                    selectInteraction.followUp({
                        content: `❌ المبلغ المحول (${transferredAmount}) لا يطابق السعر (${price})!`,
                        ephemeral: true
                    }).catch(() => { });
                }

                return amountMatches;
            };

            const msgCollector = interaction.channel.createMessageCollector({
                filter,
                time: config.timeouts.payment,
                max: 1
            });

            msgCollector.on('collect', async (probotMsg) => {
                console.log(`\n[BUY] ✅ Payment confirmed!`);
                console.log(`[BUY] ProBot message: ${probotMsg.content}\n`);

                const finalDb = loadDatabase();
                const products = finalDb.products[categoryId];

                if (!products || products.length === 0) {
                    console.log(`[BUY] ❌ Out of stock after payment!`);
                    return selectInteraction.followUp({
                        content: '❌ نفذ المخزون! سيتم إرجاع المبلغ يدوياً.',
                        ephemeral: true
                    });
                }

                const randomIndex = Math.floor(Math.random() * products.length);
                const product = products[randomIndex];

                products.splice(randomIndex, 1);
                saveDatabase(finalDb);
                global.db = finalDb;

                console.log(`[BUY] 📦 Product Removed from stock`);
                console.log(`[BUY] Remaining: ${products.length}`);

                const successEmbed = new EmbedBuilder()
                    .setAuthor({ name: config.shopName, iconURL: interaction.client.user.displayAvatarURL() })
                    .setTitle('✅ تمت عملية الشراء!')
                    .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
                    .setDescription(
                        `**📦 المنتج :** \`${category.name}\`\n` +
                        `**💰 السعر :** \`${price}\` ${config.creditEmoji}\n\n` +
                        `**🔑 البيانات :**\n\`\`\`\n${product}\n\`\`\`\n` +
                        `الرجاء تقييمنا في <#${config.feedbackChannel}>`
                    )
                    .setColor(config.colors.success)
                    .setFooter({ text: config.shopName, iconURL: interaction.client.user.displayAvatarURL() })
                    .setTimestamp();

                const channelEmbed = new EmbedBuilder()
                    .setTitle('تم إرسال المنتج في الخاص!')
                    .setColor(config.colors.success);

                try {
                    await interaction.user.send({ embeds: [successEmbed] });
                    await selectInteraction.followUp({ embeds: [channelEmbed] });
                    console.log(`[BUY] ✅ Product sent successfully`);
                    console.log(`[BUY] ━━━━━━━━━━━━━━━━━━━━\n`);
                } catch (error) {
                    products.push(product);
                    saveDatabase(finalDb);
                    await selectInteraction.followUp({
                        content: '❌ افتح خاصك!',
                        ephemeral: true
                    });
                    console.log(`[BUY] ❌ DM failed - product returned`);
                }

                // إزالة القفل
                global.pendingPurchases.delete(lockKey);
            });

            msgCollector.on('end', collected => {
                // إزالة القفل عند انتهاء الوقت
                global.pendingPurchases.delete(lockKey);

                if (collected.size === 0) {
                    selectInteraction.followUp({
                        content: '⏱️ انتهى الوقت!',
                        ephemeral: true
                    }).catch(() => { });
                    console.log(`[BUY] ⏱️ Timeout without payment\n`);
                }
            });
        });
    }
};
