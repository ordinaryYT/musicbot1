// index.js
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
require('dotenv').config();

// 🌐 Web server (for Render)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🎵 Discord Music Bot is alive!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server listening on port ${PORT}`);
});

// 🤖 Discord bot setup
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
    if (!query) return message.reply('❌ Please provide a song name or URL.');
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) return message.reply('❌ You must be in a voice channel.');

    const guildId = message.guild.id;
    let serverQueue = queue.get(guildId);

    let songInfo;
    try {
      const searchResults = await play.search(query, { limit: 1 });
      if (!searchResults.length) return message.reply('🔍 No results found.');
      songInfo = {
        title: searchResults[0].title,
        url: searchResults[0].url
      };
    } catch (err) {
      console.error(err);
      return message.reply('❌ Failed to search for the song.');
    }

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
      queueConstruct.songs.push(songInfo);

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
      serverQueue.songs.push(songInfo);
      return message.reply(`✅ **${songInfo.title}** added to the queue.`);
    }
  }

  // === !skip ===
  if (command === '!skip') {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return message.reply('❌ Nothing is playing.');
    serverQueue.player.stop(); // Triggers the "Idle" event
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
    if (!serverQueue || !serverQueue.player) return message.reply('❌ Nothing is paused.');
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

// === Function to play songs ===
async function playSong(guildId, song) {
  const serverQueue = queue.get(guildId);
  if (!song) {
    serverQueue.connection.destroy();
    queue.delete(guildId);
    return;
  }

  const stream = await play.stream(song.url);
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type
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
