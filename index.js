const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, AudioPlayerStatus, createAudioPlayer, createAudioResource, AudioPlayer } = require('@discordjs/voice');
const ytSearch = require('yt-search');
const ytdl = require('ytdl-core');
const dotenv = require('dotenv');
const { Readable } = require('stream');

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const queue = new Map();

client.once('ready', () => {
  console.log('Bot is ready!');
});

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
      console.log(`Attempting to join channel: ${voiceChannel.name}`);
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      connection.on('stateChange', (oldState, newState) => {
        console.log(`Voice connection state changed from ${oldState.status} to ${newState.status}`);
      });

      connection.on('error', (error) => {
        console.error('Voice connection error:', error);
        message.reply('❌ There was an error trying to join the voice channel.');
      });

      message.reply(`✅ Joined the voice channel **${voiceChannel.name}**!`);
    } catch (error) {
      console.error('Error joining voice channel:', error);
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
          player: createAudioPlayer(),
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
});

// Function to play a song
async function playSong(guildId, song) {
  const serverQueue = queue.get(guildId);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guildId);
    return;
  }

  try {
    const stream = ytdl(song.url, { filter: 'audioonly' });
    const resource = createAudioResource(stream, {
      inputType: ytdl.FFMPEG,
    });

    const player = serverQueue.player;

    player.play(resource);
    serverQueue.connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
      serverQueue.songs.shift();
      playSong(guildId, serverQueue.songs[0]);
    });

    serverQueue.textChannel.send(`🎶 Now playing: **${song.title}**`);
  } catch (error) {
    console.error('Error while playing song:', error);
    serverQueue.textChannel.send('❌ There was an error trying to play the song.');
  }
}

client.login(process.env.TOKEN);
