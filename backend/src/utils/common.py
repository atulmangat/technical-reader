import fitz  # PyMuPDF
import os
from PIL import Image
import time
import uuid



def generate_pdf_thumbnail(thumbnail_dir, pdf_file):
    try:

        os.makedirs(thumbnail_dir, exist_ok=True)

        # Generate thumbnail filename with unique identifier (timestamp + uuid)
        unique_id = f"{int(time.time())}_{uuid.uuid4().hex[:8]}"
        thumbnail_filename = f"thumb_{unique_id}.jpg"
        
        # Store only the filename in the database
        thumbnail_path = thumbnail_filename
        absolute_thumb_path = os.path.join(thumbnail_dir, thumbnail_filename)

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




