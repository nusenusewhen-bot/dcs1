const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionsBitField, SlashCommandBuilder, Routes, REST } = require('discord.js');
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
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,

    roles: {
        MODERATOR: '1497886259148750959',
        CLEAR_WARN_ROLE: '1497884756694798398',
        MUTE_ROLE: '1497884120603164772',
        DAWUUD_ROLE: '1494798337361186998',
        BREAK_ROLE: '1497882194142691398',
        MONITOR_ROLE: '1497882194142691398',
        BLOCKED_ROLE: '1494798358089437314',

        // Rank roles in order from lowest to highest
        RANK_ROLES: {
            '1494798337361186998': ['1497883985198583899', '1497886259148750959'],
            '1497883985198583899': ['1497886259148750959', '1497884120603164772'],
            '1497886259148750959': ['1497884120603164772', '1497884416964431932'],
            '1497884120603164772': ['1497884416964431932', '1497884627619283007'],
            '1497884416964431932': ['1497884627619283007', '1497884756694798398'],
            '1497884627619283007': ['1497884756694798398', '1497885013675606033'],
            '1497884756694798398': ['1497885013675606033', '1463189207282356276'],
            '1497885013675606033': ['1463189207282356276'],
            '1463189207282356276': []
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
        MUTE_LOGS: '1496865997074989096',
        KICK_BAN_CONFIRM: '1497934917345214514'
    },

    dawuud: {
        embedMessage: `Welcome to Axz hitting community.

you're probably thinking, whats hitting?
Hitting is a scam method used with middleman and a hitter.
Whats a hitter?
a hitter is a guy that works with the middleman to scam.
Do i get my stuff back?
No, but you can get 100x the stuff you lost.

Tutorial will be sent in your dm's after you click accept.
or decline and stay poor`,
        dmMessage: `Welcome, i see you clicked accept.
That means you became a hitter.
Whats my duty? your probably asking. so what you do is.
1. Find a good trading server
2. Find a trader whos willing to trade with you.
3. Try manipulating him into using our server as middleman.
4. if he accepts, make him join server and after create a middleman ticket and wait for middleman arrival.
5. Middleman will help you hit him and split 50/50 with you.
6. Repeat all the time and you will eventually earn bands.

Go to https://discord.com/channels/1463178747766247508/1497897427632394370

to learn alt hitting, or you could hit normally with middleman.`
    }
};

// ============ DATA STORAGE ============
let warningsData = {};
let breakData = {};
let activeButtons = new Map();
let dawuudCooldowns = new Map();
let kickCooldowns = new Map();
let banCooldowns = new Map();

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
    const rankRoles = CONFIG.roles.ALL_RANK_ROLES;
    for (let i = rankRoles.length - 1; i >= 0; i--) {
        if (member.roles.cache.has(rankRoles[i])) {
            return rankRoles[i];
        }
    }
    return null;
}

function getUserRankRoles(member) {
    return CONFIG.roles.ALL_RANK_ROLES.filter(roleId => member.roles.cache.has(roleId));
}

function getRolesUnderRank(highestRoleId) {
    const rankRoles = CONFIG.roles.ALL_RANK_ROLES;
    const highestIndex = rankRoles.indexOf(highestRoleId);
    if (highestIndex === -1) return [];
    return rankRoles.slice(0, highestIndex);
}

function getRolesAboveRank(highestRoleId) {
    const rankRoles = CONFIG.roles.ALL_RANK_ROLES;
    const highestIndex = rankRoles.indexOf(highestRoleId);
    if (highestIndex === -1) return [];
    return rankRoles.slice(highestIndex + 1);
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

// ============ ROLE MONITORING ============
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const hadBlocked = oldMember.roles.cache.has(CONFIG.roles.BLOCKED_ROLE);
    const hasBlocked = newMember.roles.cache.has(CONFIG.roles.BLOCKED_ROLE);
    const hasMonitor = newMember.roles.cache.has(CONFIG.roles.MONITOR_ROLE);

    if (!hadBlocked && hasBlocked && hasMonitor) {
        try {
            await newMember.roles.remove(CONFIG.roles.BLOCKED_ROLE);
            console.log(`Auto-removed blocked role from ${newMember.user.tag}`);
        } catch (err) {
            console.error(`Failed to auto-remove blocked role from ${newMember.user.tag}:`, err);
        }
    }
});

// ============ BUTTON INTERACTION HANDLER ============
async function handleButtonInteraction(interaction) {
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
            embeds: [createRedEmbed('[OK] Warning Applied', `<@${targetUserId}> has been warned.\n**Reason:** ${reason}`)],
            components: []
        });
    }

    if (customId.startsWith('warn_decline_')) {
        await interaction.update({
            embeds: [createRedEmbed('[X] Warning Declined', 'The warning has been declined.')],
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
                embeds: [createRedEmbed('[OK] Warning Cleared', `Warning #${warnNumber} for <@${targetUserId}> has been cleared.\n**Reason was:** ${removed[0].reason}`)],
                components: []
            });
        } else {
            await interaction.update({
                embeds: [createRedEmbed('[X] Error', 'Warning not found or already cleared.')],
                components: []
            });
        }
    }

    if (customId.startsWith('clearwarn_decline_')) {
        await interaction.update({
            embeds: [createRedEmbed('[X] Declined', 'The clear warning request has been declined.')],
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
                embeds: [createRedEmbed('[OK] All Warnings Cleared', `All ${count} warning(s) for <@${targetUserId}> have been cleared.`)],
                components: []
            });
        } else {
            await interaction.update({
                embeds: [createRedEmbed('[X] Error', 'No warnings found for this user.')],
                components: []
            });
        }
    }

    if (customId.startsWith('clearwarns_decline_')) {
        await interaction.update({
            embeds: [createRedEmbed('[X] Declined', 'The clear all warnings request has been declined.')],
            components: []
        });
    }

    // ==================== RANK BUTTONS (PROMOTE) ====================
    if (customId.startsWith('rank_confirm_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const targetRoleId = parts[3];
        const requesterId = parts[4];

        const guild = interaction.guild;
        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

        if (!targetMember) {
            return interaction.update({
                embeds: [createRedEmbed('[X] Error', 'User is no longer in the server.')],
                components: []
            });
        }

        try {
            await targetMember.roles.add(targetRoleId);
            await interaction.update({
                embeds: [createRedEmbed('[OK] Rank Up Approved', `<@${targetUserId}> has been given <@&${targetRoleId}>.\n**Approved by:** <@${interaction.user.id}>`)],
                components: []
            });
        } catch (err) {
            await interaction.update({
                embeds: [createRedEmbed('[X] Error', 'Failed to add role. Check bot permissions.')],
                components: []
            });
        }
    }

    if (customId.startsWith('rank_decline_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const targetRoleId = parts[3];

        await interaction.update({
            embeds: [createRedEmbed('[X] Rank Up Declined', `<@${targetUserId}> will not receive <@&${targetRoleId}>.\n**Declined by:** <@${interaction.user.id}>`)],
            components: []
        });
    }

    // ==================== DEMOTE BUTTONS ====================
    if (customId.startsWith('demote_confirm_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const targetRoleId = parts[3];
        const requesterId = parts[4];

        const guild = interaction.guild;
        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

        if (!targetMember) {
            return interaction.update({
                embeds: [createRedEmbed('[X] Error', 'User is no longer in the server.')],
                components: []
            });
        }

        try {
            await targetMember.roles.remove(targetRoleId);
            await interaction.update({
                embeds: [createRedEmbed('[OK] Demote Approved', `<@${targetUserId}> has been demoted and <@&${targetRoleId}> removed.\n**Approved by:** <@${interaction.user.id}>`)],
                components: []
            });
        } catch (err) {
            await interaction.update({
                embeds: [createRedEmbed('[X] Error', 'Failed to remove role. Check bot permissions.')],
                components: []
            });
        }
    }

    if (customId.startsWith('demote_decline_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const targetRoleId = parts[3];

        await interaction.update({
            embeds: [createRedEmbed('[X] Demote Declined', `<@${targetUserId}> will not be demoted. <@&${targetRoleId}> stays.\n**Declined by:** <@${interaction.user.id}>`)],
            components: []
        });
    }

    // ==================== KICK BUTTONS ====================
    if (customId.startsWith('kick_confirm_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const requesterId = parts[3];

        const guild = interaction.guild;
        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

        if (!targetMember) {
            return interaction.update({
                embeds: [createRedEmbed('[X] Error', 'User is no longer in the server.')],
                components: []
            });
        }

        const originalMessage = interaction.message;
        const embedDescription = originalMessage.embeds[0].description;
        const reasonMatch = embedDescription.match(/\*\*Reason:\*\* (.+)/);
        const reason = reasonMatch ? reasonMatch[1] : 'No reason provided';

        try {
            await targetMember.kick(reason);
            await interaction.update({
                embeds: [createRedEmbed('[OK] Kick Approved', `<@${targetUserId}> has been kicked.\n**Reason:** ${reason}\n**Approved by:** <@${interaction.user.id}>`)],
                components: []
            });
        } catch (err) {
            await interaction.update({
                embeds: [createRedEmbed('[X] Error', 'Failed to kick user. Check bot permissions.')],
                components: []
            });
        }
    }

    if (customId.startsWith('kick_decline_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];

        await interaction.update({
            embeds: [createRedEmbed('[X] Kick Declined', `<@${targetUserId}> will not be kicked.\n**Declined by:** <@${interaction.user.id}>`)],
            components: []
        });
    }

    // ==================== BAN BUTTONS ====================
    if (customId.startsWith('ban_confirm_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const requesterId = parts[3];

        const guild = interaction.guild;

        const originalMessage = interaction.message;
        const embedDescription = originalMessage.embeds[0].description;
        const reasonMatch = embedDescription.match(/\*\*Reason:\*\* (.+)/);
        const reason = reasonMatch ? reasonMatch[1] : 'No reason provided';

        try {
            await guild.members.ban(targetUserId, { reason: reason });
            await interaction.update({
                embeds: [createRedEmbed('[OK] Ban Approved', `<@${targetUserId}> has been banned.\n**Reason:** ${reason}\n**Approved by:** <@${interaction.user.id}>`)],
                components: []
            });
        } catch (err) {
            await interaction.update({
                embeds: [createRedEmbed('[X] Error', 'Failed to ban user. Check bot permissions.')],
                components: []
            });
        }
    }

    if (customId.startsWith('ban_decline_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];

        await interaction.update({
            embeds: [createRedEmbed('[X] Ban Declined', `<@${targetUserId}> will not be banned.\n**Declined by:** <@${interaction.user.id}>`)],
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
            return interaction.reply({ embeds: [createRedEmbed('[X] Expired', 'This button has expired or already been used.')], ephemeral: true });
        }

        if (buttonData.used) {
            return interaction.reply({ embeds: [createRedEmbed('[X] Already Used', 'This button has already been clicked.')], ephemeral: true });
        }

        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ embeds: [createRedEmbed('[X] Not For You', 'Only the mentioned user can click these buttons.')], ephemeral: true });
        }

        const guild = interaction.guild;
        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

        if (!targetMember) {
            return interaction.reply({ embeds: [createRedEmbed('[X] Error', 'Could not find you in the server.')], ephemeral: true });
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
                embeds: [createRedEmbed('[OK] Accepted', `<@${targetUserId}> has accepted the hitter request and received the role.`)],
                components: []
            });
        } catch (err) {
            await interaction.reply({ embeds: [createRedEmbed('[X] Error', 'Failed to add role. Contact an admin.')], ephemeral: true });
        }
    }

    if (customId.includes('_decline') && customId.startsWith('dawuud_')) {
        const parts = customId.split('_');
        const targetUserId = parts[1];
        const uniqueId = `dawuud_${targetUserId}_${parts[2]}`;

        const buttonData = activeButtons.get(uniqueId);

        if (!buttonData) {
            return interaction.reply({ embeds: [createRedEmbed('[X] Expired', 'This button has expired or already been used.')], ephemeral: true });
        }

        if (buttonData.used) {
            return interaction.reply({ embeds: [createRedEmbed('[X] Already Used', 'This button has already been clicked.')], ephemeral: true });
        }

        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ embeds: [createRedEmbed('[X] Not For You', 'Only the mentioned user can click these buttons.')], ephemeral: true });
        }

        buttonData.used = true;
        activeButtons.set(uniqueId, buttonData);

        await interaction.update({
            content: `<@${targetUserId}> has declined our request and won't become a hitter.`,
            embeds: [createRedEmbed('[X] Declined', `<@${targetUserId}> has declined the hitter request.`)],
            components: []
        });
    }
}

// ============ SELECT MENU HANDLER ============
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) return;
    if (interaction.isButton()) return handleButtonInteraction(interaction);
    if (!interaction.isStringSelectMenu()) return;

    const customId = interaction.customId;

    // ==================== PROMOTE SELECT MENU ====================
    if (customId.startsWith('promote_select_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const requesterId = parts[3];

        if (interaction.user.id !== requesterId) {
            return interaction.reply({
                embeds: [createRedEmbed('[X] Not For You', 'Only the command user can select a role.')],
                ephemeral: true
            });
        }

        const selectedRoleId = interaction.values[0];
        const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

        if (!targetMember) {
            return interaction.update({
                embeds: [createRedEmbed('[X] Error', 'User is no longer in the server.')],
                components: []
            });
        }

        // Check if role has dangerous permissions
        const isDangerous = await hasDangerousPermissions(interaction.guild, selectedRoleId);
        if (isDangerous) {
            return interaction.update({
                embeds: [createRedEmbed('[X] Dangerous Role', 'You cannot assign roles with administrator or dangerous permissions.')],
                components: []
            });
        }

        const rankConfirmChannel = await client.channels.fetch(CONFIG.channels.RANK_CONFIRM);

        const confirmEmbed = createRedEmbed('[!] Promote Request',
            `**Requester:** <@${requesterId}>\n**Target:** <@${targetUserId}>\n**Role:** <@&${selectedRoleId}>\n\nAn admin needs to approve this promotion.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`rank_confirm_${targetUserId}_${selectedRoleId}_${requesterId}_${Date.now()}`)
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`rank_decline_${targetUserId}_${selectedRoleId}_${requesterId}_${Date.now()}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        await rankConfirmChannel.send({ embeds: [confirmEmbed], components: [row] });
        await interaction.update({
            embeds: [createRedEmbed('[...] Awaiting Approval', 'Your promotion request has been sent for admin approval.')],
            components: []
        });
    }

    // ==================== DEMOTE SELECT MENU ====================
    if (customId.startsWith('demote_select_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const requesterId = parts[3];

        if (interaction.user.id !== requesterId) {
            return interaction.reply({
                embeds: [createRedEmbed('[X] Not For You', 'Only the command user can select a role.')],
                ephemeral: true
            });
        }

        const selectedRoleId = interaction.values[0];
        const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

        if (!targetMember) {
            return interaction.update({
                embeds: [createRedEmbed('[X] Error', 'User is no longer in the server.')],
                components: []
            });
        }

        const rankConfirmChannel = await client.channels.fetch(CONFIG.channels.RANK_CONFIRM);

        const confirmEmbed = createRedEmbed('[!] Demote Request',
            `**Requester:** <@${requesterId}>\n**Target:** <@${targetUserId}>\n**Role to remove:** <@&${selectedRoleId}>\n\nAn admin needs to approve this demotion.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`demote_confirm_${targetUserId}_${selectedRoleId}_${requesterId}_${Date.now()}`)
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`demote_decline_${targetUserId}_${selectedRoleId}_${requesterId}_${Date.now()}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        await rankConfirmChannel.send({ embeds: [confirmEmbed], components: [row] });
        await interaction.update({
            embeds: [createRedEmbed('[...] Awaiting Approval', 'Your demotion request has been sent for admin approval.')],
            components: []
        });
    }
});

// ============ PREFIX COMMAND HANDLER ============
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('.')) return;

    const args = message.content.slice(1).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    // ==================== PROMOTE COMMAND ====================
    if (command === 'promote') {
        const member = message.member;
        const highestRole = getHighestRankRole(member);

        if (!highestRole) {
            return message.reply({ embeds: [createRedEmbed('[X] Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 1) {
            return message.reply({ embeds: [createRedEmbed('[X] Invalid Usage', 'Usage: .promote @user')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('[X] User Not Found', 'Could not find that user.')] });
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply({ embeds: [createRedEmbed('[X] Member Not Found', 'Could not find that member in the server.')] });
        }

        // Get roles ABOVE the user's highest rank (roles they can promote to)
        const promotableRoles = getRolesAboveRank(highestRole);

        if (promotableRoles.length === 0) {
            return message.reply({ embeds: [createRedEmbed('[X] No Roles Available', 'You are at the highest rank and cannot promote anyone further.')] });
        }

        // Filter out roles the target already has and dangerous roles
        const availablePromotions = [];
        for (const roleId of promotableRoles) {
            if (targetMember.roles.cache.has(roleId)) continue;
            const isDangerous = await hasDangerousPermissions(message.guild, roleId);
            if (isDangerous) continue;
            availablePromotions.push(roleId);
        }

        if (availablePromotions.length === 0) {
            return message.reply({ embeds: [createRedEmbed('[X] No Roles Available', 'This user cannot be promoted any further by you, or all available roles have dangerous permissions.')] });
        }

        // Build select menu options
        const selectOptions = [];
        for (const roleId of availablePromotions) {
            const role = message.guild.roles.cache.get(roleId);
            if (role) {
                selectOptions.push({
                    label: role.name,
                    value: roleId,
                    description: `Promote to ${role.name}`
                });
            }
        }

        const embed = createRedEmbed('[!] Promote User',
            `**Target:** <@${targetUser.id}>\n\nSelect a role to promote them to from the dropdown below.\n\n*Only showing roles above your rank that the user doesn't already have.*`);

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`promote_select_${targetUser.id}_${member.id}_${Date.now()}`)
                .setPlaceholder('Select a role to promote to')
                .addOptions(selectOptions)
        );

        await message.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    }

    // ==================== DEMOTE COMMAND ====================
    if (command === 'demote') {
        const member = message.member;
        const highestRole = getHighestRankRole(member);

        if (!highestRole) {
            return message.reply({ embeds: [createRedEmbed('[X] Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 1) {
            return message.reply({ embeds: [createRedEmbed('[X] Invalid Usage', 'Usage: .demote @user')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('[X] User Not Found', 'Could not find that user.')] });
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply({ embeds: [createRedEmbed('[X] Member Not Found', 'Could not find that member in the server.')] });
        }

        // Get roles UNDER the user's highest rank (roles they can demote)
        const demotableRoles = getRolesUnderRank(highestRole);

        // Filter to only roles the target actually has
        const targetDemotableRoles = demotableRoles.filter(roleId => targetMember.roles.cache.has(roleId));

        if (targetDemotableRoles.length === 0) {
            return message.reply({ embeds: [createRedEmbed('[X] No Roles to Demote', 'This user has no rank roles under your rank that can be demoted.')] });
        }

        // Filter out dangerous roles
        const availableDemotions = [];
        for (const roleId of targetDemotableRoles) {
            const isDangerous = await hasDangerousPermissions(message.guild, roleId);
            if (isDangerous) continue;
            availableDemotions.push(roleId);
        }

        if (availableDemotions.length === 0) {
            return message.reply({ embeds: [createRedEmbed('[X] No Roles to Demote', 'This user has no demotable roles under your rank (all remaining roles may have dangerous permissions).')] });
        }

        // Build select menu options
        const selectOptions = [];
        for (const roleId of availableDemotions) {
            const role = message.guild.roles.cache.get(roleId);
            if (role) {
                selectOptions.push({
                    label: role.name,
                    value: roleId,
                    description: `Demote and remove ${role.name}`
                });
            }
        }

        const embed = createRedEmbed('[!] Demote User',
            `**Target:** <@${targetUser.id}>\n\nSelect a role to demote them from using the dropdown below.\n\n*Only showing roles under your rank that the user currently has.*`);

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`demote_select_${targetUser.id}_${member.id}_${Date.now()}`)
                .setPlaceholder('Select a role to demote from')
                .addOptions(selectOptions)
        );

        await message.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    }

    // ==================== WARN COMMAND ====================
    if (command === 'warn') {
        if (!message.member.roles.cache.has(CONFIG.roles.MODERATOR)) {
            return message.reply({ embeds: [createRedEmbed('[X] Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 2) {
            return message.reply({ embeds: [createRedEmbed('[X] Invalid Usage', 'Usage: .warn @user (reason)')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('[X] User Not Found', 'Could not find that user.')] });
        }

        const reason = args.slice(1).join(' ');
        const confirmChannel = await client.channels.fetch(CONFIG.channels.WARN_CONFIRM);

        const embed = createRedEmbed('[!] Warn Confirmation', `**Target:** <@${targetUser.id}>\n**Reason:** ${reason}\n**Moderator:** <@${message.author.id}>`);

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
        await message.reply({ embeds: [createRedEmbed('[OK] Confirmation Sent', `A confirmation message has been sent to <#${CONFIG.channels.WARN_CONFIRM}>.`)] });
    }

    // ==================== WARNINGS COMMAND ====================
    if (command === 'warnings') {
        if (!message.member.roles.cache.has(CONFIG.roles.MODERATOR)) {
            return message.reply({ embeds: [createRedEmbed('[X] Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 1) {
            return message.reply({ embeds: [createRedEmbed('[X] Invalid Usage', 'Usage: .warnings @user')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('[X] User Not Found', 'Could not find that user.')] });
        }

        const userWarnings = warningsData[targetUser.id] || [];

        if (userWarnings.length === 0) {
            return message.reply({ embeds: [createRedEmbed('[OK] No Warnings', `<@${targetUser.id}> has no warnings.`)] });
        }

        let warningsList = '';
        userWarnings.forEach((warn, index) => {
            warningsList += `**${index + 1}.** ${warn.reason} - ${getTimeAgo(warn.timestamp)}\n`;
        });

        const embed = createRedEmbed(`[!] Warnings for ${targetUser.tag}`, warningsList);
        embed.setFooter({ text: `Total: ${userWarnings.length} warning${userWarnings.length !== 1 ? 's' : ''}` });

        await message.reply({ embeds: [embed] });
    }

    // ==================== CLEARWARN COMMAND ====================
    if (command === 'clearwarn') {
        if (!message.member.roles.cache.has(CONFIG.roles.CLEAR_WARN_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('[X] Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 2) {
            return message.reply({ embeds: [createRedEmbed('[X] Invalid Usage', 'Usage: .clearwarn @user (warn number)')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('[X] User Not Found', 'Could not find that user.')] });
        }

        const warnNumber = parseInt(args[1]);
        const userWarnings = warningsData[targetUser.id] || [];

        if (isNaN(warnNumber) || warnNumber < 1 || warnNumber > userWarnings.length) {
            return message.reply({ embeds: [createRedEmbed('[X] Invalid Warning Number', `User has ${userWarnings.length} warning(s).`)] });
        }

        const confirmChannel = await client.channels.fetch(CONFIG.channels.CLEAR_WARN_CONFIRM);
        const embed = createRedEmbed('[!] Clear Warning Confirmation',
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
        await message.reply({ embeds: [createRedEmbed('[OK] Confirmation Sent', `A confirmation message has been sent to <#${CONFIG.channels.CLEAR_WARN_CONFIRM}>.`)] });
    }

    // ==================== CLEARWARNS COMMAND ====================
    if (command === 'clearwarns') {
        if (!message.member.roles.cache.has(CONFIG.roles.CLEAR_WARN_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('[X] Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 1) {
            return message.reply({ embeds: [createRedEmbed('[X] Invalid Usage', 'Usage: .clearwarns @user')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('[X] User Not Found', 'Could not find that user.')] });
        }

        const userWarnings = warningsData[targetUser.id] || [];
        if (userWarnings.length === 0) {
            return message.reply({ embeds: [createRedEmbed('[OK] No Warnings', 'This user has no warnings to clear.')] });
        }

        const confirmChannel = await client.channels.fetch(CONFIG.channels.CLEAR_WARN_CONFIRM);
        const embed = createRedEmbed('[!] Clear All Warnings Confirmation',
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
        await message.reply({ embeds: [createRedEmbed('[OK] Confirmation Sent', `A confirmation message has been sent to <#${CONFIG.channels.CLEAR_WARN_CONFIRM}>.`)] });
    }

    // ==================== MUTE COMMAND ====================
    if (command === 'mute') {
        if (!message.member.roles.cache.has(CONFIG.roles.MUTE_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('[X] Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 2) {
            return message.reply({ embeds: [createRedEmbed('[X] Invalid Usage', 'Usage: .mute @user (duration). Max: 1h or 60m')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('[X] User Not Found', 'Could not find that user.')] });
        }

        const duration = parseDuration(args[1]);
        if (!duration) {
            return message.reply({ embeds: [createRedEmbed('[X] Invalid Duration', 'Use format: 1m to 60m or 1h. Max duration: 1 hour')] });
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply({ embeds: [createRedEmbed('[X] Member Not Found', 'Could not find that member in the server.')] });
        }

        try {
            await targetMember.timeout(duration, `Muted by ${message.author.tag}`);

            const logChannel = await client.channels.fetch(CONFIG.channels.MUTE_LOGS);
            await logChannel.send(`<@${targetUser.id}> muted for ${formatDuration(duration)} by <@${message.author.id}>`);

            await message.reply({
                embeds: [createRedEmbed('[OK] User Muted',
                    `<@${targetUser.id}> has been muted for **${formatDuration(duration)}**.`)]
            });
        } catch (err) {
            await message.reply({ embeds: [createRedEmbed('[X] Error', 'Failed to mute user. Check bot permissions.')] });
        }
    }

    // ==================== UNMUTE COMMAND ====================
    if (command === 'unmute') {
        if (!message.member.roles.cache.has(CONFIG.roles.MUTE_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('[X] Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 1) {
            return message.reply({ embeds: [createRedEmbed('[X] Invalid Usage', 'Usage: .unmute @user')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('[X] User Not Found', 'Could not find that user.')] });
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply({ embeds: [createRedEmbed('[X] Member Not Found', 'Could not find that member in the server.')] });
        }

        try {
            await targetMember.timeout(null);

            const logChannel = await client.channels.fetch(CONFIG.channels.MUTE_LOGS);
            await logChannel.send(`<@${targetUser.id}> unmuted by <@${message.author.id}>`);

            await message.reply({
                embeds: [createRedEmbed('[OK] User Unmuted',
                    `<@${targetUser.id}> has been unmuted.`)]
            });
        } catch (err) {
            await message.reply({ embeds: [createRedEmbed('[X] Error', 'Failed to unmute user. Check bot permissions.')] });
        }
    }

    // ==================== KICK COMMAND ====================
    if (command === 'kick') {
        if (!message.member.roles.cache.has('1497884833446363286')) {
            return message.reply({ embeds: [createRedEmbed('[X] Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 2) {
            return message.reply({ embeds: [createRedEmbed('[X] Invalid Usage', 'Usage: .kick @user (reason)')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('[X] User Not Found', 'Could not find that user.')] });
        }

        if (targetUser.id === message.author.id) {
            return message.reply({ embeds: [createRedEmbed('[X] Error', 'You cannot kick yourself.')] });
        }

        const now = Date.now();
        const lastUsed = kickCooldowns.get(message.author.id);
        if (lastUsed && (now - lastUsed) < 30 * 60 * 1000) {
            const remaining = Math.ceil((30 * 60 * 1000 - (now - lastUsed)) / 1000 / 60);
            return message.reply({ embeds: [createRedEmbed('[...] Cooldown', `You must wait ${remaining} more minute(s) before using .kick again.`)] });
        }

        const reason = args.slice(1).join(' ');
        const confirmChannel = await client.channels.fetch(CONFIG.channels.KICK_BAN_CONFIRM);

        const embed = createRedEmbed('[!] Kick Confirmation',
            `**Target:** <@${targetUser.id}>\n**Reason:** ${reason}\n**Requested by:** <@${message.author.id}>\n\nA higher rank needs to approve this kick.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`kick_confirm_${targetUser.id}_${message.author.id}_${Date.now()}`)
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`kick_decline_${targetUser.id}_${message.author.id}_${Date.now()}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        await confirmChannel.send({ embeds: [embed], components: [row] });
        kickCooldowns.set(message.author.id, now);
        await message.reply({ embeds: [createRedEmbed('[OK] Confirmation Sent', `A kick confirmation has been sent to <#${CONFIG.channels.KICK_BAN_CONFIRM}>.`)] });
    }

    // ==================== BAN COMMAND ====================
    if (command === 'ban') {
        if (!message.member.roles.cache.has('1497884892351041698')) {
            return message.reply({ embeds: [createRedEmbed('[X] Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 2) {
            return message.reply({ embeds: [createRedEmbed('[X] Invalid Usage', 'Usage: .ban @user (reason)')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('[X] User Not Found', 'Could not find that user.')] });
        }

        if (targetUser.id === message.author.id) {
            return message.reply({ embeds: [createRedEmbed('[X] Error', 'You cannot ban yourself.')] });
        }

        const now = Date.now();
        const lastUsed = banCooldowns.get(message.author.id);
        if (lastUsed && (now - lastUsed) < 30 * 60 * 1000) {
            const remaining = Math.ceil((30 * 60 * 1000 - (now - lastUsed)) / 1000 / 60);
            return message.reply({ embeds: [createRedEmbed('[...] Cooldown', `You must wait ${remaining} more minute(s) before using .ban again.`)] });
        }

        const reason = args.slice(1).join(' ');
        const confirmChannel = await client.channels.fetch(CONFIG.channels.KICK_BAN_CONFIRM);

        const embed = createRedEmbed('[!] Ban Confirmation',
            `**Target:** <@${targetUser.id}>\n**Reason:** ${reason}\n**Requested by:** <@${message.author.id}>\n\nA higher rank needs to approve this ban.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`ban_confirm_${targetUser.id}_${message.author.id}_${Date.now()}`)
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`ban_decline_${targetUser.id}_${message.author.id}_${Date.now()}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        await confirmChannel.send({ embeds: [embed], components: [row] });
        banCooldowns.set(message.author.id, now);
        await message.reply({ embeds: [createRedEmbed('[OK] Confirmation Sent', `A ban confirmation has been sent to <#${CONFIG.channels.KICK_BAN_CONFIRM}>.`)] });
    }

    // ==================== BREAK COMMAND ====================
    if (command === 'break') {
        const highestRole = getHighestRankRole(message.member);
        if (!highestRole) {
            return message.reply({ embeds: [createRedEmbed('[X] Permission Denied', 'You do not have permission to use this command.')] });
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

        await message.reply({ embeds: [createRedEmbed('[OK] Break Started', 'Your rank roles have been removed. Use .breakoff to return.')] });
    }

    // ==================== BREAKOFF COMMAND ====================
    if (command === 'breakoff') {
        const userBreakData = breakData[message.author.id];
        if (!userBreakData || !userBreakData.roles || userBreakData.roles.length === 0) {
            return message.reply({ embeds: [createRedEmbed('[X] No Break Data', 'You are not on a break or no data was found.')] });
        }

        for (const roleId of userBreakData.roles) {
            await message.member.roles.add(roleId).catch(() => {});
        }

        delete breakData[message.author.id];
        saveBreakData();

        await message.reply({ embeds: [createRedEmbed('[OK] Welcome Back', 'Your roles have been restored!')] });
    }

    // ==================== DAWUUD COMMAND ====================
    if (command === 'dawuud') {
        if (!message.member.roles.cache.has(CONFIG.roles.DAWUUD_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('[X] Permission Denied', 'You do not have permission to use this command.')] });
        }

        if (args.length < 1) {
            return message.reply({ embeds: [createRedEmbed('[X] Invalid Usage', 'Usage: .dawuud @user')] });
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply({ embeds: [createRedEmbed('[X] User Not Found', 'Could not find that user.')] });
        }

        const now = Date.now();
        const lastUsed = dawuudCooldowns.get(message.author.id);
        if (lastUsed && (now - lastUsed) < 10 * 60 * 1000) {
            const remaining = Math.ceil((10 * 60 * 1000 - (now - lastUsed)) / 1000 / 60);
            return message.reply({ embeds: [createRedEmbed('[...] Cooldown', `You must wait ${remaining} more minute(s) before using .dawuud again.`)] });
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply({ embeds: [createRedEmbed('[X] Member Not Found', 'Could not find that member in the server.')] });
        }

        if (targetMember.roles.cache.has(CONFIG.roles.BREAK_ROLE)) {
            return message.reply({ embeds: [createRedEmbed('[X] Already Has Role', 'This user already has the hitter role.')] });
        }

        dawuudCooldowns.set(message.author.id, now);

        const uniqueId = `dawuud_${targetUser.id}_${Date.now()}`;

        const embed = createRedEmbed('[!] Hitter Request', CONFIG.dawuud.embedMessage)
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

// ============ LOGIN ============
client.login(CONFIG.token);

module.exports = { client, CONFIG };
