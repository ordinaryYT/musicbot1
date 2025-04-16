// Import the necessary libraries
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();

// Set the port, either from the environment variable or default to 3000
const PORT = process.env.PORT || 3000;

// Create a new client instance with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

// Express route for a basic web interface
app.get('/', (req, res) => {
  res.send('Hello from the bot\'s web server!');
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Web server is running on port ${PORT}`);
});

// Log the bot in using your token (this token should be stored securely)
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Handle incoming messages
client.on('messageCreate', async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Command to join a voice channel
  if (message.content === '!join') {
    // Check if the user is in a voice channel
    if (message.member.voice.channel) {
      try {
        // Attempt to join the voice channel
        const connection = await message.member.voice.channel.join();
        message.channel.send('Joined the voice channel!');
      } catch (error) {
        console.error('Error joining the voice channel:', error);
        message.channel.send('Failed to join the voice channel!');
      }
    } else {
      // If the user is not in a voice channel
      message.channel.send('You need to join a voice channel first!');
    }
  }

  // Command to leave the voice channel
  if (message.content === '!leave') {
    if (message.guild.voiceAdapterCreator) {
      message.guild.voiceChannel.leave();
      message.channel.send('Left the voice channel!');
    } else {
      message.channel.send('I am not in a voice channel!');
    }
  }
});

// Log in using your bot's token (use an environment variable to keep it secure)
client.login(process.env.DISCORD_TOKEN);
