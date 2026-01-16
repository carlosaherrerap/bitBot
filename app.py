#c:\documentos\audios_carpeta1
import argparse
import os
import shutil
from pathlib import Path
from typing import Iterator

try:
	from mutagen.mp3 import MP3
except Exception as e:
	MP3 = None


def parse_blocks(filename: str) -> list[str]:
	"""Devuelve la lista de bloques separados por '-' del nombre del archivo (sin extensión)."""
	name = Path(filename).stem
	return name.split("-")


def meets_name_rule(filename: str) -> bool:
	"""Comprueba si el 4º bloque (index 3) existe y es '19'."""
	blocks = parse_blocks(filename)
	if len(blocks) < 6:
		return False
	return blocks[3] == "19"


def size_bytes_threshold(kb: float = 50.0) -> int:
	return int(kb * 1024)


def get_duration_seconds(path: Path) -> float | None:
	"""Devuelve la duración en segundos usando mutagen o None si no disponible."""
	if MP3 is None:
		raise RuntimeError("mutagen no está instalado. Instala con: pip install mutagen")
	try:
		audio = MP3(str(path))
		return float(audio.info.length)
	except Exception:
		return None


def iter_audio_files(folder: Path, extensions: tuple[str, ...] = (".mp3", ".wav", ".gsm"), recursive: bool = False) -> Iterator[Path]:
	"""Generador de archivos de audio en el directorio. Por defecto busca .mp3, .wav y .m4a"""
	if recursive:
		for root, _, files in os.walk(folder):
			for f in files:
				p = Path(root) / f
				if p.suffix.lower() in extensions:
					yield p
	else:
		for entry in folder.iterdir():
			if entry.is_file() and entry.suffix.lower() in extensions:
				yield entry


def filter_and_copy(ruta: str, carpeta: str, min_kb: float = 50.0, min_duration_s: float = 10.0, recursive: bool = False, dry_run: bool = False):
	base = Path(ruta)
	# asegurar que 'carpeta' no empiece por / o \ para no perder la parte base en la unión
	safe_carpeta = carpeta.lstrip('/\\')
	source_dir = base / safe_carpeta
	if not source_dir.exists() or not source_dir.is_dir():
		raise FileNotFoundError(f"La carpeta fuente no existe: {source_dir}")

	# Carpeta de destino en la raíz del script
	script_root = Path(__file__).resolve().parent
	# normaliza el nombre de la carpeta para usarlo en la carpeta destino
	dest_name = f"doyouanalitics_{safe_carpeta}"
	dest_name = dest_name.replace("\\", "_")
	dest_dir = script_root / dest_name
	dest_dir.mkdir(parents=True, exist_ok=True)

	size_thr = size_bytes_threshold(min_kb)

	processed = 0
	copied = 0

	for fpath in iter_audio_files(source_dir, recursive=recursive):
		processed += 1

		# 1) Name rule
		if not meets_name_rule(fpath.name):
			continue

		# 2) Size rule
		try:
			s = fpath.stat().st_size
		except Exception:
			continue
		if s <= size_thr:
			continue

		# 3) Duration rule
		dur = None
		try:
			dur = get_duration_seconds(fpath)
		except RuntimeError as re:
			# re-raise so user knows to install mutagen
			raise
		if dur is None or dur <= min_duration_s:
			continue

		# copy
		rel_name = fpath.name
		dest_path = dest_dir / rel_name
		if dry_run:
			print(f"[DRY] Matched: {fpath}  size={s/1024:.2f}KB dur={dur:.2f}s -> {dest_path}")
		else:
			# Evitar sobrescribir: si destino existe, añadir índice
			final_dest = dest_path
			i = 1
			while final_dest.exists():
				final_dest = dest_dir / f"{fpath.stem}__{i}{fpath.suffix}"
				i += 1
			shutil.copy2(fpath, final_dest)
			copied += 1

	print(f"He procesado {processed} archivos, y copiado {copied} que cumplen las reglas a: {dest_dir}")


def main():
	parser = argparse.ArgumentParser(description="Filtrar y copiar audios que cumplan reglas.")
	parser.add_argument("--ruta", default=str(Path("E:/ProcesoAudios/2026/01")), help="Ruta base donde se encuentran las carpetas de audios")
	parser.add_argument("--carpeta", default="15", help="Nombre de la carpeta a procesar dentro de ruta")
	parser.add_argument("--min-kb", type=float, default=50.0, help="Tamaño mínimo (KB) para procesar")
	parser.add_argument("--min-duration", type=float, default=10.0, help="Duración mínima (s)")
	parser.add_argument("--recursive", action="store_true", help="Buscar recursivamente en subcarpetas")
	parser.add_argument("--dry-run", action="store_true", help="No copia archivos, solo muestra qué se haría")

	args = parser.parse_args()

	try:
		filter_and_copy(args.ruta, args.carpeta, args.min_kb, args.min_duration, recursive=args.recursive, dry_run=args.dry_run)
	except FileNotFoundError as fnf:
		print(fnf)
	except RuntimeError as rte:
		print(rte)


if __name__ == "__main__":
	main()

