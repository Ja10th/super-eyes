import asyncio
import os
import edge_tts
VOICE_TEXTS = {
    "intro_hi": "hi",
    "horizontal": "exercise one: horizontal tracking. follow the ball smoothly from left to right with your eyes only.",
    "vertical": "next exercise: vertical tracking. follow the ball up and down without moving your head.",
    "diagonal": "diagonal cross. track the ball smoothly across opposite corners.",
    "circular": "circular flow. follow the ball in a smooth circular orbit. keep breathing deeply.",
    "infinity": "infinity loop. follow the figure-eight pattern. relax your eye muscles.",
    "near_far": "depth focus. shift your focus as the target moves between near and far.",
    "saccades": "fast saccades. jump your eyes briskly to each new target position.",
    "rest_blink": "rest and blink. close your eyes gently, take a slow deep breath, and let your eyes completely relax.",
    "spiral": "spiral movement. follow the expanding and contracting spiral path.",
    "peripheral": "peripheral awareness. keep your gaze centered while tracking the outer pulse.",
    "box": "box tracking. follow the ball along each corner of the perimeter.",
    "outro": "session complete. great job giving your eyes the reset they deserve today."
}
async def generate_brian():
    # en-US-BrianMultilingualNeural is Microsoft's top ultra-realistic studio male voice
    voice = "en-US-BrianMultilingualNeural"
    output_dir = "public/audio/voice"
    os.makedirs(output_dir, exist_ok=True)
    for name, text in VOICE_TEXTS.items():
        out_path = os.path.join(output_dir, f"{name}.mp3")
        temp_path = out_path + ".tmp"
        c = edge_tts.Communicate(text, voice, rate="-2%", pitch="-1Hz")
        await c.save(temp_path)
        if os.path.exists(temp_path) and os.path.getsize(temp_path) > 5000:
            os.replace(temp_path, out_path)
            print(f"saved brian voice: {name} ({os.path.getsize(out_path)} bytes)")
    print("BRIAN_NEURAL_VOICE_COMPLETE")
if __name__ == "__main__":
    asyncio.run(generate_brian())