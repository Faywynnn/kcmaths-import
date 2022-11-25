import fs from 'fs';
import prompt from 'prompt';
import cheerio from 'cheerio';
import axios from 'axios';
import FormData from 'form-data'; 

import functions from "./functions";

const {
	separatorTextLog,
	separatorLog,
	textLog
} = functions;

const curentVersion = 'v1.2.0'; //Ne pas modifier

prompt.start();



// Get the last version of the script on github
async function lastVersion() {
    const response = await axios.get('https://github.com/Faywynnn/kcmaths-import/releases/latest');
    const versionUrl = response?.request?.res?.responseUrl;

    if (!versionUrl) {
        return curentVersion
    }

    const version = versionUrl.split('/')[versionUrl.split('/').length - 1]
    return version;
}
// Log if the version is not up to date
async function startText(version: Promise<string>) {

	textLog('', 0); // Empty line

    if ((await version) !== curentVersion) {
		separatorTextLog("MISE A JOUR");
        textLog(`Une nouvelle version est disponible (${await version}) !`, 2);
        textLog(`Vous pouvez la télécharger à l'adresse suivante:`, 2);
		textLog(`- https://github.com/Faywynnn/kcmaths-import/releases/latest`, 4);
        separatorLog();
    }

	textLog('', 0); // Empty line

    separatorTextLog('KCMATHS Import');

	textLog('', 0); // Empty line

	textLog("Ce script permet de télécharger l'ensemble des fichiers du site kcmaths en les triants dans des dossiers par chapitre.", 2);

	textLog('', 0); // Empty line

	textLog("Entrer le chemin d'accès où vous voulez télécharger les fichiers.", 2);
	textLog(`- Le chemin d'accès par défaut est: \"${process.cwd()}\". Pour l'utiliser cliquer sur Entrer.`, 4);
	textLog("- Sinon vous devez entrer un chemin d'accès valide absolue", 4);
	textLog("- Racourcis: entrer \"\\\\\" ou \"//\" au début du chemin pour continuer après le chemin d'accès par défaut.", 4);
	
	textLog('', 0); // Empty line

    textLog("Puis entrer votre nom d'utilisateur et votre mot de passe.", 2)
	textLog("- Le nom d'utilisateur et le mot de passe sont ceux utilisés pour vous connecter sur le site kcmaths.", 4);

	textLog('', 0); // Empty line

    separatorLog();

    start();
}


// Ask for the username and password
async function start({defaultUsername, defaultPath} = {defaultUsername: "", defaultPath: process.cwd()}) {
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
            "Chemin d'accès": {
                hidden: false,
                required: true,
				default: defaultPath
            }
        }
    }

	textLog('', 0); // Empty line

    let downloadPath: string = await new Promise((resolve, _) => {
		prompt.get(path_schema, function(_, result) {
			const res = result["Chemin d'accès"]?.toString();
			if (res !== undefined && (res.startsWith('//') || res.startsWith('\\\\'))) {
				resolve(defaultPath + `\\` + res.substring(2))
			} else {
				resolve(res)
			}
		})
	})

    while (!fs.existsSync(downloadPath)) {
		textLog("Le chemin d'accès n'existe pas, veuillez entrer un chemin d'accès valide.", 2);
		downloadPath = await new Promise((resolve, _) => {
			prompt.get(path_schema, function(_, result) {
				const res = result["Chemin d'accès"]?.toString();
				if (res !== undefined && (res.startsWith('//') || res.startsWith('\\\\'))) {
					resolve(defaultPath + `\\` + res.substring(2))
				} else {
					resolve(res)
				}
			})
		})
    } 

    prompt.get(schema, function(err, result) {
        if (err) { return err; }

        const userName = result["Nom d'utilisateur"].toString();
        const userPassword = result["Mot de passe"].toString();

        main(userName, userPassword, downloadPath);
    });
}

// Main function
async function main(userName: string, userPassword: string, downloadPath: string) {

    function logStart() {
        separatorTextLog("Démarrage de l'application");
		textLog('', 0); // Empty line
        textLog(`Chemin d'accès: \"${downloadPath}\"`, 2);
        textLog(`Nom d'utilisateur: ${userName}`, 2);
        textLog(`Mot de passe: ${userPassword.replace(/./g, '*')}`, 2);
		textLog('', 0); // Empty line
        separatorLog();
		textLog('', 0); // Empty line
    }

    async function checkResponseCode(code: number) {
        if (code === 200) {
            return true;
        } if (code === 429) {
            textLog("Erreur: Trop de requetes, veuillez réessayer plus tard", 2);
        } else {
            textLog(`Erreur: Un erreur est survenue, veuillez réessayer plus tard. Code: ${code}`, 2);
        }
        false
    }

    async function getPhpSessionId(userName: string, userPassword: string) {
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
                        const cookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0] : undefined;

                        const phpSessionId = cookie ? cookie.substring(cookie.indexOf("=") + 1, cookie.indexOf(";")) : undefined;
                        resolve(phpSessionId);
                    }
                })
                .catch((_) => {
                    separatorLog();
                    textLog("Erreur: Un erreur est survenue, veuillez réessayer plus tard. Vérifier votre connexion internet.", 2);
                    separatorLog();
                    start();
                })
        });
    }

    const phpSessionId = await getPhpSessionId(userName, userPassword);
    if (!phpSessionId) {
        separatorLog();
		textLog('', 0); // Empty line
        textLog(`Le nom d'utilisateur ou le mot de passe est incorrect`, 2);
		textLog('', 0); // Empty line
		separatorLog();
        start({defaultUsername: userName, defaultPath: downloadPath});
        return
    }

    logStart();

    const getHtml = (url: string): Promise<string> => {
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
    const documentsPageHtml = cheerio.load(documentsPage);

    // Get the div with the class "accueil"
    const divAccueil: any = documentsPageHtml("div.accueil");

	// documents type [['string', {link: string, title: string}, {link: string, title: string}, ...], ...]
    var documents = [];


    for (const element of divAccueil.children()) {
        if (element.name === 'h1') {
            documents.push([element.children[0].data])
        }
        else if (element.name === 'table' && element.children[1].name === 'tbody') {
            for (const tr of element.children[1].children) {
                if (tr.name === 'tr') {
                    const tdLink = tr.children[0];
                    const tdTitle = tr.children[2];
                    const tdLinkChildren = tdLink.children.filter((x: {name: string}) => x.name === 'a'); 

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

	console.log(documents);


    for (const folder of documents) {
        const folderName = folder[0];

        for (const document of folder.slice(1)) {
            const documentName = document.title;
            const documentLink = document.link;

            // If include Chapitre in document name, create a folder with the name of the document
            // "Chapitre 1" => chapter 1, "Chapter 10" => chapter 10
            // Sort by chapter / folderName

            const chapter_n = documentName.includes("Chapitre") ? parseInt(documentName.split("Chapitre ")[1]) : null;

            function checkFolder(folderPath: string) {
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
                        res.data.pipe(fs.createWriteStream(filePath));
                        textLog(`Fichier téléchargé: ${fileName}`, 2);
                    })
            }
        }
    }
}



startText(lastVersion());