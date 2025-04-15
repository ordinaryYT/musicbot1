// index.js
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const play = require('play-dl');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.split(' ');
  const command = args.shift().toLowerCase();

  if (command === '!play') {
    const url = args[0];
    if (!url) return message.reply('❌ Please provide a YouTube URL.');
    
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) return message.reply('❌ You must be in a voice channel first.');

    try {
      const stream = await play.stream(url);
      const resource = createAudioResource(stream.stream, { inputType: stream.type });

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator
      });

      const player = createAudioPlayer();
      connection.subscribe(player);
      player.play(resource);

      message.reply(`🎶 Now playing: ${url}`);

      player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
      });

    } catch (err) {
      console.error(err);
      message.reply('⚠️ There was an error playing the track.');
    }
  }

  if (command === '!leave') {
    const connection = getVoiceConnection(message.guild.id);
    if (connection) {
      connection.destroy();
      message.reply('👋 Left the voice channel.');
    } else {
      message.reply('❌ I\'m not in a voice channel.');
    }
  }
});

client.login(process.env.TOKEN);
