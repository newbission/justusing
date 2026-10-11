/**
 * 나누기 범위 입력 해석 (브라우저 없이 도는 함수 테스트).
 */
import { expect, test } from '@playwright/test';
import { parseRanges, rangeLabel } from '../../src/lib/pdf/ranges';

test('범위·한 쪽·쉼표 구분을 해석한다', () => {
  expect(parseRanges('1-3, 4-6, 7', 8)).toEqual({ ok: true, ranges: [[1, 2, 3], [4, 5, 6], [7]] });
});

test('물결표·끝까지·처음부터·줄바꿈을 받는다', () => {
  expect(parseRanges('1~2\n5-\n-1', 6)).toEqual({ ok: true, ranges: [[1, 2], [5, 6], [1]] });
});

test('겹치는 범위도 각각 파일이 된다', () => {
  expect(parseRanges('1-2, 2-3', 3)).toEqual({
    ok: true,
    ranges: [
      [1, 2],
      [2, 3],
    ],
  });
});

test('잘못된 입력은 이유를 알려 준다', () => {
  expect(parseRanges('', 5)).toMatchObject({ ok: false, message: expect.stringContaining('입력') });
  expect(parseRanges('1-9', 5)).toMatchObject({
    ok: false,
    message: expect.stringContaining('9쪽은 없습니다'),
  });
  expect(parseRanges('4-2', 5)).toMatchObject({
    ok: false,
    message: expect.stringContaining('앞 번호'),
  });
  expect(parseRanges('0', 5)).toMatchObject({
    ok: false,
    message: expect.stringContaining('1부터'),
  });
  expect(parseRanges('a', 5)).toMatchObject({
    ok: false,
    message: expect.stringContaining('알 수 없는'),
  });
  expect(parseRanges('-', 5)).toMatchObject({ ok: false });
});

test('쪽 번호 목록을 짧은 이름으로 만든다', () => {
  expect(rangeLabel([1, 2, 3])).toBe('1-3');
  expect(rangeLabel([7])).toBe('7');
  expect(rangeLabel([1, 3, 4])).toBe('1,3,4');
});
