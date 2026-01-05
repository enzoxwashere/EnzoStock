const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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
        .setName('add-product')
        .setDescription('إضافة منتج (للمالك فقط)'),

    async execute(interaction) {
        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({ content: '❌ هذا الأمر للمالك فقط!', ephemeral: true });
        }

        const db = loadDatabase();

        if (!db.categories || Object.keys(db.categories).length === 0) {
            return interaction.reply({ content: '❌ لا توجد فئات! أضف فئة أولاً.', ephemeral: true });
        }

        const options = [];
        for (const [id, category] of Object.entries(db.categories)) {
            const count = db.products[id]?.length || 0;
            options.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(category.name)
                    .setDescription(`المتوفر: ${count}`)
                    .setValue(id)
                    .setEmoji(category.emoji)
            );
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('add_product_select')
            .setPlaceholder('اختر الفئة')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);

        const embed = new EmbedBuilder()
            .setTitle('➕ إضافة منتج')
            .setDescription('اختر الفئة من القائمة')
            .setColor('#5865F2');

        try {
            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        } catch (e) {
            console.log('[ADD-PRODUCT] Reply failed:', e.message);
        }
    }
};

// معالج Modal منفصل في index.js
