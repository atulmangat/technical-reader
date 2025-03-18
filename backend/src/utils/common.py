import fitz  # PyMuPDF
import os
from PIL import Image


def generate_pdf_thumbnail(pdf_file):
    try:
        # Create thumbnails directory if it doesn't exist
        thumbnails_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "thumbnails"
        )
        os.makedirs(thumbnails_dir, exist_ok=True)

        # Generate thumbnail filename
        thumbnail_filename = f"thumb_{os.path.splitext(os.path.basename(pdf_file))[0]}.jpg"
        # Store only the filename in the database
        thumbnail_path = thumbnail_filename
        absolute_thumb_path = os.path.join(thumbnails_dir, thumbnail_filename)

        # Create PDF document object
        doc = fitz.open(pdf_file)

        try:
            # Get the first page
            page = doc[0]

            # Convert page to image with higher resolution
            pix = page.get_pixmap(matrix=fitz.Matrix(3, 3))  # Increased resolution

            # Convert to PIL Image
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

            # Maintain aspect ratio while resizing
            img.thumbnail((800, 1000), Image.Resampling.LANCZOS)  # Increased size

            # Save thumbnail with higher quality
            img.save(absolute_thumb_path, "JPEG", quality=95)

            return thumbnail_path
        finally:
            # Always close the document
            doc.close()

    except Exception as e:
        print(f"Error generating thumbnail: {e}")
        return None




