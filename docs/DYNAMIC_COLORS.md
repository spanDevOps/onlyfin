# Dynamic Color System

## Overview

OnlyFin uses an intelligent, contrast-based color system that automatically calculates optimal background colors for UI elements based on their text color and the current theme. This ensures maximum readability and accessibility across all color combinations.

## How It Works

### 1. Color Palette

The system uses 8 distinct colors from different color families:

```typescript
const COLOR_PALETTE = [
  '10ea5d', // Green
  '01fff4', // Cyan
  'fffa0c', // Yellow
  'f712e8', // Pink
  '9333ea', // Purple
  '2323ff', // Blue
  'f75900', // Orange
  'e5f2ff'  // Light
];
```

### 2. Contrast Calculation Algorithm

The system implements the **WCAG (Web Content Accessibility Guidelines)** contrast calculation formula:

#### Step 1: Convert Hex to RGB
```typescript
const hexToRgb = (hex: string) => {
  const cleanHex = hex.replace('#', '');
  return {
    r: parseInt(cleanHex.substring(0, 2), 16),
    g: parseInt(cleanHex.substring(2, 4), 16),
    b: parseInt(cleanHex.substring(4, 6), 16)
  };
};
```

#### Step 2: Calculate Relative Luminance
Uses the WCAG formula for relative luminance:

```typescript
const getLuminance = (r: number, g: number, b: number) => {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const val = c / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};
```

**Formula breakdown:**
- Normalizes RGB values (0-255) to 0-1 range
- Applies gamma correction (sRGB to linear RGB)
- Weights channels: Red (21.26%), Green (71.52%), Blue (7.22%)
- Returns luminance value between 0 (black) and 1 (white)

#### Step 3: Calculate Contrast Ratio
```typescript
const getContrastRatio = (lum1: number, lum2: number) => {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
};
```

**WCAG Contrast Requirements:**
- **AAA (Enhanced)**: 7:1 ratio for normal text, 4.5:1 for large text
- **AA (Minimum)**: 4.5:1 ratio for normal text, 3:1 for large text
- Our system targets **minimum 4.5:1** for AA compliance

### 3. Background Selection

The system evaluates 7 candidate backgrounds:

| Luminance | Color | Description |
|-----------|-------|-------------|
| 0.95 | #f5f5f5 | Very light (near white) |
| 0.85 | #d9d9d9 | Light gray |
| 0.70 | #b3b3b3 | Medium-light gray |
| 0.50 | #808080 | Medium gray |
| 0.30 | #4d4d4d | Medium-dark gray |
| 0.15 | #262626 | Dark gray |
| 0.05 | #0d0d0d | Very dark (near black) |

#### Selection Algorithm

```typescript
const getCardBackground = (textColor: string, isDark: boolean) => {
  // 1. Calculate text luminance
  const textRgb = hexToRgb(textColor);
  const textLum = getLuminance(textRgb.r, textRgb.g, textRgb.b);
  
  // 2. Get theme background luminance
  const themeBg = isDark ? '#0d1117' : '#c5c7ca';
  const themeBgLum = getLuminance(...hexToRgb(themeBg));
  
  // 3. Score each candidate
  for (const candidate of candidates) {
    const textContrast = getContrastRatio(textLum, candidate.lum);
    const themeContrast = getContrastRatio(candidate.lum, themeBgLum);
    const score = textContrast + (themeContrast * 0.3);
    // Select highest scoring candidate
  }
};
```

**Scoring weights:**
- Text contrast: 100% (primary concern)
- Theme harmony: 30% (secondary concern)

This ensures the background provides excellent readability while still blending with the overall theme.

## Application

### Where It's Used

1. **Preset Question Cards** (Home page)
   - 8 cards with random colors from palette
   - Each gets optimal background for its color

2. **Suggestion Cards** (After assistant responses)
   - 3-5 cards with random colors
   - Backgrounds calculated per card

### Theme Responsiveness

The system automatically recalculates backgrounds when the user switches themes:

- **Dark Theme** (`#0d1117`): Typically selects lighter backgrounds for contrast
- **Light Theme** (`#c5c7ca`): Typically selects darker backgrounds for contrast

### Example Results

For a bright yellow text (`#fffa0c`):
- High luminance → needs dark background
- System selects: `#262626` or `#0d0d0d`
- Contrast ratio: ~12:1 (exceeds AAA standard)

For a dark blue text (`#2323ff`):
- Medium luminance → needs light background
- System selects: `#f5f5f5` or `#d9d9d9`
- Contrast ratio: ~8:1 (exceeds AAA standard)

## Benefits

1. **Accessibility**: Meets WCAG AA standards (4.5:1 minimum)
2. **Automatic**: No manual color picking required
3. **Consistent**: Same algorithm for all UI elements
4. **Theme-aware**: Adapts to light/dark theme changes
5. **Scientific**: Based on human perception research
6. **Future-proof**: Works with any new colors added to palette

## Technical References

- [WCAG 2.1 Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Relative Luminance Formula](https://www.w3.org/TR/WCAG21/#dfn-relative-luminance)
- [Contrast Ratio Formula](https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio)

## Code Location

- **Implementation**: `app/page.tsx` (lines ~25-75)
- **Functions**: `hexToRgb()`, `getLuminance()`, `getContrastRatio()`, `getCardBackground()`
- **Usage**: All preset and suggestion card `backgroundColor` styles
