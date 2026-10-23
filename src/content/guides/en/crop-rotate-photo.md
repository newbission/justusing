---
title: How to straighten a photo and crop it to any aspect ratio
description: How to level a tilted photo and crop it to the ratio of where you post it, such as 1:1, 4:5 or 16:9. Learn why straightening trims the edges, why some photos appear sideways, and how to choose a ratio.
tool: image/crop
published: 2026-10-23
order: 26
---

Photos of the sea or buildings often turn out with a slightly tilted horizon. Even a few degrees makes the whole picture look off balance. Each place you post also has its own aspect ratio, so Instagram may cut off the sides and a profile picture may push a face toward the edge. Level the photo first and crop it to the ratio you need, and you decide which part stays.

## The order: rotate → straighten → crop

With [Crop & Rotate Image](/en/image/crop/), this order saves you from redoing work:

1. **Fix the orientation**: if the photo lies on its side, stand it up with "Rotate left 90°" or "Rotate right 90°". Fix a mirrored selfie with "Flip horizontally"
2. **Level it**: move the Straighten slider until the horizon or the edge of a building lines up with the grid lines. It moves in 0.1° steps, and the arrow keys nudge it too
3. **Crop**: pick a ratio and drag the bright box to the part you want to keep

The crop box turns and flips together with the photo, so you do not have to set it again if you cropped first.

<picture>
  <source media="(prefers-reduced-motion: no-preference)" srcset="/guide-motion/en/crop-rotate-photo/straightened.webp" type="image/webp" />
  <img src="/guide-motion/en/crop-rotate-photo/straightened-still.webp" alt="The tilted sea photo (1600×1200) turns by 4° until the horizon is level, then everything outside the 4:5 box is cut away, leaving the result (960×1200)" width="733" height="400" loading="lazy" decoding="async" />
</picture>

This is the actual result of straightening the sample photo by 4° and cropping it to 4:5 with this tool. The last panel is exactly what the tool produced.

## Why straightening trims the edges

When a rectangular photo is turned, empty triangles appear in its four corners. Filling them with white or black would be noticeable, so the tool enlarges the photo just enough to fill the frame. That is why the edges are trimmed slightly.

The more you turn, the more is trimmed. Turning a 4:3 photo by 2° keeps about 95% of its width and height, but turning it by 10° trims away nearly 20%. If something important sits near the edge, turn only as much as you need. Lining the horizon up with the grid lines on the screen makes leveling easy.

## Which ratio to choose

| Ratio | Where it is used                                                        |
| ----- | ----------------------------------------------------------------------- |
| 1:1   | Profile pictures, square posts, product photos in online store listings |
| 4:5   | Instagram portrait posts (they appear largest in the feed)              |
| 9:16  | Stories, Reels and Shorts that fill a phone screen                      |
| 16:9  | YouTube thumbnails, slides, desktop wallpapers                          |
| 3:2   | Standard camera photos, 4×6 inch prints                                 |
| 4:3   | The default ratio of phone photos, older slide formats                  |

Matching the ratio keeps the photo from being cut where you post it. If you need an exact pixel size such as 1080×1350, crop to the ratio first and then change the size with [Resize Image](/en/image/resize/). Enlarging makes photos blurry, so if the cropped result is smaller than you need, crop a larger area instead.

## When a photo appears sideways only in some places

Phones always store the pixels in the same direction and write how the phone was held into an orientation tag (EXIF Orientation) inside the photo. Phone galleries and most browsers read this tag and show the photo upright, but some older programs and websites ignore it, so the photo appears sideways.

This tool applies the tag and saves the photo the way it looks. The result has no orientation tag and the pixels themselves are upright, so it looks the same wherever it is opened. Even if you do not need to rotate or crop, just open it and download it.

## Good to know when saving

- **Format**: the original format (JPG, PNG or WebP) is chosen at first. JPG suits photos; choose PNG if there must be no quality loss at all
- **Quality**: the image is saved again, so JPG and WebP may lose a tiny bit of quality (92% quality). Straightening recalculates the pixels, so the image becomes very slightly softer
- **Photo information**: the image is redrawn, so details such as location, date and device are not kept. This also removes the location before you post the photo

Opening, rotating, cropping and saving all happen in this browser, and your photo is never uploaded.
