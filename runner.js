import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const idsDir = path.join(process.cwd(), 'docs', 'ids');
const progressFile = path.join(process.cwd(), 'progress.json');

let lastProcessedFile = null;
if (fs.existsSync(progressFile)) {
    try {
        const progress = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
        lastProcessedFile = progress.lastFile;
    } catch (e) { lastProcessedFile = null; }
}

const files = fs.readdirSync(idsDir)
    .filter(f => f.startsWith('ids') && f.endsWith('.txt'))
    .sort((a, b) => (parseInt(a.match(/\d+/)) || 0) - (parseInt(b.match(/\d+/)) || 0));

const filesToProcess = lastProcessedFile 
    ? files.filter(f => (parseInt(f.match(/\d+/)) || 0) > (parseInt(lastProcessedFile.match(/\d+/)) || 0))
    : files;

let isStopping = false;
process.on('SIGINT', () => {
    if (!isStopping) {
        console.log('\n\n[WAIT] 🛑 Сигнал остановки получен! Докачиваем текущий файл и выходим...');
        isStopping = true;
    } else {
        console.log('\n[FORCE] ⚠️ Повторное нажатие! Принудительное завершение...');
        process.exit(1);
    }
});

console.log(`🚀 Начинаем работу. Файлов к обработке: ${filesToProcess.length}`);

for (const file of filesToProcess) {
    if (isStopping) break;

    console.log(`\n>>> В РАБОТЕ: ${file}`);
    
    const result = spawnSync('yarn', ['dw'], {
        stdio: 'inherit',
        shell: true, 
        env: { 
            ...process.env, 
            CURRENT_IDS_FILE: file 
        },
        killSignal: 'SIGTERM' 
    });

    if (result.status === 0) {
        fs.writeFileSync(progressFile, JSON.stringify({ lastFile: file }, null, 2));
        console.log(`✅ Файл ${file} полностью обработан.`);
    } else {
        console.log(`\n⚠️ Процесс ${file} был прерван или завершился с ошибкой.`);
        break;
    }
}

console.log(isStopping ? "⏸ Скрипт успешно поставлен на паузу." : "🏁 Все файлы обработаны.");