"""
동영상 도구(동영상을 GIF로, 장면 캡처) E2E용 동영상을 만든다. Pillow로 장면을 그려 ffmpeg로 묶는다.

  python3 tests/fixtures/make_frame_fixtures.py   (Pillow, ffmpeg 필요)

- color-steps.mp4: 320×180, 30fps, 3초, H.264. 0~1초 빨강, 1~2초 초록, 2~3초 파랑.
  위쪽 띠(0~40px)에서만 흰 네모가 오른쪽으로 움직여 장면마다 조금씩 다르다 (아래쪽 색은 장면 색 그대로).
  키프레임을 0.5초마다 두어 장면 찾기가 빠르다
- not-a-video.mp4: 이름만 MP4인 글자 파일 (열지 못하는 파일)
"""
import os
import subprocess

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
WIDTH, HEIGHT, FPS, SECONDS = 320, 180, 30, 3
COLORS = [(230, 30, 30), (30, 200, 60), (30, 60, 230)]


def frames():
    for i in range(FPS * SECONDS):
        image = Image.new('RGB', (WIDTH, HEIGHT), COLORS[i // FPS])
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, WIDTH, 40), fill=(20, 20, 20))
        x = (i * 3) % (WIDTH - 20)
        draw.rectangle((x, 10, x + 20, 30), fill=(255, 255, 255))
        yield image.tobytes()


def encode(path: str):
    process = subprocess.Popen(
        [
            'ffmpeg', '-y', '-loglevel', 'error',
            '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{WIDTH}x{HEIGHT}', '-r', str(FPS), '-i', '-',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
            '-g', str(FPS // 2), '-threads', '1', '-movflags', '+faststart',
            '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact',
            path,
        ],
        stdin=subprocess.PIPE,
    )
    for frame in frames():
        process.stdin.write(frame)
    process.stdin.close()
    if process.wait() != 0:
        raise SystemExit('ffmpeg 실패')


def main():
    encode(os.path.join(HERE, 'color-steps.mp4'))
    with open(os.path.join(HERE, 'not-a-video.mp4'), 'w') as file:
        file.write('이 파일은 동영상이 아닙니다. This is not a video.\n')
    print('color-steps.mp4, not-a-video.mp4')


if __name__ == '__main__':
    main()
