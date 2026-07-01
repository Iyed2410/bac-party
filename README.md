# Iyed's Bac Party

Mobile-first one-page invitation site with Google Sheets as the storage backend for RSVP, music votes, memory wall submissions, and the public guest list.

## Files

- `index.html` - the invitation page.
- `styles.css` - black and gold responsive styling.
- `script.js` - form validation, Google Apps Script fetch calls, countdown, public guest list, memory wall, and hidden admin view.
- `google-apps-script.gs` - Apps Script backend to paste into Google Apps Script.
- `assets/hero-luxury-party.png` - generated luxury hero background.

## Google Sheets Setup

1. Create a Google Spreadsheet named `Iyed Bac Party Responses`.
2. Open Extensions > Apps Script.
3. Paste the contents of `google-apps-script.gs`.
4. In the script, either leave `SPREADSHEET_ID` blank if the script is bound to the sheet, or paste the spreadsheet ID into `SPREADSHEET_ID`.
5. Change `ADMIN_TOKEN` from `CHANGE_ME_FOR_IYED` to a private token.
6. Run `setupSheets()` once from Apps Script and approve permissions.
7. Deploy > New deployment > Web app.
8. Set Execute as: `Me`.
9. Set Who has access: `Anyone` or `Anyone with the link`.
10. Copy the Web App URL.
11. In `script.js`, replace `[PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE]` with the Web App URL.

## Party Date

In `script.js`, replace:

```js
dateLabel: "[INSERT EXACT DATE]",
startDateIso: "",
```

with the real date and ISO timestamp, for example:

```js
dateLabel: "Saturday, July 4, 2026",
startDateIso: "2026-07-04T20:00:00+01:00",
```

## Admin View

Open the page with `#admin` or `?admin=1`, then enter the `ADMIN_TOKEN` value from Apps Script.

The admin view reads live totals from Google Sheets. Public visitors only see approved memories and public guest display names.
