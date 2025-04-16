import discord
from discord.ext import commands
import youtube_dl
import asyncio
import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Bot setup
intents = discord.Intents.default()
intents.message_content = True
client = commands.Bot(command_prefix="!", intents=intents)

# Global variables for the bot state
vc = None
song_queue = []

# FFmpeg options for audio streaming
ffmpeg_opts = {
    'before_options': '-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5',
    'options': '-vn',
}

# Join the voice channel
@client.command()
async def join(ctx):
    if ctx.author.voice:
        channel = ctx.author.voice.channel
        vc = await channel.connect()
    else:
        await ctx.send("You must join a voice channel first!")

# Leave the voice channel
@client.command()
async def leave(ctx):
    if vc:
        await vc.disconnect()
    else:
        await ctx.send("I'm not in a voice channel!")

# Play a song from YouTube
@client.command()
async def play(ctx, *, song: str):
    if not ctx.author.voice:
        await ctx.send("You need to join a voice channel first!")
        return
    
    channel = ctx.author.voice.channel
    vc = await channel.connect()
    
    # Fetch the song URL from YouTube
    ydl_opts = {
        'format': 'bestaudio/best',
        'extractaudio': True,
        'audioquality': 1,
        'outtmpl': 'downloads/%(id)s.%(ext)s',
        'restrictfilenames': True,
        'noplaylist': True,
        'quiet': True,
        'logtostderr': False,
    }
    
    with youtube_dl.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f'ytsearch:{song}', download=False)
        url = info['entries'][0]['url']
        
    # Play the song
    vc.play(discord.FFmpegPCMAudio(url, **ffmpeg_opts), after=lambda e: print('done', e))

    await ctx.send(f"Now playing: {song}")

# Skip the current song
@client.command()
async def skip(ctx):
    if vc and vc.is_playing():
        vc.stop()
        await ctx.send("Song skipped!")
    else:
        await ctx.send("No song is currently playing.")

# Listens to the message content and handle the music
@client.event
async def on_ready():
    print(f'We have logged in as {client.user}')

# Run the bot with your token from environment variable
client.run(os.getenv('DISCORD_TOKEN'))
