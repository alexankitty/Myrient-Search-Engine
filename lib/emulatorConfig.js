// See https://emulatorjs.org/docs/systems for available cores
const coreMap = {
    // Nintendo Systems
    'Nintendo Entertainment System': 'fceumm',
    'Super Nintendo Entertainment System': 'snes9x',
    'Nintendo 64': 'mupen64plus_next',
    'Nintendo DS': 'desmume2015',
    'Nintendo Game Boy': 'gambatte',
    'Nintendo Game Boy Color': 'gambatte',
    'Nintendo Game Boy Advance': 'mgba',

    // Sega Systems
    'Sega Master System': 'smsplus',
    'Sega Game Gear': 'genesis_plus_gx', // TODO: fix rom loading
    'Sega Mega Drive': 'genesis_plus_gx',
    'Sega CD': 'genesis_plus_gx', // TODO: add bios
    'Sega 32X': 'picodrive', // Known issue: https://github.com/EmulatorJS/EmulatorJS/issues/579
    'Sega Saturn': 'yabause',

    // Atari Systems
    'Atari 2600': 'stella2014',
    'Atari 5200': 'a5200',
    'Atari 7800': 'prosystem',
    'Atari Jaguar': 'virtualjaguar',
    'Atari Lynx': 'handy',

    // Commodore Systems
    'Commodore 64': 'vice_x64sc',
    'Commodore 128': 'vice_x128', // Untested, Myrient has no ROMs for it
    'Commodore Amiga': 'puae', // TODO: fix rom loading
    'Commodore PET': 'vice_xpet', // Untested, Myrient has no ROMs for it
    'Commodore Plus-4': 'vice_xplus4', // TODO: fix rom loading
    'Commodore VIC-20': 'vice_xvic', // TODO: fix rom loading

    // Sony Systems
    'Sony PlayStation 1': 'pcsx_rearmed', // TODO: fix rom loading

    // Other Systems
    'Arcade': 'fbneo', // TODO: fix rom loading
    'ColecoVision': 'gearcoleco', // TODO: add bios
    'Panasonic 3DO': 'opera',  // TODO: fix rom loading
};

const COMPATIBLE_SYSTEMS = Object.keys(coreMap);

export function isEmulatorCompatible(category) {
    if (process.env.EMULATOR_ENABLED !== 'true') {
        return false;
    }
    return COMPATIBLE_SYSTEMS.includes(category);
}

export function getEmulatorConfig(category) {
    const core = coreMap[category] || 'unknown';

    // Add system-specific settings
    const config = {
        core,
        system: category,
        options: {}
    };

    return config;
}

export function isNonGameContent(filename, nonGameTerms) {
    const pattern = new RegExp(nonGameTerms.terms.join('|'), 'i');
    return pattern.test(filename);
}