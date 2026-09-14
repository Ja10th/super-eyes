import sys
import os
import asyncio
import edge_tts
VOICE = "en-US-ChristopherNeural"
RATE = "-3%"
PITCH = "-2Hz"
async def generate(text: str, out_path: str):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    tmp_path = out_path + ".tmp"
    c = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
    await c.save(tmp_path)
    if os.path.exists(tmp_path) and os.path.getsize(tmp_path) > 1000:
        os.replace(tmp_path, out_path)
        print(f"SAVED: {out_path} ({os.path.getsize(out_path)} bytes)")
    else:
        raise RuntimeError("Generated file too small or missing")
def main():
    if len(sys.argv) < 3:
        print("Usage: python3 tts_generator.py <text> <out_path>")
        sys.exit(1)
    
    text = sys.argv[1].strip()
    out_path = sys.argv[2].strip()
    if not text:
        sys.exit(0)
    asyncio.run(generate(text, out_path))
if __name__ == "__main__":
    main()
