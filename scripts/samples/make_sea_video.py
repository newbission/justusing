"""
동영상 도구(자르기·용량 줄이기·소리 뽑기)의 '예시 파일로 해 보기' 견본을 만든다. 결과는 public/samples/<언어>/에 쓰고 커밋한다.

  python3 scripts/samples/make_sea_video.py   (Pillow, ffmpeg 필요)

- 그림과 소리는 모두 이 스크립트가 직접 만든다 (해 지는 바다를 지나는 돛단배 그림 + 짧은 선율과 파도 소리)
- 12초, 1280×720, 30fps, H.264 + AAC. 키프레임은 2초마다 (빠르게 자르기의 키프레임 설명과 맞춘다)
- 글자가 없어 두 언어가 같은 내용을 쓴다 (언어 폴더마다 이름만 다르다)
- 같은 입력이면 같은 그림이 나오게 난수 씨앗을 고정한다

파일 목록과 도구 연결은 src/frame/samples.ts에 있다.
"""
import math
import os
import random
import struct
import subprocess
import tempfile
import wave

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'public', 'samples')
NAMES = {'ko': '예시-바다영상.mp4', 'en': 'sample-sea-video.mp4'}

W, H = 1280, 720
FPS = 30
SECONDS = 12
RATE = 48000
HORIZON = 430


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def sky(t: float) -> Image.Image:
    """t: 0(낮)~1(해 질 녘). 위에서 아래로 번지는 하늘"""
    top = mix((86, 150, 214), (52, 46, 108), t)
    bottom = mix((198, 226, 246), (250, 160, 96), t)
    image = Image.new('RGB', (W, HORIZON))
    draw = ImageDraw.Draw(image)
    for y in range(HORIZON):
        draw.line([(0, y), (W, y)], fill=mix(top, bottom, y / HORIZON))
    return image


rng = random.Random(7)
CLOUDS = [(rng.uniform(0, W), rng.uniform(40, 220), rng.uniform(70, 150)) for _ in range(6)]
SPARKLES = [(rng.uniform(0, W), rng.uniform(HORIZON + 10, H)) for _ in range(90)]


def frame(index: int) -> Image.Image:
    time = index / FPS
    t = time / SECONDS
    image = Image.new('RGB', (W, H))
    image.paste(sky(t), (0, 0))
    draw = ImageDraw.Draw(image, 'RGBA')

    # 해: 오른쪽 위에서 수평선 쪽으로 내려간다
    sun_x = 880 + 120 * t
    sun_y = 150 + 300 * t
    sun = mix((255, 240, 190), (255, 150, 70), t)
    for glow in range(5, 0, -1):
        radius = 46 + glow * 14
        draw.ellipse(
            [sun_x - radius, sun_y - radius, sun_x + radius, sun_y + radius],
            fill=(*sun, 18),
        )
    draw.ellipse([sun_x - 46, sun_y - 46, sun_x + 46, sun_y + 46], fill=sun)

    # 구름: 천천히 왼쪽으로
    for x, y, size in CLOUDS:
        cx = (x - time * 18) % (W + 300) - 150
        color = (*mix((255, 255, 255), (255, 200, 180), t), 210)
        for dx, dy, r in ((0, 0, 1), (0.7, 0.15, 0.75), (-0.7, 0.2, 0.7)):
            rr = size * 0.45 * r
            draw.ellipse(
                [cx + dx * size * 0.5 - rr, y + dy * size * 0.3 - rr * 0.6,
                 cx + dx * size * 0.5 + rr, y + dy * size * 0.3 + rr * 0.6],
                fill=color,
            )

    # 바다: 아래로 짙어지고 물결 줄이 움직인다
    sea_top = mix((40, 120, 170), (70, 60, 120), t)
    sea_bottom = mix((14, 60, 110), (30, 24, 70), t)
    for y in range(HORIZON, H):
        draw.line([(0, y), (W, y)], fill=mix(sea_top, sea_bottom, (y - HORIZON) / (H - HORIZON)))
    for row in range(14):
        y = HORIZON + 12 + row * 21
        points = [
            (x, y + 4 * math.sin(x / 60 + time * 2.2 + row)) for x in range(0, W + 20, 20)
        ]
        draw.line(points, fill=(255, 255, 255, 40), width=2)
    # 해가 비친 물빛
    for x, y in SPARKLES:
        if abs(x - sun_x) < 160 + (y - HORIZON) * 0.4:
            flicker = 0.5 + 0.5 * math.sin(time * 6 + x)
            draw.line([(x - 8, y), (x + 8, y)], fill=(*sun, round(120 * flicker)), width=2)

    # 돛단배: 왼쪽에서 오른쪽으로, 물결 따라 흔들린다
    bx = -160 + (W + 320) * t
    by = HORIZON + 120 + 6 * math.sin(time * 2.4)
    tilt = 3 * math.sin(time * 2.4 + 0.6)
    hull = [(bx - 90, by), (bx + 90, by), (bx + 60, by + 34), (bx - 60, by + 34)]
    draw.polygon(hull, fill=(120, 62, 40))
    mast_top = (bx + tilt, by - 170)
    draw.line([(bx, by), mast_top], fill=(70, 40, 30), width=6)
    draw.polygon([mast_top, (bx + tilt, by - 12), (bx + 92, by - 14)], fill=(250, 248, 240))
    draw.polygon([(mast_top[0] - 4, by - 150), (bx - 4, by - 14), (bx - 70, by - 16)], fill=(236, 92, 72))
    draw.polygon(
        [(mast_top[0], mast_top[1]), (mast_top[0] + 30, mast_top[1] + 8), (mast_top[0], mast_top[1] + 16)],
        fill=(47, 111, 85),
    )
    return image.filter(ImageFilter.SMOOTH)


def sound(path: str):
    """짧은 선율(도·미·솔·도…)과 낮게 깔린 파도 소리. 2채널 16비트"""
    notes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 349.23, 440.0, 523.25, 440.0, 392.0, 261.63]
    noise = random.Random(11)
    smooth = 0.0
    with wave.open(path, 'wb') as file:
        file.setnchannels(2)
        file.setsampwidth(2)
        file.setframerate(RATE)
        frames = bytearray()
        for i in range(RATE * SECONDS):
            time = i / RATE
            note = notes[min(len(notes) - 1, int(time))]
            within = time - int(time)
            envelope = min(1, within * 20) * math.exp(-within * 2.5)
            tone = 0.22 * envelope * (math.sin(2 * math.pi * note * time) + 0.3 * math.sin(4 * math.pi * note * time))
            smooth = smooth * 0.995 + noise.uniform(-1, 1) * 0.005
            swell = 0.5 + 0.5 * math.sin(2 * math.pi * time / 4)
            waves = smooth * 6 * (0.4 + 0.6 * swell)
            left = max(-1, min(1, tone + waves * 0.9))
            right = max(-1, min(1, tone * 0.9 + waves))
            frames += struct.pack('<hh', round(left * 32000), round(right * 32000))
        file.writeframes(bytes(frames))


def main():
    with tempfile.TemporaryDirectory() as tmp:
        audio = os.path.join(tmp, 'sound.wav')
        sound(audio)
        target = os.path.join(tmp, 'sea.mp4')
        encoder = subprocess.Popen(
            [
                'ffmpeg', '-v', 'error', '-y',
                '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                '-i', audio,
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p',
                '-g', str(FPS * 2), '-keyint_min', str(FPS * 2), '-sc_threshold', '0',
                '-c:a', 'aac', '-b:a', '128k',
                '-movflags', '+faststart', '-map_metadata', '-1', '-shortest', target,
            ],
            stdin=subprocess.PIPE,
        )
        assert encoder.stdin
        for index in range(FPS * SECONDS):
            encoder.stdin.write(frame(index).tobytes())
        encoder.stdin.close()
        encoder.wait()
        data = open(target, 'rb').read()
    for locale, name in NAMES.items():
        with open(os.path.join(OUT, locale, name), 'wb') as file:
            file.write(data)
        print(locale, name, len(data), 'bytes')


main()
