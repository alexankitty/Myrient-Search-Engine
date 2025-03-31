import i18n from 'i18n';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, 'locales');

// Automatically detect available languages from locale files
const getAvailableLocales = () => {
    try {
        return fs.readdirSync(localesDir)
            .filter(file => file.endsWith('.json'))
            .map(file => path.basename(file, '.json'));
    } catch (error) {
        console.error('Error reading locale directory:', error);
        return ['en']; // Fallback to English
    }
};

const availableLocales = getAvailableLocales();
console.log('Available locales:', availableLocales);

i18n.configure({
    locales: availableLocales,
    defaultLocale: 'en',
    directory: localesDir,
    objectNotation: true,
    updateFiles: false,
    syncFiles: false,
    cookie: 'lang',
    queryParameter: 'lang'
});

// Export available locales for use in templates
export const locales = availableLocales;
export default i18n;