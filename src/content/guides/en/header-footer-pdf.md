---
title: How to add a header and footer to a PDF (with page numbers and date)
description: Put a company name, document title, page numbers like "3 / 10" and the date at the top and bottom of every PDF page. How placeholders work and how to skip the cover.
tool: pdf/header-footer
published: 2026-10-15
order: 9
---

A report merged from several files, a multi-page quote or an application packet looks much tidier with the document name at the top and page numbers at the bottom of every page, and printed pages are easy to put back in order. This guide shows how to add text to the top and bottom of every page of a PDF.

## Steps

1. Open [Add Header and Footer to PDF](/en/pdf/header-footer/).
2. Click "Choose PDF file" or drag the PDF onto the screen.
3. Type the text for "Header (top of page)" and "Footer (bottom of page)", and choose left, center or right alignment for each. You can fill in just one.
4. Choose a font from the list below. For a font you have not used before, click "Download".
5. Check the position in the page preview, click "Add header and footer", then "Download".

## Page numbers and dates with placeholders

Write these placeholders in your text and they are replaced on each page.

| Placeholder | Becomes            | Example    |
| ----------- | ------------------ | ---------- |
| {page}      | That page's number | 3          |
| {total}     | Number of pages    | 10         |
| {date}      | Today's date       | 10/15/2026 |

Common patterns:

- Footer, center: `{page} / {total}` → "3 / 10"
- Footer, center: `- {page} -` → "- 3 -"
- Header, right: `Acme Inc. · Quote`
- Footer, right: `Printed {date}` → "Printed 10/15/2026"

## Leaving the cover blank

Turn on "Skip the first page (cover)" to leave the first page untouched. Pages are still counted from the first page, so the second page shows "2", which matches how most documents count the cover as page 1.

## Avoiding overlap with the content

Headers and footers sit about 10 mm in from the page edge. PDFs with almost no margin, such as scans, may overlap.

- Flip through several pages with ‹ › in the preview to check.
- Choose **Small** to reduce overlap.
- **Gray** keeps the body text readable even where they overlap.

## Only need page numbers?

If you only need numbers, [Add Page Numbers](/en/pdf/page-numbers/) is simpler: no font to download, and a few ready-made styles. To place large text such as "CONFIDENTIAL" over the page, use [Add Watermark to PDF](/en/pdf/watermark/).

## Fonts and your file

Putting text into a PDF needs a font, so a font is downloaded once. It is kept in this browser for next time, and only the characters you use are embedded, so the file barely grows. The PDF is processed only in your browser and never sent anywhere.
