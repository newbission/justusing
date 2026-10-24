"""
E2E 테스트용 동영상을 만든다. ffmpeg가 필요하다 (도구의 mediabunny·WebCodecs와 다른 구현으로 만든 기준 파일).

  python3 tests/fixtures/make_video_fixtures.py [파일 이름…]   (이름을 적으면 그 파일만 다시 만든다)

화면은 1초마다 한 가지 색이다 (0초 빨강, 1초 초록, 2초 파랑, 3초 노랑, 4초 자홍, 5초 청록).
첫 장면의 색으로 어디서 잘렸는지 알 수 있다. 키프레임은 2초마다 (0·2·4초).

- clip.mp4          6초, 1280×720, 30fps, H.264 약 800kbps + AAC(48kHz 2채널), 잡음을 얹음
- clip.webm         4초, 640×360, VP9 약 400kbps + Opus, 잡음을 얹음
- silent.mp4        3초, 640×360, H.264, 소리 없음, 잡음 없음 (아주 작아 다시 저장하면 오히려 커진다)
- mpeg4-part2.mp4   2초, MPEG-4 Part 2 화면(WebCodecs가 풀지 못하는 코덱) + AAC
- broken-video.mp4  동영상이 아닌 글자 (못 여는 파일)
- pcm-be.mov        2초, 320×180 H.264 + 빅엔디언 16비트 PCM(카메라 MOV의 twos). WAV에 그대로 못 담는 소리
- sparse-keys.webm, sparse-keys.mp4  16초, 320×180, 키프레임이 맨 앞 하나뿐 (화면 녹화처럼). 빠르게 자르기를 막는지
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
COLORS = ['red', 'lime', 'blue', 'yellow', 'magenta', 'cyan']


def colors(seconds: int, size: str, noise: bool = True) -> list[str]:
    """1초마다 색이 바뀌는 화면 입력과 이어 붙이는 필터.
    noise: 장면마다 바뀌는 잡음을 얹어 실제 영상처럼 비트레이트를 쓰게 한다 (용량 줄이기가 줄일 것이 있게)"""
    args: list[str] = []
    for color in COLORS[:seconds]:
        args += ['-f', 'lavfi', '-i', f'color=c={color}:s={size}:r=30:d=1']
    joined = ''.join(f'[{i}:v]' for i in range(seconds))
    grain = ',noise=alls=12:allf=t' if noise else ''
    return args + [
        '-filter_complex',
        f'{joined}concat=n={seconds}:v=1:a=0{grain},format=yuv420p[v]',
    ]


def tone(seconds: int) -> list[str]:
    return ['-f', 'lavfi', '-i', f'sine=frequency=440:sample_rate=48000:duration={seconds}']


ONLY = sys.argv[1:]


def make(name: str, args: list[str]):
    if ONLY and name not in ONLY:
        return
    path = os.path.join(HERE, name)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args, '-map_metadata', '-1', path], check=True)
    print(name, os.path.getsize(path), 'bytes')


KEY_EVERY_2S = ['-g', '60', '-keyint_min', '60', '-sc_threshold', '0']

make(
    'clip.mp4',
    colors(6, '1280x720')
    + tone(6)
    + ['-map', '[v]', '-map', '6:a', '-ac', '2']
    + ['-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '800k', '-maxrate', '900k', '-bufsize', '1800k', *KEY_EVERY_2S]
    + ['-c:a', 'aac', '-b:a', '96k'],
)
make(
    'clip.webm',
    colors(4, '640x360')
    + tone(4)
    + ['-map', '[v]', '-map', '4:a', '-ac', '2']
    + ['-c:v', 'libvpx-vp9', '-b:v', '400k', '-minrate', '400k', '-maxrate', '400k', *KEY_EVERY_2S, '-c:a', 'libopus', '-b:a', '64k'],
)
make(
    'silent.mp4',
    colors(3, '640x360', noise=False)
    + ['-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', *KEY_EVERY_2S],
)
make(
    'mpeg4-part2.mp4',
    colors(2, '640x360', noise=False)
    + tone(2)
    + ['-map', '[v]', '-map', '2:a', '-c:v', 'mpeg4', '-c:a', 'aac', '-b:a', '64k'],
)

# 키프레임이 맨 앞 하나뿐인 16초 (ffmpeg 시험 화면 + 소리)
SPARSE = [
    '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=16,format=yuv420p',
    *tone(16),
    '-g', '1000', '-keyint_min', '1000', '-sc_threshold', '0',
]
make('sparse-keys.webm', SPARSE + ['-c:v', 'libvpx-vp9', '-b:v', '100k', '-c:a', 'libopus', '-b:a', '32k'])
make('sparse-keys.mp4', SPARSE + ['-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '100k', '-c:a', 'aac', '-b:a', '32k'])

make(
    'pcm-be.mov',
    ['-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=2,format=yuv420p', *tone(2)]
    + ['-ac', '2', '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'pcm_s16be'],
)

if not ONLY or 'broken-video.mp4' in ONLY:
    with open(os.path.join(HERE, 'broken-video.mp4'), 'wb') as file:
        file.write('이 파일은 동영상이 아닙니다. 동영상 도구가 못 여는 파일을 알리는지 확인합니다.\n'.encode() * 4)
    print('broken-video.mp4')
