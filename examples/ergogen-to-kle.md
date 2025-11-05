# Converting Ergogen Points to KLE Format

This guide shows how to convert ergogen point layouts to KLE (Keyboard Layout Editor) format.

## Usage

Use the `--to-kle` flag with the ergogen CLI:

```bash
node src/cli.js <config-file> --to-kle -o <output-folder>
```

## Example

Given an ergogen config file `my-keyboard.yaml`:

```yaml
points:
  zones:
    matrix:
      columns:
        pinky:
          rows:
            bottom:
            home:
            top:
        ring:
          key:
            stagger: 5
          rows:
            bottom:
            home:
            top:
        middle:
          key:
            stagger: 2
          rows:
            bottom:
            home:
            top:
        index:
          key:
            stagger: -5
          rows:
            bottom:
            home:
            top:
```

Run the conversion:

```bash
node src/cli.js my-keyboard.yaml --to-kle -o output
```

This will generate:
- `output/points/kle.json` - KLE format JSON that can be imported into http://www.keyboard-layout-editor.com/

## How to Use the KLE Output

1. Go to http://www.keyboard-layout-editor.com/
2. Click the "Raw data" tab
3. Copy the contents of `output/points/kle.json`
4. Paste into the editor
5. Switch back to the visual tab to see your layout

## Notes

- The conversion maps ergogen's center-based coordinates to KLE's corner-based coordinates
- Rotation and key sizes are preserved
- Key labels are taken from the point's meta.name field
