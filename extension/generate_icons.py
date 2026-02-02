#!/usr/bin/env python3
"""Generate simple icons for the Chrome extension."""

import struct
import zlib


def create_png(width, height, rgb_color, text_color, text):
    """Create a simple PNG with text."""

    def make_pixel_data():
        """Create pixel data for the image."""
        pixels = []

        # Simple background with centered text area
        for y in range(height):
            row = []
            for x in range(width):
                # Background color
                row.extend(rgb_color)
            pixels.append(bytes([0] + row))  # Filter byte + row data

        return b''.join(pixels)

    def png_chunk(chunk_type, data):
        """Create a PNG chunk."""
        chunk = chunk_type + data
        crc = zlib.crc32(chunk) & 0xffffffff
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', crc)

    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr = png_chunk(b'IHDR', ihdr_data)

    # IDAT chunk (compressed pixel data)
    pixel_data = make_pixel_data()
    compressed = zlib.compress(pixel_data, 9)
    idat = png_chunk(b'IDAT', compressed)

    # IEND chunk
    iend = png_chunk(b'IEND', b'')

    return signature + ihdr + idat + iend


def create_icon_with_pillow(size, filename):
    """Create icon using Pillow if available."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return False

    # Create image with blue background
    img = Image.new('RGB', (size, size), color=(59, 130, 246))
    draw = ImageDraw.Draw(img)

    # Try to use a font, fall back to default
    text = "NT+"

    # Calculate font size based on icon size
    font_size = size // 3
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()

    # Get text bounding box and center it
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) // 2
    y = (size - text_height) // 2 - bbox[1]

    # Draw text in white
    draw.text((x, y), text, fill=(255, 255, 255), font=font)

    # Save
    img.save(filename, 'PNG')
    return True


def create_simple_icon(size, filename):
    """Create a simple colored square icon (fallback)."""
    # Blue color similar to the app theme
    rgb = (59, 130, 246)
    png_data = create_png(size, size, rgb, (255, 255, 255), "NT+")

    with open(filename, 'wb') as f:
        f.write(png_data)


if __name__ == '__main__':
    import os

    # Ensure icons directory exists
    os.makedirs('icons', exist_ok=True)

    sizes = [16, 48, 128]

    for size in sizes:
        filename = f'icons/icon{size}.png'

        # Try Pillow first for nicer icons with text
        if not create_icon_with_pillow(size, filename):
            print(f"Pillow not available, creating simple icon for {size}x{size}")
            create_simple_icon(size, filename)
        else:
            print(f"Created {filename}")

    print("\nIcons created! Reload the extension in chrome://extensions/")
