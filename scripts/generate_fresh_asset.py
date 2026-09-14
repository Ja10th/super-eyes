import asyncio
import os
import wave
import struct
import math
import subprocess
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

async def generate_male_voice():
    import edge_tts
    voice = "en-US-ChristopherNeural"
    output_dir = "public/audio/voice"
    os.makedirs(output_dir, exist_ok=True)
    
    for name, text in VOICE_TEXTS.items():
        out_path = os.path.join(output_dir, f"{name}.mp3")
        print(f"Generating male voice: {name} -> {out_path}")
        communicate = edge_tts.Communicate(text, voice, rate="-3%", pitch="-1Hz")
        await communicate.save(out_path)
    print("MALE_VOICE_GENERATION_COMPLETE")
def generate_clean_ambient_music():
    music_dir = "public/audio/music"
    os.makedirs(music_dir, exist_ok=True)
    sample_rate = 44100
    duration = 90  # 90 second seamless soothing loop
    total_samples = sample_rate * duration
    # 1. Warm Serene Meditation (Zero hum - strictly frequencies between 220Hz and 880Hz, soft acoustic chime harmonics)
    print("Generating hum-free zen meditation track...")
    t1_wav = os.path.join(music_dir, "zen_432hz.wav")
    t1_mp3 = os.path.join(music_dir, "zen_432hz.mp3")
    
    # Beautiful Fmaj9 peaceful chord: F3 (174.6), A3 (220.0), C4 (261.6), E4 (329.6), G4 (392.0)
    chord1 = [174.61, 220.0, 261.63, 329.63, 392.0]
     chord2 = [196.00, 246.94, 293.66, 369.99, 440.0] # Gmaj9
    
    with wave.open(t1_wav, 'wb') as wav_file:
        wav_file.setnchannels(2)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        frames = bytearray()
        
        for i in range(total_samples):
            t = i / sample_rate
            # 16-second chord progression between chord1 and chord2
            chord_mix = (math.sin(2 * math.pi * t / 16.0) + 1) / 2
            
            # Breathing amplitude envelope
            envelope = 0.6 + 0.4 * math.sin(2 * math.pi * t / 8.0)
            
            left_sig = 0.0
            right_sig = 0.0
            
            # Harmonic richness without low frequency drone/buzz
            for f in chord1:
                # Soft sine with gentle second harmonic
                s = 0.07 * math.sin(2 * math.pi * f * t) + 0.02 * math.sin(4 * math.pi * f * t)
                left_sig += s * (1 - chord_mix)
                right_sig += s * (1 - chord_mix)
                
            for f in chord2:
                s = 0.07 * math.sin(2 * math.pi * f * t + 0.3) + 0.02 * math.sin(4 * math.pi * f * t + 0.3)
                left_sig += s * chord_mix
                right_sig += s * chord_mix
                     # Subtle stereo pan modulation
            pan = 0.15 * math.sin(2 * math.pi * t / 12.0)
            left_val = left_sig * (1 - pan) * envelope * 0.55
            right_val = right_sig * (1 + pan) * envelope * 0.55
            
            l_int = max(-32767, min(32767, int(left_val * 32767)))
            r_int = max(-32767, min(32767, int(right_val * 32767)))
            frames.extend(struct.pack('<hh', l_int, r_int))
        wav_file.writeframes(frames)
        
    # 2. Alpha Wave Focus (Clear acoustic glass bell harmony)
    print("Generating alpha wave focus track...")
    t2_wav = os.path.join(music_dir, "alpha_waves.wav")
    t2_mp3 = os.path.join(music_dir, "alpha_waves.mp3")
    
    # D minor 9 tranquil chord (D3 146.8, A3 220.0, C4 261.6, E4 329.6, F4 349.2)
    alpha_chord = [146.83, 220.0, 261.63, 329.63, 349.23, 523.25]
    with wave.open(t2_wav, 'wb') as wav_file:
        wav_file.setnchannels(2)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        frames = bytearray()
         for i in range(total_samples):
            t = i / sample_rate
            env = 0.5 + 0.5 * math.sin(2 * math.pi * t / 10.0)
            
            l_val = sum(0.06 * math.sin(2 * math.pi * f * t) for f in alpha_chord)
            r_val = sum(0.06 * math.sin(2 * math.pi * f * (t + 0.005)) for f in alpha_chord)
            
            l_val = l_val * env * 0.5
            r_val = r_val * env * 0.5
            
            l_int = max(-32767, min(32767, int(l_val * 32767)))
            r_int = max(-32767, min(32767, int(r_val * 32767)))
            frames.extend(struct.pack('<hh', l_int, r_int))
        wav_file.writeframes(frames)
    # 3. Crystal Peace Shimmer
    print("Generating crystal peace track...")
    t3_wav = os.path.join(music_dir, "crystal_calm.wav")
    t3_mp3 = os.path.join(music_dir, "crystal_calm.mp3")
    
    crystal_freqs = [261.63, 329.63, 392.00, 523.25, 659.25]
    with wave.open(t3_wav, 'wb') as wav_file:
        wav_file.setnchannels(2)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        frames = bytearray()
         for i in range(total_samples):
            t = i / sample_rate
            shimmer = 0.6 + 0.4 * math.sin(2 * math.pi * t / 6.0)
            l_val = sum(0.05 * math.sin(2 * math.pi * f * t) for f in crystal_freqs) * shimmer * 0.5
            r_val = sum(0.05 * math.sin(2 * math.pi * f * (t + 0.003)) for f in crystal_freqs) * shimmer * 0.5
            
            l_int = max(-32767, min(32767, int(l_val * 32767)))
            r_int = max(-32767, min(32767, int(r_val * 32767)))
            frames.extend(struct.pack('<hh', l_int, r_int))
        wav_file.writeframes(frames)
    # Convert with ffmpeg and apply highpass filter to eliminate any residual subsonic hum
    for wav, mp3 in [(t1_wav, t1_mp3), (t2_wav, t2_mp3), (t3_wav, t3_mp3)]:
        try:
            subprocess.run([
                "ffmpeg", "-y", "-i", wav,
                "-af", "highpass=f=120,lowpass=f=4500",
                "-b:a", "192k", mp3
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"Converted & Filtered {wav} -> {mp3}")
            if os.path.exists(mp3) and os.path.getsize(mp3) > 0:
                os.remove(wav)
        except Exception as e:
            print(f"FFmpeg error: {e}")
if __name__ == "__main__":
    generate_clean_ambient_music()
    asyncio.run(generate_male_voice())