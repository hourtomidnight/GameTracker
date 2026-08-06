# Theme Preset Instructions

Since dynamic theme switching with Tailwind is complex, here's how to manually switch themes:

## Current Theme: Medium Contrast
The tracker is currently set to "Medium Contrast" (the high contrast version you requested).

## To Change Themes:

Download one of these pre-configured files and upload as `index.html`:

### 1. High Contrast (Maximum Visibility)
- Pure black background
- Brightest text (white, orange-100, orange-200)
- 90% opacity cards
- 70% opacity borders

**Changes needed in index.html:**
- Replace all: `from-black via-gray-950 to-black` → `from-black via-black to-black`
- Replace all: `slate-700/80` → `slate-700/90`
- Replace all: `text-orange-200` → `text-orange-100`
- Replace all: `text-orange-300` → `text-orange-200`
- Replace all: `border-orange-400/60` → `border-orange-400/70`

### 2. Medium Contrast (Current - Balanced)
No changes needed - this is the current setup.

### 3. Low Contrast (Softer)
- Dark gray background
- Standard orange text
- 50% opacity cards
- 20-30% opacity borders

**Changes needed:**
- Replace: `from-black via-gray-950 to-black` → `from-gray-950 via-gray-900 to-gray-950`
- Replace: `slate-700/80` → `slate-800/50`
- Replace: `slate-600/90` → `slate-700/50`
- Replace: `text-orange-200` → `text-orange-300`
- Replace: `border-orange-400/60` → `border-orange-500/30`

### 4. Ultra Bright (Brightest Rooms)
- Lighter gray background
- Maximum opacity everywhere
- Ultra-bright borders

**Changes needed:**
- Replace: `from-black via-gray-950 to-black` → `from-gray-800 via-gray-700 to-gray-800`
- Replace: `slate-700/80` → `slate-500/95`
- Replace: `slate-600/90` → `slate-400/95`
- Replace: `text-orange-200` → `text-orange-50`
- Replace: `border-orange-400/60` → `border-orange-300/80`

## Easiest Method:

**Option A**: Test current theme first. If visibility is good, done!

**Option B**: Let me know which theme you want and I'll generate the modified index.html for you.

**Option C**: Use find-and-replace in a text editor to make the changes above.

Which theme would you like me to generate for you to test on tablets?
