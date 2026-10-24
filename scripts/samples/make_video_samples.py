"""
동영상 도구(동영상을 GIF로, 장면 캡처)의 '예시 파일로 해 보기' 견본 동영상을 만든다.
결과는 public/samples/<언어>/에 쓰고 커밋한다 (글자가 없어 두 언어가 같은 파일을 쓴다).

  python3 scripts/samples/make_video_samples.py   (Pillow, ffmpeg 필요)

- 직접 그린 그림이다: 하늘·구름·풀밭 위에서 공이 두 번 튀어 오른다 (4초, 640×360, 30fps, H.264, 소리 없음)
- 4초가 끝나면 처음과 같은 자리로 돌아와 GIF로 반복해도 끊기지 않는다
- 같은 입력이면 같은 파일이 나오게 한다 (스레드 하나, 메타데이터 없음)

파일 이름과 도구 연결은 src/frame/samples.ts에 있다. 이름을 바꾸면 거기도 고친다.
"""
import math
import os
import subprocess

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'public', 'samples')
NAMES = {'ko': '예시-공튀기기.mp4', 'en': 'sample-bouncing-ball.mp4'}

WIDTH, HEIGHT, FPS, SECONDS = 640, 360, 30, 4
SCALE = 2
GROUND = 280
BALL = 34
BOUNCES = 2


def sky() -> Image.Image:
    image = Image.new('RGB', (WIDTH * SCALE, HEIGHT * SCALE))
    draw = ImageDraw.Draw(image)
    for y in range(GROUND * SCALE):
        t = y / (GROUND * SCALE)
        color = tuple(round(a + (b - a) * t) for a, b in zip((120, 180, 235), (225, 240, 250)))
        draw.line((0, y, WIDTH * SCALE, y), fill=color)
    for y in range(GROUND * SCALE, HEIGHT * SCALE):
        t = (y - GROUND * SCALE) / ((HEIGHT - GROUND) * SCALE)
        color = tuple(round(a + (b - a) * t) for a, b in zip((110, 175, 90), (70, 130, 60)))
        draw.line((0, y, WIDTH * SCALE, y), fill=color)
    return image


def cloud(draw: ImageDraw.ImageDraw, x: float, y: float, size: float):
    for dx, dy, r in ((0, 0, 1.0), (0.9, -0.35, 0.8), (1.7, 0.05, 0.75), (-0.8, 0.15, 0.6)):
        cx, cy, rr = (x + dx * size) * SCALE, (y + dy * size) * SCALE, r * size * SCALE
        draw.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=(250, 252, 255))


def frame(i: int, background: Image.Image) -> bytes:
    t = i / (FPS * SECONDS)
    image = background.copy()
    draw = ImageDraw.Draw(image)
    # 구름은 한 바퀴(화면 폭)를 4초에 정확히 돌아 처음 장면과 이어진다
    for base, y, size, speed in ((80, 70, 30, 1), (420, 110, 22, 2)):
        x = (base + t * speed * (WIDTH + 200)) % (WIDTH + 200) - 100
        cloud(draw, x, y, size)
    # 공: 왼쪽에서 오른쪽으로 갔다가 돌아온다 (가로는 코사인), 튀기는 |sin|
    x = WIDTH / 2 - math.cos(t * 2 * math.pi) * 200
    phase = (t * BOUNCES) % 1
    height = 170 * math.sin(phase * math.pi)
    squash = max(0.0, 1 - height / 12) * 0.25
    y = GROUND - BALL - height + BALL * squash
    rx, ry = BALL * (1 + squash), BALL * (1 - squash)
    shadow = 1 - height / 220
    draw.ellipse(
        ((x - BALL * shadow) * SCALE, (GROUND - 6 * shadow) * SCALE,
         (x + BALL * shadow) * SCALE, (GROUND + 6 * shadow) * SCALE),
        fill=(60, 110, 50),
    )
    draw.ellipse(((x - rx) * SCALE, (y - ry) * SCALE, (x + rx) * SCALE, (y + ry) * SCALE), fill=(235, 90, 50))
    # 공의 줄무늬와 빛
    draw.arc(((x - rx) * SCALE, (y - ry * 0.35) * SCALE, (x + rx) * SCALE, (y + ry * 0.35) * SCALE),
             0, 180, fill=(255, 220, 90), width=5 * SCALE)
    draw.ellipse(((x - rx * 0.55) * SCALE, (y - ry * 0.7) * SCALE, (x - rx * 0.15) * SCALE, (y - ry * 0.35) * SCALE),
                 fill=(255, 170, 140))
    return image.resize((WIDTH, HEIGHT), Image.LANCZOS).filter(ImageFilter.SMOOTH_MORE).tobytes()


def main():
    background = sky()
    path = os.path.join(OUT, 'en', NAMES['en'])
    process = subprocess.Popen(
        [
            'ffmpeg', '-y', '-loglevel', 'error',
            '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{WIDTH}x{HEIGHT}', '-r', str(FPS), '-i', '-',
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-profile:v', 'main',
            '-g', str(FPS), '-threads', '1', '-movflags', '+faststart',
            '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact',
            path,
        ],
        stdin=subprocess.PIPE,
    )
    for i in range(FPS * SECONDS):
        process.stdin.write(frame(i, background))
    process.stdin.close()
    if process.wait() != 0:
        raise SystemExit('ffmpeg 실패')
    with open(path, 'rb') as file:
        data = file.read()
    with open(os.path.join(OUT, 'ko', NAMES['ko']), 'wb') as file:
        file.write(data)
    print(f'{NAMES["en"]}, {NAMES["ko"]}: {len(data):,} bytes')


if __name__ == '__main__':
    main()
