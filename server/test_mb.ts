import { MusicBrainzApi } from 'musicbrainz-api';
const mbApi = new MusicBrainzApi({ appName: 'MusicMaster', appVersion: '1.0.0', appContactInfo: 'none' });
mbApi.lookup('release', 'ca22ac22-63bc-4670-af96-27fedbf43491', ['recordings']).then(res => console.log(Object.keys(res))).catch(err => console.error(err));
