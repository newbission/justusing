import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '중고 거래 사진을 올리기 전에',
        text: '집에서 찍은 물건 사진에는 휴대폰이 적어 둔 촬영 위치가 들어 있을 수 있습니다. 사진 파일을 그대로 올리거나 보내기 전에 위치를 지워 집 주소가 드러나지 않게 합니다.',
      },
      {
        title: '사진 원본을 메일·클라우드로 보낼 때',
        text: '메일 첨부나 클라우드 공유 링크, 메신저의 "원본으로 보내기"는 파일을 그대로 전달해 위치와 찍은 날짜가 함께 갑니다. 보내기 전에 여러 장을 한 번에 지웁니다.',
      },
      {
        title: '블로그·카페에 올릴 사진 정리',
        text: '어디에서 언제 찍었는지 남기고 싶지 않은 여행·일상 사진의 정보를 지웁니다. 날짜순 정리가 필요하면 위치만 지우고 찍은 날짜는 남길 수 있습니다.',
      },
    ],
    howTo: [
      '"이미지 파일 선택" 버튼을 누르거나 사진을 화면으로 끌어다 놓습니다. 목록에서 사진마다 들어 있는 위치·찍은 날짜·기기를 볼 수 있습니다.',
      '지울 정보를 고릅니다. 모든 정보를 지우려면 "모든 정보 지우기"를, 찍은 날짜·기기는 남기려면 "위치만 지우기"를 고릅니다.',
      '"정보 지우기"를 누릅니다. 사진마다 지운 결과가 목록에 보입니다.',
      '한 장이면 "다운로드", 여러 장이면 "모두 받기"를 눌러 ZIP 하나로 받습니다. 목록의 ↓ 버튼으로 한 장씩 받을 수도 있습니다.',
    ],
    faq: [
      {
        q: '사진에 위치가 왜 들어 있나요?',
        a: '휴대폰 카메라는 위치 서비스가 켜져 있으면 찍은 곳의 위도·경도를 사진 파일 안의 EXIF 정보에 적어 둡니다. 화면에는 보이지 않지만 파일을 받은 사람은 사진 앱이나 프로그램으로 쉽게 볼 수 있습니다.',
      },
      {
        q: 'SNS에 올리면 저절로 지워지지 않나요?',
        a: '많은 SNS와 메신저는 사진을 줄여 올리면서 위치 정보를 지우지만, 서비스마다 다르고 바뀔 수도 있습니다. 메일 첨부, 클라우드 공유, 메신저의 원본 보내기처럼 파일을 그대로 전달하면 정보가 그대로 남습니다. 확실하게 하려면 보내기 전에 지우세요.',
      },
      {
        q: '화질이 나빠지나요?',
        a: '아니요. 사진을 다시 저장하지 않고 파일 안의 정보 부분만 떼어 냅니다. 그림 자료는 한 바이트도 바뀌지 않아 화질과 가로·세로가 그대로입니다. 다만 HDR 사진은 사진 뒤에 붙은 밝기 정보가 함께 빠져 일반 사진으로 보입니다. 아이폰 HEIC의 HDR 밝기 그림은 남지만 그 설정이 적힌 정보 칸이 비워져 HDR로 보이지 않을 수 있습니다.',
      },
      {
        q: '"모든 정보 지우기"와 "위치만 지우기"는 무엇이 다른가요?',
        a: '"모든 정보 지우기"는 위치, 찍은 날짜, 기기, 편집 프로그램 기록, 설명 글을 모두 지우고 사진 방향 정보만 남깁니다. "위치만 지우기"는 찍은 날짜·기기·렌즈·노출 같은 촬영 정보만 남기고, GPS 위치와 함께 장소가 적힐 수 있는 설명·메모 글, 편집 기록(XMP·IPTC)을 지웁니다. 사진 앱에서 날짜순 정리가 그대로 됩니다.',
      },
      {
        q: '어떤 사진을 넣을 수 있나요?',
        a: 'JPG·PNG·WebP 사진과 아이폰의 HEIC 사진입니다. HEIC도 다시 저장하지 않고 HEIC 그대로 두며, 정보 칸을 그 자리에서 비워 파일 크기도 그대로입니다. HEIC 안에 든 작은 JPEG 그림의 촬영 정보도 함께 비웁니다. 안전하다고 확인한 내용만 든 HEIC만 고치고, 그 밖의 내용이 하나라도 있으면 거기에도 위치가 적힐 수 있어 고치지 않고 "안전하게 지울 수 없다"고 미리 알려 드립니다(이럴 때는 HEIC JPG 변환 도구로 바꾸면 촬영 정보가 모두 빠집니다). 크롬·엣지처럼 HEIC를 스스로 열지 못하는 브라우저에서는 목록에 사진을 보여 주려고 HEIC를 여는 프로그램(libheif, 약 0.5MB)을 우리 사이트에서 받습니다. 움직이는 사진(모션 포토)은 사진 뒤에 붙은 영상 부분도 함께 빠지고 멈춘 사진만 남습니다. 안드로이드의 HDR 사진(Ultra HDR)은 사진 뒤에 붙은 밝기 정보가 빠져 일반 사진으로 보입니다. 이런 사진을 넣으면 지우기 전에 화면에 알려 드립니다.',
      },
      {
        q: '지운 뒤 사진이 옆으로 눕지 않나요?',
        a: '휴대폰 사진은 방향 정보로 바로 세워 보여 주는 경우가 많아, 모든 정보를 지울 때도 방향 정보 한 칸은 새로 적어 둡니다. 그래서 지운 뒤에도 원래처럼 바로 선 채로 보입니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Before posting items for sale',
        text: 'Photos taken at home can include the location your phone recorded. Remove it before you post or send the photo file so your home address is not revealed.',
      },
      {
        title: 'Sending original photos by email or cloud',
        text: 'Email attachments, cloud share links and "send original" in chat apps pass the file as is, so the location and date go with it. Clean several photos at once before you send them.',
      },
      {
        title: 'Photos for a blog or forum',
        text: 'Remove where and when travel or everyday photos were taken. If you still want them sorted by date, remove only the location and keep the date taken.',
      },
    ],
    howTo: [
      'Click "Choose image files" or drag photos onto the screen. The list shows the location, date taken and device found in each photo.',
      'Choose what to remove. Choose "Remove all info" to remove everything, or "Location only" to keep the date taken and device.',
      'Click "Remove info". The list shows the result for each photo.',
      'For one photo, click "Download". For several, click "Download all" to get one ZIP. You can also download each photo with its ↓ button.',
    ],
    faq: [
      {
        q: 'Why is there a location in my photos?',
        a: 'When location services are on, phone cameras write the latitude and longitude into the EXIF data inside the photo file. You cannot see it in the picture, but anyone who gets the file can read it with a photo app or viewer.',
      },
      {
        q: 'Don’t social networks remove it anyway?',
        a: 'Many social networks and chat apps remove location data when they shrink photos for upload, but this differs by service and can change. Email attachments, cloud sharing and sending originals in chat apps pass the file as is, with the data still inside. To be sure, remove it before you send.',
      },
      {
        q: 'Will the quality get worse?',
        a: 'No. The photo is not saved again; only the info part of the file is taken out. The image data is not changed by a single byte, so quality, width and height stay the same. HDR photos, however, lose the brightness data attached after the picture and show as regular photos. In iPhone HEIC photos the HDR brightness image stays, but the info that describes it is blanked out, so they may no longer show as HDR.',
      },
      {
        q: 'What is the difference between "Remove all info" and "Location only"?',
        a: '"Remove all info" removes the location, date taken, device, editing history and descriptions, keeping only the orientation. "Location only" keeps only shooting details such as the date taken, device, lens and exposure, and removes the GPS location along with captions, notes and editing data (XMP, IPTC) where a place could be written. Photo apps still sort by date.',
      },
      {
        q: 'Which photos can I add?',
        a: 'JPG, PNG and WebP photos, and iPhone HEIC photos. HEIC photos are not saved again either: they stay HEIC, and the info is blanked out in place, so the file size stays the same. Photo information inside small JPEG pictures stored in the HEIC is blanked out too. Only HEIC files holding content known to be safe are changed; if anything else is inside, a location could be written there, so the file is left unchanged and the list tells you in advance that it cannot be cleaned safely (converting it with the HEIC to JPG tool removes all photo information). Browsers that cannot open HEIC on their own, such as Chrome and Edge, download a HEIC reader (libheif, about 0.5 MB) from this site to show the photo in the list. For motion photos, the video attached after the picture is removed too, leaving only the still photo. Android HDR photos (Ultra HDR) lose the brightness data attached after the picture and show as regular photos. If you add such photos, the screen tells you before you remove anything.',
      },
      {
        q: 'Will my photos turn sideways?',
        a: 'Phone photos often rely on orientation info to be shown upright, so even when removing all info, a single orientation entry is written back. Your photos stay upright as before.',
      },
    ],
  },
});
