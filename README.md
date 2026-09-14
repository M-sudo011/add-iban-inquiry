# Add IBAN Inquiry Prototype

A dependency-free, static web prototype for the driver-client IBAN inquiry flow. It simulates both adding and editing a bank account and makes no external API calls.

## Run locally

From the repository root:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Prototype controls

Use the floating control button at the bottom-left to change:

- Add or edit flow
- Successful or failed inquiry
- Three- or five-second inquiry timeout
- Simulated Android viewport dimensions

Switching the flow resets the current product screen. Changing the result or timeout affects the next inquiry. The device selector only resizes the preview.

## Deploy to GitHub Pages

1. Copy these files to the root of the `add-iban-inquiry` repository.
2. Commit and push them to the default branch.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select the default branch and the `/ (root)` folder, then save.

All asset paths are relative, so the prototype works when hosted under the repository subpath.

## Files

- `index.html` — page structure and control center
- `styles.css` — product styling, responsive device preview, and controls
- `app.js` — simulated state machine and interactions
- `fonts/` — locally bundled Vazirmatn font files
