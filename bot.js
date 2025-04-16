// Load environment variables
require('dotenv').config();

// Imports
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

// Create bot client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

// Bot ready
client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// Listen for commands
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // !join command
  if (message.content === '!join') {
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) {
      return message.reply('❌ You must be in a voice channel to use this!');
    }

    try {
      joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      message.reply('✅ Joined your voice channel!');
    } catch (err) {
      console.error('Error joining voice channel:', err);
      message.reply('⚠️ Something went wrong trying to join the voice channel.');
    }
  }

  // !leave command
  if (message.content === '!leave') {
    const connection = getVoiceConnection(message.guild.id);
    if (connection) {
      connection.destroy();
      message.reply('👋 Left the voice channel!');
    } else {
      message.reply("I'm not in a voice channel.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
