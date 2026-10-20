---
title: How to extract images from a PDF at original quality
description: Save the photos and pictures inside a PDF as JPG or PNG files with no quality loss. How it differs from screenshots and saving whole pages, and when images cannot be extracted.
tool: pdf/extract-images
published: 2026-10-15
updated: 2026-10-19
order: 14
---

When you need a photo from a catalog, report or paper PDF, a screenshot only captures it at screen size. PDFs usually store the original image file inside, so extracting it gives you the original quality.

## Steps

1. Open [Extract Images from PDF](/en/pdf/extract-images/).
2. Click "Choose PDF file" or drag a PDF onto the screen.
3. The images inside the PDF are listed right away, each with its page number, size in pixels and format.
4. Click "Download" under an image, or "Download all (ZIP)" to get them all at once.

## Is the quality unchanged?

- **JPG images** are extracted byte for byte as stored in the PDF. Nothing is recompressed, so the quality is the same. If the PDF assigns its own color profile, that profile is added to the JPG so the colors match the PDF. Conversely, a color profile inside the JPG that the PDF ignores is removed so other apps do not show different colors. If the JPG carries an orientation value ("rotate when showing"), as phone photos do, the PDF ignores it, so the value is reset to "as is" to look the same. In these cases the bytes differ slightly from the original (the quality is the same). JPGs with transparency are saved as PNG to keep the transparent parts.
- **Other images** (screenshots, transparent pictures and so on) are decoded and saved as PNG, a lossless format.
- You get the size stored in the PDF, even if the image looked small on the page.

## Compared with screenshots and "PDF to Image"

| Method                            | What you get                    | Quality           |
| --------------------------------- | ------------------------------- | ----------------- |
| Screenshot                        | What is on screen               | Screen size       |
| [PDF to Image](/en/pdf/to-image/) | The whole page, text included   | Chosen resolution |
| Extract Images                    | The image files inside the page | Original          |

If you need the page as it looks, text and all, use "PDF to Image". If you only need the pictures, use this tool.

![The edge of the sun in the photo on page 1 of the sample photo PDF, enlarged to the same size. The extracted photo keeps its original 1400×1050 pixels; in the page image from PDF to Image (150 DPI) the same photo is drawn about 940 pixels wide, so the edge is slightly rougher](../../../assets/guides/en/extract-images-pdf/compare.png)

This is the same spot, enlarged to the same size, from the actual results of both methods. The extracted photo has exactly the pixels stored in the PDF; in the page image, the photo only has as many pixels as its size on the page and the chosen resolution allow.

## Tiny images such as icons and lines

PDFs often contain many tiny images, like bullets, lines and icons. By default, images under 50 pixels wide or high are left out. Turn off "Skip tiny images" if you need them.

## When images cannot be extracted

- **Black-and-white scans**: scanners often store pages in fax formats (CCITT, JBIG2), which cannot be extracted. Use [PDF to Image](/en/pdf/to-image/) to save the whole page instead.
- **Print images stored as CMYK pixels** (not JPG), CMYK JPGs with transparency, 16-bit images, images in special color spaces (Lab, spot colors and so on) and images written directly into the page content cannot be extracted either. CMYK JPG photos are extracted as they are. The tool tells you how many were skipped.
- **JPEG 2000** images are extracted as original .jp2 files (or .jpx/.j2k, depending on the format) only when they would look the same as in the PDF. If the PDF sets their colors or transparency separately, they are counted as skipped. Browsers cannot preview them, so open them in an image editor.
- **Drawn graphics** such as charts, diagrams and parts of logos are made of lines and shapes, not photos, so there is no image to extract.

## Why isn't anything uploaded?

Opening a PDF and pulling out its images is quick work for a browser. There is no need to send work or personal documents to a server, and your file never leaves your device.
