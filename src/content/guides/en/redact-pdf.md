---
title: How to redact a PDF, and why black boxes are not enough
description: Drawing a black rectangle over names, ID numbers or phone numbers in a PDF leaves the text underneath in the file. How to remove covered text for good, and how to check it.
tool: pdf/redact
published: 2026-10-15
updated: 2026-10-16
order: 13
---

Before sending a document, you often need to hide an ID number or an account number. But if you only draw a black rectangle with a PDF editor or a comment tool, the text under it stays in the file. Anyone who copies that area or moves the rectangle can read it again. Personal data has leaked from published documents this way many times.

## Redaction that removes the text

[Redact PDF](/en/pdf/redact/) redraws each redacted page as an image with the boxes painted in, and does not put the original text and images of that page in the new file. The covered text is not left anywhere in the result.

1. Open [Redact PDF](/en/pdf/redact/).
2. Click "Choose PDF file" or drag a PDF onto the screen.
3. Drag on the page to draw black boxes. Use the ‹ › buttons to change pages.
4. For words that appear many times, such as a name, type them in "Find and redact" and click "Redact all matches".
5. Click "Redact and save", then "Download".

## Always check afterwards

- **Go through every page**: Find and redact misses words that break across lines and text on scanned pages. Draw boxes over anything that was missed.
- **Search the result**: open the downloaded PDF and press Ctrl+F for the redacted words. Nothing should be found.
- **Try copying**: drag across a redacted area. Redacted pages are images, so no text is selected.

## What changes in the result

- **Redacted pages become images.** They look the same, but their other text can no longer be selected or searched. To make them searchable again, run the result through [OCR PDF](/en/pdf/ocr/). The redacted areas are painted black, so they are not read back.
- **Other pages stay as they were.** Their text can still be selected and searched. In the rare case that a page shares its content with a redacted page, it becomes an image too so the redacted text does not remain.
- **Document-level information is dropped.** Bookmarks, links, form fields, document information (title, author and so on) and attachments could leak redacted content, so they are not kept. Filled-in form values and printable signatures or comments are drawn onto the page as they look.
- **The file may get bigger**, because redacted pages are stored as images. Shrink it with [Compress PDF](/en/pdf/compress/) if needed.

## Isn't "White out" the same thing?

"White out" in [Edit PDF](/en/pdf/edit/) is for covering a mistake and writing over it, so the text underneath stays in the file. For anything others must not see, use this redaction tool.

## Why isn't anything uploaded?

Uploading a document to a server in order to hide its private parts would defeat the purpose. This tool works inside your browser, and your file never leaves your device.
