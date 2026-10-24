/**
 * 문서의 "검증·오류·수정 히스토리"(history.md)에서 자동으로 만드는 부분을 채운다.
 *
 *   node scripts/docs/history.mjs            # 모든 기능·기반 문서
 *   node scripts/docs/history.mjs pdf-redact # 하나만
 *
 * 커밋 기록(영역 이름으로 고름)과 GitHub PR·리뷰 지적(gh CLI)을 모아
 * history.md의 <!-- auto:start --> … <!-- auto:end --> 사이만 바꾼다. 그 밖(사람이 쓴 요약)은 그대로 둔다.
 * 브랜치에만 있는(아직 병합 전) 커밋도 넣으려고 origin의 모든 브랜치를 본다.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REPO = 'newbission/justusing';

/**
 * 문서 → 커밋 영역(scope)들과 PR 번호들.
 * 영역이 같은 커밋과, 제목 영역이 같은 PR은 저절로 들어간다. 여러 도구를 한 PR로 만든 경우는 prs로 더한다
 */
const DOCS = {
  // 기능 (도구)
  'features/pdf-view': { scopes: ['pdf-view'], prs: [77] },
  'features/pdf-merge': { scopes: ['pdf-merge'], prs: [61, 77] },
  'features/pdf-split': { scopes: ['pdf-split'], prs: [] },
  'features/pdf-rotate': { scopes: ['pdf-rotate'], prs: [] },
  'features/pdf-organize': { scopes: ['pdf-organize'], prs: [] },
  'features/pdf-to-image': { scopes: ['pdf-to-image'], prs: [29, 66] },
  'features/pdf-from-image': { scopes: ['pdf-from-image'], prs: [29] },
  'features/pdf-unlock': { scopes: ['pdf-unlock'], prs: [31] },
  'features/pdf-protect': { scopes: ['pdf-protect'], prs: [31] },
  'features/pdf-page-numbers': { scopes: ['pdf-page-numbers'], prs: [31] },
  'features/pdf-extract-text': { scopes: ['pdf-extract-text'], prs: [31] },
  'features/pdf-add-image': { scopes: ['pdf-add-image'], prs: [32] },
  'features/pdf-sign': { scopes: ['pdf-sign'], prs: [32] },
  'features/pdf-crop': { scopes: ['pdf-crop'], prs: [32] },
  'features/pdf-compress': { scopes: ['pdf-compress'], prs: [33] },
  'features/pdf-watermark': { scopes: ['pdf-watermark'], prs: [47] },
  'features/pdf-header-footer': { scopes: ['pdf-header-footer'], prs: [50] },
  'features/pdf-n-up': { scopes: ['pdf-n-up'], prs: [52] },
  'features/pdf-edit': { scopes: ['pdf-edit'], prs: [54] },
  'features/pdf-ocr': { scopes: ['pdf-ocr'], prs: [56] },
  'features/pdf-fill-form': { scopes: ['pdf-fill-form'], prs: [60] },
  'features/pdf-redact': { scopes: ['pdf-redact'], prs: [63, 58, 74] },
  'features/pdf-extract-images': { scopes: ['pdf-extract-images'], prs: [59, 75, 77] },
  'features/pdf-metadata': { scopes: ['pdf-metadata'], prs: [61, 76, 77] },
  'features/image-compress': { scopes: ['image-compress'], prs: [36] },
  'features/image-resize': { scopes: ['image-resize'], prs: [36] },
  'features/image-target-size': { scopes: ['image-target-size'], prs: [] },
  'features/image-convert': { scopes: ['image-convert'], prs: [44] },
  'features/image-id-photo': { scopes: ['image-id-photo'], prs: [] },
  'features/image-remove-location': { scopes: ['image-remove-location'], prs: [116] },
  'features/image-stitch': { scopes: ['image-stitch'], prs: [] },
  'features/image-crop': { scopes: ['image-crop'], prs: [] },
  'features/image-mosaic': { scopes: ['image-mosaic'], prs: [] },
  'features/image-heic-to-jpg': { scopes: ['image-heic-to-jpg'], prs: [] },
  'features/image-ocr': { scopes: ['image-ocr', 'ocr'], prs: [] },
  'features/text-csv-encoding': { scopes: ['text-csv-encoding'], prs: [] },
  // 기반 (여러 도구·페이지가 같이 쓰는 것)
  'foundations/frame-isolation': { scopes: ['frame'], prs: [40] },
  'foundations/pdf-common': { scopes: ['pdf'], prs: [76, 77] },
  'foundations/image-common': { scopes: ['image'], prs: [] },
  'foundations/fonts-and-data': { scopes: ['font'], prs: [47] },
  'foundations/site-structure': {
    scopes: ['registry', 'category', 'hub', 'layout', 'theme', 'config', 'dev', 'entitlement'],
    prs: [23, 26, 30],
  },
  'foundations/i18n': { scopes: ['i18n'], prs: [17, 20] },
  'foundations/ads-and-analytics': { scopes: ['ads', 'privacy'], prs: [8, 12, 14] },
  'foundations/seo-and-guides': {
    scopes: ['seo', 'guide', 'about', 'terms'],
    prs: [6, 10, 16, 37],
  },
  // 영역 없는 커밋(docs:·chore:·ci: 등, 규칙·작업 방식·문서 체계)은 여기에 모은다
  'foundations/process': { scopes: [''], prs: [1, 2, 4, 5, 62, 71] },
};

const run = (command, args) =>
  execFileSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** origin의 모든 브랜치에서 커밋 (같은 커밋은 한 번) */
function commits() {
  const out = run('git', [
    'log',
    '--remotes=origin',
    '--no-merges',
    '--date=short',
    '--format=%h%x09%ad%x09%aI%x09%s',
  ]);
  const seen = new Set();
  const list = [];
  for (const line of out.trim().split('\n')) {
    const [hash, date, authored, subject] = line.split('\t');
    // 리베이스로 여러 브랜치에 생긴 같은 커밋은 처음 쓴 시각(초까지)과 제목이 같아 하나만 둔다.
    // 같은 날 같은 제목으로 따로 만든 커밋은 쓴 시각이 달라 둘 다 남는다
    const key = `${authored} ${subject}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const match = /^([a-z]+)(?:\(([^)]*)\))?: (.*)$/.exec(subject);
    if (match) {
      list.push({ hash, date, authored, type: match[1], scope: match[2] ?? '', title: match[3] });
    }
  }
  // git log는 병합 순서(토폴로지)라, 예전에 쓴 브랜치가 늦게 병합되면 날짜가 뒤섞인다. 쓴 시각 순으로 맞춘다
  // (같은 시각이면 git log 순서를 지킨다)
  return list.reverse().sort((a, b) => Date.parse(a.authored) - Date.parse(b.authored));
}

/** 저장소의 모든 PR. 개수 상한 없이 끝 쪽까지 받는다 (빠진 PR의 기록이 지워지지 않게) */
function pulls() {
  const pages = JSON.parse(
    run('gh', ['api', '--paginate', '--slurp', `repos/${REPO}/pulls?state=all&per_page=100`]),
  );
  return pages.flat().map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.merged_at ? 'MERGED' : pr.state === 'open' ? 'OPEN' : 'CLOSED',
    mergedAt: pr.merged_at ?? '',
    headRefName: pr.head.ref,
  }));
}

/**
 * 커밋·PR 제목, 리뷰 지적처럼 그대로 옮기는 글이 Markdown 문법으로 바뀌지 않게 한다 (__proto__ → 굵은 글씨 등).
 * 줄 가운데에 들어가므로 줄 첫머리에서만 뜻이 있는 글자(#, +, 1.)는 두고, 줄 안에서 모양을 바꾸는 글자만 막는다
 */
function plain(text) {
  return text.replace(/[\\`*_[\]<>|~]/g, '\\$&');
}

/** PR의 리뷰 지적(Codex)과 처리 답글. 스레드는 개수 상한 없이 끝 쪽까지 받는다 */
function findings(number) {
  const query = `query($endCursor:String){repository(owner:"newbission",name:"justusing"){pullRequest(number:${number}){reviewThreads(first:100,after:$endCursor){pageInfo{hasNextPage endCursor} nodes{isResolved first:comments(first:1){nodes{body createdAt}} last:comments(last:1){totalCount nodes{body}}}}}}}`;
  const pages = JSON.parse(
    run('gh', ['api', 'graphql', '--paginate', '--slurp', '-f', `query=${query}`]),
  );
  const threads = pages.flatMap((page) => page.data.repository.pullRequest.reviewThreads.nodes);
  return threads.map((thread) => {
    // 지적은 첫 댓글, 처리는 마지막 댓글 (중간에 질문·보충이 끼어도 마지막 처리 내용을 적는다)
    const finding = thread.first.nodes[0];
    const reply = thread.last.totalCount > 1 ? thread.last.nodes[0] : undefined;
    const body = finding?.body ?? '';
    const priority = /(P[0-3]) Badge/.exec(body)?.[1] ?? '';
    const title = (body.split('\n')[0] ?? '')
      .replace(/.*<\/sub><\/sub>\s*/, '')
      .replace(/\*\*/g, '')
      .trim();
    const answer = (reply?.body ?? '').split('\n')[0].trim();
    return {
      date: (finding?.createdAt ?? '').slice(0, 10),
      priority,
      title,
      resolved: thread.isResolved,
      answer,
    };
  });
}

const TYPE_TITLE = {
  feat: '기능',
  fix: '오류 수정',
  refactor: '구조 정리',
  test: '테스트',
  docs: '문서',
  build: '빌드',
  ci: 'CI',
  style: '모양',
  chore: '기타',
};

function render(spec, allCommits, allPulls) {
  const lines = [];
  const prNumbers = new Set(spec.prs);
  for (const pr of allPulls) {
    const scope = /^[a-z]+\(([^)]*)\)/.exec(pr.title)?.[1];
    // dev·main 사이 배포 PR은 빼고 기능 PR만
    if (scope && spec.scopes.includes(scope) && !['dev', 'main'].includes(pr.headRefName)) {
      prNumbers.add(pr.number);
    }
  }
  const prs = allPulls.filter((pr) => prNumbers.has(pr.number)).sort((a, b) => a.number - b.number);
  lines.push('### PR', '');
  if (prs.length === 0) lines.push('- (영역 이름으로 고른 PR 없음. 아래 커밋을 보세요)');
  for (const pr of prs) {
    const state =
      pr.state === 'MERGED'
        ? `병합 ${pr.mergedAt.slice(0, 10)}`
        : pr.state === 'OPEN'
          ? '진행 중'
          : '닫힘';
    lines.push(`- #${pr.number} ${plain(pr.title)} (${state})`);
  }
  lines.push('');

  const mine = allCommits.filter((commit) => spec.scopes.includes(commit.scope));
  lines.push(`### 커밋 (${mine.length}개)`, '');
  for (const type of Object.keys(TYPE_TITLE)) {
    const group = mine.filter((commit) => commit.type === type);
    if (group.length === 0) continue;
    lines.push(`<details><summary>${TYPE_TITLE[type]} ${group.length}개</summary>`, '');
    for (const commit of group)
      lines.push(`- ${commit.date} \`${commit.hash}\` ${plain(commit.title)}`);
    lines.push('', '</details>', '');
  }

  for (const pr of prs) {
    const list = findings(pr.number);
    if (list.length === 0) continue;
    lines.push(`### 리뷰 지적 — #${pr.number} (${list.length}개)`, '');
    lines.push('| 날짜 | 등급 | 지적 | 처리 |', '| --- | --- | --- | --- |');
    for (const item of list) {
      const answer = plain(item.answer.slice(0, 160)) || (item.resolved ? '해결' : '남음');
      const title = plain(item.title);
      lines.push(`| ${item.date} | ${item.priority} | ${title} | ${answer} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

const START = '<!-- auto:start -->';
const END = '<!-- auto:end -->';

function write(path, generated) {
  const file = join(root, 'docs', path, 'history.md');
  written.push(file);
  mkdirSync(dirname(file), { recursive: true });
  const block = `${START}\n<!-- scripts/docs/history.mjs가 만든다. 직접 고치지 않는다 -->\n\n${generated}\n${END}`;
  if (!existsSync(file)) {
    const title = path.split('/').at(-1);
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(
      file,
      `# ${title} — 검증·오류·수정 히스토리\n\n쓴 날 ${today} · 고친 날 ${today}\n\n## 요약\n\n(사람이 쓰는 부분: 중요한 결정, 큰 오류와 원인, 배운 점)\n\n## 기록\n\n${block}\n`,
    );
    return;
  }
  const text = readFileSync(file, 'utf8');
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (start === -1 || end === -1) throw new Error(`${file}: auto 표시가 없습니다`);
  writeFileSync(file, text.slice(0, start) + block + text.slice(end + END.length));
}

/** 쓴 파일들. 끝나면 저장소 포맷(Prettier, CI가 검사)으로 맞춘다 (표 칸 너비 등) */
const written = [];
const only = process.argv[2];
const allCommits = commits();
const allPulls = pulls();
for (const [path, spec] of Object.entries(DOCS)) {
  if (only && !path.endsWith(`/${only}`)) continue;
  write(path, render(spec, allCommits, allPulls));
  console.log('history:', path);
}
if (written.length > 0) run('npx', ['prettier', '--write', ...written]);
