import os
import pandas as pd
from pathlib import Path

# Configuración de rutas
ruta_evidencias = r"E:\ProcesoAudios\2026\evidencias_general"
archivo_salida = r"E:\ProcesoAudios\2026\reporte_evidencias.xlsx"

def contar_caracteres_unicos(archivo_path):
    """
    Cuenta la cantidad de caracteres únicos (sin repetirse) en un archivo de texto.
    """
    try:
        with open(archivo_path, 'r', encoding='utf-8', errors='ignore') as f:
            contenido = f.read()
            caracteres_unicos = len(set(contenido))
            return caracteres_unicos
    except Exception as e:
        print(f"Error al leer {archivo_path}: {e}")
        return 0

def procesar_archivo(archivo_path):
    """
    Procesa un archivo de texto y extrae la información según el formato del nombre.
    """
    nombre_completo = archivo_path.stem  # Nombre sin extensión
    partes = nombre_completo.split('-')
    
    # Validar que tenga 6 o 7 bloques
    if len(partes) < 6 or len(partes) > 7:
        print(f"Advertencia: {nombre_completo} no tiene el formato esperado (6 o 7 bloques)")
        return None
    
    # Extraer fecha del primer bloque
    fecha = partes[0]
    if len(fecha) != 8:
        print(f"Advertencia: {nombre_completo} no tiene una fecha válida en el primer bloque")
        return None
    
    año = fecha[:4]
    mes = fecha[4:6]
    dia = fecha[6:8]
    
    # Extraer los demás campos
    codigo1 = partes[1] if len(partes) > 1 else ""
    tipo = partes[2] if len(partes) > 2 else ""
    cartera = partes[3] if len(partes) > 3 else ""
    codigo2 = partes[4] if len(partes) > 4 else ""
    telefono = partes[5] if len(partes) > 5 else ""
    dni = partes[6] if len(partes) > 6 else ""
    
    # Calcular longText (caracteres únicos)
    longText = contar_caracteres_unicos(archivo_path)
    
    # Construir la ruta
    ruta = f"E:/ProcesoAudios/{año}/{mes}/{dia}"
    
    # Retornar diccionario con toda la información
    return {
        'año': año,
        'mes': mes,
        'dia': dia,
        'codigo1': codigo1,
        'tipo': tipo,
        'cartera': cartera,
        'codigo2': codigo2,
        'teléfono': telefono,
        'dni': dni,
        'longText': longText,
        'ruta': ruta,
        'nombre_completo': nombre_completo
    }

def main():
    """
    Función principal que procesa todos los archivos y genera el Excel.
    """
    print(f"Buscando archivos en: {ruta_evidencias}")
    
    # Verificar que la ruta existe
    if not os.path.exists(ruta_evidencias):
        print(f"ERROR: La ruta {ruta_evidencias} no existe")
        return
    
    # Lista para almacenar los datos
    datos = []
    
    # Procesar todos los archivos .txt en la carpeta
    archivos_procesados = 0
    archivos_error = 0
    
    for archivo in Path(ruta_evidencias).glob('*.txt'):
        resultado = procesar_archivo(archivo)
        if resultado:
            datos.append(resultado)
            archivos_procesados += 1
            print(f"✓ Procesado: {archivo.name}")
        else:
            archivos_error += 1
    
    # Crear DataFrame y guardar en Excel
    if datos:
        df = pd.DataFrame(datos)
        
        # Asegurar el orden de las columnas
        columnas_ordenadas = ['año', 'mes', 'dia', 'codigo1', 'tipo', 'cartera', 
                             'codigo2', 'teléfono', 'dni', 'longText', 'ruta', 'nombre_completo']
        df = df[columnas_ordenadas]
        
        # Guardar en Excel
        df.to_excel(archivo_salida, index=False, sheet_name='Reporte')
        
        print(f"\n{'='*60}")
        print(f"✓ Reporte generado exitosamente")
        print(f"{'='*60}")
        print(f"Archivo Excel: {archivo_salida}")
        print(f"Total de archivos procesados: {archivos_procesados}")
        print(f"Total de archivos con error: {archivos_error}")
        print(f"Total de registros en el reporte: {len(datos)}")
        print(f"{'='*60}")
    else:
        print("\nNo se encontraron archivos para procesar o todos tuvieron errores")

if __name__ == "__main__":
    main()
