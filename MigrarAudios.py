import subprocess
import os
import shutil
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from pathlib import Path
import itertools

# ---------- CONFIG ----------
UNC_BASE = r"\\110.238.64.237\informa\2026\01"
USERNAME = "informa"   # No se usa porque no hay mapeo
PASSWORD = "1nf0rm4#1Vr"  # No se usa porque no hay mapeo

LOCAL_DEST = Path(r"E:\ProcesoAudios\2026\01")
TEMP_DIR = LOCAL_DEST / "temp"

FFMPEG_BIN = Path(r"E:\ffmpeg_Convertidor\bin\ffmpeg.exe")

MAX_CPU_WORKERS = os.cpu_count() or 4   # conversión paralela
MAX_IO_WORKERS = 10                     # copias remotas en paralelo

BLOCK_SIZE = 500
PRINT_EVERY = 10
# --------------------------------------------


def ensure_dir(path):
    Path(path).mkdir(parents=True, exist_ok=True)


def fast_copy(src, dst, buffer_size=8 * 1024 * 1024):
    """Copia binaria rápida."""
    ensure_dir(dst.parent)
    with open(src, "rb") as fsrc, open(dst, "wb") as fdst:
        shutil.copyfileobj(fsrc, fdst, buffer_size)
    return dst


def convert_to_mp3(temp_file, local_mp3):
    """Convierte archivo WAV/GSM a MP3."""
    cmd = [
        str(FFMPEG_BIN),
        "-y",
        "-loglevel", "error",
        "-i", str(temp_file),
        "-acodec", "libmp3lame",
        "-ab", "64k",
        str(local_mp3)
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr)
    return local_mp3


def copy_remote_files(files, dest_dir):
    """Copia archivos remotos en paralelo."""
    ensure_dir(dest_dir)
    copied = []
    if not files:
        return copied

    with ThreadPoolExecutor(max_workers=MAX_IO_WORKERS) as executor:
        futures = {executor.submit(fast_copy, f, dest_dir / f.name): f for f in files}

        for future in as_completed(futures):
            src = futures[future]
            try:
                dst = future.result()
                copied.append(dst)
            except Exception as e:
                print(f"Error copiando {src}: {e}")

    return copied


def process_day_folder(day):
    # Carpeta UNC remota del día
    day_folder = Path(f"{UNC_BASE}\\{day}")

    print(f"\n Verificando carpeta remota: {day_folder}")

    if not day_folder.exists():
        raise FileNotFoundError(f"No existe la carpeta remota: {day_folder}")

    # Leer archivos remotos
    with os.scandir(day_folder) as it:
        all_files = [
            Path(entry.path)
            for entry in it
            if entry.is_file() and entry.stat().st_size > 0
        ]

    # Clasificar archivos
    mp3_files = [f for f in all_files if f.suffix.lower() == ".mp3"]
    to_convert = [f for f in all_files if f.suffix.lower() in (".gsm", ".wav")]

    if not mp3_files and not to_convert:
        print("No hay archivos válidos.")
        return

    local_day_dir = LOCAL_DEST / day
    ensure_dir(local_day_dir)

    total = len(mp3_files) + len(to_convert)
    total_done = 0

    print(f"\nEncontrados: {len(mp3_files)} MP3 + {len(to_convert)} WAV/GSM = {total}\n")

    # --- Copia directa MP3 ---
    if mp3_files:
        print(f"Copiando {len(mp3_files)} archivos MP3...")

        for i in range(0, len(mp3_files), BLOCK_SIZE):
            copied = copy_remote_files(mp3_files[i:i + BLOCK_SIZE], local_day_dir)
            total_done += len(copied)

            if total_done % PRINT_EVERY == 0 or total_done == total:
                print(f" {total_done}/{total} procesados ({round(total_done / total * 100, 1)}%)")

        print(f"MP3 copiados: {len(mp3_files)}\n")

    # --- Conversión ---
    if to_convert:
        print(f"Iniciando conversión de {len(to_convert)} archivos WAV/GSM\n")

        for i in range(0, len(to_convert), BLOCK_SIZE):
            block = to_convert[i:i + BLOCK_SIZE]
            print(f"Bloque {i//BLOCK_SIZE + 1} → {len(block)} archivos")

            # Copiar a temp local
            copied_files = copy_remote_files(block, TEMP_DIR)

            # Convertir en paralelo
            with ProcessPoolExecutor(max_workers=MAX_CPU_WORKERS) as executor:
                futures = {
                    executor.submit(
                        convert_to_mp3,
                        f,
                        local_day_dir / (f.stem + ".mp3")
                    ): f
                    for f in copied_files
                }

                for future in as_completed(futures):
                    try:
                        future.result()
                        total_done += 1
                        if total_done % PRINT_EVERY == 0 or total_done == total:
                            print(f" {total_done}/{total} procesados ({round(total_done / total * 100, 1)}%)")
                    except Exception as e:
                        print(f"Error al convertir {e}")

            # Borrar temporales
            for f in copied_files:
                f.unlink(missing_ok=True)

            print(f"Bloque completado. Total: {total_done}/{total}\n")

    print(f"\nProcesamiento finalizado. Total: {total_done}/{total}\n")


def main():
    print("=== INICIO PROCESO ===")
    day = input("Ingrese el número de la carpeta a procesar (ej: 01, 02, 03...): ").strip()

    try:
        process_day_folder(day)
    except Exception as e:
        print("ERROR:", e)

    print("\n=== PROCESO FINALIZADO ===")


if __name__ == "__main__":
    main()
