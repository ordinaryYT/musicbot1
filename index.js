require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const player = createAudioPlayer();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (!message.guild) return;

    const args = message.content.split(' ');
    const command = args[0];

    if (command === '!play') {
        if (!args[1]) return message.reply('Please provide a YouTube link!');
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('Join a voice channel first!');

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        const stream = ytdl(args[1], { filter: 'audioonly' });
        const resource = createAudioResource(stream);
        player.play(resource);
        connection.subscribe(player);

        message.reply('Now playing!');
    }

    if (command === '!stop') {
        player.stop();
        message.reply('Playback stopped.');
    }

    if (command === '!leave') {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
            message.reply('Left the voice channel.');
        } else {
            message.reply('Not in a voice channel.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
