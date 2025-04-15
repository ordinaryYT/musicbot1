const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
require('dotenv').config();

// 🌐 Web server for Render
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🎵 Discord Music Bot is online!'));
app.listen(PORT, () => console.log(`🌐 Web listening on port ${PORT}`));

// 🤖 Discord bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

const queue = new Map(); // guildId -> queue object

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const args = message.content.trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  // === !play ===
  if (command === '!play') {
    const query = args.join(' ');
    if (!query) return message.reply('❌ Please provide a song name or YouTube URL.');
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) return message.reply('❌ You must be in a voice channel.');

    const guildId = message.guild.id;
    let serverQueue = queue.get(guildId);

    let songInfo;
    try {
      const isYoutubeURL = ytdl.validateURL(query);
      if (isYoutubeURL) {
        songInfo = await ytdl.getInfo(query);
      } else {
        const searchResults = await ytdl.search(query, { limit: 1 });
        songInfo = await ytdl.getInfo(searchResults[0].url);
      }

      const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url
      };

      if (!serverQueue) {
        const queueConstruct = {
          textChannel: message.channel,
          voiceChannel: voiceChannel,
          connection: null,
          player: null,
          songs: [],
          playing: true
        };

        queue.set(guildId, queueConstruct);
        queueConstruct.songs.push(song);

        try {
          const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator
          });
          queueConstruct.connection = connection;
          playSong(guildId, queueConstruct.songs[0]);
        } catch (err) {
          console.error(err);
          queue.delete(guildId);
          return message.reply('❌ Could not join the voice channel.');
        }
      } else {
        serverQueue.songs.push(song);
        return message.reply(`✅ **${song.title}** added to the queue.`);
      }
    } catch (err) {
      console.error(err);
      return message.reply('❌ Failed to load the song.');
    }
  }

  // === !skip ===
  if (command === '!skip') {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return message.reply('❌ Nothing is playing.');
    serverQueue.player.stop();
    message.reply('⏭️ Skipped the song.');
  }

  // === !pause ===
  if (command === '!pause') {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue || !serverQueue.player) return message.reply('❌ Nothing is playing.');
    serverQueue.player.pause();
    message.reply('⏸️ Paused.');
  }

  // === !resume ===
  if (command === '!resume') {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue || !serverQueue.player) return message.reply('❌ Nothing to resume.');
    serverQueue.player.unpause();
    message.reply('▶️ Resumed.');
  }

  // === !leave ===
  if (command === '!leave') {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return message.reply('❌ I\'m not in a voice channel.');
    serverQueue.connection.destroy();
    queue.delete(message.guild.id);
    message.reply('👋 Left the voice channel and cleared the queue.');
  }
});

// 🔁 Play function
async function playSong(guildId, song) {
  const serverQueue = queue.get(guildId);
  if (!song) {
    serverQueue.connection.destroy();
    queue.delete(guildId);
    return;
  }

  const stream = ytdl(song.url, { filter: 'audioonly' });
  const resource = createAudioResource(stream, {
    inputType: 'arbitrary',
  });

  const player = createAudioPlayer();
  serverQueue.player = player;
  serverQueue.connection.subscribe(player);

  player.play(resource);
  serverQueue.textChannel.send(`🎶 Now playing: **${song.title}**`);

  player.on(AudioPlayerStatus.Idle, () => {
    serverQueue.songs.shift();
    playSong(guildId, serverQueue.songs[0]);
  });

  player.on('error', error => {
    console.error(`❌ Player error: ${error.message}`);
    serverQueue.songs.shift();
    playSong(guildId, serverQueue.songs[0]);
  });
}

client.login(process.env.TOKEN);
