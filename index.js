import { parseStringPromise } from 'xml2js';
import { readdir, readFile, writeFile } from 'fs/promises';
import config from './config.js';
import { join } from 'path';
import semver from 'semver';

const files = (await readdir(config.searchPath)).filter(x => x !== '.svn');

const interfaces = await Promise.all(files.map(x => readdir(join(config.searchPath, x))));

const arr = [];

for (const i in files) {
    for (const j in interfaces[i]) {
        const int = interfaces[i][j];
        const path = join(config.searchPath, files[i], interfaces[i][j], config.subfolder);
        const items = await retrieveComponentsFromInterfaceFolder(path);

        arr.push([int, items]);
    }
}

writeCsv(arr);

async function retrieveComponentsFromInterfaceFolder(folder) {
    try {
        const items = (await readdir(folder)).filter(x => x.endsWith('.item')).reduce((acc, cur) => {
            const lastUnderscodeIndex = cur.lastIndexOf('_')
            const jobName = cur.substring(0, lastUnderscodeIndex);
            const found = acc.findIndex(x => x.startsWith(jobName));
            if(found < 0)
                return [...acc, cur];
            const regex = /\d+(\.\d+)+/;
            const [accVersion, curVersion] = [acc[found], cur].map(x => regex.exec(x)[0]).map(x => `${x}.0` /* valid semver */);
            return semver.lte(accVersion, curVersion) ? Object.assign([], acc, { [found]: cur}) : acc;
        }, []);
        const file = await Promise.all(items.map(x => readFile(join(folder, x), "utf8")));
        const content = await Promise.all(file.map(parseStringPromise));

        const components = content.flatMap(x => x['talendfile:ProcessType']['node']).map(x => x?.$?.componentName);

        return components.reduce((acc, cur) => ({ ...acc, [cur]: acc[cur] ? acc[cur] + 1 : 1 }), {});
    }
    catch (e) {
        console.warn(`Une erreur a eu lieu lors du traitement du dossier ${folder}`, e);
    }
}

function writeCsv(data) {
    const result = data.filter(([, value]) => value).map(([key, value]) => [key, Object.entries(value)]);

    result.forEach((arr) => {
        const [first, second] = arr;
        arr.shift();
        second.forEach(x => x.unshift(first))
    })

    const csv = result.flat(2).map(x => x.join(',')).join('\r\n');

    writeFile('result.csv', csv);
}

    