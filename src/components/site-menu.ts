/**
 * 머리글 메뉴(데스크톱 펼침 메뉴 MegaMenu, 모바일 메뉴 MobileMenu)가 같이 쓰는 목록.
 * 도구는 레지스트리, 가이드는 가이드 목록에서 만든다. 도구·가이드를 더하면 메뉴에도 저절로 들어간다.
 */
import { CATEGORIES } from '../tools/categories';
import { liveTools, sectionsInCategory, visibleCategories } from '../tools/registry';
import { guideCategories, guidesInCategory, slugOf } from '../guides';
import { localeOf, localizePath } from '../i18n/locales';
import { ui } from '../i18n/ui';

export interface MenuItem {
  href: string;
  name: string;
  /** 이름 아래 짧은 설명 (도구만) */
  summary?: string;
  /** 도구 아이콘 (ToolIcon) */
  icon: string[];
  /** 지금 보고 있는 페이지 */
  current: boolean;
}

export interface MenuGroup {
  /** 화면에 보이는 묶음 이름 (도구 묶음, 'PDF 가이드') */
  title: string;
  /** 묶음 이름이 가는 곳 (카테고리 가이드 페이지) */
  href?: string;
  items: MenuItem[];
}

export interface Menu {
  /** 'pdf', 'image', 'guide' */
  id: string;
  name: string;
  /** 지금 페이지가 이 메뉴 안에 있다 */
  current: boolean;
  groups: MenuGroup[];
  /** 판 아래 '전체 보기' 링크 */
  all: { href: string; label: string };
  /** 묶음이 길어 칸을 넘어가도 된다 (가이드). 도구 묶음은 한 칸 안에 둔다 */
  flow?: boolean;
}

export function siteMenus(pathname: string): Menu[] {
  const locale = localeOf(pathname);
  const t = ui(locale);
  const live = new Set(liveTools.map((tool) => tool.id));
  const item = (href: string, rest: Omit<MenuItem, 'href' | 'current'>): MenuItem => ({
    href: localizePath(href, locale),
    current: pathname === localizePath(href, locale),
    ...rest,
  });

  const categories: Menu[] = visibleCategories.map((category) => {
    const name = CATEGORIES[category].text[locale].name;
    const href = localizePath(`/${category}/`, locale);
    return {
      id: category,
      name,
      current: pathname.startsWith(href),
      groups: sectionsInCategory(category)
        .map((section) => ({
          title: section.text[locale],
          items: section.tools
            .filter((tool) => live.has(tool.id))
            .map((tool) =>
              item(tool.href, {
                name: tool.text[locale].name,
                summary: tool.text[locale].summary,
                icon: tool.icon,
              }),
            ),
        }))
        .filter((group) => group.items.length > 0),
      all: { href, label: t.nav.allTools(name) },
    };
  });

  const guideHref = localizePath('/guide/', locale);
  const guides: Menu = {
    id: 'guide',
    name: t.nav.guides,
    current: pathname.startsWith(guideHref),
    groups: guideCategories.map((category) => ({
      title: t.guide.categoryTitle(CATEGORIES[category].text[locale].name),
      href: localizePath(`/guide/${category}/`, locale),
      items: guidesInCategory(category, locale).map((guide) =>
        item(`/guide/${slugOf(guide)}/`, {
          name: guide.data.title,
          icon: liveTools.find((tool) => tool.id === guide.data.tool)!.icon,
        }),
      ),
    })),
    all: { href: guideHref, label: t.nav.allGuides },
    flow: true,
  };

  return [...categories, guides];
}
