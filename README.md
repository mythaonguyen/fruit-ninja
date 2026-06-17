# Face Ninja

A webcam-powered eating game. MediaPipe tracks your mouth — open wide to start, then close your mouth to bite flying food.

## Play online

Deploy to **GitHub Pages** https://mythaonguyen.github.io/fruit-ninja/.

## How to play

1. Allow camera access when prompted (HTTPS required — GitHub Pages provides this).
2. Keep your mouth **closed** during calibration (~2 seconds).
3. **Open your mouth** to start the game.
4. **Close your mouth** when food overlaps your mouth to bite it.

| Object | Effect |
|--------|--------|
| Avocado, Cherry, Grape | +1 score |
| Onigiri, Sushi | +3 score |
| Coffee | Speed +1 level |
| Chili | −1 heart |

You start with **3 hearts**. Game ends at 0 hearts or when spawn speed maxes out (too much coffee).

## Project structure

```
├── index.html          # Entry point (GitHub Pages root)
├── static/
│   ├── face.js         # MediaPipe + MAR detection
│   ├── game.js         # p5.js game loop & state machine
│   ├── objects.js      # Spawnable objects
│   ├── ui.js           # HUD
│   ├── screens.js      # Splash, game-over screens
│   ├── style.css
│   └── assets/         # PNG sprites (optimized)
├── app.py              # Optional local dev server
└── requirements.txt
```
