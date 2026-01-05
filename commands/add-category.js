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
        .setName('add-category')
        .setDescription('إضافة فئة منتج جديدة (للمالك فقط)')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('معرف الفئة بالإنجليزي')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('اسم الفئة')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('إيموجي الفئة')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('price')
                .setDescription('السعر الافتراضي')
                .setRequired(true)),

    async execute(interaction) {
        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({ content: '❌ هذا الأمر للمالك فقط!', ephemeral: true });
        }

        const id = interaction.options.getString('id').toLowerCase();
        const name = interaction.options.getString('name');
        const emoji = interaction.options.getString('emoji');
        const price = interaction.options.getInteger('price');

        const db = loadDatabase();

        if (db.categories[id]) {
            return interaction.reply({ content: '❌ هذه الفئة موجودة مسبقاً!', ephemeral: true });
        }

        db.categories[id] = {
            emoji: emoji,
            emojiDisplay: emoji,
            name: name,
            price: price
        };

        db.products[id] = [];

        saveDatabase(db);
        global.db = db;

        const embed = new EmbedBuilder()
            .setTitle('✅ تمت إضافة الفئة')
            .setDescription(
                `**المعرف:** \`${id}\`\n` +
                `**الاسم:** ${name}\n` +
                `**الإيموجي:** ${emoji}\n` +
                `**السعر:** ${price} كريديت`
            )
            .setColor('#57F287');

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
