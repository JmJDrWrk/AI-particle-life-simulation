import os
import shutil
import glob

def merge_runs():
    base_dir = './ds'
    # Las carpetas en el orden que quieres que se unan
    source_folders = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] 
    merge_dir = os.path.join(base_dir, 'merge')

    # 1. Vaciar o crear la carpeta merge
    if os.path.exists(merge_dir):
        print(f"Borrando el contenido anterior de {merge_dir}...")
        shutil.rmtree(merge_dir)
    os.makedirs(merge_dir)

    # 2. Procesar los archivos
    global_counter = 0

    for folder in source_folders:
        source_dir = os.path.join(base_dir, folder, 'runs')
        
        # Verificar si la carpeta existe para evitar errores
        if not os.path.exists(source_dir):
            print(f"Advertencia: No se encontró la ruta {source_dir}. Saltando...")
            continue
            
        # Buscar todos los JSON con el patrón y ordenarlos alfabéticamente
        search_pattern = os.path.join(source_dir, 'run-*.json')
        files = sorted(glob.glob(search_pattern))
        
        if not files:
            print(f"No se encontraron archivos en {source_dir}.")
            continue

        print(f"Procesando {len(files)} archivos de {source_dir}...")
        
        for file_path in files:
            # Generar el nuevo nombre manteniendo 4 ceros a la izquierda (0000, 0001...)
            # Si pasas de 9999 archivos, Python automáticamente pondrá 5 dígitos.
            new_filename = f"run-{global_counter:04d}.json"
            target_path = os.path.join(merge_dir, new_filename)
            
            # Copiar el archivo (copy2 mantiene los metadatos como fecha de creación)
            shutil.copy2(file_path, target_path)
            
            global_counter += 1
            
    print(f"\n¡Listo! Se han copiado un total de {global_counter} archivos en {merge_dir}.")

if __name__ == "__main__":
    merge_runs()