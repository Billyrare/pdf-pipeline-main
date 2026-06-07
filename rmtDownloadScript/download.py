import os
import sys
import requests
import gspread
import time
from oauth2client.service_account import ServiceAccountCredentials

GOOGLE_JSON_KEY = 'dulcet-field-497411-p8-c52c98ec130d.json'
SPREADSHEET_ID = '1OJCOTg1oCthirKLFQDhX2tcixXbgMX0RS9bKLA7Zi60'
DOWNLOAD_DIR = 'asl_belgisi_documents'
BASE_STATIC_URL = 'https://xtrace.aslbelgisi.uz/xtrc-static-product/'
LOG_FILE = 'log.txt'

START_ROW = 2 

scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
creds = ServiceAccountCredentials.from_json_keyfile_name(GOOGLE_JSON_KEY, scope)

class Logger:
    def __init__(self, filename):
        self.terminal = sys.stdout
        self.log = open(filename, "a", encoding="utf-8")

    def write(self, message):
        self.terminal.write(message)
        self.log.write(message)
        self.log.flush()

    def flush(self):
        self.terminal.flush()
        self.log.flush()

sys.stdout = Logger(LOG_FILE)

def get_google_sheet():
    try:
        client = gspread.authorize(creds)
        return client.open_by_key(SPREADSHEET_ID).get_worksheet(0)
    except Exception as e:
        print(f"[!] Ошибка подключения к Google Sheets: {e}. Повтор через 10 секунд...")
        time.sleep(10)
        return get_google_sheet()

def download_files():
    if not os.path.exists(DOWNLOAD_DIR):
        os.makedirs(DOWNLOAD_DIR)

    sheet = get_google_sheet()
    print("прочитывание google таблицы...")
    
    try:
        all_rows = sheet.get_all_values()
    except Exception as e:
        print(f"[!] Не удалось прочитать таблицу: {e}. Переподключение...")
        sheet = get_google_sheet()
        all_rows = sheet.get_all_values()

    data_rows = all_rows[1:]
    total = len(data_rows)

    print(f"Старт скачивания со строки {START_ROW}...\n")

    for i, row in enumerate(data_rows, start=2):
        if i < START_ROW:
            continue
        if len(row) < 11:
            continue
        product_id = row[3].strip()
        file_links = [row[8].strip(), row[9].strip(), row[10].strip()]
        
        if not product_id:
            continue

        valid_links = [l for l in file_links if l]
        if not valid_links:
            continue

        product_path = os.path.join(DOWNLOAD_DIR, product_id)
        if not os.path.exists(product_path):
            os.makedirs(product_path)

        print(f"[{i}/{total+1}] Карточка ID: {product_id}")

        for link in valid_links:
            if link.startswith('http'):
                file_url = link
            else:
                file_url = BASE_STATIC_URL + link

            original_file_name = file_url.split('/')[-1]
            if '?' in original_file_name:
                original_file_name = original_file_name.split('?')[0]

            save_path = os.path.join(product_path, original_file_name)

            if os.path.exists(save_path) and os.path.getsize(save_path) > 0:
                print(f"   - [Пропуск] Файл уже скачан: {original_file_name}")
                continue

            success = False
            retry_delay = 30 
            
            while not success:
                try:
                    response = requests.get(file_url, timeout=30, stream=True)
                    
                    if response.status_code == 200:
                        with open(save_path, 'wb') as f:
                            for chunk in response.iter_content(chunk_size=8192):
                                f.write(chunk)
                        print(f"   - Скачан: {original_file_name}")
                        success = True
                    
                    elif response.status_code == 429:
                        print(f"   - [Лимит 429] Сервер перегружен. Ожидание {retry_delay} сек...")
                        time.makedirs(DOWNLOAD_DIR, exist_ok=True)
                        time.sleep(retry_delay)
                        retry_delay *= 2  
                        if retry_delay > 300:  
                            retry_delay = 300
                    
                    else:
                        print(f"   - Ошибка сервера ({response.status_code}) для: {original_file_name}")
                        success = True   
                except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as net_err:
                    print(f"   - [Ошибка сети] {net_err}. Повтор через 10 сек...")
                    time.sleep(10)
                except Exception as e:
                    print(f"   - Критическая ошибка при скачивании {original_file_name}: {e}")
                    success = True
        time.sleep(0.1)

if __name__ == "__main__":
    download_files()