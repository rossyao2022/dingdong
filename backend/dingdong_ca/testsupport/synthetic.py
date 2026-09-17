"""Small deterministic non-biometric PNGs generated in memory, never real fingerprints."""

import struct
import zlib


def synthetic_png(slot):
    if slot not in range(1, 6):
        raise ValueError("invalid synthetic slot")

    def chunk(kind, data):
        return (
            struct.pack("!I", len(data))
            + kind
            + data
            + struct.pack("!I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\0" + bytes([slot * 32, y * 8, 180]) * 16 for y in range(16))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack("!2I5B", 16, 16, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )
