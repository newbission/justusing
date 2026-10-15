---
title: How to reduce image file size (JPG and PNG)
description: Shrink phone photos and screenshots while keeping them looking the same. How JPG and PNG shrink differently, and when to use WebP.
tool: image/compress
published: 2026-10-15
order: 2
---

A phone photo today is 3–8 MB. Forums ask for "2 MB or less", application forms for "1 MB per file", and the original often will not go through. This guide shows how to shrink images inside your browser without uploading them, and how each format gets smaller.

## Steps

1. Open [Compress Image](/en/image/compress/).
2. Click "Choose image files" or drag the images onto the screen. You can add many at once.
3. Choose how much to shrink. If you are not sure, choose **Balanced**.
4. Click "Compress images". The list shows "old size → new size (N% smaller)" for each image.
5. For one image, click "Download". For several, click "Download all" to get one ZIP file. You can also download each image with its ↓ button.

## JPG photos shrink by quality

JPG makes files small by dropping detail the eye barely notices. How much it drops is called "quality", and phones and cameras usually save at a very high quality. That is why lowering it a little saves a lot of space.

- **Less**: for photos you will zoom into or print.
- **Balanced**: hard to tell apart on screen, and the file is usually half the size or less.
- **More**: the smallest file. Edges may look rough when zoomed in a lot.

## PNG shrinks by color count

Screenshots, logos and drawings saved as PNG have no "quality" setting. Instead, they get smaller by **using fewer colors**. A screenshot often mixes thousands of colors, and cutting them to about 256 is barely visible. This often saves 60–80%.

- **Less**: keeps every color. PNG quality stays the same, so it does not shrink much.
- **Balanced**: reduces to 256 colors.
- **More**: reduces to 128 colors. Smooth gradients may show bands.

Transparent areas stay transparent.

## WebP is even smaller

Choose "Convert to WebP" under Save as to get files about 25–35% smaller than JPG or PNG at the same quality. Modern browsers and most apps open WebP, but some older programs and upload systems do not accept it. If you are not sure where the image will go, "Same format" is the safe choice.

## Still too big? Make it smaller in pixels

Pixel count matters most. Shrinking a 4000×3000 photo to 2000×1500 leaves a quarter of the pixels, and the file shrinks with it. For forums and chat, about 2000 px on the long side is plenty. Resize first with [Resize Image](/en/image/resize/), then compress, for the smallest result.

## Good to know

- **Compact images are left alone.** If re-saving would not make an image smaller, the list says "already compact, kept as is", and the ZIP contains the original.
- **Location data is removed.** The image is redrawn and saved again, so EXIF data such as location, date and device is not kept. This is also handy for removing location data before sharing a photo.
- **Orientation is kept.** Phone photo rotation is applied first, so photos stay upright.
- **Nothing is uploaded.** Everything happens inside your browser, and several images are compressed at once, matched to your CPU cores.
