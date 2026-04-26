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

        // Rank roles in hierarchy order (lowest to highest)
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
        CLEAR_WARN_CONFIRM: '1497889821845360760'
    },

    dawuud: {
        embedMessage: 'Custom message here',
        dmMessage: 'Custom dm message here'
    }
};

// ============ DATA STORAGE ============
let warningsData = {};
let breakData = {};
let activeButtons = new Map(); // Changed to Map to store timestamps
let dawuudCooldowns = new Map(); // Store cooldowns: userId -> timestamp

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
    // NO .setTimestamp() - removed completely
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

// Get the highest rank role a user has
function getHighestRankRole(member) {
    const rankRoles = Object.keys(CONFIG.roles.RANK_ROLES);
    for (let i = rankRoles.length - 1; i >= 0; i--) {
        if (member.roles.cache.has(rankRoles[i])) {
            return rankRoles[i];
        }
    }
    return null;
}

// Check if a role can be assigned by a user
// FIXED: Now checks if target role is LOWER in hierarchy (can assign if targetIndex < assignerIndex)
function canAssignRole(assignerRoleId, targetRoleId) {
    const rankRoles = Object.keys(CONFIG.roles.RANK_ROLES);
    const assignerIndex = rankRoles.indexOf(assignerRoleId);
    const targetIndex = rankRoles.indexOf(targetRoleId);

    // If both are rank roles, target must be strictly lower (lower index = lower rank)
    if (assignerIndex !== -1 && targetIndex !== -1) {
        return targetIndex < assignerIndex;
    }

    // If target role is not in rank list but assigner has a rank role, allow it
    // (as long as it's not an admin role with dangerous perms)
    if (assignerIndex !== -1 && targetIndex === -1) {
        return true; // Allow assigning non-rank roles
    }

    return false;
}

// Check if role has dangerous permissions (Administrator, Manage Server, etc.)
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
            return message.reply({ embeds: [createRedEmbed('â Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 2) {
            return message.reply({ embeds: [createRedEmbed('â Invalid Usage', 'Usage: `.warn @user (reason)`')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('â User Not Found', 'Could not find that user.')] });
        }

        const reason = args.slice(1).join(' ');
        const confirmChannel = await client.channels.fetch(CONFIG.channels.WARN_CONFIRM);

        const embed = createRedEmbed('â ï¸ Warn Confirmation', `**Target:** <@${targetUser.id}>
**Reason:** ${reason}
**Moderator:** <@${message.author.id}>`);

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
        await message.reply({ embeds: [createRedEmbed('â Confirmation Sent', `A confirmation message has been sent to <#${CONFIG.channels.WARN_CONFIRM}>.`)] });
    }

    // ==================== WARNINGS COMMAND ====================
    if (command === 'warnings') {
        if (!message.member.roles.cache.has(CONFIG.roles.MODERATOR)) {
            return message.reply({ embeds: [createRedEmbed('â Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 1) {
            return message.reply({ embeds: [createRedEmbed('â Invalid Usage', 'Usage: `.warnings @user`')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('â User Not Found', 'Could not find that user.')] });
        }

        const userWarnings = warningsData[targetUser.id] || [];

        if (userWarnings.length === 0) {
            return message.reply({ embeds: [createRedEmbed('â No Warnings', `<@${targetUser.id}> has no warnings.`)] });
        }

        let warningsList = '';
        userWarnings.forEach((warn, index) => {
            warningsList += `**${index + 1}.** ${warn.reason} - ${getTimeAgo(warn.timestamp)}
`;
        });

        const embed = createRedEmbed(`â ï¸ Warnings for ${targetUser.tag}`, warningsList);
        embed.setFooter({ text: `Total: ${userWarnings.length} warning${userWarnings.length !== 1 ? 's' : ''}` });

        await message.reply({ embeds: [embed] });
    }

    // ==================== CLEARWARN COMMAND ====================
    if (command === 'clearwarn') {
        if (!message.member.roles.cache.has(CONFIG.roles.CLEAR_WARN_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('â Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 2) {
            return message.reply({ embeds: [createRedEmbed('â Invalid Usage', 'Usage: `.clearwarn @user (warn number)`')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('â User Not Found', 'Could not find that user.')] });
        }

        const warnNumber = parseInt(args[1]);
        const userWarnings = warningsData[targetUser.id] || [];

        if (isNaN(warnNumber) || warnNumber < 1 || warnNumber > userWarnings.length) {
            return message.reply({ embeds: [createRedEmbed('â Invalid Warning Number', `User has ${userWarnings.length} warning(s).`)] });
        }

        const confirmChannel = await client.channels.fetch(CONFIG.channels.CLEAR_WARN_CONFIRM);
        const embed = createRedEmbed('â ï¸ Clear Warning Confirmation', 
            `**Target:** <@${targetUser.id}>
**Warning #${warnNumber}:** ${userWarnings[warnNumber - 1].reason}
**Requested by:** <@${message.author.id}>`);

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
        await message.reply({ embeds: [createRedEmbed('â Confirmation Sent', `A confirmation message has been sent to <#${CONFIG.channels.CLEAR_WARN_CONFIRM}>.`)] });
    }

    // ==================== CLEARWARNS COMMAND ====================
    if (command === 'clearwarns') {
        if (!message.member.roles.cache.has(CONFIG.roles.CLEAR_WARN_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('â Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 1) {
            return message.reply({ embeds: [createRedEmbed('â Invalid Usage', 'Usage: `.clearwarns @user`')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('â User Not Found', 'Could not find that user.')] });
        }

        const userWarnings = warningsData[targetUser.id] || [];
        if (userWarnings.length === 0) {
            return message.reply({ embeds: [createRedEmbed('â No Warnings', 'This user has no warnings to clear.')] });
        }

        const confirmChannel = await client.channels.fetch(CONFIG.channels.CLEAR_WARN_CONFIRM);
        const embed = createRedEmbed('â ï¸ Clear All Warnings Confirmation', 
            `**Target:** <@${targetUser.id}>
**Total Warnings:** ${userWarnings.length}
**Requested by:** <@${message.author.id}>`);

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
        await message.reply({ embeds: [createRedEmbed('â Confirmation Sent', `A confirmation message has been sent to <#${CONFIG.channels.CLEAR_WARN_CONFIRM}>.`)] });
    }

    // ==================== MUTE COMMAND ====================
    if (command === 'mute') {
        if (!message.member.roles.cache.has(CONFIG.roles.MUTE_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('â Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 2) {
            return message.reply({ embeds: [createRedEmbed('â Invalid Usage', 'Usage: `.mute @user (duration)`
Max: 1h or 60m')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('â User Not Found', 'Could not find that user.')] });
        }

        const duration = parseDuration(args[1]);
        if (!duration) {
            return message.reply({ embeds: [createRedEmbed('â Invalid Duration', 'Use format: `1m` to `60m` or `1h`
Max duration: 1 hour')] });
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply({ embeds: [createRedEmbed('â Member Not Found', 'Could not find that member in the server.')] });
        }

        try {
            await targetMember.timeout(duration, `Muted by ${message.author.tag}`);
            await message.reply({ 
                embeds: [createRedEmbed('â User Muted', 
                    `<@${targetUser.id}> has been muted for **${formatDuration(duration)}**.`)] 
            });
        } catch (err) {
            await message.reply({ embeds: [createRedEmbed('â Error', 'Failed to mute user. Check bot permissions.')] });
        }
    }

    // ==================== RANK COMMAND ====================
    // FIXED: Now supports role IDs, mentions, and role names
    if (command === 'rank') {
        const highestRole = getHighestRankRole(message.member);

        if (!highestRole) {
            return message.reply({ embeds: [createRedEmbed('â Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 2) {
            return message.reply({ embeds: [createRedEmbed('â Invalid Usage', 'Usage: `.rank @user @role` or `.rank @user roleID`')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('â User Not Found', 'Could not find that user.')] });
        }

        // FIXED: Try to find role by mention, ID, or name
        let targetRole = message.mentions.roles.first();

        if (!targetRole && args[1]) {
            // Try by ID
            targetRole = await message.guild.roles.fetch(args[1]).catch(() => null);
        }

        if (!targetRole && args[1]) {
            // Try by name (case insensitive)
            const roleName = args.slice(1).join(' ');
            targetRole = message.guild.roles.cache.find(r => 
                r.name.toLowerCase() === roleName.toLowerCase()
            );
        }

        if (!targetRole) {
            return message.reply({ embeds: [createRedEmbed('â Role Not Found', 'Please mention a valid role, provide a role ID, or use the exact role name.')] });
        }

        // Check if target role has dangerous permissions
        const isDangerous = await hasDangerousPermissions(message.guild, targetRole.id);
        if (isDangerous) {
            return message.reply({ embeds: [createRedEmbed('â Dangerous Role', 'You cannot assign roles with administrator or dangerous permissions.')] });
        }

        // Check if user can assign this role
        if (!canAssignRole(highestRole, targetRole.id)) {
            return message.reply({ embeds: [createRedEmbed('â Permission Denied', 'You cannot assign a role higher than or equal to your own.')] });
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply({ embeds: [createRedEmbed('â Member Not Found', 'Could not find that member in the server.')] });
        }

        if (targetMember.roles.cache.has(targetRole.id)) {
            return message.reply({ embeds: [createRedEmbed('â Already Has Role', 'This user already has that role.')] });
        }

        const embed = createRedEmbed('â ï¸ Rank Up Request', 
            `**Requester:** <@${message.author.id}>
**Target:** <@${targetUser.id}>
**Role:** <@&${targetRole.id}>

An admin needs to approve this request.`);

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

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.reply({ embeds: [createRedEmbed('â³ Awaiting Approval', 'Your rank up request has been sent for admin approval.')] });
    }

    // ==================== BREAK COMMAND ====================
    if (command === 'break') {
        const highestRole = getHighestRankRole(message.member);
        if (!highestRole) {
            return message.reply({ embeds: [createRedEmbed('â Permission Denied', 'You do not have permission to use this command.')] });
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

        await message.reply({ embeds: [createRedEmbed('â Break Started', 'Your rank roles have been removed. Use `.breakoff` to return.')] });
    }

    // ==================== BREAKOFF COMMAND ====================
    if (command === 'breakoff') {
        const userBreakData = breakData[message.author.id];
        if (!userBreakData || !userBreakData.roles || userBreakData.roles.length === 0) {
            return message.reply({ embeds: [createRedEmbed('â No Break Data', 'You are not on a break or no data was found.')] });
        }

        for (const roleId of userBreakData.roles) {
            await message.member.roles.add(roleId).catch(() => {});
        }

        delete breakData[message.author.id];
        saveBreakData();

        await message.reply({ embeds: [createRedEmbed('â Welcome Back', 'Your roles have been restored!')] });
    }

    // ==================== DAWUUD COMMAND ====================
    // FIXED: Added 10 minute cooldown and fixed button expiration bug
    if (command === 'dawuud') {
        if (!message.member.roles.cache.has(CONFIG.roles.DAWUUD_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('â Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 1) {
            return message.reply({ embeds: [createRedEmbed('â Invalid Usage', 'Usage: `.dawuud @user`')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('â User Not Found', 'Could not find that user.')] });
        }

        // Check cooldown
        const now = Date.now();
        const lastUsed = dawuudCooldowns.get(message.author.id);
        if (lastUsed && (now - lastUsed) < 10 * 60 * 1000) { // 10 minutes
            const remaining = Math.ceil((10 * 60 * 1000 - (now - lastUsed)) / 1000 / 60);
            return message.reply({ embeds: [createRedEmbed('â³ Cooldown', `You must wait ${remaining} more minute(s) before using .dawuud again.`)] });
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply({ embeds: [createRedEmbed('â Member Not Found', 'Could not find that member in the server.')] });
        }

        if (targetMember.roles.cache.has(CONFIG.roles.BREAK_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('â Already Has Role', 'This user already has the hitter role.')] });
        }

        // Set cooldown
        dawuudCooldowns.set(message.author.id, now);

        const uniqueId = `dawuud_${targetUser.id}_${Date.now()}`;

        const embed = createRedEmbed('â ï¸ Hitter Request', CONFIG.dawuud.embedMessage)
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

        // FIXED: Store with timestamp for 10-minute expiration
        activeButtons.set(uniqueId, {
            targetUserId: targetUser.id,
            timestamp: Date.now(),
            used: false
        });

        // Auto-expire after 10 minutes
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
            embeds: [createRedEmbed('â Warning Applied', `<@${targetUserId}> has been warned.
**Reason:** ${reason}`)], 
            components: [] 
        });
    }

    if (customId.startsWith('warn_decline_')) {
        await interaction.update({ 
            embeds: [createRedEmbed('â Warning Declined', 'The warning has been declined.')], 
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
                embeds: [createRedEmbed('â Warning Cleared', `Warning #${warnNumber} for <@${targetUserId}> has been cleared.
**Reason was:** ${removed[0].reason}`)], 
                components: [] 
            });
        } else {
            await interaction.update({ 
                embeds: [createRedEmbed('â Error', 'Warning not found or already cleared.')], 
                components: [] 
            });
        }
    }

    if (customId.startsWith('clearwarn_decline_')) {
        await interaction.update({ 
            embeds: [createRedEmbed('â Declined', 'The clear warning request has been declined.')], 
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
                embeds: [createRedEmbed('â All Warnings Cleared', `All ${count} warning(s) for <@${targetUserId}> have been cleared.`)], 
                components: [] 
            });
        } else {
            await interaction.update({ 
                embeds: [createRedEmbed('â Error', 'No warnings found for this user.')], 
                components: [] 
            });
        }
    }

    if (customId.startsWith('clearwarns_decline_')) {
        await interaction.update({ 
            embeds: [createRedEmbed('â Declined', 'The clear all warnings request has been declined.')], 
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
                embeds: [createRedEmbed('â Error', 'User is no longer in the server.')], 
                components: [] 
            });
        }

        try {
            await targetMember.roles.add(targetRoleId);
            await interaction.update({ 
                embeds: [createRedEmbed('â Rank Up Approved', `<@${targetUserId}> has been given <@&${targetRoleId}>.
**Approved by:** <@${interaction.user.id}>`)], 
                components: [] 
            });
        } catch (err) {
            await interaction.update({ 
                embeds: [createRedEmbed('â Error', 'Failed to add role. Check bot permissions.')], 
                components: [] 
            });
        }
    }

    if (customId.startsWith('rank_decline_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const targetRoleId = parts[3];

        await interaction.update({ 
            embeds: [createRedEmbed('â Rank Up Declined', `<@${targetUserId}> will not receive <@&${targetRoleId}>.
**Declined by:** <@${interaction.user.id}>`)], 
            components: [] 
        });
    }

    // ==================== DAWUUD BUTTONS ====================
    // FIXED: Proper cooldown and expiration handling
    if (customId.includes('_accept') && customId.startsWith('dawuud_')) {
        const parts = customId.split('_');
        const targetUserId = parts[1];
        const uniqueId = `dawuud_${targetUserId}_${parts[2]}`;

        const buttonData = activeButtons.get(uniqueId);

        // Check if button exists and hasn't expired (10 minutes)
        if (!buttonData) {
            return interaction.reply({ embeds: [createRedEmbed('â Expired', 'This button has expired or already been used.')], ephemeral: true });
        }

        if (buttonData.used) {
            return interaction.reply({ embeds: [createRedEmbed('â Already Used', 'This button has already been clicked.')], ephemeral: true });
        }

        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ embeds: [createRedEmbed('â Not For You', 'Only the mentioned user can click these buttons.')], ephemeral: true });
        }

        const guild = interaction.guild;
        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

        if (!targetMember) {
            return interaction.reply({ embeds: [createRedEmbed('â Error', 'Could not find you in the server.')], ephemeral: true });
        }

        try {
            await targetMember.roles.add(CONFIG.roles.BREAK_ROLE);

            // Mark as used
            buttonData.used = true;
            activeButtons.set(uniqueId, buttonData);

            // Send DM
            try {
                const targetUser = await client.users.fetch(targetUserId);
                await targetUser.send({ embeds: [createRedEmbed('â Welcome!', CONFIG.dawuud.dmMessage)] });
            } catch (dmErr) {
                console.log('Could not DM user:', dmErr.message);
            }

            await interaction.update({ 
                content: `<@${targetUserId}> has accepted our request. <@${targetUserId}> please check your DMs to learn how to hit.`,
                embeds: [createRedEmbed('â Accepted', `<@${targetUserId}> has accepted the hitter request and received the role.`)], 
                components: [] 
            });
        } catch (err) {
            await interaction.reply({ embeds: [createRedEmbed('â Error', 'Failed to add role. Contact an admin.')], ephemeral: true });
        }
    }

    if (customId.includes('_decline') && customId.startsWith('dawuud_')) {
        const parts = customId.split('_');
        const targetUserId = parts[1];
        const uniqueId = `dawuud_${targetUserId}_${parts[2]}`;

        const buttonData = activeButtons.get(uniqueId);

        if (!buttonData) {
            return interaction.reply({ embeds: [createRedEmbed('â Expired', 'This button has expired or already been used.')], ephemeral: true });
        }

        if (buttonData.used) {
            return interaction.reply({ embeds: [createRedEmbed('â Already Used', 'This button has already been clicked.')], ephemeral: true });
        }

        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ embeds: [createRedEmbed('â Not For You', 'Only the mentioned user can click these buttons.')], ephemeral: true });
        }

        // Mark as used
        buttonData.used = true;
        activeButtons.set(uniqueId, buttonData);

        await interaction.update({ 
            content: `<@${targetUserId}> has declined our request and won't become a hitter.`,
            embeds: [createRedEmbed('â Declined', `<@${targetUserId}> has declined the hitter request.`)], 
            components: [] 
        });
    }
});

// ============ LOGIN ============
client.login(CONFIG.token);

module.exports = { client, CONFIG };
