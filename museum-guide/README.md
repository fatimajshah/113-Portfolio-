# Your museum assistant

An independent, deterministic museum interaction prototype. The existing paper background, Met-inspired red, typography, header, homepage and photo capture layout are preserved.

## Demo path

Start exploring → choose European Paintings → preview → enter the gallery.

For each of five photographs, choose/take an image, enter one word in each of three fields, and Save. Words are never filled automatically. Completed selections can be viewed, replaced or removed. Replacements require three words before replacing the original selection. No sixth photograph can be added.

Find my thread → review five images with their fifteen words → Find my thread → 1.5-second “Finding connections…” → authored thread and Arts of Japan recommendation → five Japanese works with curatorial connections → Take me there → supplied map → I'm here → final arrival with the same five works.

Arrival ends the demo. The other existing gallery options remain previews only. Back retains completed selections. Restart or refresh clears session photos and words; old browser history cannot restore a restarted visit.

## Files

- `index.html`: preserved shell, native camera/file inputs; versioned stylesheet/script URLs.
- `script.js`: vanilla JavaScript screen state, local photo intake, required three-word validation, review and fixed authored screens. No AI, image recognition, dynamic recommendations, route calculations, positioning, API or backend.
- `style.css`: existing visual system with matching word-entry, review, editorial artwork rows and map presentation.
- `images/`: the eleven supplied files, used under their exact names. `map.svg` is unchanged. CSS frames its central map to avoid its large white margins; Enlarge map provides a scrollable larger view.
- `assets/`: preserved imagery for the existing homepage and gallery previews.
- `dist/`: synchronized static publication files.

Images are decoded/resized locally into revocable blob URLs. Nothing is uploaded or stored beyond the open browser session. Files must be browser-decodable images under 25 MB.

## Verification

Tested the complete supplied five-image/fifteen-word path on desktop and a 390px-wide mobile layout, including review → analysis → all five recommendations → supplied map → arrival. Checked all recommendation images load, map fit/enlargement, blank/multiple-word rejection, no capture at five, invalid-image recovery, cancellation before saving, retake, removal returning to four and disabling continuation, retained photos/words through Back, and Restart with old history.

Physical phone camera hardware was not available for testing; desktop camera-input fallback and native image-file selection were tested. This is an authored UX demo, not live museum navigation or analysis.
