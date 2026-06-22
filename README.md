# WMI Student Results & Certificate Portal

Static web portal for World Mathematics Invitational (WMI) student result lookup and certificate download.

## Project Structure

```
WMI-result/
├── index.html
├── css/styles.css
├── js/main.js
├── logo-images/wmi-logo.png
└── package.json
```

## Getting Started

1. Install dependencies: `npm install`
2. Start local dev server: `npm start`
3. Open `http://127.0.0.1:8080` in your browser

## Features

- WMI student result lookup via backend API (`POST /check-wmi-result`)
- Certificate PDF download from Google Drive links
- Contact form via EmailJS (same service as AMC result portal)
- Responsive single-page layout

## Backend

Results are fetched from:

```
https://competition-backend-1-zd68.onrender.com/check-wmi-result
```

Required fields: `firstName`, `lastName`, `dob`

## Deployment

Deploy as a static site on GitHub Pages (same pattern as [amc_result](https://github.com/asiamathsalliance/amc_result)).

## Contact

Asia Maths Alliance — asiamaths@gmail.com
