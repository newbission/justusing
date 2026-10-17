/** 고치기 워커가 알리는 오류 (화면이 알아보고 알맞은 안내를 띄운다). 워커와 화면이 같이 쓰므로 가볍게 둔다 */

/** 인쇄되는 주석·양식 입력값 중 모양을 만들 수 없는 것이 있다 (모양 없이 저장된 한글 입력값 등) */
export const UNRENDERED_ANNOTATION = 'unrendered-annotation';

/**
 * 남길 쪽이 가린 쪽과 내용 스트림을 같이 쓴다 (뒤에 쉼표로 이은 쪽 번호, 0부터). 그 스트림에 가린 글자가 있어
 * 그대로 옮기면 남는다. 화면이 그 쪽도 그림으로 그려 다시 맡긴다
 */
export const SHARED_CONTENT = 'shared-content:';
