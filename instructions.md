# Social Media Badge Generator

## Overview
A client-side web application that generates personalized social media badges by layering three images:
1. **Background** — Solid white (#FFFFFF)
2. **User Photo** — Uploaded by the user
3. **Foreground Overlay** — Pre-defined event branding (Future Leader Summit 2026)

The user uploads their photo, adjusts zoom and position, and downloads a ready-to-share PNG badge.

## Architecture
- **100% client-side** — No backend, no database, no server-side processing
- **Vanilla HTML/CSS/JS** — No framework dependencies
- **HTML5 Canvas** — For compositing layers and exporting PNG
- **Responsive design** — Works on desktop, tablet, and mobile

## Tech Stack
- HTML5 + CSS3 + Vanilla JavaScript (ES6+)
- HTML5 Canvas API for image compositing
- Google Fonts (Montserrat)
- No external JS dependencies

## Features
- Drag & drop or click-to-upload photo
- Zoom slider to scale user photo
- Drag-to-reposition photo within the badge
- Live preview of the composited badge
- One-click PNG download (1080×1080px)
- Fully responsive layout

## File Structure
```
├── index.html              # Main entry point
├── css/
│   └── style.css           # All styles, responsive layout
├── js/
│   └── app.js              # Canvas logic, upload, zoom, export
├── assets/
│   └── foreground.png      # Event overlay with transparency
├── instructions.md         # This file
└── README.md               # (optional) public-facing docs
```

## How It Works
1. The canvas renders 3 layers in order: white background → user photo → foreground overlay
2. The foreground PNG has transparent areas where the user's photo shows through
3. The user can zoom (scale) and drag (reposition) their photo behind the overlay
4. On download, the canvas is exported as a 1080×1080 PNG file

## Design Reference
- **Layout/UX inspiration**: [startup-contacts.de](https://www.startup-contacts.de/) — clean, modern, bold typography
- **Badge logic inspiration**: [im-attending.com](https://im-attending.com/) — upload → preview → download flow
- **Font**: Montserrat (Google Fonts)
- **Output size**: 1080×1080px (optimized for Instagram/LinkedIn)
