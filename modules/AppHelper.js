import { homedir, EOL, cpus, userInfo, arch } from 'os';
import * as pathHelper from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import { createBrotliCompress, createBrotliDecompress } from 'zlib';



export class AppHelper {
    
    #username = 'dear user';
    #currentDir;

    constructor(argv) {

        argv.slice(2).forEach( (arg, index) => {

            if (arg.slice(0,2) === '--') {
    
                const parseArg = arg.slice(2).split('=');
    
                if (parseArg[0] == 'username') {
                    this.#username = parseArg[1];
                }
    
            }

        });

        this.#currentDir = homedir();
        this.printGreeting();
        this.printCurrentDir();
    }

    printCurrentDir() {
        if (this.#currentDir) {
            console.log(`You are currently in ${this.#currentDir}` + EOL);
        } else {
            console.log(`You are currently in ${homedir()}` + EOL);
        }
    }

    printGreeting() {
        console.log(`Welcome to the File Manager, ${this.#username}!`);
    }

    printParting() {
        console.log(`Thank you for using File Manager, ${this.#username}, goodbye!`);
    }

    printOperationError() {
        console.log('Operation failed');
    }

    printInputError() {
        console.log('Invalid input' + EOL);
    }

    onOperationFailed() {
        this.printOperationError();
        this.printCurrentDir();
    }

    exitHandler() {
        this.printParting();
        process.exit();
    }

    async navigateHandtler(comand) {
        const args = comand.toString().trim().split(' ');
        let promise;
        
        switch (args[0]) {
            
            case '.exit': {
                this.exitHandler();
                break;
            }
                
            
            case 'up': {
                promise = this.upDirPromisify();
                break;
            }
                
    
            case 'cd': {
                promise = this.cdDirPromisify(args[1]);
                break;
            }

            case 'ls': {
                promise = this.lsDirPromisify();
                break;
            }

            case 'cat': {
                promise = this.catFilePromisify(args[1]);
                break;
            }
             
            case 'add': {
                promise = this.addFilePromisify(args[1]);
                break;
            }
            
            case 'rn': {
                promise = this.rnFilePromisify(args[1], args[2]);
                break;
            }

            case 'cp': {
                promise = this.cpFilePromisify(args[1], args[2]);
                break;
            }

            case 'mv': {
                promise = this.mvFilePromisify(args[1], args[2]);
                break;
            }

            case 'rm': {
                promise = this.rmFilePromisify(args[1]);
                break;
            }

            case 'os': {
                promise = this.osPromisify(args[1]);
                break;
            }

            case 'hash': {
                promise = this.hashPromisify(args[1]);
                break;
            }

            case 'compress': {
                promise = this.compressPromisify(args[1], args[2]);
                break;
            }

            case 'decompress': {
                promise = this.decompressPromisify(args[1], args[2]);
                break;
            }

            default: {
                this.printInputError();
                break;
            }
        }

        if (promise) {
            promise
                .then(this.printCurrentDir.bind(this))
                .catch(err => {
                    err ? console.log(err.message) : '';
                    this.onOperationFailed();
                });
        }
    }

    upDirPromisify() {

        return new Promise((resolve, reject) => {
            const newDir = pathHelper.join(this.#currentDir, '..');
            this.#currentDir = newDir;
            resolve();
        });
        
    }

    cdDirPromisify(path) {

        const newDir = pathHelper.resolve(this.#currentDir, pathHelper.normalize(path));
        return fs.promises.lstat(newDir).then( stats => {
            if(stats.isDirectory) {
                this.#currentDir = newDir;
            }
        })

    }

    lsDirPromisify() {

        return fs.promises.readdir(this.#currentDir).then(async (files) => {

            let arFiles = [];
            let arDirectories = [];
            
            for (const file of files) {

                const fileStats = await fs.promises.lstat(pathHelper.join(this.#currentDir, file));

                if (fileStats && fileStats.isFile()) arFiles.push({
                    Name: file,
                    Type: 'file'
                });

                if (fileStats && fileStats.isDirectory()) arDirectories.push({
                    Name: file,
                    Type: 'directory'
                });

            }

            arFiles.sort((a, b) => a.Name > b.Name ? 1 : -1);
            arDirectories.sort((a, b) => a.Name > b.Name ? 1 : -1);

            return arDirectories.concat(arFiles);

        }).then(arResult => {
            console.table(arResult);
        })

    }

    async catFilePromisify(path) {

        try {

            const filePath = pathHelper.resolve(this.#currentDir, pathHelper.normalize(path));
            const stream = fs.createReadStream(filePath);
            
            await new Promise((resolve, reject) => {
                stream.on("data", chunk => {process.stdout.write(chunk)});
                stream.on("end", () => {
                    process.stdout.write(EOL)
                    resolve()
                });
                stream.on("error", error => {reject(error)});
            })
            
            return Promise.resolve();
        
        } catch (error) {
            return Promise.reject(error);
        }

    }

    addFilePromisify(path) {
        const filePath = pathHelper.resolve(this.#currentDir, pathHelper.normalize(path));

        return fs.promises.writeFile(filePath, '').then(() => console.log('File created!'));
    }

    rnFilePromisify(pathToFile, newFileName) {
        const dirPath = pathHelper.dirname(pathHelper.normalize(pathToFile));

        return fs.promises.rename(pathToFile, pathHelper.join(dirPath, pathHelper.normalize(newFileName))).then(() => console.log('File renamed!'));
    }

    rmFilePromisify(path) {
        return fs.promises.rm(pathHelper.normalize(path)).then(() => console.log('File deleted!'));
    }

    // cp path_to_file path_to_new_directory
    async cpFilePromisify(pathToFile, pathToNewDir) {

        try {

            const rs = fs.createReadStream(pathHelper.normalize(pathToFile));
            const ws = fs.createWriteStream(pathHelper.resolve(pathHelper.normalize(pathToNewDir) + '/' + pathHelper.basename(pathHelper.normalize(pathToFile))));
            
            await pipeline(
                rs, 
                ws
            )

            return Promise.resolve();

        } catch (error) {
            return Promise.reject(error);            
        }
       
    }

    async mvFilePromisify(pathToFile, pathToNewDir) {

        try {

            const rs = fs.createReadStream(pathHelper.normalize(pathToFile));
            const ws = fs.createWriteStream(pathHelper.resolve(pathHelper.normalize(pathToNewDir) + '/' + pathHelper.basename(pathHelper.normalize(pathToFile))));
            
            await new Promise((resolve, reject) => {
                
                rs.on('data', (chunk) => {
                    ws.write(chunk);
                })

                rs.on("end", () => {
                    fs.promises.rm(pathHelper.normalize(pathToFile)).then(() => {
                        console.log('File moved!')
                        resolve();
                    }).catch(err => {
                        reject(err);         
                    })
                });
                ws.on("end", () => resolve());
                
                rs.on('error', (err) => reject(err));
                ws.on('error', (err) => reject(err));

            })

            return Promise.resolve();

        } catch (error) {
            return Promise.reject(error);            
        }
       
    }

    osPromisify(arg) {
        let promice = null;
        switch (arg) {
            case '--EOL':
                promice = this.printEOLPromisify();
                break;
            
            case '--cpus':
                promice = this.printCPUSPromisify();
                break;

            case '--homedir':
                promice = this.printHomeDirPromisify();
                break;

            case '--username':
                promice = this.printUsernamePromisify();
                break;

            case '--architecture':
                promice = this.printArchitecturePromisify();
                break;
        
            default: {
                this.printInputError();
                break;
            }
        }

        return promice;
    }

    printEOLPromisify() {

        return new Promise((resolve, reject) => {
            console.log(JSON.stringify(EOL));
            resolve();
        });
        
    }

    printCPUSPromisify() {
        
        return new Promise((resolve, reject) => {
            const mycpus = cpus();
            let cpusToPrint = [];

            mycpus.forEach(cpu => {
                const speed = this.decimalAdjust('round', cpu.speed/1000, -1) + ' GHz';
                cpusToPrint.push({model: cpu.model, speed: speed})
            })

            console.table(cpusToPrint);
            resolve();
        });

    }

    printHomeDirPromisify() {

        return new Promise((resolve, reject) => {
            console.log(homedir());
            resolve();
        }); 

    }

    printUsernamePromisify() {

        return new Promise((resolve, reject) => {
            console.log(userInfo().username);
            resolve();
        }); 

    }

    printArchitecturePromisify() {

        return new Promise((resolve, reject) => {
            console.log(arch());
            resolve();
        }); 

    }

    async hashPromisify(pathToFile) {

        try {

            const rs = fs.createReadStream(pathHelper.normalize(pathToFile));
            const hash = createHash('sha256');
            
            await new Promise((resolve, reject) => {
                
                rs.on('data', (chunk) => {
                    process.stdout.write(hash.update(chunk).digest('hex'));
                })

                rs.on("end", () => {
                    process.stdout.write(EOL);
                    resolve()
                });
                
                rs.on('error', (err) => reject(err));

            })

            return Promise.resolve();

        } catch (error) {
            return Promise.reject(error);            
        }

    }

    async compressPromisify(pathToFile, pathToDestination) {

        try {

            pathToFile = pathHelper.normalize(pathToFile);
            let pathToZip = pathHelper.normalize(pathToDestination) + '/' + pathHelper.basename(pathToFile) + '.gz';
            const rs = fs.createReadStream(pathToFile);
            const ws = fs.createWriteStream(pathToZip);
            
            const compress = createBrotliCompress();

            // rs.pipe(compress).pipe(ws);
            await pipeline(
                rs, 
                compress, 
                ws
            )
            
            console.log('file compressed!');
            return Promise.resolve();

        } catch (error) {
            return Promise.reject(error);            
        }

    }

    async decompressPromisify(pathToFile, pathToDestination) {

        try {

            pathToFile = pathHelper.normalize(pathToFile);
            let pathToZip = pathHelper.normalize(pathToDestination) + '/' + pathHelper.basename(pathToFile, '.gz');
            const rs = fs.createReadStream(pathToFile);
            const ws = fs.createWriteStream(pathToZip);
            
            const decompress = createBrotliDecompress();
            
            await pipeline(
                rs,
                decompress,
                ws
            )
            
            console.log('file decompressed!');
            return Promise.resolve();

        } catch (error) {
            return Promise.reject(error);            
        }

    }

    decimalAdjust(type, value, exp) {

        if (typeof exp === 'undefined' || +exp === 0) {
          return Math[type](value);
        }
        value = +value;
        exp = +exp;

        if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
          return NaN;
        }

        value = value.toString().split('e');
        value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));

        value = value.toString().split('e');
        return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
    }

}