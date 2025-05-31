import figlet from 'figlet';

export function generateAsciiArt(text) {
  return figlet.textSync(text || process.env.INSTANCE_NAME || 'Myrient', {
    font: 'Slant',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });
}
