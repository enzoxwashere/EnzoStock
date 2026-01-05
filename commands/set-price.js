const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
        .setName('set-price')
        .setDescription('تغيير سعر فئة (للمالك فقط)')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('معرف الفئة')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('price')
                .setDescription('السعر الجديد')
                .setRequired(true)),

    async execute(interaction) {
        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({ content: '❌ هذا الأمر للمالك فقط!', ephemeral: true });
        }

        const categoryId = interaction.options.getString('category');
        const newPrice = interaction.options.getInteger('price');

        const db = loadDatabase();

        if (!db.categories[categoryId]) {
            return interaction.reply({ content: '❌ هذه الفئة غير موجودة!', ephemeral: true });
        }

        const oldPrice = db.categories[categoryId].price;
        db.categories[categoryId].price = newPrice;

        saveDatabase(db);
        global.db = db;

        const category = db.categories[categoryId];
        const emoji = category.emojiDisplay || category.emoji;

        const embed = new EmbedBuilder()
            .setTitle('✅ تم تحديث السعر')
            .setDescription(
                `${emoji} **${category.name}**\n\n` +
                `السعر القديم: ~~${oldPrice}~~\n` +
                `السعر الجديد: **${newPrice}** ${config.creditEmoji}`
            )
            .setColor('#57F287');

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
