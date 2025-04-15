const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} = require('@discordjs/voice');
const googleTTS = require('google-tts');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith('!say')) {
    const input = message.content.slice(5).trim();
    if (!input) return;

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return;

    try {
      // 🔁 Request from OpenRouter (GPT-3.5 model)
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'openai/gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful voice assistant.' },
            { role: 'user', content: input },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const aiReply = response.data.choices[0].message.content;
      console.log('🧠 AI Reply:', aiReply);

      // 🗣 Convert AI reply to speech using Google TTS
      const ttsUrl = googleTTS.getAudioUrl(aiReply, {
        lang: 'en',
        slow: false,
        host: 'https://translate.google.com',
      });

      const filePath = './tts.mp3';
      const audioStream = await axios({ url: ttsUrl, responseType: 'stream' });
      const writer = fs.createWriteStream(filePath);
      audioStream.data.pipe(writer);

      await new Promise((resolve) => writer.on('finish', resolve));

      // 🎧 Join voice channel and play audio
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      const player = createAudioPlayer();
      const resource = createAudioResource(filePath);
      player.play(resource);
      connection.subscribe(player);

      player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
      });
    } catch (err) {
      console.error('❌ AI Error:', JSON.stringify(err.response?.data || err.message, null, 2));
    }
  }
});

client.login(process.env.TOKEN);
