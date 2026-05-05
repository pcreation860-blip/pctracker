# App Icons Required

For the PWA to work properly on Android devices, you need two icon files in this folder:

## Required Files:
- `icon-192.png` (192x192 pixels)
- `icon-512.png` (512x512 pixels)

## How to Generate:

### Quick Method:
1. Open `generate-icons.html` in your browser
2. Click the "Generate and Download Icons" button
3. Save both files to this `/public/` folder

### Manual Method:
Create PNG images with these specifications:
- **Size:** 192x192 and 512x512 pixels
- **Design:** Blue gradient background with white "P" letter
- **Format:** PNG with transparency support
- **Colors:** 
  - Background: Linear gradient from #3B82F6 to #2563EB
  - Text: White (#FFFFFF)
  - Accent: Yellow (#FCD34D) for the small "T"

## Icon Design:
The default design shows:
- Large white "P" (for Production)
- Small yellow "T" (for Table/Tracker)
- Blue gradient background

Feel free to replace with your company logo!

## Testing:
After adding the icons, test on Android:
1. Open the app in Chrome
2. Look for the install banner
3. Install the app
4. Check if the icon appears correctly on the home screen

If icons don't appear, clear browser cache and try again.
