import os
import shutil
import zipfile

DEFAULT_FOLDER = "./ds/merge"
DEFAULT_ARCHIVE = "./ds/merge.zip"

def get_input(prompt, default_val):
    user_val = input(f"{prompt} [{default_val}]: ").strip()
    return user_val if user_val else default_val

def compress():
    folder_path = get_input("Ruta de la carpeta a comprimir", DEFAULT_FOLDER)
    if not os.path.exists(folder_path):
        print(f"❌ Error: La carpeta '{folder_path}' no existe.")
        return

    archive_path = get_input("Nombre/Ruta del archivo ZIP de salida", DEFAULT_ARCHIVE)
    if os.path.exists(archive_path):
        confirm = input(f"⚠️ El archivo '{archive_path}' ya existe. ¿Sobrescribir? (s/n) [s]: ").strip().lower()
        if confirm == 'n':
            print("Operación cancelada.")
            return

    print(f"\n📦 Comprimiendo '{folder_path}' en máximo nivel de compresión...")
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                # Guarda las rutas relativas dentro del zip
                arcname = os.path.relpath(file_path, start=os.path.dirname(folder_path))
                zipf.write(file_path, arcname)

    size_mb = os.path.getsize(archive_path) / (1024 * 1024)
    print(f"✅ ¡Comprimido con éxito! Tamaño final: {size_mb:.2f} MB")
    
    if size_mb > 100:
        print("🚨 Atención: El archivo supera los 100 MB. GitHub rechazará el commit a menos que uses Git LFS.")
    elif size_mb > 50:
        print("⚠️ Advertencia: El archivo supera los 50 MB. GitHub mostrará un aviso al hacer push.")

def decompress():
    archive_path = get_input("Ruta del archivo ZIP a descomprimir", DEFAULT_ARCHIVE)
    if not os.path.exists(archive_path):
        print(f"❌ Error: El archivo '{archive_path}' no existe.")
        return

    extract_to = get_input("Carpeta destino donde descomprimir", os.path.dirname(DEFAULT_FOLDER))
    target_folder = os.path.join(extract_to, os.path.splitext(os.path.basename(archive_path))[0])

    if os.path.exists(target_folder):
        confirm = input(f"⚠️ La carpeta '{target_folder}' ya existe. ¿Eliminarla y reemplazarla? (s/n) [s]: ").strip().lower()
        if confirm == 'n':
            print("Operación cancelada.")
            return
        shutil.rmtree(target_folder)

    print(f"\n📂 Descomprimiendo '{archive_path}'...")
    with zipfile.ZipFile(archive_path, 'r') as zipf:
        zipf.extractall(extract_to)

    print(f"✅ ¡Descompresión completada en '{target_folder}'!")

def main():
    print("=" * 45)
    print(" GESTOR DE COMPRESIÓN Y DESCOMPRESIÓN ")
    print("=" * 45)
    print("1. Comprimir carpeta a ZIP (para Git)")
    print("2. Descomprimir archivo ZIP")
    print("3. Salir")
    
    choice = input("\nSelecciona una opción (1-3): ").strip()
    
    if choice == '1':
        compress()
    elif choice == '2':
        decompress()
    elif choice == '3':
        print("Saliendo...")
    else:
        print("Opción no válida.")

if __name__ == "__main__":
    main()