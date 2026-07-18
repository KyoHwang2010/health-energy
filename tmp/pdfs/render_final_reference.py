from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageDraw

workspace = Path(r"C:\Users\pc\.gemini\antigravity\scratch\health-energy")
source = workspace / "tmp" / "incoming-final" / "SDGs-UI-realrealfinal.pdf"
output = workspace / "tmp" / "pdfs" / "realrealfinal"
output.mkdir(parents=True, exist_ok=True)

document = pdfium.PdfDocument(source)
thumbnails = []
print(f"pages {len(document)}")

for index in range(len(document)):
    page = document[index]
    image = page.render(scale=1.5).to_pil()
    page_path = output / f"page-{index + 1:02d}.png"
    image.save(page_path)
    thumbnail = image.copy()
    thumbnail.thumbnail((280, 420))
    thumbnails.append((index + 1, thumbnail))
    print(index + 1, image.size, page_path)

sheet_width = 600
cell_height = 460
sheet_height = ((len(thumbnails) + 1) // 2) * cell_height
sheet = Image.new("RGB", (sheet_width, sheet_height), "white")
draw = ImageDraw.Draw(sheet)

for index, (page_number, image) in enumerate(thumbnails):
    x = (index % 2) * 300 + (300 - image.width) // 2
    y = (index // 2) * cell_height + 28
    sheet.paste(image, (x, y))
    draw.text((x, y - 20), f"Page {page_number}", fill="black")

sheet.save(output / "contact-sheet.png")
