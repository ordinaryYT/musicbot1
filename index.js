const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search'); // Import yt-search
const express = require('express'); // Import express for HTTP server
require('dotenv').config();

const queue = new Map(); // guildId -> queue object

// Create an Express app
const app = express();
const port = process.env.PORT || 3000; // Set port from env or default to 3000

// Set up a basic route for health check
app.get('/', (req, res) => {
  res.send('Bot is running');
});

// Start the Express server
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

// Create the Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

// When the bot logs in
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Listen to messages
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const args = message.content.trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  // === !join ===
  if (command === '!join') {
    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
      return message.reply('❌ You need to join a voice channel first!');
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator
      });
      message.reply(`✅ Joined the voice channel **${voiceChannel.name}**!`);
    } catch (error) {
      console.error(error);
      message.reply('❌ There was an error trying to join the voice channel.');
    }
  }

  // === !play ===
  if (command === '!play') {
    const query = args.join(' ');
    if (!query) return message.reply('❌ Please provide a song name or YouTube URL.');
    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) return message.reply('❌ You must be in a voice channel.');

    const guildId = message.guild.id;
    let serverQueue = queue.get(guildId);

    let songInfo;
    try {
      const isYoutubeURL = ytdl.validateURL(query);
      if (isYoutubeURL) {
        songInfo = await ytdl.getInfo(query);
      } else {
        // Search by song name
        const results = await ytSearch(query);
        const song = results.videos[0];
        songInfo = await ytdl.getInfo(song.url);
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
