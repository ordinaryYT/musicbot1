const { Client, GatewayIntentBits } = require('discord.js');
const SpotifyWebApi = require('spotify-web-api-node');
const ytdl = require('ytdl-core');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
require('dotenv').config();

// Initialize the Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.MessageContent],
});

// Initialize Spotify API client
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// Authenticate with Spotify
async function authenticateSpotify() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
    console.log('Successfully authenticated with Spotify!');
  } catch (err) {
    console.log('Error authenticating with Spotify:', err);
  }
}

// Login to Discord with your app's token
client.login(process.env.TOKEN);

// When the bot is ready
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  authenticateSpotify(); // Authenticate Spotify on bot startup
});

// Command handler for play command
client.on('messageCreate', async (message) => {
  // Ignore messages from the bot itself
  if (message.author.bot) return;

  // Command: !play
  if (message.content.startsWith('!play')) {
    const query = message.content.slice(6).trim(); // Get song name from command
    
    if (!query) {
      return message.reply("Please provide a song name to play!");
    }

    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) {
      return message.reply("You need to join a voice channel first!");
    }

    try {
      // Search for the song on Spotify
      const data = await spotifyApi.searchTracks(query);
      const track = data.body.tracks.items[0];
      if (!track) return message.reply("No results found on Spotify!");

      // Log the song info
      console.log(`Found song: ${track.name}`);
      console.log(`Artist: ${track.artists[0].name}`);
      console.log(`URL: ${track.external_urls.spotify}`);
      console.log(`Duration: ${track.duration_ms / 1000} seconds`);

      // Join the voice channel
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      // Create an audio player
      const player = createAudioPlayer();
      
      // Create an audio resource from the YouTube link (since Discord only supports raw audio streams)
      const stream = ytdl(track.external_urls.spotify, { filter: 'audioonly' });
      const resource = createAudioResource(stream);

      // Play the resource
      player.play(resource);
      connection.subscribe(player);

      // Respond to the user
      message.reply(`Now playing: **${track.name}** by ${track.artists[0].name}`);

      // Handle the end of the song
      player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
      });
    } catch (err) {
      console.error(err);
      message.reply("An error occurred while trying to play the song.");
    }
  }
});
