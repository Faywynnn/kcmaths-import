const fs = require('fs');
const prompt = require('prompt');
const cheerio = require('cheerio');
const axios = require('axios');
const FormData = require('form-data');

const curentVersion = 'v1.1.0'; //Ne pas modifier

prompt.start();

const separator = "=".repeat(process.stdout.columns)

const separatorText = (text) => {
    const textLength = text.length;
    const separatorLength = separator.length - (textLength + 2);
    return separator.substring(0, (separatorLength / 2)) + " " + text + " " + separator.substring(0, (separatorLength % 2) + (separatorLength / 2));
};


startText(lastVersion());

async function lastVersion() {
    const response = await axios.get('https://github.com/Faywynnn/kcmaths-import/releases/latest');
    const versionUrl = response?.request?.res?.responseUrl;

    if (!versionUrl) {
        return curentVersion
    }

    const version = versionUrl.split('/')[versionUrl.split('/').length - 1]
    return version;
}


async function startText(version) {

    console.log('');

    if ((await version) !== curentVersion) {
        console.log(separatorText("MISE A JOUR"));
        console.log(`  Une nouvelle version est disponible (${await version}) !`);
        console.log(`  Vous pouvez la télécharger à l'adresse suivante:\n   - https://github.com/Faywynnn/kcmaths-import/releases/latest`);
        console.log(separator + '\n')
    }

    console.log(separatorText('KCMATHS Import'));
    console.log("  Ce script permet de télécharger l'ensemble des fichiers du site kcmaths  \n  en les triants dans des dossiers par chapitre.")
    console.log("  Entrer votre nom d'utilisateur et votre mot de passe (du site kcmaths) pour  \n  continuer.")
    console.log(separator + '\n')

    start();

}

async function start(defaultUsername = '') {
    const schema = {
        properties: {
            "Nom d'utilisateur": {
                pattern: /^[a-zA-Z]+$/,
                message: "Le nom d'utilisateur doit contenir que des caracteres du type [a-zA-Z]",
                required: true,
                default: defaultUsername
            },
            "Mot de passe": {
                hidden: true,
                required: true,
                replace: "*"
            }
        }
    };

    const path_schema = {
        properties: {
            "Chemin d'accès (absolue)": {
                hidden: false,
                required: true
            }
        }
    }

    let downloadPath;

    do {
        await new Promise((resolve, _) => {
            prompt.get(path_schema, function(_, result) {
                downloadPath = result["Chemin d'accès (absolue)"];
                resolve();
            })
        })
    } while (!fs.existsSync(downloadPath))

    prompt.get(schema, function(err, result) {
        if (err) { return onErr(err); }

        const userName = result["Nom d'utilisateur"];
        const userPassword = result["Mot de passe"];

        main(userName, userPassword, downloadPath);
    });
}


async function main(userName, userPassword, downloadPath) {

    function logStart() {
        console.log(`${separatorText("Démarrage de l'application")}\n`);
        console.log(`  Chemin d'accès: ${downloadPath}`);
        console.log(`  Nom d'utilisateur: ${userName}`);
        console.log(`  Mot de passe: ${userPassword.replace(/./g, '*')}`);
        console.log(`\n${separator}\n`);
    }

    async function checkResponseCode(code) {
        if (code === 200) {
            return true;
        } if (code === 429) {
            console.log("  Erreur: Trop de requetes, veuillez réessayer plus tard");
        } else {
            console.log("  Erreur: Un erreur est survenue, veuillez réessayer plus tard. Code: ", code);
        }
        false
    }

    async function getPhpSessionId(userName, userPassword) {
        return new Promise((resolve, _) => {
            var bodyFormData = new FormData();
            bodyFormData.append('nom_session', userName);
            bodyFormData.append('mot_de_passe', userPassword);

            axios({
                method: 'POST',
                url: `https://kcmaths.com/index.php`,
                data: bodyFormData,
                headers: { "Content-Type": "multipart/form-data" },
            })
                .then(async function(res) {
                    if (await checkResponseCode(res.status)) {
                        if (res.data.includes("Pas de connexion, pas de crampons")) {
                            resolve(false)
                        }
                        const cookie = res.headers['set-cookie'][0];
                        const phpSessionId = cookie.substring(cookie.indexOf("=") + 1, cookie.indexOf(";"));
                        resolve(phpSessionId);
                    }
                })
                .catch((_) => {
                    console.log(`\n${separator}\n`);
                    console.log("  Erreur: Un erreur est survenue, veuillez réessayer plus tard.\n  Vérifier votre connexion internet");
                    console.log(`\n${separator}\n`);
                    start();
                })
        });
    }

    const phpSessionId = await getPhpSessionId(userName, userPassword);
    if (!phpSessionId) {
        console.log(`\n${separator}\n`);
        console.log(`  Le nom d'utilisateur ou le mot de passe est incorrect`);
        console.log(`\n${separator}\n`);
        start(userName);
        return
    }

    logStart();

    const getHtml = async (url) => {
        return new Promise((resolve, reject) => {
            try {
                var bodyFormData = new FormData();
                bodyFormData.append('nom_session', userName);
                bodyFormData.append('mot_de_passe', userPassword);

                axios({
                    method: 'GET',
                    url: `https://kcmaths.com/${url}`,
                    data: bodyFormData,
                    headers: {
                        "Content-Type": "multipart/form-data",
                        "Cookie": `PHPSESSID=${phpSessionId}`
                    },
                })
                    .then(async function(res) {
                        if (await checkResponseCode(res.status)) {
                            resolve(res.data);
                        }
                    })
            }
            catch (e) {
                console.log(e);
                reject(e);
            }
        });
    }

    const documentsPage = await getHtml("documents_sommaire.php"); // fs.readFileSync('./html.html', 'utf8');
    const documentsPageHtml = cheerio.load(documentsPage, null, false);

    // Get the div with the class "accueil"
    const divAccueil = documentsPageHtml("div.accueil");
    var documents = [];

    for (element of divAccueil.children()) {
        if (element.name === 'h1') {
            documents.push([element.children[0].data])
        }
        else if (element.name === 'table' && element.children[1].name === 'tbody') {
            for (tr of element.children[1].children) {
                if (tr.name === 'tr') {
                    const tdLink = tr.children[0];
                    const tdTitle = tr.children[2];
                    const tdLinkChildren = tdLink.children.filter(x => x.name === 'a');

                    const link = tdLinkChildren[0].attribs.href;
                    const title = tdTitle.children[0].data;

                    documents[documents.length - 1].push({
                        link,
                        title
                    });
                }
            }
        }
    }


    for (folder of documents) {
        const folderName = folder[0];

        for (document of folder.slice(1)) {
            const documentName = document.title;
            const documentLink = document.link;

            // If include Chapitre in document name, create a folder with the name of the document
            // "Chapitre 1" => chapter 1, "Chapter 10" => chapter 10
            // Sort by chapter / folderName

            const chapter_n = documentName.includes("Chapitre") ? parseInt(documentName.split("Chapitre ")[1]) : null;

            function checkFolder(folderPath) {
                if (!fs.existsSync(folderPath)) {
                    fs.mkdirSync(folderPath);
                }
            }

            if (chapter_n) {
                checkFolder(`${downloadPath}/Chapitre ${chapter_n}`)
                checkFolder(`${downloadPath}/Chapitre ${chapter_n}/${folderName}`)
            }
            else {
                checkFolder(`${downloadPath}/${folderName}`);
            }


            const documentPath = chapter_n ? `${downloadPath}/Chapitre ${chapter_n}/${folderName}` : `${downloadPath}/${folderName}`;
            let fileName = documentName.trim().replace(/[^a-zA-Z0-9_éêèàùïüëöâôûç]/g, '_').trim().replace(/_+/g, '_');
            while (fileName.endsWith('_')) {
                fileName = fileName.substring(0, fileName.length - 1);
            }
            while (fileName.startsWith('_')) {
                fileName = fileName.substring(1, fileName.length);
            }


            const filePath = `${documentPath}/${fileName}.pdf`;

            if (!fs.existsSync(filePath)) {
                // Encode base64 username:password
                const authorization = "Basic " + Buffer.from(userName + ":" + userPassword).toString('base64');

                axios({
                    method: 'GET',
                    url: `https://kcmaths.com/${documentLink}`,
                    headers: {
                        Authorization: authorization
                    },
                    responseType: 'stream'
                })
                    .then(function(res) {
                        res.data.pipe(fs.createWriteStream(filePath))
                        console.log(`  Fichier téléchargé: ${fileName}`)
                        setTimeout(() => { }, 5000)
                    })
            }
        }
    }
}
