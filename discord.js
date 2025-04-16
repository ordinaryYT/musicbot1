const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.MessageContent] });

// Log when the bot is ready
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Join a voice channel
client.on('messageCreate', async message => {
  if (message.content === '!join') {
    if (message.member.voice.channel) {
      const connection = await message.member.voice.channel.join();
      message.channel.send('Joined the voice channel!');
    } else {
      message.channel.send('You need to join a voice channel first!');
    }
  }

  // Leave the voice channel
  if (message.content === '!leave') {
    if (message.guild.voiceAdapterCreator) {
      message.guild.voiceChannel.leave();
      message.channel.send('Left the voice channel!');
    }
  }

  // Simple text-to-speech (mock response)
  if (message.content.startsWith('!speak')) {
    const text = message.content.slice(7);  // Get text after '!speak '
    message.channel.send(`Bot says: ${text}`);
  }
});

// Log in using your bot token
client.login(process.env.DISCORD_TOKEN);
