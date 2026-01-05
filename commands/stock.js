const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');

function loadDatabase() {
    const dbPath = path.join(__dirname, '..', 'database.json');
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stock')
        .setDescription('عرض المخزون'),

    async execute(interaction) {
        const db = loadDatabase();
        const categories = Object.entries(db.categories);

        let description = '';
        if (categories.length === 0) {
            description = '```\n❌ لا توجد منتجات حالياً\n```';
        } else {
            description = categories.map(([id, cat]) => {
                const count = db.products[id]?.length || 0;
                return `**${cat.name}**\nالسعر : \`${cat.price}\` ${config.creditEmoji}\nالكمية : \`${count}\`\nللشراء اكتب: \`/buy\``;
            }).join('\n\n━━━━━━━━━━━━━━━\n\n');
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: config.shopName, iconURL: interaction.client.user.displayAvatarURL() })
            .setTitle('المتجر')
            .setDescription(description)
            .setColor('#5865F2')
            .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
            .setFooter({ text: config.shopName })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
