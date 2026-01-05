const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

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
        .setName('delete-category')
        .setDescription('حذف فئة منتج (للمالك فقط)')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('معرف الفئة')
                .setRequired(true)),

    async execute(interaction) {
        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({ content: '❌ هذا الأمر للمالك فقط!', ephemeral: true });
        }

        const categoryId = interaction.options.getString('id');

        const db = loadDatabase();

        if (!db.categories[categoryId]) {
            return interaction.reply({ content: '❌ هذه الفئة غير موجودة!', ephemeral: true });
        }

        const category = db.categories[categoryId];
        const productCount = db.products[categoryId]?.length || 0;

        delete db.categories[categoryId];
        delete db.products[categoryId];

        saveDatabase(db);
        global.db = db;

        const embed = new EmbedBuilder()
            .setTitle('✅ تم الحذف')
            .setDescription(
                `تم حذف فئة **${category.name}** ${category.emojiDisplay || category.emoji}\n` +
                `عدد المنتجات المحذوفة: ${productCount}`
            )
            .setColor('#57F287');

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
