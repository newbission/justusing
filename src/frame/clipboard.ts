/**
 * 글자를 클립보드에 복사한다 (격리 frame 안에서). 버튼을 누른 순간에 불러야 한다.
 *
 * 바깥 페이지가 iframe에 clipboard-write를 허용한다 (ToolFrame). 그래도 막히는 브라우저가 있어
 * 보이지 않는 글자 칸을 골라 복사하는 옛 방식으로 한 번 더 해 본다. 복사한 글자는 이 기기 안에만 있다.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.className = 'visually-hidden';
    document.body.append(area);
    area.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}
