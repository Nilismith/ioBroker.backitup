'use strict';
const fs = require('fs');
const fse = require('fs-extra');
const getDate = require('../tools').getDate;
const path = require('path');

async function command(options, log, callback) {
    let noderedInst = [];

    for (let i = 0; i <= 5; i++) {
        let pth = path.join(options.path, `node-red.${i}`);

        if (fs.existsSync(pth)) {
            noderedInst.push(`node-red.${i}`);

            const nameSuffix = options.hostType == 'Slave' && options.slaveSuffix ? options.slaveSuffix : options.hostType !== 'Slave' && options.nameSuffix ? options.nameSuffix : '';
            const fileName = path.join(options.backupDir, `nodered.${i}_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);
            const tmpDir = path.join(options.backupDir, `noderedtmp${i}`).replace(/\\/g, '/');

            if (!fs.existsSync(tmpDir)) {
                try {
                    await fse.ensureDir(tmpDir);
                    log.debug('Created noderedtmp directory');
                } catch (err) {
                    log.debug(`Node-Red tmp directory "${tmpDir}" cannot created`);
                }
            } else {
                log.debug(`Try deleting the old Node-Red tmp directory: "${tmpDir}"`);
                try {
                    await fse.remove(tmpDir);
                } catch (err) {
                    log.debug(`old Node-Red tmp directory "${tmpDir}" cannot deleted`);
                }
                if (!fs.existsSync(tmpDir)) {
                    log.debug(`old Node-Red tmp directory "${tmpDir}" successfully deleted`);
                    try {
                        await fse.ensureDir(tmpDir);
                        log.debug('Created new noderedtmp directory');
                    } catch (err) {
                        log.debug(`Node-Red tmp directory "${tmpDir}" cannot created`);
                    }
                }
            }

            await tmpCopy(pth, tmpDir, log);
            await compressBackupFile(fileName, tmpDir, log, callback);

            try {
                log.debug(`Try deleting the Node-Red tmp directory: "${tmpDir}"`);
                await fse.remove(tmpDir);
                if (!fs.existsSync(tmpDir)) {
                    log.debug(`Node-Red tmp directory "${tmpDir}" successfully deleted`);
                }
            } catch (err) {
                log.debug(`Node-Red tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                callback && callback(err);
            }

            options.context.fileNames.push(fileName);
            options.context.types.push(`nodered.${i}`);
            options.context.done.push(`nodered.${i}`);

            if (i == 5) {
                log.debug(noderedInst.length ? `found node-red database: ${noderedInst}` : 'no Node-Red database found!!');
            }
        } else if (!fs.existsSync(pth) && i === 5) {
            log.debug(noderedInst.length ? `found node-red database: ${noderedInst}` : 'no node-red database found!!');
            callback && callback(null, 'done');
        }
    }
}

async function tmpCopy(pth, tmpDir, log) {
    return new Promise(async (resolve, reject) => {
        await fse.copy(pth, tmpDir, {
            filter: path => {
                return !(path.indexOf('node_modules') > -1)
            }
        }).then(() => {
            log.debug('Node-Red tmp copy finish');
            resolve();
        }).catch(err => {
            reject(err);
        })
    });
}

async function compressBackupFile(fileName, tmpDir, log, callback) {
    return new Promise(async (resolve, reject) => {
        const compress = require('../targz').compress;

        compress({
            src: tmpDir,
            dest: fileName,
        }, async (err, stderr) => {
            if (err) {
                options.context.errors.nodered = err.toString();
                stderr && log.error(stderr);
                if (callback) {
                    callback(err, stderr);
                    callback = null;
                    reject();
                }
            } else {
                log.debug(`Backup created: ${fileName}`);
                resolve();
            }
        });
    });
}

module.exports = {
    command,
    ignoreErrors: true
};