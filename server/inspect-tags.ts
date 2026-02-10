import { execSync } from 'child_process';
// @ts-ignore
import ffprobePath from 'ffprobe-static';

const filePath = "C:/Users/denni/Desktop/Apps/MusicMaster/music/2005 - Mezmerize/01-04 - System Of A Down - Cigaro.flac";

try {
    const ffprobe = ffprobePath.path;
    const stdout = execSync(`"${ffprobe}" -v quiet -print_format json -show_format "${filePath}"`).toString();
    const data = JSON.parse(stdout);
    console.log(JSON.stringify(data.format.tags, null, 2));
} catch (error) {
    console.error('Failed:', error);
}
