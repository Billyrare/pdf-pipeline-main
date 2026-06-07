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

// ПЕРЕХВАТ Ctrl+C
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
    
    // Используем spawnSync, чтобы лучше контролировать процесс
    const result = spawnSync('yarn', ['dw'], {
        stdio: 'inherit',
        shell: true, // важно для Windows
        env: { 
            ...process.env, 
            CURRENT_IDS_FILE: file 
        },
        // Это заставляет дочерний процесс игнорировать Ctrl+C, 
        // пока мы сами не решим его убить (но мы даем ему доработать)
        killSignal: 'SIGTERM' 
    });

    // Проверяем, завершился ли процесс успешно (код 0)
    if (result.status === 0) {
        fs.writeFileSync(progressFile, JSON.stringify({ lastFile: file }, null, 2));
        console.log(`✅ Файл ${file} полностью обработан.`);
    } else {
        console.log(`\n⚠️ Процесс ${file} был прерван или завершился с ошибкой.`);
        // Если мы нажали Ctrl+C, то выходим из цикла, НЕ сохраняя этот файл как готовый
        break;
    }
}

console.log(isStopping ? "⏸ Скрипт успешно поставлен на паузу." : "🏁 Все файлы обработаны.");