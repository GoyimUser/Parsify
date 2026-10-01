"""Validate generated QA PDFs; text checks supplement (not replace) PNG review."""
from pathlib import Path
import json
import re
import pdfplumber
from pypdf import PdfReader

directory = Path(__file__).resolve().parents[1] / "tmp/pdfs/native-tables"
reports = []
for path in sorted(directory.glob("*.pdf")):
    reader = PdfReader(path)
    with pdfplumber.open(path) as document:
        text = "\n".join(page.extract_text() or "" for page in document.pages)
        assert "THIS MUST NEVER PRINT" not in text, path.name
        assert "Preparing PDF" not in text, path.name
        assert "Local native-app" not in text, path.name
        assert all((page.extract_text() or "").strip() for page in document.pages), f"{path.name}: blank page"
        first_page = document.pages[0].extract_text() or ""
        assert all(re.search(r"\b" + symbol + r"\b", first_page) for symbol in
                   ["C", "Si", "S", "Na", "Al", "Sn", "Cl", "Mg", "P", "Pb", "Ge"]), f"{path.name}: missing column"
        out_of_page = []
        for index, page in enumerate(document.pages):
            for char in page.chars:
                if char["x0"] < -1 or char["x1"] > page.width + 1 or char["top"] < -1 or char["bottom"] > page.height + 1:
                    out_of_page.append((index + 1, char["text"]))
        assert not out_of_page, (path.name, out_of_page[:10])
        if path.stem == "android-long":
            for i in range(90):
                token = "Row-" + chr(65 + i // 26) + chr(65 + i % 26)
                assert token in text, (path.name, token)
        images = sum(len(page.images) for page in document.pages)
        assert images == 0, f"{path.name}: unexpected raster image"
        fonts = sorted({font[1].get_object().get("/BaseFont", "") for page in reader.pages
                        for font in page["/Resources"].get_object().get("/Font", {}).get_object().items()})
        assert any("Yas" in font for font in fonts), (path.name, fonts)
        reports.append(dict(file=path.name, pages=len(document.pages),
                            size=[round(document.pages[0].width, 2), round(document.pages[0].height, 2)],
                            chars=sum(len(page.chars) for page in document.pages),
                            images=images, fonts=fonts))
print(json.dumps(reports, ensure_ascii=False, indent=2))
