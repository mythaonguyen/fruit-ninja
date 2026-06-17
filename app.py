"""Optional local dev server. GitHub Pages serves the static files directly."""
from pathlib import Path

from flask import Flask, send_from_directory

ROOT = Path(__file__).parent
app = Flask(__name__, static_folder=str(ROOT / "static"), static_url_path="/static")


@app.route("/")
def index():
    return send_from_directory(ROOT, "index.html")


if __name__ == "__main__":
    app.run(debug=False, port=5000)
