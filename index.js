const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// ============ CONFIGURATION ============
const CONFIG = {
    token: process.env.TOKEN,

    roles: {
        MODERATOR: '1497886259148750959',
        CLEAR_WARN_ROLE: '1497884756694798398',
        MUTE_ROLE: '1497884120603164772',
        DAWUUD_ROLE: '1494798337361186998',
        BREAK_ROLE: '1497882194142691398',

        RANK_ROLES: {
            '1497884692471349392': ['1494798337361186998', '1497883985198583899', '1497886259148750959'],
            '1497884833446363286': ['1494798337361186998', '1497883985198583899', '1497886259148750959', '1497884120603164772'],
            '1497884892351041698': ['1494798337361186998', '1497883985198583899', '1497886259148750959', '1497884120603164772', '1497884416964431932'],
            '1497884955034779668': ['1494798337361186998', '1497883985198583899', '1497886259148750959', '1497884120603164772', '1497884416964431932', '1497884627619283007', '1497884756694798398'],
            '1497885013675606033': ['1494798337361186998', '1497883985198583899', '1497886259148750959', '1497884120603164772', '1497884416964431932', '1497884627619283007', '1497884756694798398', '1497885013675606033'],
            '1463189207282356276': ['1494798337361186998', '1497883985198583899', '1497886259148750959', '1497884120603164772', '1497884416964431932', '1497884627619283007', '1497884756694798398', '1497885013675606033', '1463189207282356276']
        },

        ALL_RANK_ROLES: [
            '1494798337361186998',
            '1497883985198583899',
            '1497886259148750959',
            '1497884120603164772',
            '1497884416964431932',
            '1497884627619283007',
            '1497884756694798398',
            '1497885013675606033',
            '1463189207282356276',
            '1494798363437043712'
        ]
    },

    channels: {
        WARN_CONFIRM: '1497887584788025355',
        CLEAR_WARN_CONFIRM: '1497889821845360760',
        RANK_CONFIRM: '1497893616784375889',
        MUTE_LOGS: '1496865997074989096'
    },

    dawuud: {
        embedMessage: '# Welcome to Axz hitting community.

you’re probably thinking, **whats hitting?**
Hitting is a scam method used with middleman and a hitter.
**Whats a hitter?**
a hitter is a guy that works with the middleman to scam.
**Do i get my stuff back?**
No, but you can get 100x the stuff you lost.

# Tutorial will be sent in your dm’s after you click accept.
or decline and stay **poor**',
        dmMessage: 'Welcome, i see you clicked accept. 
That means you became a hitter.
**Whats my duty?** your probably asking. so what you do is.
• 1. Find a good trading server
• 2. Find a trader whos willing to trade with you.
• 3. Try manipulating him into using our server as middleman.
• 4. if he accepts, make him join server and after create a middleman ticket and wait for middleman arrival.
• 5. Middleman will help you hit him and split 50/50 with you.
• 6. Repeat all the time and you will eventually earn bands.

Go to https://discord.com/channels/1463178747766247508/1497897427632394370

to learn alt hitting, or you could hit normally with middleman.'
    }
};

// ============ DATA STORAGE ============
let warningsData = {};
let breakData = {};
let activeButtons = new Map();
let dawuudCooldowns = new Map();

function loadWarnings() {
    try {
        if (fs.existsSync('./warnings.json')) {
            warningsData = JSON.parse(fs.readFileSync('./warnings.json', 'utf8'));
        }
    } catch (err) {
        console.error('Error loading warnings:', err);
    }
}

function saveWarnings() {
    fs.writeFileSync('./warnings.json', JSON.stringify(warningsData, null, 2));
}

function loadBreakData() {
    try {
        if (fs.existsSync('./breakData.json')) {
            breakData = JSON.parse(fs.readFileSync('./breakData.json', 'utf8'));
        }
    } catch (err) {
        console.error('Error loading break data:', err);
    }
}

function saveBreakData() {
    fs.writeFileSync('./breakData.json', JSON.stringify(breakData, null, 2));
}

// ============ UTILITY FUNCTIONS ============

function createRedEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0xFF0000);
}

function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

function parseDuration(input) {
    const match = input.match(/^(\d+)([mh])$/i);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === 'm') {
        if (value < 1 || value > 60) return null;
        return value * 60 * 1000;
    }
    if (unit === 'h') {
        if (value !== 1) return null;
        return 60 * 60 * 1000;
    }
    return null;
}

function formatDuration(ms) {
    const minutes = Math.floor(ms / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
        return `${hours}h ${remainingMinutes > 0 ? remainingMinutes + 'm' : ''}`;
    }
    return `${minutes}m`;
}

function getHighestRankRole(member) {
    const rankRoles = Object.keys(CONFIG.roles.RANK_ROLES);
    for (let i = rankRoles.length - 1; i >= 0; i--) {
        if (member.roles.cache.has(rankRoles[i])) {
            return rankRoles[i];
        }
    }
    return null;
}

function canAssignRole(assignerRoleId, targetRoleId) {
    const rankRoles = Object.keys(CONFIG.roles.RANK_ROLES);
    const assignerIndex = rankRoles.indexOf(assignerRoleId);
    const targetIndex = rankRoles.indexOf(targetRoleId);

    if (assignerIndex !== -1 && targetIndex !== -1) {
        return targetIndex < assignerIndex;
    }

    if (assignerIndex !== -1 && targetIndex === -1) {
        return true;
    }

    return false;
}

async function hasDangerousPermissions(guild, roleId) {
    try {
        const role = await guild.roles.fetch(roleId);
        if (!role) return false;

        const dangerousPerms = [
            PermissionsBitField.Flags.Administrator,
            PermissionsBitField.Flags.ManageGuild,
            PermissionsBitField.Flags.ManageRoles,
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.KickMembers,
            PermissionsBitField.Flags.BanMembers,
            PermissionsBitField.Flags.MentionEveryone
        ];

        return dangerousPerms.some(perm => role.permissions.has(perm));
    } catch {
        return false;
    }
}

// ============ BOT READY ============
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    loadWarnings();
    loadBreakData();
});

// ============ MESSAGE COMMANDS ============
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('.')) return;

    const args = message.content.slice(1).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    // ==================== WARN COMMAND ====================
    if (command === 'warn') {
        if (!message.member.roles.cache.has(CONFIG.roles.MODERATOR)) {
            return message.reply({ embeds: [createRedEmbed('❌ Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 2) {
            return message.reply({ embeds: [createRedEmbed('❌ Invalid Usage', 'Usage: .warn @user (reason)')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('❌ User Not Found', 'Could not find that user.')] });
        }

        const reason = args.slice(1).join(' ');
        const confirmChannel = await client.channels.fetch(CONFIG.channels.WARN_CONFIRM);

        const embed = createRedEmbed('⚠️ Warn Confirmation', `**Target:** <@${targetUser.id}>\n**Reason:** ${reason}\n**Moderator:** <@${message.author.id}>`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`warn_confirm_${targetUser.id}_${message.author.id}_${Date.now()}`)
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`warn_decline_${targetUser.id}_${message.author.id}_${Date.now()}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Secondary)
        );

        await confirmChannel.send({ embeds: [embed], components: [row] });
        await message.reply({ embeds: [createRedEmbed('✅ Confirmation Sent', `A confirmation message has been sent to <#${CONFIG.channels.WARN_CONFIRM}>.`)] });
    }

    // ==================== WARNINGS COMMAND ====================
    if (command === 'warnings') {
        if (!message.member.roles.cache.has(CONFIG.roles.MODERATOR)) {
            return message.reply({ embeds: [createRedEmbed('❌ Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 1) {
            return message.reply({ embeds: [createRedEmbed('❌ Invalid Usage', 'Usage: .warnings @user')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('❌ User Not Found', 'Could not find that user.')] });
        }

        const userWarnings = warningsData[targetUser.id] || [];

        if (userWarnings.length === 0) {
            return message.reply({ embeds: [createRedEmbed('✅ No Warnings', `<@${targetUser.id}> has no warnings.`)] });
        }

        let warningsList = '';
        userWarnings.forEach((warn, index) => {
            warningsList += `**${index + 1}.** ${warn.reason} - ${getTimeAgo(warn.timestamp)}\n`;
        });

        const embed = createRedEmbed(`⚠️ Warnings for ${targetUser.tag}`, warningsList);
        embed.setFooter({ text: `Total: ${userWarnings.length} warning${userWarnings.length !== 1 ? 's' : ''}` });

        await message.reply({ embeds: [embed] });
    }

    // ==================== CLEARWARN COMMAND ====================
    if (command === 'clearwarn') {
        if (!message.member.roles.cache.has(CONFIG.roles.CLEAR_WARN_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('❌ Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 2) {
            return message.reply({ embeds: [createRedEmbed('❌ Invalid Usage', 'Usage: .clearwarn @user (warn number)')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('❌ User Not Found', 'Could not find that user.')] });
        }

        const warnNumber = parseInt(args[1]);
        const userWarnings = warningsData[targetUser.id] || [];

        if (isNaN(warnNumber) || warnNumber < 1 || warnNumber > userWarnings.length) {
            return message.reply({ embeds: [createRedEmbed('❌ Invalid Warning Number', `User has ${userWarnings.length} warning(s).`)] });
        }

        const confirmChannel = await client.channels.fetch(CONFIG.channels.CLEAR_WARN_CONFIRM);
        const embed = createRedEmbed('⚠️ Clear Warning Confirmation', 
            `**Target:** <@${targetUser.id}>\n**Warning #${warnNumber}:** ${userWarnings[warnNumber - 1].reason}\n**Requested by:** <@${message.author.id}>`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`clearwarn_confirm_${targetUser.id}_${warnNumber}_${message.author.id}_${Date.now()}`)
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`clearwarn_decline_${targetUser.id}_${warnNumber}_${message.author.id}_${Date.now()}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Secondary)
        );

        await confirmChannel.send({ embeds: [embed], components: [row] });
        await message.reply({ embeds: [createRedEmbed('✅ Confirmation Sent', `A confirmation message has been sent to <#${CONFIG.channels.CLEAR_WARN_CONFIRM}>.`)] });
    }

    // ==================== CLEARWARNS COMMAND ====================
    if (command === 'clearwarns') {
        if (!message.member.roles.cache.has(CONFIG.roles.CLEAR_WARN_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('❌ Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 1) {
            return message.reply({ embeds: [createRedEmbed('❌ Invalid Usage', 'Usage: .clearwarns @user')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('❌ User Not Found', 'Could not find that user.')] });
        }

        const userWarnings = warningsData[targetUser.id] || [];
        if (userWarnings.length === 0) {
            return message.reply({ embeds: [createRedEmbed('✅ No Warnings', 'This user has no warnings to clear.')] });
        }

        const confirmChannel = await client.channels.fetch(CONFIG.channels.CLEAR_WARN_CONFIRM);
        const embed = createRedEmbed('⚠️ Clear All Warnings Confirmation', 
            `**Target:** <@${targetUser.id}>\n**Total Warnings:** ${userWarnings.length}\n**Requested by:** <@${message.author.id}>`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`clearwarns_confirm_${targetUser.id}_${message.author.id}_${Date.now()}`)
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`clearwarns_decline_${targetUser.id}_${message.author.id}_${Date.now()}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Secondary)
        );

        await confirmChannel.send({ embeds: [embed], components: [row] });
        await message.reply({ embeds: [createRedEmbed('✅ Confirmation Sent', `A confirmation message has been sent to <#${CONFIG.channels.CLEAR_WARN_CONFIRM}>.`)] });
    }

    // ==================== MUTE COMMAND ====================
    if (command === 'mute') {
        if (!message.member.roles.cache.has(CONFIG.roles.MUTE_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('❌ Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 2) {
            return message.reply({ embeds: [createRedEmbed('❌ Invalid Usage', 'Usage: .mute @user (duration). Max: 1h or 60m')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('❌ User Not Found', 'Could not find that user.')] });
        }

        const duration = parseDuration(args[1]);
        if (!duration) {
            return message.reply({ embeds: [createRedEmbed('❌ Invalid Duration', 'Use format: 1m to 60m or 1h. Max duration: 1 hour')] });
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply({ embeds: [createRedEmbed('❌ Member Not Found', 'Could not find that member in the server.')] });
        }

        try {
            await targetMember.timeout(duration, `Muted by ${message.author.tag}`);

            // Send log to mute logs channel
            const logChannel = await client.channels.fetch(CONFIG.channels.MUTE_LOGS);
            await logChannel.send(`<@${targetUser.id}> muted for ${formatDuration(duration)} by <@${message.author.id}>`);

            await message.reply({ 
                embeds: [createRedEmbed('✅ User Muted', 
                    `<@${targetUser.id}> has been muted for **${formatDuration(duration)}**.`)] 
            });
        } catch (err) {
            await message.reply({ embeds: [createRedEmbed('❌ Error', 'Failed to mute user. Check bot permissions.')] });
        }
    }

    // ==================== UNMUTE COMMAND ====================
    if (command === 'unmute') {
        if (!message.member.roles.cache.has(CONFIG.roles.MUTE_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('❌ Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 1) {
            return message.reply({ embeds: [createRedEmbed('❌ Invalid Usage', 'Usage: .unmute @user')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('❌ User Not Found', 'Could not find that user.')] });
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply({ embeds: [createRedEmbed('❌ Member Not Found', 'Could not find that member in the server.')] });
        }

        try {
            await targetMember.timeout(null);

            // Send log to mute logs channel
            const logChannel = await client.channels.fetch(CONFIG.channels.MUTE_LOGS);
            await logChannel.send(`<@${targetUser.id}> unmuted by <@${message.author.id}>`);

            await message.reply({ 
                embeds: [createRedEmbed('✅ User Unmuted', 
                    `<@${targetUser.id}> has been unmuted.`)] 
            });
        } catch (err) {
            await message.reply({ embeds: [createRedEmbed('❌ Error', 'Failed to unmute user. Check bot permissions.')] });
        }
    }

    // ==================== RANK COMMAND ====================
    if (command === 'rank') {
        const highestRole = getHighestRankRole(message.member);

        if (!highestRole) {
            return message.reply({ embeds: [createRedEmbed('❌ Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 2) {
            return message.reply({ embeds: [createRedEmbed('❌ Invalid Usage', 'Usage: .rank @user @role or .rank @user roleID')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('❌ User Not Found', 'Could not find that user.')] });
        }

        let targetRole = message.mentions.roles.first();

        if (!targetRole && args[1]) {
            targetRole = await message.guild.roles.fetch(args[1]).catch(() => null);
        }

        if (!targetRole && args[1]) {
            const roleName = args.slice(1).join(' ');
            targetRole = message.guild.roles.cache.find(r => 
                r.name.toLowerCase() === roleName.toLowerCase()
            );
        }

        if (!targetRole) {
            return message.reply({ embeds: [createRedEmbed('❌ Role Not Found', 'Please mention a valid role, provide a role ID, or use the exact role name.')] });
        }

        const isDangerous = await hasDangerousPermissions(message.guild, targetRole.id);
        if (isDangerous) {
            return message.reply({ embeds: [createRedEmbed('❌ Dangerous Role', 'You cannot assign roles with administrator or dangerous permissions.')] });
        }

        if (!canAssignRole(highestRole, targetRole.id)) {
            return message.reply({ embeds: [createRedEmbed('❌ Permission Denied', 'You cannot assign a role higher than or equal to your own.')] });
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply({ embeds: [createRedEmbed('❌ Member Not Found', 'Could not find that member in the server.')] });
        }

        if (targetMember.roles.cache.has(targetRole.id)) {
            return message.reply({ embeds: [createRedEmbed('❌ Already Has Role', 'This user already has that role.')] });
        }

        // Send rank confirmation to the designated channel
        const rankConfirmChannel = await client.channels.fetch(CONFIG.channels.RANK_CONFIRM);

        const embed = createRedEmbed('⚠️ Rank Up Request', 
            `**Requester:** <@${message.author.id}>\n**Target:** <@${targetUser.id}>\n**Role:** <@&${targetRole.id}>\n\nAn admin needs to approve this request.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`rank_confirm_${targetUser.id}_${targetRole.id}_${message.author.id}_${Date.now()}`)
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`rank_decline_${targetUser.id}_${targetRole.id}_${message.author.id}_${Date.now()}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        await rankConfirmChannel.send({ embeds: [embed], components: [row] });
        await message.reply({ embeds: [createRedEmbed('⏳ Awaiting Approval', 'Your rank up request has been sent for admin approval.')] });
    }

    // ==================== BREAK COMMAND ====================
    if (command === 'break') {
        const highestRole = getHighestRankRole(message.member);
        if (!highestRole) {
            return message.reply({ embeds: [createRedEmbed('❌ Permission Denied', 'You do not have permission to use this command.')] });
        }

        const rolesToRemove = CONFIG.roles.ALL_RANK_ROLES.filter(r => r !== CONFIG.roles.BREAK_ROLE);
        const removedRoles = [];

        for (const roleId of rolesToRemove) {
            if (message.member.roles.cache.has(roleId)) {
                removedRoles.push(roleId);
                await message.member.roles.remove(roleId).catch(() => {});
            }
        }

        breakData[message.author.id] = {
            roles: removedRoles,
            timestamp: Date.now()
        };
        saveBreakData();

        await message.reply({ embeds: [createRedEmbed('✅ Break Started', 'Your rank roles have been removed. Use .breakoff to return.')] });
    }

    // ==================== BREAKOFF COMMAND ====================
    if (command === 'breakoff') {
        const userBreakData = breakData[message.author.id];
        if (!userBreakData || !userBreakData.roles || userBreakData.roles.length === 0) {
            return message.reply({ embeds: [createRedEmbed('❌ No Break Data', 'You are not on a break or no data was found.')] });
        }

        for (const roleId of userBreakData.roles) {
            await message.member.roles.add(roleId).catch(() => {});
        }

        delete breakData[message.author.id];
        saveBreakData();

        await message.reply({ embeds: [createRedEmbed('✅ Welcome Back', 'Your roles have been restored!')] });
    }

    // ==================== DAWUUD COMMAND ====================
    if (command === 'dawuud') {
        if (!message.member.roles.cache.has(CONFIG.roles.DAWUUD_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('❌ Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 1) {
            return message.reply({ embeds: [createRedEmbed('❌ Invalid Usage', 'Usage: .dawuud @user')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('❌ User Not Found', 'Could not find that user.')] });
        }

        const now = Date.now();
        const lastUsed = dawuudCooldowns.get(message.author.id);
        if (lastUsed && (now - lastUsed) < 10 * 60 * 1000) {
            const remaining = Math.ceil((10 * 60 * 1000 - (now - lastUsed)) / 1000 / 60);
            return message.reply({ embeds: [createRedEmbed('⏳ Cooldown', `You must wait ${remaining} more minute(s) before using .dawuud again.`)] });
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply({ embeds: [createRedEmbed('❌ Member Not Found', 'Could not find that member in the server.')] });
        }

        if (targetMember.roles.cache.has(CONFIG.roles.BREAK_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('❌ Already Has Role', 'This user already has the hitter role.')] });
        }

        dawuudCooldowns.set(message.author.id, now);

        const uniqueId = `dawuud_${targetUser.id}_${Date.now()}`;

        const embed = createRedEmbed('⚠️ Hitter Request', CONFIG.dawuud.embedMessage)
            .setFooter({ text: `Requested for: ${targetUser.tag}` });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${uniqueId}_accept`)
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`${uniqueId}_decline`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        await message.channel.send({ content: `<@${targetUser.id}>`, embeds: [embed], components: [row] });

        activeButtons.set(uniqueId, {
            targetUserId: targetUser.id,
            timestamp: Date.now(),
            used: false
        });

        setTimeout(() => {
            activeButtons.delete(uniqueId);
        }, 10 * 60 * 1000);
    }
});

// ============ BUTTON INTERACTIONS ============
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // ==================== WARN BUTTONS ====================
    if (customId.startsWith('warn_confirm_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const moderatorId = parts[3];

        if (!warningsData[targetUserId]) warningsData[targetUserId] = [];

        const originalMessage = interaction.message;
        const embedDescription = originalMessage.embeds[0].description;
        const reasonMatch = embedDescription.match(/\*\*Reason:\*\* (.+)/);
        const reason = reasonMatch ? reasonMatch[1] : 'No reason provided';

        warningsData[targetUserId].push({
            reason: reason,
            timestamp: Date.now(),
            moderator: moderatorId
        });
        saveWarnings();

        await interaction.update({ 
            embeds: [createRedEmbed('✅ Warning Applied', `<@${targetUserId}> has been warned.\n**Reason:** ${reason}`)], 
            components: [] 
        });
    }

    if (customId.startsWith('warn_decline_')) {
        await interaction.update({ 
            embeds: [createRedEmbed('❌ Warning Declined', 'The warning has been declined.')], 
            components: [] 
        });
    }

    // ==================== CLEARWARN BUTTONS ====================
    if (customId.startsWith('clearwarn_confirm_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const warnNumber = parseInt(parts[3]);

        if (warningsData[targetUserId] && warningsData[targetUserId][warnNumber - 1]) {
            const removed = warningsData[targetUserId].splice(warnNumber - 1, 1);
            saveWarnings();
            await interaction.update({ 
                embeds: [createRedEmbed('✅ Warning Cleared', `Warning #${warnNumber} for <@${targetUserId}> has been cleared.\n**Reason was:** ${removed[0].reason}`)], 
                components: [] 
            });
        } else {
            await interaction.update({ 
                embeds: [createRedEmbed('❌ Error', 'Warning not found or already cleared.')], 
                components: [] 
            });
        }
    }

    if (customId.startsWith('clearwarn_decline_')) {
        await interaction.update({ 
            embeds: [createRedEmbed('❌ Declined', 'The clear warning request has been declined.')], 
            components: [] 
        });
    }

    // ==================== CLEARWARNS BUTTONS ====================
    if (customId.startsWith('clearwarns_confirm_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];

        if (warningsData[targetUserId]) {
            const count = warningsData[targetUserId].length;
            delete warningsData[targetUserId];
            saveWarnings();
            await interaction.update({ 
                embeds: [createRedEmbed('✅ All Warnings Cleared', `All ${count} warning(s) for <@${targetUserId}> have been cleared.`)], 
                components: [] 
            });
        } else {
            await interaction.update({ 
                embeds: [createRedEmbed('❌ Error', 'No warnings found for this user.')], 
                components: [] 
            });
        }
    }

    if (customId.startsWith('clearwarns_decline_')) {
        await interaction.update({ 
            embeds: [createRedEmbed('❌ Declined', 'The clear all warnings request has been declined.')], 
            components: [] 
        });
    }

    // ==================== RANK BUTTONS ====================
    if (customId.startsWith('rank_confirm_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const targetRoleId = parts[3];
        const requesterId = parts[4];

        const guild = interaction.guild;
        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

        if (!targetMember) {
            return interaction.update({ 
                embeds: [createRedEmbed('❌ Error', 'User is no longer in the server.')], 
                components: [] 
            });
        }

        try {
            await targetMember.roles.add(targetRoleId);
            await interaction.update({ 
                embeds: [createRedEmbed('✅ Rank Up Approved', `<@${targetUserId}> has been given <@&${targetRoleId}>.\n**Approved by:** <@${interaction.user.id}>`)], 
                components: [] 
            });
        } catch (err) {
            await interaction.update({ 
                embeds: [createRedEmbed('❌ Error', 'Failed to add role. Check bot permissions.')], 
                components: [] 
            });
        }
    }

    if (customId.startsWith('rank_decline_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const targetRoleId = parts[3];

        await interaction.update({ 
            embeds: [createRedEmbed('❌ Rank Up Declined', `<@${targetUserId}> will not receive <@&${targetRoleId}>.\n**Declined by:** <@${interaction.user.id}>`)], 
            components: [] 
        });
    }

    // ==================== DAWUUD BUTTONS ====================
    if (customId.includes('_accept') && customId.startsWith('dawuud_')) {
        const parts = customId.split('_');
        const targetUserId = parts[1];
        const uniqueId = `dawuud_${targetUserId}_${parts[2]}`;

        const buttonData = activeButtons.get(uniqueId);

        if (!buttonData) {
            return interaction.reply({ embeds: [createRedEmbed('❌ Expired', 'This button has expired or already been used.')], ephemeral: true });
        }

        if (buttonData.used) {
            return interaction.reply({ embeds: [createRedEmbed('❌ Already Used', 'This button has already been clicked.')], ephemeral: true });
        }

        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ embeds: [createRedEmbed('❌ Not For You', 'Only the mentioned user can click these buttons.')], ephemeral: true });
        }

        const guild = interaction.guild;
        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

        if (!targetMember) {
            return interaction.reply({ embeds: [createRedEmbed('❌ Error', 'Could not find you in the server.')], ephemeral: true });
        }

        try {
            await targetMember.roles.add(CONFIG.roles.BREAK_ROLE);

            buttonData.used = true;
            activeButtons.set(uniqueId, buttonData);

            try {
                const targetUser = await client.users.fetch(targetUserId);
                await targetUser.send({ embeds: [createRedEmbed('Welcome!', CONFIG.dawuud.dmMessage)] });
            } catch (dmErr) {
                console.log('Could not DM user:', dmErr.message);
            }

            await interaction.update({ 
                content: `<@${targetUserId}> has accepted our request. <@${targetUserId}> please check your DMs to learn how to hit.`,
                embeds: [createRedEmbed('✅ Accepted', `<@${targetUserId}> has accepted the hitter request and received the role.`)], 
                components: [] 
            });
        } catch (err) {
            await interaction.reply({ embeds: [createRedEmbed('❌ Error', 'Failed to add role. Contact an admin.')], ephemeral: true });
        }
    }

    if (customId.includes('_decline') && customId.startsWith('dawuud_')) {
        const parts = customId.split('_');
        const targetUserId = parts[1];
        const uniqueId = `dawuud_${targetUserId}_${parts[2]}`;

        const buttonData = activeButtons.get(uniqueId);

        if (!buttonData) {
            return interaction.reply({ embeds: [createRedEmbed('❌ Expired', 'This button has expired or already been used.')], ephemeral: true });
        }

        if (buttonData.used) {
            return interaction.reply({ embeds: [createRedEmbed('❌ Already Used', 'This button has already been clicked.')], ephemeral: true });
        }

        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ embeds: [createRedEmbed('❌ Not For You', 'Only the mentioned user can click these buttons.')], ephemeral: true });
        }

        buttonData.used = true;
        activeButtons.set(uniqueId, buttonData);

        await interaction.update({ 
            content: `<@${targetUserId}> has declined our request and won't become a hitter.`,
            embeds: [createRedEmbed('❌ Declined', `<@${targetUserId}> has declined the hitter request.`)], 
            components: [] 
        });
    }
});

// ============ LOGIN ============
client.login(CONFIG.token);

module.exports = { client, CONFIG };
