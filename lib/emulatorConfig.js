import debugPrint from './debugprint.js'

// See https://emulatorjs.org/docs/systems for available cores
const systemConfigs = {
    // Nintendo Systems
    'Nintendo Entertainment System': {
        core: 'fceumm',
        unpackRoms: true
    },
    'Super Nintendo Entertainment System': {
        core: 'snes9x',
        unpackRoms: true
    },
    'Nintendo 64': {
        core: 'mupen64plus_next',
        unpackRoms: true
    },
    'Nintendo DS': {
        core: 'desmume2015',
        unpackRoms: true
    },
    'Nintendo Game Boy': {
        core: 'gambatte',
        unpackRoms: true
    },
    'Nintendo Game Boy Color': {
        core: 'gambatte',
        unpackRoms: true
    },
    'Nintendo Game Boy Advance': {
        core: 'mgba',
        unpackRoms: true
    },

    // Sega Systems
    'Sega Master System': {
        core: 'smsplus',
        unpackRoms: true
    },
    'Sega Game Gear': {
        core: 'genesis_plus_gx',
        unpackRoms: false
    },
    'Sega Mega Drive': {
        core: 'genesis_plus_gx',
        unpackRoms: true
    },
    // 'Sega CD': { // TODO: Fix ROM loading
    //     core: 'genesis_plus_gx',
    //     unpackRoms: false,
    //     bios: {
    //         required: true,
    //         files: {
    //             'bios_CD_U.bin': {
    //                 url: 'https://github.com/Abdess/retroarch_system/raw/refs/heads/libretro/Sega%20-%20Mega%20CD%20-%20Sega%20CD/bios_CD_U.bin',
    //                 md5: '2efd74e3232ff260e371b99f84024f7f',
    //                 region: 'US'
    //             },
    //             'bios_CD_E.bin': {
    //                 url: 'https://github.com/Abdess/retroarch_system/raw/refs/heads/libretro/Sega%20-%20Mega%20CD%20-%20Sega%20CD/bios_CD_E.bin',
    //                 md5: 'e66fa1dc5820d254611fdcdba0662372',
    //                 region: 'EU'
    //             },
    //             'bios_CD_J.bin': {
    //                 url: 'https://github.com/Abdess/retroarch_system/raw/refs/heads/libretro/Sega%20-%20Mega%20CD%20-%20Sega%20CD/bios_CD_J.bin',
    //                 md5: 'bdeb4c47da613946d422d97d98b21cda',
    //                 region: 'JP'
    //             }
    //         }
    //     }
    // },
    'Sega 32X': {
        core: 'picodrive',
        unpackRoms: true
    },
    'Sega Saturn': {
        core: 'yabause',
        unpackRoms: true
    },

    // Atari Systems
    'Atari 2600': {
        core: 'stella2014',
        unpackRoms: true
    },
    'Atari 5200': {
        core: 'a5200',
        unpackRoms: true
    },
    'Atari 7800': {
        core: 'prosystem',
        unpackRoms: true
    },
    'Atari Jaguar': {
        core: 'virtualjaguar',
        unpackRoms: true
    },
    'Atari Lynx': {
        core: 'handy',
        unpackRoms: true
    },

    // Commodore Systems
    // 'Commodore 64': { // TODO: Fix ROM loading
    //     core: 'vice_x64sc',
    //     unpackRoms: true
    // },
    // 'Commodore 128': { // No ROMs on Myrient
    //     core: 'vice_x128',
    //     unpackRoms: true
    // },
    // 'Commodore Amiga': { // TODO: Fix ROM loading
    //     core: 'puae',
    //     unpackRoms: true
    // },
    // 'Commodore PET': { // No ROMs on Myrient
    //     core: 'vice_xpet',
    //     unpackRoms: true
    // },
    // 'Commodore Plus-4': { // TODO: fix rom loading
    //     core: 'vice_xplus4',
    //     unpackRoms: true
    // },
    // 'Commodore VIC-20': { // TODO: fix rom loading
    //     core: 'vice_xvic',
    //     unpackRoms: true
    // },

    // Sony Systems
    'Sony PlayStation 1': {
        core: 'pcsx_rearmed',
        unpackRoms: true
    },
    'Sony PlayStation Portable': {
        core: 'ppsspp',
        unpackRoms: true
    },

    // Other Systems
    // 'Arcade': { // TODO: fix rom loading
    //     core: 'fbneo',
    //     unpackRoms: true
    // },
    // 'ColecoVision': { // TODO: fix rom loading
    //     core: 'gearcoleco',
    //     unpackRoms: false,
    //     bios: {
    //         required: true,
    //         files: {
    //             'colecovision.rom': {
    //                 url: 'https://github.com/Abdess/retroarch_system/raw/refs/heads/libretro/Coleco%20-%20ColecoVision/colecovision.rom',
    //                 md5: '2c66f5911e5b42b8ebe113403548eee7',
    //                 region: 'Global'
    //             }
    //         }
    //     }
    // },
    // 'Panasonic 3DO': {  // TODO: fix rom loading
    //     core: 'opera',
    //     unpackRoms: false
    //     // bios: {
    //     //     required: true,
    //     //     files: {
    //     //         'panafz1.bin': {
    //     //             url: 'https://files.catbox.moe/u5hy1c.bin',
    //     //             md5: 'f47264dd47fe30f73ab3c010015c155b',
    //     //             region: 'Global'
    //     //         }
    //     //     }
    //     // }
    // }
};

const COMPATIBLE_SYSTEMS = Object.keys(systemConfigs);

export function isEmulatorCompatible(category) {
    debugPrint(`[EmulatorConfig] Checking compatibility for: ${category}`);

    if (process.env.EMULATOR_ENABLED !== 'true') {
        debugPrint('[EmulatorConfig] Emulator is disabled via environment variable');
        return false;
    }

    const isCompatible = COMPATIBLE_SYSTEMS.includes(category);
    debugPrint(`[EmulatorConfig] System compatibility result: ${isCompatible}`);
    return isCompatible;
}

export function getEmulatorConfig(category) {
    debugPrint(`[EmulatorConfig] Configuring emulator for category: ${category}`);

    const systemConfig = systemConfigs[category];
    if (!systemConfig) {
        debugPrint(`[EmulatorConfig] No configuration found for category: ${category}`, 'warn');
        return null;
    }

    const config = {
        core: systemConfig.core,
        system: category,
        unpackRoms: systemConfig.unpackRoms,
        bios: systemConfig.bios || null
    };

    debugPrint(`[EmulatorConfig] Final configuration:`, config);
    return config;
}

export function isNonGameContent(filename, nonGameTerms) {
    const pattern = new RegExp(nonGameTerms.terms.join('|'), 'i');
    return pattern.test(filename);
}