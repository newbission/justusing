---
title: How to convert WebP and PNG to JPG
description: When a saved WebP will not open, or a PNG is too big. The differences between JPG, PNG and WebP, which to choose, and how to handle iPhone HEIC photos.
tool: image/convert
published: 2026-10-15
updated: 2026-10-23
order: 7
---

Save an image from the web and you may get a `.webp` file that your document app or an upload form will not accept. Or a PNG screenshot is too big and you want it as a JPG. This guide shows how to change image formats in your browser without uploading anything, and which format to choose.

## Steps

1. Open [Convert Image](/en/image/convert/).
2. Click "Choose image files" or drag the images onto the screen. You can add many at once, even in mixed formats.
3. Choose **JPG**, **PNG** or **WebP**. The list shows each change, such as "WEBP → JPG".
4. Click "Convert images".
5. For one image, click "Download". For several, click "Download all" to get one ZIP.

The file name stays the same and only the extension changes (for example, `cat.webp` → `cat.jpg`).

## How the three formats differ

| Format | Traits                                                   | Best for                              |
| ------ | -------------------------------------------------------- | ------------------------------------- |
| JPG    | Opens almost anywhere, small for photos, no transparency | Uploads and attachments, photos       |
| PNG    | Lossless, supports transparency, large for photos        | Screenshots, logos, text-heavy images |
| WebP   | Smaller than JPG and PNG, supports transparency          | Websites and blogs                    |

In most cases: **JPG if it has to open everywhere**, **PNG if you need transparency or crisp text**, **WebP if it is going on the web**.

![The word 'Notifications' enlarged from the sample screenshot (PNG) and its JPG and WebP versions. The PNG original is 28 KB with clean edges, the JPG is larger at 36 KB with faint smudges around the letters, and the WebP is 16 KB](../../../assets/guides/en/convert-image/formats.png)

This is text enlarged from the actual results of converting a screenshot. Images with lots of text and flat color can get bigger as JPG, with slightly blurry letter edges. Keep such images as PNG or choose WebP.

## Good to know

- **Transparency**: JPG has none, so transparent areas in a PNG or WebP are filled with white. Convert images such as logos to PNG or WebP if transparency matters.
- **Quality**: converting to PNG is lossless. JPG and WebP are saved at high quality, so the difference is hard to see. Re-saving lossy formats (JPG, WebP) many times adds up small losses, so keep your originals.
- **File size**: a photo saved as PNG can be several times larger. If the goal is a smaller file, [Compress Image](/en/image/compress/) is a better fit.
- **Animated GIFs**: only the first frame becomes a single image.
- **Location data**: images are redrawn and saved again, so EXIF data such as location is not kept.

## What about iPhone photos (HEIC)?

iPhones take photos in HEIC by default. HEIC is smaller than JPG, but many Windows PCs and websites cannot open it.

- Add HEIC files to this tool as they are and convert them to JPG. Safari reads HEIC by itself; Chrome, Edge and Firefox first load a HEIC reader once and open the photo inside the browser.
- If you only have iPhone photos, see the [HEIC to JPG](/en/image/heic-to-jpg/) tool and [How to convert HEIC photos to JPG](/en/guide/heic-to-jpg/).
- To get JPG for future photos, choose **Settings → Camera → Formats → Most Compatible** on your iPhone.

## Is it safe to convert in the browser?

Images are converted only inside your browser and are never uploaded. Several images are converted at once, matched to your CPU cores. To put the converted images into one PDF, continue with [Image to PDF](/en/pdf/from-image/).
