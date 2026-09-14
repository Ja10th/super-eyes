import asyncio
import os
import edge_tts
NEW_VOICES = {
    "zigzag": "exercise: zig-zag stepping. follow the stepping wave pattern smoothly with your eyes only.",
    "diamond": "exercise: diamond quadrant tracking. follow the ball along the diamond perimeter.",
    "star": "exercise: star trajectory. trace the five points of the star without moving your head.",
    "hourglass": "exercise: hourglass sweep. follow the ball along the vertical hourglass contours.",
    "butterfly": "exercise: butterfly oscillations. follow the fluid wing contours smoothly.",
    "pendulum": "exercise: pendulum arc. track the rhythmic swinging arc without moving your head."
}
async def generate():
    voice = "en-US-BrianMultilingualNeural"
    output_dir = "public/audio/voice"
    os.makedirs(output_dir, exist_ok=True)
    
    for name, text in NEW_VOICES.items():
        out_path = os.path.join(output_dir, f"{name}.mp3")
        c = edge_tts.Communicate(text, voice, rate="-2%", pitch="-1Hz")
        await c.save(out_path)
        print(f"saved {name} ({os.path.getsize(out_path)} bytes)")
    print("ALL_NEW_VOICES_DONE")
if __name__ == "__main__":
    asyncio.run(generate())
