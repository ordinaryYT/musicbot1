import os
import discord
from discord.ext import commands
import yt_dlp
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

# Load config
with open('config.json') as f:
    config = json.load(f)

# Spotify API setup
sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
    client_id=SPOTIFY_CLIENT_ID,
    client_secret=SPOTIFY_CLIENT_SECRET
))

# Discord bot setup
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix=config["prefix"], intents=intents)

queue = []

@bot.event
async def on_ready():
    print(f"✅ Logged in as {bot.user}")

def search_youtube(query):
    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'default_search': 'ytsearch',
        'extract_flat': 'in_playlist'
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(query, download=False)
            return info['entries'][0]['url']
        except Exception as e:
            print(f"🔍 YouTube search error: {e}")
            return None

@bot.command()
async def play(ctx, *, query: str):
    if not ctx.author.voice or not ctx.author.voice.channel:
        await ctx.send(config["messages"]["not_in_voice"])
        return

    voice_channel = ctx.author.voice.channel
    if ctx.voice_client is None:
        await voice_channel.connect()

    vc = ctx.voice_client

    # Check if it's a Spotify link
    if "open.spotify.com" in query:
        if "track" in query:
            track_id = query.split("/")[-1].split("?")[0]
            track = sp.track(track_id)
            search_query = f"{track['name']} {track['artists'][0]['name']}"
        else:
            await ctx.send(config["messages"]["spotify_not_supported"])
            return
    else:
        search_query = query

    yt_url = search_youtube(search_query)
    if yt_url:
        queue.append(yt_url)
        await ctx.send(config["messages"]["track_added"].format(track=search_query))
        if not vc.is_playing():
            await play_next(ctx)
    else:
        await ctx.send(config["messages"]["track_not_found"])

async def play_next(ctx):
    if queue:
        vc = ctx.voice_client
        url = queue.pop(0)
        vc.play(discord.FFmpegPCMAudio(url), after=lambda e: bot.loop.create_task(play_next(ctx)))

@bot.command()
async def skip(ctx):
    if ctx.voice_client and ctx.voice_client.is_playing():
        ctx.voice_client.stop()
        await ctx.send(config["messages"]["skipped"])

@bot.command()
async def leave(ctx):
    if ctx.voice_client:
        await ctx.voice_client.disconnect()
        await ctx.send(config["messages"]["disconnected"])

bot.run(DISCORD_TOKEN)
