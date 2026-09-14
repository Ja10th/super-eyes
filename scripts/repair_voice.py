import asyncio
import os
import edge_tts
VOICE_TEXTS = {
    "intro_hi": "hi",
    "horizontal": "Exercise one: Horizontal Tracking. Follow the ball smoothly from left to right with your eyes only.",
    "vertical": "Next exercise: Vertical Tracking. Follow the ball up and down without moving your head.",
    "diagonal": "Diagonal Cross. Track the ball smoothly across opposite corners.",
    "circular": "Circular Flow. Follow the ball in a smooth circular orbit. Keep breathing deeply.",
    "infinity": "Infinity Loop. Follow the figure-eight pattern. Relax your eye muscles.",
    "near_far": "Depth Focus. Shift your focus as the target moves between near and far.",
    "saccades": "Fast Saccades. Jump your eyes briskly to each new target position.",
    "rest_blink": "Rest and Blink. Close your eyes gently, take a slow deep breath, and let your eyes completely relax.",
    "spiral": "Spiral Movement. Follow the expanding and contracting spiral path.",
    "peripheral": "Peripheral Awareness. Keep your gaze centered while tracking the outer pulse.",
    "box": "Box Tracking. Follow the ball along each corner of the perimeter.",
    "outro": "Session complete. Great job giving your eyes the reset they deserve today."
}
async def repair_voice():
    voice = "en-US-AriaNeural"
    output_dir = "public/audio/voice"
    os.makedirs(output_dir, exist_ok=True)
    
    for name, text in VOICE_TEXTS.items():
        out_path = os.path.join(output_dir, f"{name}.mp3")
        if not os.path.exists(out_path) or os.path.getsize(out_path) < 1000:
            print(f"Regenerating: {name} -> {out_path}")
            if os.path.exists(out_path):
                os.remove(out_path)
            communicate = edge_tts.Communicate(text, voice, rate="-4%", pitch="-2Hz")
            await communicate.save(out_path)
        else:
            print(f"Valid: {name} ({os.path.getsize(out_path)} bytes)")
    print("VERIFICATION_COMPLETE")
if __name__ == "__main__":
    asyncio.run(repair_voice())
