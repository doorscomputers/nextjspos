# Company Logo Replacement Guide

## Current Setup

The system is configured to display your company logo in the sidebar. A temporary placeholder logo has been created at:

- `public/logo.svg` - SVG format (recommended)
- `public/logo.png` - PNG format (fallback)

## How to Replace the Logo

### Option 1: Using SVG (Recommended for best quality)

1. Save your company logo as `logo.svg`
2. Place it in the `public/` folder, replacing the existing `logo.svg`
3. Refresh your browser to see the changes

### Option 2: Using PNG

1. Save your company logo as `logo.png` (recommended size: 120x120 pixels or larger)
2. Place it in the `public/` folder
3. Refresh your browser to see the changes

## Logo Requirements

- **Format**: SVG (preferred) or PNG
- **Recommended Size**: 120x120 pixels minimum
- **Background**: Transparent background works best
- **File Name**: Must be exactly `logo.svg` or `logo.png`
- **Location**: Must be in the `public/` folder at the root of the project

## Fallback Behavior

The system has built-in fallback logic:
1. First tries to load `logo.svg`
2. If SVG fails, tries to load `logo.png`
3. If both fail, displays company name initials

## Based on Your Images

From the Pcinet Computer Trading and Services branding you showed me:
- The logo should match your brand identity
- Consider using the circular logo design from your social media
- Ensure it's clearly visible on both light and dark backgrounds

## Notes

- The logo appears in the sidebar header
- It's displayed in a circular container with white background
- The logo scales automatically to fit the container
- No code changes are needed - just replace the file!
